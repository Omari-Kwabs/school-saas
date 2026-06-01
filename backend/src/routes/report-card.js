const express = require('express');
const pool = require('../config/db');
const requirePrivilege = require('../middleware/privilege');
const { reportQueue } = process.env.REDIS_URL ? require('../jobs/queue') : { reportQueue: null };

const router = express.Router();

function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function classify(total, max) {
  if (!max || max <= 0) return null;
  const pct = (total / max) * 100;
  if (pct >= 75) return 'strong';
  if (pct >= 50) return 'average';
  return 'weak';
}

async function generateReportCard(school_id, student_id, term_id) {
  const [studentRes, termRes, resultsRes] = await Promise.all([
    pool.query(
      `SELECT s.*, c.name AS class_name
       FROM students s LEFT JOIN classes c ON c.id = s.class_id
       WHERE s.school_id = $1 AND s.id = $2`,
      [school_id, student_id]
    ),
    pool.query(
      'SELECT id, name, start_date, end_date FROM terms WHERE school_id=$1 AND id=$2',
      [school_id, term_id]
    ),
    pool.query(
      `SELECT r.id, r.score_theory, r.score_practical, r.total_score,
              a.id AS assessment_id, a.title AS assessment_title,
              a.type AS assessment_type, a.max_score,
              sub.id AS subject_id, sub.name AS subject_name, sub.code AS subject_code
       FROM results r
       JOIN students st  ON st.id = r.student_id AND st.school_id = $1
       JOIN assessments a ON a.id = r.assessment_id
       JOIN subjects sub ON sub.id = a.subject_id
       WHERE r.student_id = $2 AND a.term_id = $3
       ORDER BY sub.name, a.title`,
      [school_id, student_id, term_id]
    )
  ]);

  if (!studentRes.rows.length) throw new Error('Student not found');
  if (!termRes.rows.length) throw new Error('Term not found');

  const student = studentRes.rows[0];
  const term = termRes.rows[0];

  const subjectMap = {};
  for (const row of resultsRes.rows) {
    if (!subjectMap[row.subject_id]) {
      subjectMap[row.subject_id] = {
        subject_id: row.subject_id,
        subject_name: row.subject_name,
        subject_code: row.subject_code,
        assessments: []
      };
    }
    subjectMap[row.subject_id].assessments.push({
      assessment_id: row.assessment_id,
      title: row.assessment_title,
      type: row.assessment_type,
      max_score: parseFloat(row.max_score),
      score_theory: row.score_theory != null ? parseFloat(row.score_theory) : null,
      score_practical: row.score_practical != null ? parseFloat(row.score_practical) : null,
      total_score: parseFloat(row.total_score),
      classification: classify(parseFloat(row.total_score), parseFloat(row.max_score))
    });
  }

  const subjects = Object.values(subjectMap).map(sub => {
    const totalScore = sub.assessments.reduce((s, a) => s + a.total_score, 0);
    const maxScore   = sub.assessments.reduce((s, a) => s + a.max_score,   0);
    return {
      ...sub,
      total_score: totalScore,
      max_score: maxScore,
      percentage: maxScore > 0 ? +((totalScore / maxScore) * 100).toFixed(1) : null,
      classification: classify(totalScore, maxScore)
    };
  });

  const totalScore = subjects.reduce((s, sub) => s + sub.total_score, 0);
  const maxScore   = subjects.reduce((s, sub) => s + sub.max_score,   0);

  return {
    metadata: { report_type: 'student_report_card', generated_at: new Date().toISOString() },
    student: {
      id: student.id,
      name: student.name,
      student_code: student.student_code,
      class: student.class_name,
      parent_name: student.parent_name || null,
      parent_phone: student.parent_phone || null
    },
    term: { id: term.id, name: term.name, start_date: term.start_date, end_date: term.end_date },
    subjects,
    performance_summary: {
      total_score: totalScore,
      max_score: maxScore,
      percentage: maxScore > 0 ? +((totalScore / maxScore) * 100).toFixed(1) : null,
      classification: classify(totalScore, maxScore),
      subjects_count: subjects.length,
      strong:  subjects.filter(s => s.classification === 'strong').length,
      average: subjects.filter(s => s.classification === 'average').length,
      weak:    subjects.filter(s => s.classification === 'weak').length
    }
  };
}

