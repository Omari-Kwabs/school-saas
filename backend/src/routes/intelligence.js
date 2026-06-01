const express = require('express');
const pool = require('../config/db');
const requireRole = require('../middleware/roles');
const requirePrivilege = require('../middleware/privilege');
const {
  calculateAttendanceRate,
  detectDecliningPerformance,
  countWeakCompetencies,
  countPendingRemediation,
  calculateRiskLevel
} = require('../utils/riskCalculator');

const router = express.Router();

// GET /intelligence/student/:student_id/term/:term_id
router.get('/student/:student_id/term/:term_id', requirePrivilege('academic:write'), async (req, res) => {
  const { student_id, term_id } = req.params;
  const { school_id } = req.user;

  try {
    // Validate student and term exist
    const studentCheck = await pool.query(
      'SELECT id, name FROM students WHERE school_id = $1 AND id = $2',
      [school_id, student_id]
    );
    if (studentCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const termCheck = await pool.query(
      'SELECT id, start_date, end_date FROM terms WHERE school_id = $1 AND id = $2',
      [school_id, term_id]
    );
    if (termCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Term not found' });
    }

    const term = termCheck.rows[0];

    // Fetch data in parallel
    const [resultsRes, attendanceRes, diagnosticsRes, remediationRes, profileRes] = await Promise.all([
      // Results for the term
      pool.query(`
        SELECT r.total_score, a.max_score, a.subject_id, s.name AS subject_name, a.title, r.created_at
        FROM results r
        JOIN assessments a ON r.assessment_id = a.id
        JOIN subjects s ON a.subject_id = s.id
        WHERE r.school_id = $1 AND r.student_id = $2 AND a.term_id = $3
        ORDER BY r.created_at ASC
      `, [school_id, student_id, term_id]),

      // Attendance for the term
      pool.query(`
        SELECT status, COUNT(*) as count
        FROM attendance
        WHERE school_id = $1 AND student_id = $2 AND date >= $3 AND date <= $4
        GROUP BY status
      `, [school_id, student_id, term.start_date, term.end_date]),

      // Diagnostic results — filtered by student_id only (school already verified via student check)
      pool.query(`
        SELECT dr.level, c.name AS competency_name, s.name AS subject_name
        FROM diagnostic_results dr
        JOIN competency_benchmarks c ON dr.competency_id = c.id
        LEFT JOIN subjects s ON c.subject_id = s.id
        WHERE dr.student_id = $1
      `, [student_id]),

      // Remediation flags — filtered by student_id only (school already verified via student check)
      pool.query(`
        SELECT status, COUNT(*) as count
        FROM remediation_flags
        WHERE student_id = $1
        GROUP BY status
      `, [student_id]),

      // Learner profile (no school_id column on this table)
      pool.query(`
        SELECT sen_flag, gifted_flag, learning_style
        FROM learner_profiles
        WHERE student_id = $1
      `, [student_id])
    ]);

    // Process data
    const results = resultsRes.rows;
    const attendance = attendanceRes.rows;
    const diagnostics = diagnosticsRes.rows;
    const remediation = remediationRes.rows;
    const profile = profileRes.rows[0] || {};

    // Calculate attendance rate
    const attendanceRate = calculateAttendanceRate(attendance);

    // Group results by subject for trend analysis (store percentages for meaningful comparison)
    const subjectTrends = {};
    results.forEach(r => {
      if (!subjectTrends[r.subject_id]) {
        subjectTrends[r.subject_id] = { name: r.subject_name, scores: [] };
      }
      const pct = r.max_score > 0 ? (parseFloat(r.total_score) / parseFloat(r.max_score)) * 100 : 0;
      subjectTrends[r.subject_id].scores.push(pct);
    });

    // Check for declining performance
    const decliningSubjects = detectDecliningPerformance(subjectTrends);

    // Weak competencies
    const weakCompetencies = countWeakCompetencies(diagnostics);

    // Pending remediation
    const pendingRemediation = countPendingRemediation(remediation);

    // Risk calculation
    const { risk_level, reasons, actions } = calculateRiskLevel(
      decliningSubjects, attendanceRate, weakCompetencies, pendingRemediation
    );

    // If no data, low risk
    if (results.length === 0 && attendance.length === 0 && diagnostics.length === 0) {
      reasons.push('Insufficient data for assessment');
    }

    res.json({
      student_id,
      term_id,
      risk_level,
      reasons,
      recommended_actions: actions,
      data_summary: {
        assessments_count: results.length,
        attendance_rate: attendanceRate.toFixed(1),
        weak_competencies: weakCompetencies,
        pending_remediation: pendingRemediation
      }
    });

  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /intelligence/class/:class_id/term/:term_id
router.get('/class/:class_id/term/:term_id', requirePrivilege('academic:write'), async (req, res) => {
  const { class_id, term_id } = req.params;
  const { school_id } = req.user;

  try {
    // Validate class and term
    const classCheck = await pool.query(
      'SELECT id, name FROM classes WHERE school_id = $1 AND id = $2',
      [school_id, class_id]
    );
    if (classCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Class not found' });
    }

    const termCheck = await pool.query(
      'SELECT id, start_date, end_date FROM terms WHERE school_id = $1 AND id = $2',
      [school_id, term_id]
    );
    if (termCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Term not found' });
    }

    const term = termCheck.rows[0];

    // Get active students in class
    const studentsRes = await pool.query(
      'SELECT id, name, student_code FROM students WHERE school_id = $1 AND class_id = $2 AND status = $3',
      [school_id, class_id, 'active']
    );
    const students = studentsRes.rows;

    if (students.length === 0) {
      return res.json({
        class_id,
        term_id,
        at_risk_students: [],
        subject_weaknesses: [],
        teacher_actions: [],
        assessment_difficulties: []
      });
    }

    // Batch fetch data for all students
    const studentIds = students.map(s => s.id);
    const [resultsRes, attendanceRes, diagnosticsRes, remediationRes] = await Promise.all([
      // All results for the term
      pool.query(`
        SELECT r.student_id, r.total_score, a.max_score, a.subject_id, s.name AS subject_name, a.id AS assessment_id, a.title
        FROM results r
        JOIN assessments a ON r.assessment_id = a.id
        JOIN subjects s ON a.subject_id = s.id
        WHERE r.school_id = $1 AND r.student_id = ANY($2) AND a.term_id = $3
      `, [school_id, studentIds, term_id]),

      // All attendance for the term
      pool.query(`
        SELECT student_id, status, COUNT(*) as count
        FROM attendance
        WHERE school_id = $1 AND student_id = ANY($2) AND date >= $3 AND date <= $4
        GROUP BY student_id, status
      `, [school_id, studentIds, term.start_date, term.end_date]),

      // All diagnostic results — filtered by student_id only (students already verified as school-scoped)
      pool.query(`
        SELECT dr.student_id, dr.level, c.subject_id, s.name AS subject_name
        FROM diagnostic_results dr
        JOIN competency_benchmarks c ON dr.competency_id = c.id
        LEFT JOIN subjects s ON c.subject_id = s.id
        WHERE dr.student_id = ANY($1)
      `, [studentIds]),

      // All remediation flags — filtered by student_id only (students already verified as school-scoped)
      pool.query(`
        SELECT student_id, status, COUNT(*) as count
        FROM remediation_flags
        WHERE student_id = ANY($1)
        GROUP BY student_id, status
      `, [studentIds])
    ]);

    // Process per student
    const studentRisks = [];
    const subjectAverages = {};
    const assessmentStats = {};

    students.forEach(student => {
      const studentResults = resultsRes.rows.filter(r => r.student_id === student.id);
      const studentAttendance = attendanceRes.rows.filter(a => a.student_id === student.id);
      const studentDiagnostics = diagnosticsRes.rows.filter(d => d.student_id === student.id);
      const studentRemediation = remediationRes.rows.filter(r => r.student_id === student.id);

      // Calculate attendance rate
      const attendanceRate = calculateAttendanceRate(studentAttendance);

      // Weak competencies
      const weakCompetencies = countWeakCompetencies(studentDiagnostics);

      // Pending remediation
      const pendingRemediation = countPendingRemediation(studentRemediation);

      // Subject trends — use percentages so different max_scores are comparable
      const subjectTrends = {};
      studentResults.forEach(r => {
        const pct = r.max_score > 0 ? (parseFloat(r.total_score) / parseFloat(r.max_score)) * 100 : 0;

        if (!subjectTrends[r.subject_id]) {
          subjectTrends[r.subject_id] = { name: r.subject_name, scores: [] };
        }
        subjectTrends[r.subject_id].scores.push(pct);

        // For class averages
        if (!subjectAverages[r.subject_id]) {
          subjectAverages[r.subject_id] = { name: r.subject_name, scores: [] };
        }
        subjectAverages[r.subject_id].scores.push(pct);

        // For assessment stats
        if (!assessmentStats[r.assessment_id]) {
          assessmentStats[r.assessment_id] = { title: r.title, scores: [] };
        }
        assessmentStats[r.assessment_id].scores.push(pct);
      });

      const decliningSubjects = detectDecliningPerformance(subjectTrends);

      // Risk score
      const { risk_level } = calculateRiskLevel(
        decliningSubjects, attendanceRate, weakCompetencies, pendingRemediation
      );

      let finalRisk = risk_level;
      if (studentResults.length === 0 && studentAttendance.length === 0 && studentDiagnostics.length === 0) {
        finalRisk = 'low';
      }

      studentRisks.push({
        student_id: student.id,
        name: student.name,
        student_code: student.student_code,
        risk_level: finalRisk,
        attendance_rate: attendanceRate.toFixed(1),
        weak_competencies: weakCompetencies,
        pending_remediation: pendingRemediation
      });
    });

    // Aggregate class data
    const atRiskStudents = studentRisks.filter(s => s.risk_level === 'high' || s.risk_level === 'medium');

    // Subject weaknesses (average < 50)
    const subjectWeaknesses = Object.values(subjectAverages)
      .map(sub => ({
        subject: sub.name,
        average: sub.scores.length > 0 ? (sub.scores.reduce((a,b) => a+b, 0) / sub.scores.length).toFixed(1) : 0,
        count: sub.scores.length
      }))
      .filter(sub => parseFloat(sub.average) < 50)
      .sort((a,b) => parseFloat(a.average) - parseFloat(b.average));

    // Assessment difficulties (average < 50)
    const assessmentDifficulties = Object.values(assessmentStats)
      .map(ass => ({
        title: ass.title,
        average: ass.scores.length > 0 ? (ass.scores.reduce((a,b) => a+b, 0) / ass.scores.length).toFixed(1) : 0,
        submissions: ass.scores.length,
        failures: ass.scores.filter(s => s < 50).length
      }))
      .filter(ass => parseFloat(ass.average) < 50)
      .sort((a,b) => parseFloat(a.average) - parseFloat(b.average));

    // Teacher actions
    const teacherActions = [];
    if (atRiskStudents.length > 0) {
      teacherActions.push(`Address ${atRiskStudents.length} at-risk students`);
    }
    if (assessmentDifficulties.length > 0) {
      teacherActions.push(`Reteach ${assessmentDifficulties.length} difficult assessments`);
    }
    if (subjectWeaknesses.length > 0) {
      teacherActions.push(`Focus on ${subjectWeaknesses.length} weak subjects`);
    }

    res.json({
      class_id,
      term_id,
      at_risk_students: atRiskStudents,
      subject_weaknesses: subjectWeaknesses,
      assessment_difficulties: assessmentDifficulties,
      teacher_actions: teacherActions
    });

  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;