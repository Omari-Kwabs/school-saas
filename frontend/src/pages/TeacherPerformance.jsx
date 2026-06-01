import React, { useEffect, useState } from 'react';
import { api } from '../api';

function pctColor(v) {
  if (v == null) return '#888';
  if (v >= 75) return '#1a7340';
  if (v >= 50) return '#7d4e00';
  return '#721c24';
}

function pctBg(v) {
  if (v == null) return 'transparent';
  if (v >= 75) return '#d4edda';
  if (v >= 50) return '#fff3cd';
  return '#f8d7da';
}

function Pct({ v, bold }) {
  if (v == null) return <span style={{ color: '#aaa' }}>—</span>;
  return <span style={{ color: pctColor(v), fontWeight: bold ? 700 : 400 }}>{v}%</span>;
}

function MetricCard({ label, value, note }) {
  return (
    <div style={{
      background: '#fff', border: '1px solid #dde3ef', borderRadius: 8,
      padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 4
    }}>
      <div style={{ fontSize: 10, color: '#5a6882', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: pctColor(value) }}>
        {value != null ? `${value}%` : '—'}
      </div>
      {note && <div style={{ fontSize: 11, color: '#9ca3af' }}>{note}</div>}
    </div>
  );
}

function SectionHeader({ label, action }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      borderBottom: '2px solid #e0e7f0', paddingBottom: 8, marginBottom: 14
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#5a6882' }}>
        {label}
      </div>
      {action}
    </div>
  );
}

function roleFmt(r) { return r.replace(/_/g, ' '); }

