import React, { useState, useEffect } from 'react';
import { api } from '../api';
import SearchableSelect from '../components/SearchableSelect';

function pctColor(p) {
  if (p >= 75) return '#27ae60';
  if (p >= 50) return '#e67e22';
  return '#e74c3c';
}

const GRADE_BANDS = [
  ['strong',  '#27ae60', '#e8f5e9'],
  ['average', '#e67e22', '#fff3e0'],
  ['weak',    '#e74c3c', '#fdecea'],
];

function buildPrintHTML(report) {
  const subjectRows = (report.subjects || []).map(sub => {
    const grade = sub.classification
      ? sub.classification.charAt(0).toUpperCase() + sub.classification.slice(1)
      : '—';
    return `<tr>
      <td>${sub.subject_name}</td>
      <td><strong>${sub.total_score ?? '—'}</strong></td>
      <td>${sub.max_score ?? '—'}</td>
      <td>${sub.percentage != null ? sub.percentage + '%' : '—'}</td>
      <td>${grade}</td>
    </tr>`;
  }).join('');

  const ps = report.performance_summary;
  return `
    <h2>${report.student?.name ?? ''}</h2>
    <p>${report.student?.class ?? ''} &nbsp;·&nbsp; ${report.term?.name ?? ''}</p>
    ${ps ? `<p><strong>Overall: ${ps.percentage != null ? ps.percentage + '%' : '—'} — ${ps.classification?.toUpperCase() ?? ''}</strong></p>` : ''}
    <table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;width:100%">
      <thead style="background:#f5f5f5">
        <tr><th>Subject</th><th>Total</th><th>Max</th><th>%</th><th>Grade</th></tr>
      </thead>
      <tbody>${subjectRows}</tbody>
    </table>`;
}

