import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';

const empty = { name: '', order_num: '', is_special: false, class_fee: '' };

export default function Classes() {
  const navigate = useNavigate();
  const [classes, setClasses] = useState([]);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function load() {
    try { const d = await api.get('/classes'); setClasses(Array.isArray(d) ? d : []); } catch {}
  }
  useEffect(() => { load(); }, []);

  function openAdd()  { setForm(empty); setEditId(null); setError(''); setShowForm(true); }
  function openEdit(c) { setForm({ name: c.name, order_num: c.order_num ?? '', is_special: !!c.is_special, class_fee: c.class_fee ?? '' }); setEditId(c.id); setError(''); setShowForm(true); }

  async function save(e) {
    e.preventDefault(); setSaving(true); setError('');
    const payload = {
      name: form.name,
      order_num: form.order_num !== '' ? Number(form.order_num) : undefined,
      is_special: form.is_special,
      class_fee: form.is_special && form.class_fee !== '' ? parseFloat(form.class_fee) : 0,
    };
    try {
      if (editId) await api.put(`/classes/${editId}`, payload);
      else        await api.post('/classes', payload);
      setShowForm(false); load();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  async function del(id) {
    if (!confirm('Delete this class? This fails if active students are enrolled.')) return;
    try { await api.delete(`/classes/${id}`); load(); }
    catch (err) { alert(err.message); }
  }

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div className="page-title" style={{ marginBottom: 0 }}>Classes</div>
        <button className="btn btn-primary" onClick={openAdd}>+ Add Class</button>
      </div>

      {showForm && (
        <div className="panel" style={{ marginBottom: 16 }}>
          <div className="panel-header">
            <h3>{editId ? 'Edit Class' : 'Add Class'}</h3>
            <button className="btn btn-sm btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
          {error && <div className="alert alert-error">{error}</div>}
          <form onSubmit={save}>
            <div className="form-row">
              <div className="form-group">
                <label>Class Name *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required placeholder="e.g. Class 3B" />
              </div>
              <div className="form-group">
                <label>Order</label>
                <input type="number" min="1" value={form.order_num} onChange={e => setForm(f => ({ ...f, order_num: e.target.value }))} placeholder="e.g. 3" />
              </div>
              <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <label style={{ marginBottom: 0, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input type="checkbox" checked={form.is_special} onChange={e => setForm(f => ({ ...f, is_special: e.target.checked, class_fee: e.target.checked ? f.class_fee : '' }))} />
                  Special / Extra Class
                </label>
              </div>
              {form.is_special && (
                <div className="form-group">
                  <label>Session Fee (GH₵)</label>
                  <input type="number" step="0.01" min="0" value={form.class_fee} onChange={e => setForm(f => ({ ...f, class_fee: e.target.value }))} placeholder="e.g. 50.00" />
                </div>
              )}
            </div>
            <button className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
          </form>
        </div>
      )}

      <table>
        <thead>
          <tr><th>Name</th><th>Order</th><th>Type</th><th>Session Fee</th><th>Students</th><th>Actions</th></tr>
        </thead>
        <tbody>
          {classes.map(c => (
            <tr key={c.id}>
              <td style={{ fontWeight: 500 }}>{c.name}</td>
              <td>{c.order_num ?? '—'}</td>
              <td>
                {c.is_special
                  ? <span style={{ background: '#fef3c7', color: '#92400e', borderRadius: 12, padding: '2px 10px', fontSize: 12, fontWeight: 600 }}>Special</span>
                  : <span style={{ color: '#9ca3af', fontSize: 12 }}>Regular</span>}
              </td>
              <td>{c.is_special && parseFloat(c.class_fee || 0) > 0 ? `GH₵${parseFloat(c.class_fee).toLocaleString('en-GH', { minimumFractionDigits: 2 })}` : '—'}</td>
              <td>
                <button className="btn btn-sm btn-secondary" onClick={() => navigate(`/students?class_id=${c.id}`)}>
                  {c.student_count} student{c.student_count !== 1 ? 's' : ''} →
                </button>
              </td>
              <td style={{ display: 'flex', gap: 6 }}>
                <button className="btn btn-sm btn-secondary" onClick={() => openEdit(c)}>Edit</button>
                <button className="btn btn-sm btn-danger" onClick={() => del(c.id)}>Delete</button>
              </td>
            </tr>
          ))}
          {classes.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', color: '#888', padding: 24 }}>No classes yet.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