export default function TeacherPerformance() {
  const [terms, setTerms]               = useState([]);
  const [termId, setTermId]             = useState('');
  const [data, setData]                 = useState(null);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState(null);
  const [selected, setSelected]         = useState(null);
  const [detail, setDetail]             = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    api.get('/terms').then(list => {
      const arr = Array.isArray(list) ? list : [];
      setTerms(arr);
      const cur = arr.find(t => t.is_current) || arr[0];
      if (cur) setTermId(cur.id);
    }).catch(() => {});
  }, []);

  useEffect(() => { if (termId) loadOverview(); }, [termId]);

  async function loadOverview() {
    setLoading(true); setError(null); setData(null); setSelected(null); setDetail(null);
    try { setData(await api.get(`/teacher-performance/term/${termId}`)); }
    catch (err) { setError(err.message); }
    setLoading(false);
  }

  async function loadDetail(teacher) {
    setSelected(teacher); setDetail(null); setDetailLoading(true);
    try { setDetail(await api.get(`/teacher-performance/${teacher.teacher_id}/term/${termId}`)); }
    catch (err) { setError(err.message); }
    setDetailLoading(false);
  }

  return (
    <div className="page">
      {/* ── Page header banner ──────────────────────────────────────── */}
      <div style={{
        background: 'var(--brand-sidebar-bg, #1e2a3a)', borderRadius: 10, padding: '14px 24px',
        marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center'
      }}>
        <div>
          <div style={{ color: '#7a9cbf', fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 2 }}>
            Performance Records
          </div>
          <div style={{ color: '#fff', fontSize: 18, fontWeight: 800 }}>
            Teacher Performance — Student Outcomes
          </div>
        </div>
        <div className="form-group" style={{ marginBottom: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
          <label style={{ color: '#a0b4c8', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 0 }}>Term</label>
          <select value={termId} onChange={e => setTermId(e.target.value)}
            style={{ background: '#2c3e50', color: '#fff', border: '1px solid #3d5166', borderRadius: 5, padding: '6px 10px', fontSize: 13 }}>
            <option value="">— Select Term —</option>
            {terms.map(t => (
              <option key={t.id} value={t.id}>{t.name}{t.is_current ? ' (current)' : ''}</option>
            ))}
          </select>
        </div>
      </div>

      {error && <p style={{ color: '#721c24', background: '#f8d7da', border: '1px solid #f5c6c6', padding: '10px 14px', borderRadius: 6, marginBottom: 16 }}>{error}</p>}
      {loading && <p style={{ color: '#888' }}>Loading…</p>}

      {data && !loading && (
        <div style={{ display: 'flex', gap: 0, alignItems: 'flex-start' }}>

          {/* ── Roster table ────────────────────────────────────────── */}
          <div style={{ flex: selected ? '0 0 54%' : 1, minWidth: 0, paddingRight: selected ? 20 : 0 }}>

            {/* Table card header */}
            <div style={{
              background: '#fff', border: '1px solid #dde3ef', borderRadius: '8px 8px 0 0',
              padding: '12px 20px', borderBottom: '2px solid #e0e7f0',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#5a6882' }}>
                Practitioner Roster
              </div>
              <div style={{ fontSize: 12, color: '#8895a8' }}>{data.term?.name}</div>
            </div>

            {data.teachers.length === 0
              ? (
                <div style={{ background: '#fff', border: '1px solid #dde3ef', borderTop: 'none', borderRadius: '0 0 8px 8px', padding: 20 }}>
                  <p style={{ color: '#888', margin: 0 }}>No teachers with assignments found for this term.</p>
                </div>
              )
              : (
                <div style={{ overflowX: 'auto', background: '#fff', border: '1px solid #dde3ef', borderTop: 'none', borderRadius: '0 0 8px 8px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: '#f8fafd' }}>
                        <th style={{ padding: '9px 14px', textAlign: 'left', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#5a6882', borderBottom: '1px solid #e0e7f0' }}>Practitioner</th>
                        <th style={{ padding: '9px 14px', textAlign: 'left', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#5a6882', borderBottom: '1px solid #e0e7f0' }} title="Average of student averages">Class Avg</th>
                        <th style={{ padding: '9px 14px', textAlign: 'left', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#5a6882', borderBottom: '1px solid #e0e7f0' }} title="% of students scoring ≥ 50%">Pass Rate</th>
                        <th style={{ padding: '9px 14px', textAlign: 'left', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#5a6882', borderBottom: '1px solid #e0e7f0' }} title="% of students scoring ≥ 75%">High Perf.</th>
                        <th style={{ padding: '9px 14px', textAlign: 'left', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#5a6882', borderBottom: '1px solid #e0e7f0' }} title="% who improved first to last">Improvement</th>
                        <th style={{ padding: '9px 14px', textAlign: 'left', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#5a6882', borderBottom: '1px solid #e0e7f0' }} title="% of weak students who recovered">Recovery</th>
                        <th style={{ padding: '9px 14px', textAlign: 'left', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#5a6882', borderBottom: '1px solid #e0e7f0' }} title="% of remediation flags closed">Remediation</th>
                        <th style={{ padding: '9px 14px', textAlign: 'left', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#5a6882', borderBottom: '1px solid #e0e7f0' }} title="Total students who moved weak → passing">Recovered</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.teachers.map(t => {
                        const s      = t.summary;
                        const active = selected?.teacher_id === t.teacher_id;
                        return (
                          <tr
                            key={t.teacher_id}
                            style={{
                              cursor: 'pointer',
                              background: active ? 'var(--brand-primary-muted, #eef2ff)' : '',
                              borderLeft: active ? `4px solid var(--brand-primary, #1a73e8)` : '4px solid transparent',
                              transition: 'background 0.15s'
                            }}
                            onClick={() => loadDetail(t)}
                          >
                            <td style={{ padding: '10px 14px', borderBottom: '1px solid #f0f3f8' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div style={{
                                  width: 34, height: 34, borderRadius: '50%',
                                  background: 'linear-gradient(135deg, var(--brand-sidebar-bg, #1e2a3a), var(--brand-sidebar-hover, #2c4a6e))',
                                  color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  fontSize: 13, fontWeight: 700, flexShrink: 0
                                }}>
                                  {t.name?.[0]?.toUpperCase()}
                                </div>
                                <div>
                                  <div style={{ fontWeight: 700, color: '#1a2336' }}>{t.name}</div>
                                  <div style={{ fontSize: 11, color: '#8895a8', textTransform: 'capitalize' }}>{roleFmt(t.role)}</div>
                                  <div style={{ fontSize: 11, color: '#8895a8' }}>
                                    {[...new Set(t.outcomes.map(o => o.class_name))].join(', ')}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td style={{ padding: '10px 14px', borderBottom: '1px solid #f0f3f8' }}><Pct v={s?.avg_class_avg} bold /></td>
                            <td style={{ padding: '10px 14px', borderBottom: '1px solid #f0f3f8' }}><Pct v={s?.avg_pass_rate} bold /></td>
                            <td style={{ padding: '10px 14px', borderBottom: '1px solid #f0f3f8' }}><Pct v={s?.avg_high_rate} bold /></td>
                            <td style={{ padding: '10px 14px', borderBottom: '1px solid #f0f3f8' }}><Pct v={s?.avg_improvement_rate} bold /></td>
                            <td style={{ padding: '10px 14px', borderBottom: '1px solid #f0f3f8' }}><Pct v={s?.avg_recovery_rate} bold /></td>
                            <td style={{ padding: '10px 14px', borderBottom: '1px solid #f0f3f8' }}><Pct v={s?.avg_remediation_rate} bold /></td>
                            <td style={{ padding: '10px 14px', borderBottom: '1px solid #f0f3f8' }}>
                              {(s?.total_recovered ?? 0) > 0
                                ? <strong style={{ color: '#1a7340' }}>{s.total_recovered}</strong>
                                : <span style={{ color: '#aaa' }}>0</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )
            }
          </div>

          {/* ── Practitioner detail panel ────────────────────────────── */}
          {selected && (
            <div style={{
              flex: 1, minWidth: 0,
              borderLeft: '2px solid #e0e7f0', paddingLeft: 24,
              maxHeight: 'calc(100vh - 160px)', overflowY: 'auto'
            }}>
              {/* Practitioner record header */}
              <div style={{
                background: 'var(--brand-sidebar-bg, #1e2a3a)', borderRadius: 8, padding: '12px 18px',
                marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'
              }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: '50%',
                    background: 'linear-gradient(135deg, var(--brand-sidebar-hover, #2c4a6e), var(--brand-sidebar-active, #3d6e9e))',
                    color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 18, fontWeight: 800, flexShrink: 0, border: '2px solid #3d5166'
                  }}>
                    {selected.name?.[0]?.toUpperCase()}
                  </div>
                  <div>
                    <div style={{ color: '#7a9cbf', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                      Practitioner Record
                    </div>
                    <div style={{ color: '#fff', fontSize: 16, fontWeight: 800, marginTop: 2 }}>{selected.name}</div>
                    <div style={{ color: '#a0b4c8', fontSize: 12, textTransform: 'capitalize', marginTop: 1 }}>
                      {roleFmt(selected.role)}
                    </div>
                  </div>
                </div>
                <button
                  style={{ background: 'none', border: '1px solid #3d5166', borderRadius: 4, padding: '2px 10px', cursor: 'pointer', fontSize: 16, color: '#a0b4c8' }}
                  onClick={() => { setSelected(null); setDetail(null); }}
                >✕</button>
              </div>

              {detailLoading && <p style={{ color: '#888', marginTop: 16 }}>Loading details…</p>}

              {detail && !detailLoading && (
                <div style={{ marginTop: 0 }}>
                  {detail.outcomes.length === 0
                    ? <p style={{ color: '#888' }}>No assignments found.</p>
                    : detail.outcomes.map((o, i) => (
                      <OutcomeCard key={i} o={o} />
                    ))
                  }
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function OutcomeCard({ o }) {
  const [showCross, setShowCross] = useState(false);
  const [showRecov, setShowRecov] = useState(false);
  const [showWeak,  setShowWeak]  = useState(false);

  return (
    <div style={{
      marginBottom: 16, background: '#fff',
      border: '1px solid #dde3ef', borderRadius: 10, overflow: 'hidden'
    }}>
      {/* Card header */}
      <div style={{
        background: '#f8fafd', borderBottom: '1px solid #e0e7f0',
        padding: '12px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <strong style={{ fontSize: 14, color: '#1a2336' }}>{o.class_name} — {o.subject_name}</strong>
          {o.subject_rank != null && (
            <span style={{
              fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
              background: o.subject_rank === 1 ? '#d4edda' : o.subject_rank <= 3 ? '#fff3cd' : '#f8d7da',
              color:      o.subject_rank === 1 ? '#1a7340' : o.subject_rank <= 3 ? '#7d4e00' : '#721c24',
              textTransform: 'uppercase', letterSpacing: '0.04em'
            }}>
              #{o.subject_rank} of {o.total_classes_for_subject}
            </span>
          )}
        </div>
        <span style={{ fontSize: 11, color: '#8895a8' }}>{o.students_assessed} students assessed</span>
      </div>

      <div style={{ padding: '14px 18px' }}>
        {/* 6 metric cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 14 }}>
          <MetricCard label="Class Average"      value={o.class_avg}                note="mean student avg" />
          <MetricCard label="Pass Rate ≥ 50%"    value={o.pass_rate}                note={`${o.students_assessed} students`} />
          <MetricCard label="High Perf. ≥ 75%"   value={o.high_rate}                note="strong performers" />
          <MetricCard label="Improvement Rate"   value={o.improvement_rate}         note={`${o.improved_count}/${o.students_with_trajectory} w/ 2+ assessments`} />
          <MetricCard label="Weak Recovery"      value={o.recovery_rate}            note={`${o.recovered_count} of ${o.initially_weak} weak`} />
          <MetricCard label="Remediation Closed" value={o.remediation_success_rate} note={`${o.remediation_closed} closed · ${o.remediation_pending} pending`} />
        </div>

        {/* Cross-class comparison */}
        {o.cross_class_comparison.length > 1 && (
          <div style={{ marginBottom: 10 }}>
            <button
              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--brand-primary, #1a73e8)', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}
              onClick={() => setShowCross(v => !v)}
            >
              <span>{showCross ? '▾' : '▸'}</span>
              Cohort Analysis — {o.subject_name}
            </button>
            {showCross && (
              <table style={{ marginTop: 8, fontSize: 13, width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8fafd' }}>
                    <th style={{ padding: '7px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#5a6882', borderBottom: '1px solid #e0e7f0' }}>Class</th>
                    <th style={{ padding: '7px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#5a6882', borderBottom: '1px solid #e0e7f0' }}>Avg %</th>
                    <th style={{ padding: '7px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#5a6882', borderBottom: '1px solid #e0e7f0' }}>Students</th>
                    <th style={{ padding: '7px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#5a6882', borderBottom: '1px solid #e0e7f0' }}>Rank</th>
                  </tr>
                </thead>
                <tbody>
                  {o.cross_class_comparison.map(c => (
                    <tr key={c.class_id} style={{ background: c.is_mine ? 'var(--brand-primary-muted, #eef2ff)' : '', borderLeft: c.is_mine ? `3px solid var(--brand-primary, #1a73e8)` : '3px solid transparent' }}>
                      <td style={{ padding: '7px 12px', borderBottom: '1px solid #f0f3f8' }}>{c.class_name}{c.is_mine ? ' ★' : ''}</td>
                      <td style={{ padding: '7px 12px', borderBottom: '1px solid #f0f3f8' }}><Pct v={c.avg_pct} bold={c.is_mine} /></td>
                      <td style={{ padding: '7px 12px', borderBottom: '1px solid #f0f3f8' }}>{c.student_count}</td>
                      <td style={{ padding: '7px 12px', borderBottom: '1px solid #f0f3f8' }}>
                        <span style={{ fontWeight: 700, color: c.rank === 1 ? '#1a7340' : c.rank <= 3 ? '#7d4e00' : '#374151' }}>#{c.rank}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Recovered students */}
        {o.recovered_students.length > 0 && (
          <div style={{ marginBottom: 8 }}>
            <button
              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#1a7340', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}
              onClick={() => setShowRecov(v => !v)}
            >
              <span>{showRecov ? '▾' : '▸'}</span>
              {o.recovered_count} student{o.recovered_count > 1 ? 's' : ''} recovered (&lt;50% → ≥50%)
            </button>
            {showRecov && (
              <table style={{ marginTop: 8, fontSize: 13, width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8fafd' }}>
                    <th style={{ padding: '7px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#5a6882', borderBottom: '1px solid #e0e7f0' }}>Student</th>
                    <th style={{ padding: '7px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#5a6882', borderBottom: '1px solid #e0e7f0' }}>Code</th>
                    <th style={{ padding: '7px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#5a6882', borderBottom: '1px solid #e0e7f0' }}>First</th>
                    <th style={{ padding: '7px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#5a6882', borderBottom: '1px solid #e0e7f0' }}>Latest</th>
                    <th style={{ padding: '7px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#5a6882', borderBottom: '1px solid #e0e7f0' }}>Gain</th>
                  </tr>
                </thead>
                <tbody>
                  {o.recovered_students.map((s, i) => (
                    <tr key={i}>
                      <td style={{ padding: '7px 12px', borderBottom: '1px solid #f0f3f8' }}>{s.name}</td>
                      <td style={{ padding: '7px 12px', borderBottom: '1px solid #f0f3f8', color: '#8895a8' }}>{s.student_code}</td>
                      <td style={{ padding: '7px 12px', borderBottom: '1px solid #f0f3f8', color: '#721c24' }}>{s.first_score}%</td>
                      <td style={{ padding: '7px 12px', borderBottom: '1px solid #f0f3f8', color: '#1a7340', fontWeight: 700 }}>{s.last_score}%</td>
                      <td style={{ padding: '7px 12px', borderBottom: '1px solid #f0f3f8', color: '#1a7340' }}>+{(s.last_score - s.first_score).toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Still-weak students */}
        {o.still_weak_students.length > 0 && (
          <div>
            <button
              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#721c24', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}
              onClick={() => setShowWeak(v => !v)}
            >
              <span>{showWeak ? '▾' : '▸'}</span>
              {o.still_weak_students.length} student{o.still_weak_students.length > 1 ? 's' : ''} still below 50%
            </button>
            {showWeak && (
              <table style={{ marginTop: 8, fontSize: 13, width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8fafd' }}>
                    <th style={{ padding: '7px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#5a6882', borderBottom: '1px solid #e0e7f0' }}>Student</th>
                    <th style={{ padding: '7px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#5a6882', borderBottom: '1px solid #e0e7f0' }}>Code</th>
                    <th style={{ padding: '7px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#5a6882', borderBottom: '1px solid #e0e7f0' }}>First</th>
                    <th style={{ padding: '7px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#5a6882', borderBottom: '1px solid #e0e7f0' }}>Latest</th>
                    <th style={{ padding: '7px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#5a6882', borderBottom: '1px solid #e0e7f0' }}>Change</th>
                  </tr>
                </thead>
                <tbody>
                  {o.still_weak_students.map((s, i) => {
                    const delta = s.last_score - s.first_score;
                    return (
                      <tr key={i}>
                        <td style={{ padding: '7px 12px', borderBottom: '1px solid #f0f3f8' }}>{s.name}</td>
                        <td style={{ padding: '7px 12px', borderBottom: '1px solid #f0f3f8', color: '#8895a8' }}>{s.student_code}</td>
                        <td style={{ padding: '7px 12px', borderBottom: '1px solid #f0f3f8', color: '#721c24' }}>{s.first_score}%</td>
                        <td style={{ padding: '7px 12px', borderBottom: '1px solid #f0f3f8', color: '#721c24' }}>{s.last_score}%</td>
                        <td style={{ padding: '7px 12px', borderBottom: '1px solid #f0f3f8', color: delta > 0 ? '#7d4e00' : '#721c24' }}>
                          {delta > 0 ? '+' : ''}{delta.toFixed(1)}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
