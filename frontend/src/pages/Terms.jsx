import React, { useEffect, useState, useCallback } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

const STATUS_STYLE = {
  active:   { bg: '#dcfce7', color: '#166534', label: 'Active'    },
  upcoming: { bg: '#eff6ff', color: '#1e40af', label: 'Upcoming'  },
  ended:    { bg: '#f3f4f6', color: '#6b7280', label: 'Ended'     },
  inactive: { bg: '#fef9ec', color: '#92400e', label: 'Inactive'  },
  draft:    { bg: '#fdf4ff', color: '#6b21a8', label: 'Draft'     },
};

function fmt(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GH', { day: 'numeric', month: 'short', year: 'numeric' });
}

function daysLeft(end_date) {
  if (!end_date) return null;
  const diff = Math.ceil((new Date(end_date) - new Date()) / 86400000);
  return diff;
}

function deriveYear(start_date) {
  if (!start_date) return '';
  const d = new Date(start_date); const m = d.getMonth() + 1; const y = d.getFullYear();
  return m >= 9 ? `${y}/${y + 1}` : `${y - 1}/${y}`;
}

function nextAcademicYear() {
  const now = new Date();
  const y = now.getFullYear(); const m = now.getMonth() + 1;
  return m >= 9 ? `${y}/${y + 1}` : `${y}/${y + 1}`; // always next starting Sep
}

// ── Scaffold wizard: build N term rows ───────────────────────────────────────
function ScaffoldWizard({ onDone, onCancel }) {
  const [termCount, setTermCount]   = useState(3);
  const [rows, setRows]             = useState(() => defaultRows(3));
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState('');

  function defaultRows(n) {
    return Array.from({ length: n }, (_, i) => ({
      name: `Term ${i + 1}`, start_date: '', end_date: '',
    }));
  }

  function changeCount(n) {
    setTermCount(n);
    setRows(prev => {
      const next = defaultRows(n);
      prev.slice(0, n).forEach((r, i) => { next[i] = { ...next[i], ...r }; });
      return next;
    });
  }

  function setRow(i, field, val) {
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, [field]: val } : r));
  }

  const previewYear = rows[0]?.start_date ? deriveYear(rows[0].start_date) : '—';

  async function submit(e) {
    e.preventDefault(); setError(''); setSaving(true);
    try {
      await api.post('/terms/scaffold', { terms: rows });
      onDone();
    } catch (err) { setError(err.message || 'Failed to create terms.'); }
    finally { setSaving(false); }
  }

  return (
    <div className="panel" style={{ marginBottom: 20, borderTop: '3px solid #2563eb' }}>
      <div className="panel-header">
        <div>
          <h3>Create Academic Year</h3>
          <p style={{ fontSize: 12, color: '#6b7280', marginTop: 2, fontWeight: 400 }}>
            Define all terms for the year in one step. Academic year is derived automatically from Term 1's start date.
          </p>
        </div>
        <button className="btn btn-sm btn-secondary" onClick={onCancel}>Cancel</button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 13, color: '#374151', fontWeight: 500 }}>Number of terms:</span>
          {[2, 3, 4].map(n => (
            <button key={n} type="button"
              onClick={() => changeCount(n)}
              style={{
                padding: '4px 14px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13,
                background: termCount === n ? '#2563eb' : '#fff',
                color: termCount === n ? '#fff' : '#374151',
                cursor: 'pointer', fontWeight: termCount === n ? 700 : 400,
              }}>
              {n}
            </button>
          ))}
        </div>
        {rows[0]?.start_date && (
          <div style={{ fontSize: 13, background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 6, padding: '4px 12px', color: '#1e40af', fontWeight: 600 }}>
            Academic Year: {previewYear}
          </div>
        )}
      </div>

      <form onSubmit={submit}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
          {rows.map((row, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, padding: '12px 16px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ fontSize: 12 }}>Name *</label>
                <input value={row.name} onChange={e => setRow(i, 'name', e.target.value)} required />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ fontSize: 12 }}>Start Date *</label>
                <input type="date" value={row.start_date} onChange={e => setRow(i, 'start_date', e.target.value)} required />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ fontSize: 12 }}>End Date *</label>
                <input type="date" value={row.end_date}
                  min={row.start_date || undefined}
                  onChange={e => setRow(i, 'end_date', e.target.value)} required />
              </div>
            </div>
          ))}
        </div>
        <button className="btn btn-primary" disabled={saving}>
          {saving ? 'Creating…' : `Create ${termCount} Terms`}
        </button>
      </form>
    </div>
  );
}

