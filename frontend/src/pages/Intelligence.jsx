import React, { useEffect, useState } from 'react';
import { api } from '../api';
import SearchableSelect from '../components/SearchableSelect';

export default function Intelligence() {
  const [activeTab, setActiveTab] = useState('class');
  const [classes, setClasses] = useState([]);
  const [terms, setTerms] = useState([]);
  const [students, setStudents] = useState([]);
  const [classId, setClassId] = useState('');
  const [termId, setTermId] = useState('');
  const [studentId, setStudentId] = useState('');
  const [studentClassId, setStudentClassId] = useState('');
  const [classData, setClassData] = useState(null);
  const [studentData, setStudentData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function init() {
      try {
        const [cls, trm] = await Promise.all([api.get('/classes'), api.get('/terms')]);
        setClasses(Array.isArray(cls) ? cls : []);
        const termList = Array.isArray(trm) ? trm : [];
        setTerms(termList);
        const cur = termList.find(t => t.is_current) || termList[0];
        if (cur) setTermId(cur.id);
      } catch {}
    }
    init();
  }, []);

  useEffect(() => {
    setStudentId('');
    setStudents([]);
    if (!studentClassId) return;
    api.get(`/students?class_id=${studentClassId}`)
      .then(d => setStudents(Array.isArray(d) ? d : (d?.data ?? [])))
      .catch(() => setStudents([]));
  }, [studentClassId]);

  useEffect(() => {
    if (activeTab === 'class' && classId && termId) {
      loadClassData();
    } else if (activeTab === 'student' && studentId && termId) {
      loadStudentData();
    }
  }, [activeTab, classId, termId, studentId]);

  async function loadClassData() {
    setLoading(true);
    setError(null);
    setClassData(null);
    try {
      const res = await api.get(`/intelligence/class/${classId}/term/${termId}`);
      setClassData(res);
    } catch (err) {
      setError(err.message || 'Failed to load class intelligence data');
    }
    setLoading(false);
  }

  async function loadStudentData() {
    setLoading(true);
    setError(null);
    setStudentData(null);
    try {
      const res = await api.get(`/intelligence/student/${studentId}/term/${termId}`);
      setStudentData(res);
    } catch (err) {
      setError(err.message || 'Failed to load student intelligence data');
    }
    setLoading(false);
  }

  return (
    <div className="page">
      <div className="page-title">Intelligence Dashboard</div>

      <div className="tabs">
        <button
          className={`tab ${activeTab === 'class' ? 'active' : ''}`}
          onClick={() => { setActiveTab('class'); setError(null); }}
        >
          Class View
        </button>
        <button
          className={`tab ${activeTab === 'student' ? 'active' : ''}`}
          onClick={() => { setActiveTab('student'); setError(null); }}
        >
          Student View
        </button>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        {activeTab === 'class' && (
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Class</label>
            <SearchableSelect
              value={classId}
              onChange={v => setClassId(v)}
              options={classes.map(c => ({ value: c.id, label: c.name }))}
              placeholder="— Select Class —"
            />
          </div>
        )}
        {activeTab === 'student' && (
          <>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Class</label>
              <SearchableSelect
                value={studentClassId}
                onChange={v => setStudentClassId(v)}
                options={classes.map(c => ({ value: c.id, label: c.name }))}
                placeholder="— Select Class —"
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Student</label>
              <SearchableSelect
                value={studentId}
                onChange={v => setStudentId(v)}
                options={students.map(s => ({ value: s.id, label: `${s.name} (${s.student_code})` }))}
                placeholder="— Select Student —"
                disabled={!studentClassId}
              />
            </div>
          </>
        )}
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>Term</label>
          <SearchableSelect
            value={termId}
            onChange={v => setTermId(v)}
            options={terms.map(t => ({ value: t.id, label: t.name + (t.is_current ? ' (current)' : '') }))}
            placeholder="— Select Term —"
          />
        </div>
      </div>

      {loading && <p style={{ color: '#888' }}>Loading…</p>}
      {error && <p style={{ color: 'red', background: '#fff0f0', padding: '10px', borderRadius: 4 }}>{error}</p>}

      {activeTab === 'class' && classData && (
        <div>
          <h3>Class Intelligence</h3>

          <div style={{ marginBottom: 20 }}>
            <h4>At-Risk Students</h4>
            {classData.at_risk_students.length > 0 ? (
              <table>
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Code</th>
                    <th>Risk Level</th>
                    <th>Attendance (%)</th>
                    <th>Weak Competencies</th>
                    <th>Pending Remediation</th>
                  </tr>
                </thead>
                <tbody>
                  {classData.at_risk_students.map(s => (
                    <tr key={s.student_id}>
                      <td>{s.name}</td>
                      <td>{s.student_code}</td>
                      <td>
                        <span className={`risk-badge risk-${s.risk_level}`}>
                          {s.risk_level.toUpperCase()}
                        </span>
                      </td>
                      <td>{s.attendance_rate}%</td>
                      <td>{s.weak_competencies}</td>
                      <td>{s.pending_remediation}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p>No at-risk students identified.</p>
            )}
          </div>

          <div style={{ marginBottom: 20 }}>
            <h4>Subject Weaknesses</h4>
            {classData.subject_weaknesses.length > 0 ? (
              <ul>
                {classData.subject_weaknesses.map((sw, i) => (
                  <li key={i}>{sw.subject}: {sw.average}% average ({sw.count} assessments)</li>
                ))}
              </ul>
            ) : (
              <p>No subject weaknesses identified.</p>
            )}
          </div>

          <div style={{ marginBottom: 20 }}>
            <h4>Assessment Difficulties</h4>
            {classData.assessment_difficulties.length > 0 ? (
              <ul>
                {classData.assessment_difficulties.map((ad, i) => (
                  <li key={i}>{ad.title}: {ad.average}% average ({ad.failures}/{ad.submissions} failed)</li>
                ))}
              </ul>
            ) : (
              <p>No assessment difficulties identified.</p>
            )}
          </div>

          <div>
            <h4>Recommended Teacher Actions</h4>
            {classData.teacher_actions.length > 0 ? (
              <ul>
                {classData.teacher_actions.map((action, i) => (
                  <li key={i}>{action}</li>
                ))}
              </ul>
            ) : (
              <p>No actions recommended.</p>
            )}
          </div>
        </div>
      )}

      {activeTab === 'student' && studentData && (
        <div>
          <h3>Student Intelligence</h3>

          <div style={{ marginBottom: 20 }}>
            <div className={`risk-summary risk-${studentData.risk_level}`}>
              <h4>Risk Level: {studentData.risk_level.toUpperCase()}</h4>
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <h4>Reasons</h4>
            {studentData.reasons.length > 0 ? (
              <ul>
                {studentData.reasons.map((reason, i) => (
                  <li key={i}>{reason}</li>
                ))}
              </ul>
            ) : (
              <p>No specific reasons identified.</p>
            )}
          </div>

          <div style={{ marginBottom: 20 }}>
            <h4>Recommended Actions</h4>
            {studentData.recommended_actions.length > 0 ? (
              <ul>
                {studentData.recommended_actions.map((action, i) => (
                  <li key={i}>{action}</li>
                ))}
              </ul>
            ) : (
              <p>No actions recommended.</p>
            )}
          </div>

          <div>
            <h4>Data Summary</h4>
            <p>Assessments: {studentData.data_summary.assessments_count}</p>
            <p>Attendance Rate: {studentData.data_summary.attendance_rate}%</p>
            <p>Weak Competencies: {studentData.data_summary.weak_competencies}</p>
            <p>Pending Remediation: {studentData.data_summary.pending_remediation}</p>
          </div>
        </div>
      )}

      {!loading && ((activeTab === 'class' && (!classId || !termId)) || (activeTab === 'student' && (!studentClassId || !studentId || !termId))) && (
        <p style={{ color: '#888' }}>Select {activeTab === 'class' ? 'a class and term' : 'a class, student, and term'} to view intelligence.</p>
      )}
    </div>
  );
}