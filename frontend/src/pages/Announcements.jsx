import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

const AUDIENCE_META = {
  all:      { label: 'All Staff',        color: '#1a73e8' },
  staff:    { label: 'Staff Only',       color: '#8e44ad' },
  teachers: { label: 'Teachers',         color: '#16a085' },
  heads:    { label: 'Heads / Leaders',  color: '#d35400' },
  students: { label: 'For Students',     color: '#27ae60' },
};

// Audiences each role is allowed to post to
function postableAudiences(role) {
  if (['owner','headmaster_admin','headmaster_academics'].includes(role))
    return ['all','staff','teachers','heads','students'];
  if (role === 'department_head')
    return ['teachers','heads'];
  if (['teacher','class_teacher'].includes(role))
    return ['students'];
  return [];
}

const empty = { title: '', body: '', audience: '', expires_at: '' };

export default function Announcements() {
  const { user } = useAuth();
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState(empty);
  const [editId, setEditId]     = useState(null);
  const [error, setError]       = useState('');
  const [saving, setSaving]     = useState(false);

  const allowed   = postableAudiences(user?.role);
  const canPost   = allowed.length > 0;
  // Admins use /all to see everything including archived; others see only active
  const isAdmin   = ['owner','headmaster_admin','headmaster_academics'].includes(user?.role);

  async function load() {
    try {
      const endpoint = isAdmin ? '/announcements/all' : '/announcements';
      const d = await api.get(endpoint);
      setAnnouncements(Array.isArray(d) ? d : []);
    } catch {}
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  function handle(e) { setForm(f => ({ ...f, [e.target.name]: e.target.value })); }

  function openAdd() {
    setForm({ ...empty, audience: allowed[0] || '' });
    setEditId(null); setError(''); setShowForm(true);
  }

  function openEdit(a) {
    setForm({ title: a.title, body: a.body || '', audience: a.audience,
              expires_at: a.expires_at ? a.expires_at.slice(0, 10) : '' });
    setEditId(a.id); setError(''); setShowForm(true);
  }

  async function save(e) {
    e.preventDefault(); setSaving(true); setError('');
    const payload = {
      title: form.title, body: form.body || undefined,
      audience: form.audience, expires_at: form.expires_at || undefined,
      ...(editId ? { is_active: true } : {}),
    };
    try {
      if (editId) await api.put(`/announcements/${editId}`, payload);
      else        await api.post('/announcements', payload);
      setShowForm(false); load();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  async function archive(id) {
    try {
      await api.put(`/announcements/${id}`, {
        is_active: false,
        title: announcements.find(a => a.id === id)?.title,
      });
      load();
    } catch {}
  }

  async function del(id) {
    if (!confirm('Delete this announcement?')) return;
    try { await api.delete(`/announcements/${id}`); load(); } catch {}
  }

  if (loading) return <div className="page" style={{ color: '#888', paddingTop: 60, textAlign: 'center' }}>Loading…</div>;

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div className="page-title" style={{ marginBottom: 0 }}>Announcements</div>
        {canPost && <button className="btn btn-primary" onClick={openAdd}>+ Post Announcement</button>}
      </div>

      {showForm && (
        <div className="panel" style={{ marginBottom: 20 }}>
          <div className="panel-header">
            <h3>{editId ? 'Edit Announcement' : 'New Announcement'}</h3>
            <button className="btn btn-sm btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
          {error && <div className="alert alert-error">{error}</div>}
          <form onSubmit={save}>
            <div className="form-group">
              <label>Title *</label>
              <input name="title" value={form.title} onChange={handle} required placeholder="Announcement title" />
            </div>
            <div className="form-group">
              <label>Body</label>
              <textarea name="body" rows={4} value={form.body} onChange={handle}
                style={{ width: '100%', padding: 10, border: '1px solid #ddd', borderRadius: 6, fontSize: 13, resize: 'vertical' }}
                placeholder="Full message text…" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label>Audience</label>
                <select name="audience" value={form.audience} onChange={handle}>
                  {allowed.map(a => (
                    <option key={a} value={a}>{AUDIENCE_META[a]?.label || a}</option>
                  ))}
                </select>
                {form.audience === 'students' && (
                  <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>
                    Teachers will relay this to their classes.
                  </div>
                )}
                {form.audience === 'teachers' && user?.role === 'department_head' && (
                  <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>
                    Visible to all teachers in the school.
                  </div>
                )}
              </div>
              <div className="form-group">
                <label>Expires (optional)</label>
                <input name="expires_at" type="date" value={form.expires_at} onChange={handle} />
              </div>
            </div>
            <button className="btn btn-primary" disabled={saving}>{saving ? 'Posting…' : 'Post'}</button>
          </form>
        </div>
      )}

      {announcements.length === 0 && (
        <p style={{ color: '#888', textAlign: 'center', paddingTop: 40 }}>No announcements.</p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {announcements.map(a => {
          const meta    = AUDIENCE_META[a.audience] || { label: a.audience, color: '#888' };
          const expired = a.expires_at && new Date(a.expires_at) < new Date();
          const active  = a.is_active && !expired;
          return (
            <div key={a.id} style={{ background: '#fff', borderRadius: 8, padding: '16px 20px',
                                      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                                      borderLeft: `4px solid ${active ? meta.color : '#ddd'}`,
                                      opacity: active ? 1 : 0.6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, fontSize: 15 }}>{a.title}</span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: meta.color,
                                   background: meta.color + '18', padding: '2px 8px', borderRadius: 10 }}>
                      {meta.label}
                    </span>
                    {!a.is_active && (
                      <span style={{ fontSize: 11, color: '#999', background: '#f0f0f0', padding: '2px 8px', borderRadius: 10 }}>Archived</span>
                    )}
                    {expired && a.is_active && (
                      <span style={{ fontSize: 11, color: '#e74c3c', background: '#fdecea', padding: '2px 8px', borderRadius: 10 }}>Expired</span>
                    )}
                  </div>
                  {a.body && (
                    <p style={{ fontSize: 13, color: '#444', margin: '0 0 8px', lineHeight: 1.6 }}>{a.body}</p>
                  )}
                  <div style={{ fontSize: 11, color: '#aaa' }}>
                    Posted by {a.posted_by_name || 'Unknown'} · {new Date(a.created_at).toLocaleDateString()}
                    {a.expires_at && <> · Expires {new Date(a.expires_at).toLocaleDateString()}</>}
                  </div>
                </div>
                {canPost && (
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button className="btn btn-sm btn-secondary" onClick={() => openEdit(a)}>Edit</button>
                    {active && (
                      <button className="btn btn-sm" style={{ border: '1px solid #e67e22', color: '#e67e22', background: 'none' }}
                        onClick={() => archive(a.id)}>Archive</button>
                    )}
                    {user.role === 'owner' && (
                      <button className="btn btn-sm btn-danger" onClick={() => del(a.id)}>Delete</button>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
