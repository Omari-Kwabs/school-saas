import React, { useState, useEffect } from 'react';
import { api } from '../api';

const TYPES = ['AfL', 'AaL', 'AoL'];
const empty = { title: '', type: 'AoL', subject_id: '', class_id: '', term_id: '', max_score: '100', format: '' };

export default function Assessments() {
  const [assessments, setAssessments] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [classes, setClasses] = useState([]);
  const [terms, setTerms] = useState([]);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      const [a, s, c, t] = await Promise.all([
        api.get('/assessments'),
        api.get('/subjects'),
        api.get('/classes'),
        api.get('/terms'),
      ]);
      setAssessments(Array.isArray(a) ? a : []);
      setSubjects(Array.isArray(s) ? s : []);
      setClasses(Array.isArray(c) ? c : []);
      setTerms(Array.isArray(t) ? t : []);
    } catch {}
  }
  useEffect(() => { load(); }, []);

  function handle(e) { setForm(f => ({ ...f, [e.target.name]: e.target.value })); }
  function openAdd()  { setForm(empty); setEditId(null); setError(''); setShowForm(true); }
  function openEdit(a) {
    setForm({ title: a.title, type: a.type, subject_id: a.subject_id || '', class_id: a.class_id || '',
              term_id: a.term_id || '', max_score: a.max_score ?? '100', format: a.format || '' });
    setEditId(a.id); setError(''); setShowForm(true);
  }

  async function save(e) {
    e.preventDefault(); setSaving(true); setError('');
    const payload = {
      title: form.title, type: form.type,
      subject_id: form.subject_id || undefined,
      class_id:   form.class_id   || undefined,
      term_id:    form.term_id    || undefined,
      max_score:  form.max_score  !== '' ? Number(form.max_score) : undefined,
      format:     form.format     || undefined,
    };
    try {
      if (editId) await api.put(`/assessments/${editId}`, payload);
      else        await api.post('/assessments', payload);
      setShowForm(false); load();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  async function del(id) {
    if (!confirm('Delete this assessment?')) return;
    try { await api.delete(`/assessments/${id}`); load(); } catch (err) { alert(err.message); }
  }

  const filtered = assessments.filter(a => {
    const q = search.toLowerCase();
    return (!q || a.title.toLowerCase().includes(q) || (a.subject_name || '').toLowerCase().includes(q))
      && (!filterType || a.type === filterType);
  });

  const typeLabel = { AfL: 'For Learning', AaL: 'As Learning', AoL: 'Of Learning' };

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div className="page-title" style={{ marginBottom: 0 }}>Assessments</div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <input placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} style={{ padding: '7px 12px', border: '1px solid #ddd', borderRadius: 6, fontSize: 13, minWidth: 160 }} />
          <select value={filterType} onChange={e => setFilterType(e.target.value)} style={{ padding: '7px 10px', border: '1px solid #ddd', borderRadius: 6, fontSize: 13 }}>
            <option value="">All Types</option>
            {TYPES.map(t => <option key={t} value={t}>{t} — {typeLabel[t]}</option>)}
          </select>
          <button className="btn btn-primary" onClick={openAdd}>+ Add Assessment</button>
        </div>
      </div>

      {showForm && (
        <div className="panel" style={{ marginBottom: 16 }}>
          <div className="panel-header">
            <h3>{editId ? 'Edit Assessment' : 'New Assessment'}</h3>
            <button className="btn btn-sm btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
          {error && <div className="alert alert-error">{error}</div>}
          <form onSubmit={save}>
            <div className="form-row">
              <div className="form-group" style={{ flex: '2 1 200px' }}>
                <label>Title *</label>
                <input name="title" value={form.title} onChange={handle} required placeholder="e.g. Term 1 Maths Test" />
              </div>
              <div className="form-group">
                <label>Type *</label>
                <select name="type" value={form.type} onChange={handle}>
                  {TYPES.map(t => <option key={t} value={t}>{t} — {typeLabel[t]}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Max Score</label>
                <input name="max_score" type="number" min="1" value={form.max_score} onChange={handle} />
              </div>
              <div className="form-group">
                <label>Subject</label>
                <select name="subject_id" value={form.subject_id} onChange={handle}>
                  <option value="">— Any —</option>
                  {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Class</label>
                <select name="class_id" value={form.class_id} onChange={handle}>
                  <option value="">— Any —</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Term</label>
                <select name="term_id" value={form.term_id} onChange={handle}>
                  <option value="">— Any —</option>
                  {terms.map(t => <option key={t.id} value={t.id}>{t.name}{t.is_current ? ' (current)' : ''}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Format</label>
                <input name="format" value={form.format} onChange={handle} placeholder="e.g. written, oral" />
              </div>
            </div>
            <button className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
          </form>
        </div>
      )}

      <table>
        <thead>
          <tr><th>Title</th><th>Type</th><th>Subject</th><th>Class</th><th>Term</th><th>Max</th><th>Actions</th></tr>
        </thead>
        <tbody>
          {filtered.map(a => {
            const typeColor = a.type === 'AoL' ? '#e74c3c' : a.type === 'AfL' ? '#27ae60' : '#e67e22';
            return (
              <tr key={a.id}>
                <td style={{ fontWeight: 500 }}>{a.title}</td>
                <td><span style={{ fontSize: 11, fontWeight: 700, color: typeColor, background: typeColor + '18', padding: '2px 8px', borderRadius: 12 }}>{a.type}</span></td>
                <td>{a.subject_name || '—'}</td>
                <td>{a.class_name  || '—'}</td>
                <td>{a.term_name   || '—'}</td>
                <td>{a.max_score ?? '—'}</td>
                <td style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn-sm btn-secondary" onClick={() => openEdit(a)}>Edit</button>
                  <button className="btn btn-sm btn-danger"    onClick={() => del(a.id)}>Delete</button>
                </td>
              </tr>
            );
          })}
          {filtered.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', color: '#888', padding: 24 }}>No assessments found.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