export default function Reports() {
  const [classes, setClasses]           = useState([]);
  const [terms, setTerms]               = useState([]);
  const [students, setStudents]         = useState([]);
  const [mode, setMode]                 = useState('student');
  const [classId, setClassId]           = useState('');
  const [termId, setTermId]             = useState('');
  const [studentId, setStudentId]       = useState('');
  const [report, setReport]             = useState(null);
  const [summary, setSummary]           = useState(null);
  const [intelligence, setIntelligence] = useState(null);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState('');

  useEffect(() => {
    Promise.all([api.get('/classes'), api.get('/terms')]).then(([c, t]) => {
      setClasses(Array.isArray(c) ? c : []);
      setTerms(Array.isArray(t) ? t : []);
      const current = Array.isArray(t) ? t.find(x => x.is_current) : null;
      if (current) setTermId(current.id);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!classId) { setStudents([]); setStudentId(''); return; }
    api.get(`/students?class_id=${classId}`).then(d => {
      setStudents(Array.isArray(d) ? d : (d?.data ?? []));
    }).catch(() => {});
  }, [classId]);

  async function generate() {
    if (!termId) { setError('Please select a term.'); return; }
    if (mode === 'student' && !studentId) { setError('Please select a student.'); return; }
    if (mode === 'class'   && !classId)   { setError('Please select a class.'); return; }
    setLoading(true); setError(''); setReport(null); setSummary(null); setIntelligence(null);
    try {
      if (mode === 'student') {
        const [rep, intel] = await Promise.all([
          api.get(`/report-card/student/${studentId}/term/${termId}`),
          api.get(`/intelligence/student/${studentId}/term/${termId}`),
        ]);
        setReport(rep);
        setIntelligence(intel);
      } else {
        setSummary(await api.get(`/report-card/summary/class/${classId}/term/${termId}`));
      }
    } catch (err) { setError(err.message || 'Failed to load report.'); }
    finally { setLoading(false); }
  }

  function printReport() {
    if (!report) return;
    const win = window.open('', '_blank', 'width=800,height=600');
    win.document.write(`<!DOCTYPE html><html><head>
      <title>${report.student?.name ?? 'Report'}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 32px; color: #222; }
        h2 { margin-bottom: 4px; }
        p  { margin: 2px 0 10px; color: #555; }
        table { border-collapse: collapse; width: 100%; margin-top: 16px; }
        th, td { border: 1px solid #ccc; padding: 8px 10px; text-align: left; font-size: 13px; }
        th { background: #f5f5f5; font-weight: 700; }
        .print-btn { margin-bottom: 20px; padding: 8px 20px; cursor: pointer; }
        @media print { .print-btn { display: none; } }
      </style>
    </head><body>
      <button class="print-btn" onclick="window.print()">Print / Save as PDF</button>
      ${buildPrintHTML(report)}
    </body></html>`);
    win.document.close();
  }

  function shareWhatsApp() {
    if (!report) return;
    const ps  = report.performance_summary;
    const pct = ps?.percentage;
    const lines = [
      `*${report.student?.name} — ${report.term?.name}*`,
      `Class: ${report.student?.class ?? ''}`,
      pct != null ? `Overall: *${pct}%* (${ps?.classification ?? ''})` : '',
      '',
      ...(report.subjects || []).map(s =>
        `${s.subject_name}: ${s.total_score ?? '—'}/${s.max_score ?? '—'} (${s.percentage != null ? s.percentage + '%' : '—'})`
      ),
    ].filter(l => l !== undefined);
    window.open(`https://wa.me/?text=${encodeURIComponent(lines.join('\n'))}`, '_blank');
  }

  const ps = report?.performance_summary;

  return (
    <div className="page">
      <div className="page-title">Reports</div>

      {/* Controls */}
      <div style={{ background: '#fff', borderRadius: 8, padding: '16px 20px', marginBottom: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <div style={{ display: 'flex', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
          {['student', 'class'].map(m => (
            <button key={m}
              onClick={() => { setMode(m); setReport(null); setSummary(null); setIntelligence(null); }}
              style={{ padding: '8px 20px', borderRadius: 20, fontWeight: 600, fontSize: 13, cursor: 'pointer', border: 'none',
                       background: mode === m ? '#1a73e8' : '#f0f0f0',
                       color:      mode === m ? '#fff'    : '#555' }}>
              {m === 'student' ? 'Student Report Card' : 'Class Summary'}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Term *</label>
            <SearchableSelect
              value={termId}
              onChange={v => setTermId(v)}
              options={terms.map(t => ({ value: t.id, label: t.name + (t.is_current ? ' (current)' : '') }))}
              placeholder="— Select Term —"
            />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Class</label>
            <SearchableSelect
              value={classId}
              onChange={v => { setClassId(v); setStudentId(''); }}
              options={classes.map(c => ({ value: c.id, label: c.name }))}
              placeholder="— Select Class —"
            />
          </div>
          {mode === 'student' && (
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Student *</label>
              <SearchableSelect
                value={studentId}
                onChange={v => setStudentId(v)}
                options={students.map(s => ({ value: s.id, label: s.name }))}
                placeholder="— Select Student —"
                disabled={!classId}
              />
            </div>
          )}
          <button className="btn btn-primary" onClick={generate} disabled={loading}>
            {loading ? 'Loading…' : 'Generate'}
          </button>
          {mode === 'student' && report && (
            <>
              <button className="btn btn-secondary" onClick={printReport}>Print / PDF</button>
              <button onClick={shareWhatsApp}
                style={{ padding: '8px 16px', background: '#25D366', color: '#fff', border: 'none',
                         borderRadius: 6, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                WhatsApp
              </button>
            </>
          )}
        </div>

        {error && <div className="alert alert-error" style={{ marginTop: 12 }}>{error}</div>}
      </div>

      {/* Student report card */}
      {report && (
        <div style={{ background: '#fff', borderRadius: 8, padding: '20px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{report.student?.name}</div>
              <div style={{ fontSize: 13, color: '#666', marginTop: 2 }}>
                {report.student?.class} · {report.term?.name}
              </div>
            </div>
            {ps && (
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 26, fontWeight: 800, color: ps.percentage != null ? pctColor(ps.percentage) : '#aaa' }}>
                  {ps.percentage != null ? `${ps.percentage}%` : '—'}
                </div>
                <div style={{ fontSize: 12, color: '#888', textTransform: 'capitalize' }}>
                  {ps.classification} · {ps.subjects_count} subject{ps.subjects_count !== 1 ? 's' : ''}
                </div>
              </div>
            )}
          </div>

          <table>
            <thead>
              <tr>
                <th>Subject</th>
                <th>Total</th>
                <th>Max</th>
                <th>%</th>
                <th>Grade</th>
              </tr>
            </thead>
            <tbody>
              {(report.subjects || []).map(sub => (
                <tr key={sub.subject_id}>
                  <td style={{ fontWeight: 500 }}>{sub.subject_name}</td>
                  <td style={{ fontWeight: 600 }}>{sub.total_score ?? '—'}</td>
                  <td>{sub.max_score ?? '—'}</td>
                  <td style={{ fontWeight: 700, color: sub.percentage != null ? pctColor(sub.percentage) : '#aaa' }}>
                    {sub.percentage != null ? `${sub.percentage}%` : '—'}
                  </td>
                  <td style={{ fontSize: 12, fontWeight: 600, textTransform: 'capitalize',
                               color: sub.percentage != null ? pctColor(sub.percentage) : '#aaa' }}>
                    {sub.classification ?? '—'}
                  </td>
                </tr>
              ))}
              {(!report.subjects || report.subjects.length === 0) && (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', color: '#888', padding: 24 }}>
                    No results recorded for this term.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {ps && (
            <div style={{ display: 'flex', gap: 12, marginTop: 16, flexWrap: 'wrap' }}>
              {GRADE_BANDS.map(([k, color, bg]) => (
                <div key={k} style={{ padding: '8px 20px', borderRadius: 8, background: bg, textAlign: 'center', minWidth: 80 }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color }}>{ps[k] ?? 0}</div>
                  <div style={{ fontSize: 11, color: '#666', textTransform: 'capitalize' }}>{k}</div>
                </div>
              ))}
            </div>
          )}

          {intelligence && (
            <div style={{ marginTop: 24, padding: '16px 20px', background: '#f9f9f9', borderRadius: 8 }}>
              <h4 style={{ margin: '0 0 12px 0', fontSize: 15 }}>Intelligence Insights</h4>
              <div style={{ display: 'flex', gap: 24, marginBottom: 16, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>Risk Level</div>
                  <span className={`risk-badge risk-${intelligence.risk_level}`} style={{ fontSize: 12, padding: '3px 10px' }}>
                    {intelligence.risk_level?.toUpperCase()}
                  </span>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>Attendance Rate</div>
                  <div style={{ fontSize: 16, fontWeight: 600 }}>{intelligence.data_summary?.attendance_rate}%</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>Weak Competencies</div>
                  <div style={{ fontSize: 16, fontWeight: 600 }}>{intelligence.data_summary?.weak_competencies}</div>
                </div>
              </div>

              {intelligence.reasons?.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Key Concerns</div>
                  <ul style={{ margin: 0, paddingLeft: 20 }}>
                    {intelligence.reasons.map((r, i) => (
                      <li key={i} style={{ fontSize: 13, color: '#555', marginBottom: 2 }}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}

              {intelligence.recommended_actions?.length > 0 && (
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Recommended Actions</div>
                  <ul style={{ margin: 0, paddingLeft: 20 }}>
                    {intelligence.recommended_actions.map((a, i) => (
                      <li key={i} style={{ fontSize: 13, color: '#333', marginBottom: 2 }}>{a}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Class summary */}
      {summary && (
        <div style={{ background: '#fff', borderRadius: 8, padding: '20px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{summary.class} — {summary.term}</div>
            <div style={{ fontSize: 13, color: '#666', marginTop: 4 }}>
              {summary.results_count} result records · Average:{' '}
              <strong style={{ color: pctColor(summary.summary?.average_percentage) }}>
                {summary.summary?.average_percentage?.toFixed(1)}%
              </strong>
            </div>
          </div>

          {summary.summary?.distribution && (
            <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
              {GRADE_BANDS.map(([k, color, bg]) => (
                <div key={k} style={{ textAlign: 'center', padding: '10px 24px', borderRadius: 8, background: bg }}>
                  <div style={{ fontSize: 26, fontWeight: 800, color }}>{summary.summary.distribution[k] ?? 0}</div>
                  <div style={{ fontSize: 12, color: '#666', textTransform: 'capitalize' }}>{k}</div>
                </div>
              ))}
            </div>
          )}

          {summary.subject_breakdown && Object.keys(summary.subject_breakdown).length > 0 && (
            <table>
              <thead>
                <tr>
                  <th>Subject</th>
                  <th>Entries</th>
                  <th>Avg %</th>
                  <th>Strong</th>
                  <th>Average</th>
                  <th>Weak</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(summary.subject_breakdown).map(([name, data]) => (
                  <tr key={name}>
                    <td style={{ fontWeight: 500 }}>{name}</td>
                    <td>{data.count}</td>
                    <td style={{ fontWeight: 700, color: pctColor(data.avg_pct) }}>
                      {data.avg_pct?.toFixed(1)}%
                    </td>
                    <td style={{ color: '#27ae60', fontWeight: 600 }}>{data.strong ?? 0}</td>
                    <td style={{ color: '#e67e22', fontWeight: 600 }}>{data.average ?? 0}</td>
                    <td style={{ color: '#e74c3c', fontWeight: 600 }}>{data.weak ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {summary.results_count === 0 && (
            <p style={{ color: '#888', textAlign: 'center', padding: 24 }}>No results recorded for this class and term.</p>
          )}
        </div>
      )}
    </div>
  );
}
