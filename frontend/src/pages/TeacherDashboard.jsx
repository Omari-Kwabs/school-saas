import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import SearchableSelect from '../components/SearchableSelect';

const SCOPED_ROLES = new Set(['teacher', 'class_teacher', 'department_head']);

function pctColor(v) {
  if (v == null) return '#888';
  if (v >= 75) return '#1a7340';
  if (v >= 50) return '#7d4e00';
  return '#721c24';
}

function Pct({ v }) {
  if (v == null) return <span style={{ color: '#aaa' }}>—</span>;
  return <span style={{ color: pctColor(v), fontWeight: 700 }}>{v}%</span>;
}

function Card({ children, style }) {
  return (
    <div style={{
      background: '#fff', border: '1px solid #dde3ef', borderRadius: 10,
      padding: '16px 20px', ...style
    }}>
      {children}
    </div>
  );
}

function SectionTitle({ label }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
      textTransform: 'uppercase', color: '#5a6882',
      borderBottom: '2px solid #e0e7f0', paddingBottom: 8, marginBottom: 16
    }}>
      {label}
    </div>
  );
}

export default function TeacherDashboard() {
  const { user } = useAuth();

  const [terms, setTerms]               = useState([]);
  const [termId, setTermId]             = useState('');
  const [assignments, setAssignments]   = useState([]);
  const [performance, setPerformance]   = useState(null);
  const [pendingRemarks, setPendingRemarks] = useState([]);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState(null);

  const isScoped = user && SCOPED_ROLES.has(user.role);

  useEffect(() => {
    api.get('/terms').then(setTerms).catch(() => {});
    api.get('/teaching-assignments').then(setAssignments).catch(() => {});
  }, []);

  useEffect(() => {
    if (!termId) { setPerformance(null); setPendingRemarks([]); return; }
    setLoading(true);
    setError(null);

    const perfPromise = api.get(`/teacher-performance/me/term/${termId}`)
      .then(setPerformance)
      .catch(() => setPerformance(null));

    // For class teachers: find students missing remarks
    const classIds = [...new Set(assignments.map(a => a.class_id))];
    const remarksPromise = user?.role === 'class_teacher' && classIds.length
      ? api.get(`/students?class_id=${classIds[0]}&status=active`)
          .then(async (students) => {
            const withRemarks = await Promise.all(
              students.map(s =>
                api.get(`/grades/remarks/${s.id}?term_id=${termId}`)
                  .then(r => ({ ...s, hasRemark: !!r }))
                  .catch(() => ({ ...s, hasRemark: false }))
              )
            );
            setPendingRemarks(withRemarks.filter(s => !s.hasRemark));
          })
          .catch(() => setPendingRemarks([]))
      : Promise.resolve();

    Promise.all([perfPromise, remarksPromise]).finally(() => setLoading(false));
  }, [termId, assignments]);

  const activeTerm = terms.find(t => t.id === termId);

  // Group assignments by class
  const byClass = assignments.reduce((acc, a) => {
    if (!acc[a.class_id]) acc[a.class_id] = { class_name: a.class_name, subjects: [] };
    acc[a.class_id].subjects.push(a);
    return acc;
  }, {});

  const perfOutcomes = performance?.outcomes || [];
  const overallAvg = perfOutcomes.length
    ? (perfOutcomes.reduce((s, o) => s + (o.class_avg || 0), 0) / perfOutcomes.filter(o => o.class_avg != null).length || null)
    : null;

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 16px' }}>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: '#1e293b' }}>
          My Dashboard
        </div>
        <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
          {user?.name} · <span style={{ textTransform: 'capitalize' }}>{user?.role?.replace(/_/g, ' ')}</span>
        </div>
      </div>

      {/* Term selector */}
      <div style={{ marginBottom: 24 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: '#5a6882', marginRight: 8 }}>Term</label>
        <SearchableSelect
          value={termId}
          onChange={v => setTermId(v)}
          options={terms.map(t => ({ value: t.id, label: t.name }))}
          placeholder="Select term…"
        />
      </div>

      {/* Assigned Classes & Subjects */}
      <div style={{ marginBottom: 28 }}>
        <SectionTitle label="My Classes & Subjects" />
        {Object.keys(byClass).length === 0 ? (
          <div style={{ color: '#888', fontSize: 14 }}>No teaching assignments found.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 14 }}>
            {Object.entries(byClass).map(([classId, cls]) => (
              <Card key={classId}>
                <div style={{ fontWeight: 700, fontSize: 15, color: '#1e293b', marginBottom: 8 }}>
                  {cls.class_name}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {cls.subjects.map(s => (
                    <span key={s.subject_id} style={{
                      background: '#e8f0fe', color: '#1a56db',
                      borderRadius: 12, padding: '2px 10px', fontSize: 12, fontWeight: 600
                    }}>
                      {s.subject_name}
                    </span>
                  ))}
                </div>
                <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                  <Link to={`/results?class_id=${classId}`} style={{
                    fontSize: 12, color: '#1a56db', textDecoration: 'none', fontWeight: 600
                  }}>Enter Results →</Link>
                  <Link to={`/grades?class_id=${classId}`} style={{
                    fontSize: 12, color: '#1a56db', textDecoration: 'none', fontWeight: 600, marginLeft: 8
                  }}>Grades →</Link>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Performance overview (requires term selection) */}
      {termId && (
        <>
          {loading && <div style={{ color: '#888', marginBottom: 20 }}>Loading performance data…</div>}
          {error && <div style={{ color: '#721c24', marginBottom: 20 }}>{error}</div>}

          {perfOutcomes.length > 0 && (
            <div style={{ marginBottom: 28 }}>
              <SectionTitle label="My Performance This Term" />

              {/* Summary cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 12, marginBottom: 20 }}>
                {[
                  { label: 'Avg Class Score', value: overallAvg != null ? parseFloat(overallAvg.toFixed(1)) : null },
                  { label: 'Avg Pass Rate', value: perfOutcomes.filter(o=>o.pass_rate!=null).length ? parseFloat((perfOutcomes.reduce((s,o)=>s+(o.pass_rate||0),0)/perfOutcomes.filter(o=>o.pass_rate!=null).length).toFixed(1)) : null },
                  { label: 'Avg High Rate', value: perfOutcomes.filter(o=>o.high_rate!=null).length ? parseFloat((perfOutcomes.reduce((s,o)=>s+(o.high_rate||0),0)/perfOutcomes.filter(o=>o.high_rate!=null).length).toFixed(1)) : null },
                  { label: 'Improvement Rate', value: perfOutcomes.filter(o=>o.improvement_rate!=null).length ? parseFloat((perfOutcomes.reduce((s,o)=>s+(o.improvement_rate||0),0)/perfOutcomes.filter(o=>o.improvement_rate!=null).length).toFixed(1)) : null },
                  { label: 'Recovery Rate', value: perfOutcomes.filter(o=>o.recovery_rate!=null).length ? parseFloat((perfOutcomes.reduce((s,o)=>s+(o.recovery_rate||0),0)/perfOutcomes.filter(o=>o.recovery_rate!=null).length).toFixed(1)) : null },
                ].map(({ label, value }) => (
                  <Card key={label} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 10, color: '#5a6882', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, marginBottom: 6 }}>
                      {label}
                    </div>
                    <div style={{ fontSize: 24, fontWeight: 800, color: pctColor(value) }}>
                      {value != null ? `${value}%` : '—'}
                    </div>
                  </Card>
                ))}
              </div>

              {/* Per-class breakdown table */}
              <Card>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #e0e7f0' }}>
                      {['Class', 'Subject', 'Students', 'Avg', 'Pass %', 'High %', 'Improvement', 'Recovery'].map(h => (
                        <th key={h} style={{ padding: '8px 10px', textAlign: 'left', color: '#5a6882', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {perfOutcomes.map((o, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f0f4f8' }}>
                        <td style={{ padding: '8px 10px', fontWeight: 600 }}>{o.class_name}</td>
                        <td style={{ padding: '8px 10px', color: '#334155' }}>{o.subject_name}</td>
                        <td style={{ padding: '8px 10px', color: '#64748b' }}>{o.students_assessed || 0}</td>
                        <td style={{ padding: '8px 10px' }}><Pct v={o.class_avg} /></td>
                        <td style={{ padding: '8px 10px' }}><Pct v={o.pass_rate} /></td>
                        <td style={{ padding: '8px 10px' }}><Pct v={o.high_rate} /></td>
                        <td style={{ padding: '8px 10px' }}><Pct v={o.improvement_rate} /></td>
                        <td style={{ padding: '8px 10px' }}><Pct v={o.recovery_rate} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            </div>
          )}

          {/* Pending remarks (class teachers only) */}
          {user?.role === 'class_teacher' && pendingRemarks.length > 0 && (
            <div style={{ marginBottom: 28 }}>
              <SectionTitle label={`Pending Terminal Remarks (${pendingRemarks.length} students)`} />
              <Card>
                <div style={{ color: '#7d4e00', marginBottom: 12, fontSize: 13 }}>
                  The following students are missing terminal remarks for {activeTerm?.name || 'this term'}.
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {pendingRemarks.map(s => (
                    <span key={s.id} style={{
                      background: '#fff3cd', color: '#7d4e00', border: '1px solid #ffc107',
                      borderRadius: 12, padding: '3px 12px', fontSize: 12, fontWeight: 600
                    }}>
                      {s.name}
                    </span>
                  ))}
                </div>
                <div style={{ marginTop: 12 }}>
                  <Link to="/grades" style={{ fontSize: 12, color: '#1a56db', fontWeight: 600 }}>
                    Go to Grades → Enter Remarks
                  </Link>
                </div>
              </Card>
            </div>
          )}

          {!loading && perfOutcomes.length === 0 && (
            <Card>
              <div style={{ color: '#888', fontSize: 14 }}>
                No performance data for this term yet. Enter results and compute grades to see metrics here.
              </div>
            </Card>
          )}
        </>
      )}

      {!termId && (
        <Card style={{ color: '#64748b', fontSize: 14 }}>
          Select a term above to view your performance metrics and pending actions.
        </Card>
      )}
    </div>
  );
}