// ── Single term edit form ─────────────────────────────────────────────────────
function TermEditForm({ term, onSave, onCancel }) {
  const [form, setForm] = useState({
    name: term?.name || '',
    start_date: term?.start_date?.slice(0, 10) || '',
    end_date:   term?.end_date?.slice(0, 10)   || '',
  });
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');

  function handle(e) { setForm(f => ({ ...f, [e.target.name]: e.target.value })); }

  async function submit(e) {
    e.preventDefault(); setError(''); setSaving(true);
    try {
      if (term?.id) await api.put(`/terms/${term.id}`, form);
      else          await api.post('/terms', form);
      onSave();
    } catch (err) { setError(err.message || 'Failed to save.'); }
    finally { setSaving(false); }
  }

  return (
    <div style={{ padding: '12px 16px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8 }}>
      {error && <div className="alert alert-error" style={{ marginBottom: 8 }}>{error}</div>}
      <form onSubmit={submit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto auto', gap: 10, alignItems: 'flex-end' }}>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label style={{ fontSize: 12 }}>Name *</label>
          <input name="name" value={form.name} onChange={handle} required />
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label style={{ fontSize: 12 }}>Start Date *</label>
          <input type="date" name="start_date" value={form.start_date} onChange={handle} required />
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label style={{ fontSize: 12 }}>End Date *</label>
          <input type="date" name="end_date" value={form.end_date}
            min={form.start_date || undefined} onChange={handle} required />
        </div>
        <button className="btn btn-sm btn-primary" disabled={saving}>{saving ? '…' : 'Save'}</button>
        <button type="button" className="btn btn-sm btn-secondary" onClick={onCancel}>Cancel</button>
      </form>
      {form.start_date && (
        <div style={{ fontSize: 11, color: '#6b7280', marginTop: 6 }}>
          Academic year: <strong>{deriveYear(form.start_date)}</strong>
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Terms() {
  const { user } = useAuth();
  const [terms, setTerms]           = useState([]);
  const [loading, setLoading]       = useState(false);
  const [msg, setMsg]               = useState('');
  const [error, setError]           = useState('');
  const [showScaffold, setShowScaffold] = useState(false);
  const [editId, setEditId]         = useState(null);   // term being edited
  const [addingToYear, setAddingToYear] = useState(null); // academic_year key
  const [busy, setBusy]             = useState(null);   // term id being actioned

  useEffect(() => { document.title = 'Academic Calendar — SchoolSaaS'; }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get('/terms');
      setTerms(Array.isArray(data) ? data : []);
    } catch (err) { setError(err.message || 'Failed to load terms.'); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function flash(text, isErr = false) {
    if (isErr) setError(text); else setMsg(text);
    setTimeout(() => { setMsg(''); setError(''); }, 6000);
  }

  async function activate(term) {
    if (!confirm(`Activate "${term.name}"? This will become the current term and any outstanding balances from the previous term will be carried forward automatically.`)) return;
    setBusy(term.id);
    try {
      const res = await api.post(`/terms/${term.id}/activate`);
      const cf = res.carry_forwards_created;
      flash(`"${term.name}" is now active.${cf > 0 ? ` ${cf} balance${cf !== 1 ? 's' : ''} carried forward from previous term.` : ''}`);
      load();
    } catch (err) { flash(err.message || 'Failed to activate term.', true); }
    setBusy(null);
  }

  async function closeTerm(term) {
    setBusy(term.id);
    try {
      const res = await api.post(`/terms/${term.id}/close`);
      const n = res.outstanding_students;
      flash(`"${term.name}" closed.${n > 0 ? ` ${n} student${n !== 1 ? 's' : ''} still have outstanding balances — create plans for the next term to carry them forward.` : ''}`);
      load();
    } catch (err) { flash(err.message || 'Failed to close term.', true); }
    setBusy(null);
  }

  async function archiveTerm(term) {
    if (!confirm(`Archive "${term.name}"? It will be hidden from active views.`)) return;
    setBusy(term.id);
    try { await api.post(`/terms/${term.id}/archive`); load(); }
    catch (err) { flash(err.message, true); }
    setBusy(null);
  }

  async function archiveYear(year) {
    if (!confirm(`Archive all terms in ${year}?`)) return;
    try { await api.post('/terms/archive-year', { academic_year: year }); load(); }
    catch (err) { flash(err.message, true); }
  }

  async function deleteTerm(term) {
    if (!confirm(`Delete "${term.name}"? This cannot be undone.`)) return;
    try { await api.delete(`/terms/${term.id}`); load(); }
    catch (err) { flash(err.message || 'Cannot delete this term.', true); }
  }

  const canManage = ['owner', 'headmaster_academics', 'headmaster_admin'].includes(user.role);

  // Active term
  const activeTerm = terms.find(t => t.status === 'active');

  // Group by academic year, sorted descending
  const grouped = terms.reduce((acc, t) => {
    const key = t.academic_year || 'Unknown';
    if (!acc[key]) acc[key] = [];
    acc[key].push(t);
    return acc;
  }, {});
  const sortedYears = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  // Progress bar for a term within its year
  function termProgress(term, yearTerms) {
    if (!term.start_date || !term.end_date) return null;
    const allStarts = yearTerms.map(t => t.start_date).filter(Boolean).sort();
    const allEnds   = yearTerms.map(t => t.end_date).filter(Boolean).sort();
    const yearStart = new Date(allStarts[0]);
    const yearEnd   = new Date(allEnds[allEnds.length - 1]);
    const yearSpan  = yearEnd - yearStart || 1;
    const tStart    = new Date(term.start_date);
    const tEnd      = new Date(term.end_date);
    const left      = Math.max(0, ((tStart - yearStart) / yearSpan) * 100);
    const width     = Math.max(2, ((tEnd - tStart) / yearSpan) * 100);
    return { left, width };
  }

  return (
    <div className="page">

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div className="page-title" style={{ marginBottom: 4 }}>Academic Calendar</div>
          <div style={{ fontSize: 13, color: '#6b7280' }}>
            Manage academic years, terms, and term transitions
          </div>
        </div>
        {canManage && !showScaffold && (
          <button className="btn btn-primary" onClick={() => setShowScaffold(true)}>
            + Create Academic Year
          </button>
        )}
      </div>

      {msg   && <div className="alert alert-success" style={{ marginBottom: 12 }}>{msg}</div>}
      {error && <div className="alert alert-error"   style={{ marginBottom: 12 }}>{error}</div>}

      {/* Scaffold wizard */}
      {showScaffold && (
        <ScaffoldWizard
          onDone={() => { setShowScaffold(false); load(); }}
          onCancel={() => setShowScaffold(false)}
        />
      )}

      {/* Active term banner */}
      {activeTerm && (() => {
        const days = daysLeft(activeTerm.end_date);
        const urgent = days !== null && days <= 14;
        return (
          <div style={{
            background: urgent ? '#fef9ec' : '#f0fdf4',
            border: `1.5px solid ${urgent ? '#fbbf24' : '#4ade80'}`,
            borderRadius: 10, padding: '16px 20px', marginBottom: 20,
            display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
          }}>
            <div style={{ fontSize: 28 }}>{urgent ? '⏰' : '📅'}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: '#166534' }}>
                Current Term: {activeTerm.name}
                {activeTerm.academic_year && <span style={{ fontWeight: 400, color: '#6b7280', fontSize: 13, marginLeft: 8 }}>({activeTerm.academic_year})</span>}
              </div>
              <div style={{ fontSize: 13, color: '#374151', marginTop: 2 }}>
                {fmt(activeTerm.start_date)} → {fmt(activeTerm.end_date)}
                {days !== null && (
                  <span style={{ marginLeft: 10, fontWeight: 600, color: urgent ? '#b45309' : '#166534' }}>
                    {days > 0 ? `${days} day${days !== 1 ? 's' : ''} remaining` : days === 0 ? 'Ends today' : 'Overdue — should be closed'}
                  </span>
                )}
              </div>
            </div>
            {canManage && (
              <button className="btn btn-secondary" onClick={() => closeTerm(activeTerm)} disabled={busy === activeTerm.id}
                style={{ borderColor: '#dc2626', color: '#dc2626', fontWeight: 600 }}>
                {busy === activeTerm.id ? '…' : 'Close Term'}
              </button>
            )}
          </div>
        );
      })()}

      {loading && <p style={{ color: '#888', fontSize: 13 }}>Loading…</p>}

      {!loading && terms.length === 0 && !showScaffold && (
        <div className="panel" style={{ textAlign: 'center', padding: 48, color: '#888' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📅</div>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>No terms yet</div>
          <div style={{ fontSize: 13, marginBottom: 20 }}>Create your first academic year to get started.</div>
          {canManage && <button className="btn btn-primary" onClick={() => setShowScaffold(true)}>+ Create Academic Year</button>}
        </div>
      )}

      {/* Academic years */}
      {!loading && sortedYears.map(year => {
        const yearTerms = grouped[year];
        return (
          <div key={year} className="panel" style={{ marginBottom: 20 }}>
            {/* Year header */}
            <div className="panel-header" style={{ alignItems: 'center', marginBottom: 12 }}>
              <div>
                <h3 style={{ marginBottom: 0 }}>Academic Year {year}</h3>
                <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
                  {yearTerms.length} term{yearTerms.length !== 1 ? 's' : ''}
                  {' · '}
                  {fmt(yearTerms.map(t => t.start_date).filter(Boolean).sort()[0])}
                  {' → '}
                  {fmt(yearTerms.map(t => t.end_date).filter(Boolean).sort().slice(-1)[0])}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {canManage && (
                  <>
                    <button className="btn btn-sm btn-secondary"
                      onClick={() => setAddingToYear(addingToYear === year ? null : year)}
                      style={{ fontSize: 11 }}>
                      + Add Term
                    </button>
                    <button className="btn btn-sm btn-secondary"
                      onClick={() => archiveYear(year)}
                      style={{ fontSize: 11 }}>
                      Archive Year
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Timeline bar */}
            {yearTerms.every(t => t.start_date && t.end_date) && (
              <div style={{ position: 'relative', height: 20, background: '#f3f4f6', borderRadius: 4, marginBottom: 16, overflow: 'hidden' }}>
                {yearTerms.map(term => {
                  const pos = termProgress(term, yearTerms);
                  if (!pos) return null;
                  const sc = STATUS_STYLE[term.status] || STATUS_STYLE.ended;
                  return (
                    <div key={term.id} style={{
                      position: 'absolute', left: `${pos.left}%`, width: `${pos.width}%`,
                      height: '100%', background: sc.color, opacity: 0.85, borderRadius: 3,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <span style={{ fontSize: 9, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', padding: '0 4px' }}>
                        {term.name}
                      </span>
                    </div>
                  );
                })}
                {/* Today marker */}
                {(() => {
                  const pos = termProgress({ start_date: yearTerms.map(t => t.start_date).filter(Boolean).sort()[0], end_date: new Date().toISOString().slice(0,10) }, yearTerms);
                  if (!pos) return null;
                  const todayPct = termProgress({ start_date: yearTerms.map(t => t.start_date).filter(Boolean).sort()[0], end_date: yearTerms.map(t => t.end_date).filter(Boolean).sort().slice(-1)[0] }, yearTerms);
                  const allStarts = yearTerms.map(t => t.start_date).filter(Boolean).sort();
                  const allEnds   = yearTerms.map(t => t.end_date).filter(Boolean).sort();
                  const yearStart = new Date(allStarts[0]);
                  const yearEnd   = new Date(allEnds[allEnds.length - 1]);
                  const pct = Math.max(0, Math.min(100, ((new Date() - yearStart) / (yearEnd - yearStart)) * 100));
                  return (
                    <div style={{ position: 'absolute', left: `${pct}%`, top: 0, bottom: 0, width: 2, background: '#dc2626', zIndex: 2 }} title="Today" />
                  );
                })()}
              </div>
            )}

            {/* Add term inline form */}
            {addingToYear === year && (
              <div style={{ marginBottom: 12 }}>
                <TermEditForm
                  onSave={() => { setAddingToYear(null); load(); }}
                  onCancel={() => setAddingToYear(null)}
                />
              </div>
            )}

            {/* Terms list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {yearTerms.map(term => {
                const sc = STATUS_STYLE[term.status] || STATUS_STYLE.ended;
                const isEditing = editId === term.id;
                const isBusy = busy === term.id;
                if (isEditing) {
                  return (
                    <TermEditForm key={term.id} term={term}
                      onSave={() => { setEditId(null); load(); }}
                      onCancel={() => setEditId(null)}
                    />
                  );
                }
                return (
                  <div key={term.id} style={{
                    display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
                    padding: '10px 14px', background: term.status === 'active' ? '#f0fdf4' : '#fff',
                    border: `1px solid ${term.status === 'active' ? '#4ade80' : '#e5e7eb'}`,
                    borderLeft: `4px solid ${sc.color}`, borderRadius: 6,
                  }}>
                    {/* Term number */}
                    <div style={{ width: 24, height: 24, borderRadius: '50%', background: sc.color, color: '#fff', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {term.term_number}
                    </div>

                    {/* Name + dates */}
                    <div style={{ flex: 1, minWidth: 160 }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{term.name}</div>
                      <div style={{ fontSize: 12, color: '#6b7280', marginTop: 1 }}>
                        {fmt(term.start_date)} → {fmt(term.end_date)}
                        {term.status === 'active' && term.end_date && (
                          <span style={{ marginLeft: 8, color: '#16a34a', fontWeight: 600 }}>
                            ({daysLeft(term.end_date)} days left)
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Status chip */}
                    <span style={{ background: sc.bg, color: sc.color, padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600, flexShrink: 0 }}>
                      {sc.label}
                    </span>

                    {/* Actions */}
                    {canManage && (
                      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                        {term.status === 'upcoming' && (
                          <button className="btn btn-sm btn-primary" onClick={() => activate(term)} disabled={isBusy}
                            style={{ fontSize: 11 }}>
                            {isBusy ? '…' : 'Activate'}
                          </button>
                        )}
                        {term.status === 'active' && (
                          <button className="btn btn-sm btn-secondary" onClick={() => closeTerm(term)} disabled={isBusy}
                            style={{ fontSize: 11, borderColor: '#dc2626', color: '#dc2626' }}>
                            {isBusy ? '…' : 'Close Term'}
                          </button>
                        )}
                        {(term.status === 'ended' || term.status === 'inactive') && (
                          <button className="btn btn-sm btn-secondary" onClick={() => activate(term)} disabled={isBusy}
                            style={{ fontSize: 11 }}>
                            {isBusy ? '…' : 'Re-activate'}
                          </button>
                        )}
                        <button className="btn btn-sm btn-secondary" onClick={() => setEditId(term.id)} style={{ fontSize: 11 }}>
                          Edit
                        </button>
                        <button className="btn btn-sm btn-secondary" onClick={() => archiveTerm(term)} disabled={isBusy}
                          style={{ fontSize: 11 }}>
                          Archive
                        </button>
                        {term.status !== 'active' && (
                          <button className="btn btn-sm btn-danger" onClick={() => deleteTerm(term)} style={{ fontSize: 11 }}>
                            Delete
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