router.get('/student/:student_id/term/:term_id', requirePrivilege('reports:read'), async (req, res) => {
  const { school_id } = req.user;
  try {
    const report = await generateReportCard(school_id, req.params.student_id, req.params.term_id);
    res.json(report);
  } catch (err) {
    if (err.message === 'Student not found') return res.status(404).json({ error: 'Student not found' });
    if (err.message === 'Term not found')    return res.status(404).json({ error: 'Term not found' });
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/class/:class_id/term/:term_id', requirePrivilege('reports:read'), async (req, res) => {
  const { school_id } = req.user;
  const { class_id, term_id } = req.params;
  try {
    // Single bulk fetch — avoids N+1 (was 3 queries × N students)
    const [termRes, studentsRes, allResultsRes] = await Promise.all([
      pool.query(
        'SELECT id, name, start_date, end_date FROM terms WHERE school_id=$1 AND id=$2',
        [school_id, term_id]
      ),
      pool.query(
        `SELECT s.*, c.name AS class_name FROM students s
         LEFT JOIN classes c ON c.id = s.class_id
         WHERE s.school_id=$1 AND s.class_id=$2 AND s.status='active'
         ORDER BY s.name`,
        [school_id, class_id]
      ),
      pool.query(
        `SELECT r.student_id, r.score_theory, r.score_practical, r.total_score,
                a.id AS assessment_id, a.title AS assessment_title,
                a.type AS assessment_type, a.max_score,
                sub.id AS subject_id, sub.name AS subject_name, sub.code AS subject_code
         FROM results r
         JOIN students st  ON st.id = r.student_id AND st.school_id = $1
         JOIN assessments a ON a.id = r.assessment_id
         JOIN subjects sub ON sub.id = a.subject_id
         WHERE st.class_id = $2 AND a.term_id = $3
         ORDER BY r.student_id, sub.name, a.title`,
        [school_id, class_id, term_id]
      ),
    ]);

    if (!termRes.rows.length) return res.status(404).json({ error: 'Term not found' });
    const term = termRes.rows[0];

    // Group results by student_id
    const resultsByStudent = {};
    for (const row of allResultsRes.rows) {
      if (!resultsByStudent[row.student_id]) resultsByStudent[row.student_id] = [];
      resultsByStudent[row.student_id].push(row);
    }

    const generatedAt = new Date().toISOString();
    const reportCards = studentsRes.rows.map(student => {
      const rows = resultsByStudent[student.id] || [];
      const subjectMap = {};
      for (const row of rows) {
        if (!subjectMap[row.subject_id]) {
          subjectMap[row.subject_id] = {
            subject_id: row.subject_id,
            subject_name: row.subject_name,
            subject_code: row.subject_code,
            assessments: [],
          };
        }
        subjectMap[row.subject_id].assessments.push({
          assessment_id:   row.assessment_id,
          title:           row.assessment_title,
          type:            row.assessment_type,
          max_score:       parseFloat(row.max_score),
          score_theory:    row.score_theory    != null ? parseFloat(row.score_theory)    : null,
          score_practical: row.score_practical != null ? parseFloat(row.score_practical) : null,
          total_score:     parseFloat(row.total_score),
          classification:  classify(parseFloat(row.total_score), parseFloat(row.max_score)),
        });
      }
      const subjects = Object.values(subjectMap).map(sub => {
        const totalScore = sub.assessments.reduce((s, a) => s + a.total_score, 0);
        const maxScore   = sub.assessments.reduce((s, a) => s + a.max_score,   0);
        return { ...sub, total_score: totalScore, max_score: maxScore,
          percentage:     maxScore > 0 ? +((totalScore / maxScore) * 100).toFixed(1) : null,
          classification: classify(totalScore, maxScore) };
      });
      const totalScore = subjects.reduce((s, sub) => s + sub.total_score, 0);
      const maxScore   = subjects.reduce((s, sub) => s + sub.max_score,   0);
      return {
        metadata: { report_type: 'student_report_card', generated_at: generatedAt },
        student: {
          id: student.id, name: student.name, student_code: student.student_code,
          class: student.class_name, parent_name: student.parent_name || null,
          parent_phone: student.parent_phone || null,
        },
        term: { id: term.id, name: term.name, start_date: term.start_date, end_date: term.end_date },
        subjects,
        performance_summary: {
          total_score: totalScore, max_score: maxScore,
          percentage:  maxScore > 0 ? +((totalScore / maxScore) * 100).toFixed(1) : null,
          classification: classify(totalScore, maxScore),
          subjects_count: subjects.length,
          strong:  subjects.filter(s => s.classification === 'strong').length,
          average: subjects.filter(s => s.classification === 'average').length,
          weak:    subjects.filter(s => s.classification === 'weak').length,
        },
      };
    });

    res.json({ class_id, term_id,
      student_count: studentsRes.rows.length,
      report_cards_generated: reportCards.length,
      report_cards: reportCards });
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

router.get('/summary/class/:class_id/term/:term_id', requirePrivilege('reports:read'), async (req, res) => {
  const { school_id } = req.user;
  const { class_id, term_id } = req.params;
  try {
    const [classRes, termRes, resultsRes] = await Promise.all([
      pool.query('SELECT name FROM classes WHERE school_id=$1 AND id=$2', [school_id, class_id]),
      pool.query('SELECT name FROM terms WHERE school_id=$1 AND id=$2', [school_id, term_id]),
      pool.query(
        `SELECT r.total_score, a.max_score, sub.name AS subject_name
         FROM results r
         JOIN students st  ON st.id = r.student_id AND st.school_id = $1
         JOIN assessments a ON a.id = r.assessment_id
         JOIN subjects sub ON sub.id = a.subject_id
         WHERE st.class_id = $2 AND a.term_id = $3`,
        [school_id, class_id, term_id]
      )
    ]);

    if (!classRes.rows.length) return res.status(404).json({ error: 'Class not found' });
    if (!termRes.rows.length)  return res.status(404).json({ error: 'Term not found' });

    const rows = resultsRes.rows;
    if (!rows.length) {
      return res.json({ class: classRes.rows[0].name, term: termRes.rows[0].name,
                        results_count: 0, summary: null });
    }

    const counts = { strong: 0, average: 0, weak: 0 };
    let totalPct = 0;
    const bySubject = {};

    for (const row of rows) {
      const pct = row.max_score > 0 ? (parseFloat(row.total_score) / parseFloat(row.max_score)) * 100 : 0;
      const cls = classify(parseFloat(row.total_score), parseFloat(row.max_score));
      if (cls) counts[cls]++;
      totalPct += pct;
      if (!bySubject[row.subject_name]) bySubject[row.subject_name] = { count: 0, total_pct: 0, strong: 0, average: 0, weak: 0 };
      bySubject[row.subject_name].count++;
      bySubject[row.subject_name].total_pct += pct;
      if (cls) bySubject[row.subject_name][cls]++;
    }

    const avgPct = +(totalPct / rows.length).toFixed(1);
    for (const sub of Object.values(bySubject)) {
      sub.avg_pct = +(sub.total_pct / sub.count).toFixed(1);
      delete sub.total_pct;
    }

    res.json({
      class: classRes.rows[0].name,
      term: termRes.rows[0].name,
      results_count: rows.length,
      summary: {
        average_percentage: avgPct,
        classification: classify(avgPct, 100),
        distribution: counts,
        percent_strong:  +((counts.strong  / rows.length) * 100).toFixed(1),
        percent_average: +((counts.average / rows.length) * 100).toFixed(1),
        percent_weak:    +((counts.weak    / rows.length) * 100).toFixed(1)
      },
      subject_breakdown: bySubject
    });
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

router.get('/student/:student_id/term/:term_id/export', requirePrivilege('reports:read'), async (req, res) => {
  const { school_id } = req.user;
  const { format } = req.query;
  try {
    const report = await generateReportCard(school_id, req.params.student_id, req.params.term_id);
    if (format === 'html') {
      const ps = report.performance_summary;
      const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Report Card — ${esc(report.student.name)}</title>
<style>
  body{font-family:Arial,sans-serif;margin:20px}
  h1{text-align:center}
  table{width:100%;border-collapse:collapse;margin-bottom:20px}
  th,td{border:1px solid #ddd;padding:8px;text-align:left}
  th{background:#f2f2f2}
  .strong{color:green}.average{color:orange}.weak{color:red}
  .summary{padding:10px;background:#f9f9f9;margin-bottom:20px}
</style></head><body>
<h1>Student Report Card</h1>
<p><strong>Name:</strong> ${esc(report.student.name)} &nbsp; <strong>Code:</strong> ${esc(report.student.student_code)} &nbsp; <strong>Class:</strong> ${esc(report.student.class)}</p>
<p><strong>Term:</strong> ${esc(report.term.name)} &nbsp; (${esc(report.term.start_date)} – ${esc(report.term.end_date)})</p>
${report.subjects.map(sub => `
<h3>${esc(sub.subject_name)} <span class="${esc(sub.classification)}">[${sub.classification ? sub.classification.toUpperCase() : 'N/A'} ${sub.percentage != null ? sub.percentage + '%' : ''}]</span></h3>
<table><tr><th>Assessment</th><th>Type</th><th>Score</th><th>Max</th><th>%</th><th>Grade</th></tr>
${sub.assessments.map(a => `
  <tr>
    <td>${esc(a.title)}</td><td>${esc(a.type)}</td><td>${a.total_score}</td>
    <td>${a.max_score}</td>
    <td>${a.max_score > 0 ? ((a.total_score/a.max_score)*100).toFixed(1) : 'N/A'}%</td>
    <td class="${esc(a.classification)}">${a.classification ? a.classification.toUpperCase() : 'N/A'}</td>
  </tr>`).join('')}
</table>`).join('')}
<div class="summary">
  <strong>Overall:</strong> ${ps.total_score} / ${ps.max_score} = ${ps.percentage != null ? ps.percentage + '%' : 'N/A'}
  &nbsp; <span class="${ps.classification}">${ps.classification ? ps.classification.toUpperCase() : 'N/A'}</span><br>
  Strong: ${ps.strong} &nbsp; Average: ${ps.average} &nbsp; Weak: ${ps.weak}
</div>
</body></html>`;
      return res.type('text/html').send(html);
    }
    res.json(report);
  } catch (err) {
    if (err.message === 'Student not found') return res.status(404).json({ error: 'Student not found' });
    if (err.message === 'Term not found')    return res.status(404).json({ error: 'Term not found' });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Async class report generation — enqueues a job when Redis is available
router.post('/jobs/class/:class_id/term/:term_id', requirePrivilege('reports:read'), async (req, res) => {
  const { school_id, id: requested_by } = req.user;
  const { class_id, term_id } = req.params;

  if (!reportQueue) {
    return res.status(503).json({ error: 'Async report generation not available (Redis not configured)' });
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO generated_reports (school_id, class_id, term_id, requested_by)
       VALUES ($1,$2,$3,$4) RETURNING id`,
      [school_id, class_id, term_id, requested_by]
    );
    const job_id = rows[0].id;
    await reportQueue.add('generate-class-report', { school_id, class_id, term_id, job_id });
    res.status(202).json({ job_id, status: 'queued' });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Poll job status
router.get('/jobs/:job_id', requirePrivilege('reports:read'), async (req, res) => {
  const { school_id } = req.user;
  try {
    const { rows } = await pool.query(
      'SELECT id, status, error_message, queued_at, started_at, completed_at FROM generated_reports WHERE id=$1 AND school_id=$2',
      [req.params.job_id, school_id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Job not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Download completed job output
router.get('/jobs/:job_id/download', requirePrivilege('reports:read'), async (req, res) => {
  const { school_id } = req.user;
  try {
    const { rows } = await pool.query(
      'SELECT status, result_html FROM generated_reports WHERE id=$1 AND school_id=$2',
      [req.params.job_id, school_id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Job not found' });
    if (rows[0].status !== 'completed') return res.status(409).json({ error: `Report not ready. Status: ${rows[0].status}` });
    res.type('text/html').send(rows[0].result_html);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
