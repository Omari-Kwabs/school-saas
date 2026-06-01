import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { roleLabel } from '../utils/access';

const TABS = ['Inbox', 'Sent', 'Compose'];

const emptyForm = { to_id: '', subject: '', body: '', cc_ids: [] };

export default function Memos() {
  const [tab, setTab]         = useState('Inbox');
  const [inbox, setInbox]     = useState([]);
  const [sent, setSent]       = useState([]);
  const [staff, setStaff]     = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);
  const [form, setForm]       = useState(emptyForm);
  const [sending, setSending] = useState(false);
  const [msg, setMsg]         = useState('');

  useEffect(() => {
    loadStaff();
    loadInbox();
    loadSent();
  }, []);

  async function loadInbox() {
    setLoading(true);
    try {
      const d = await api.get('/memos/inbox');
      setInbox(Array.isArray(d) ? d : []);
    } catch {}
    setLoading(false);
  }

  async function loadSent() {
    try {
      const d = await api.get('/memos/sent');
      setSent(Array.isArray(d) ? d : []);
    } catch {}
  }

  async function loadStaff() {
    try {
      const d = await api.get('/memos/staff');
      setStaff(Array.isArray(d) ? d : []);
    } catch {}
  }

  async function openMemo(m) {
    setSelected(m);
    if (!m.read_at) {
      try {
        await api.put(`/memos/${m.id}/read`, {});
        setInbox(prev => prev.map(x => x.id === m.id ? { ...x, read_at: new Date().toISOString() } : x));
      } catch {}
    }
  }

  async function send(e) {
    e.preventDefault();
    setSending(true); setMsg('');
    try {
      await api.post('/memos', form);
      setMsg('Memo sent.');
      setForm(emptyForm);
      loadSent();
      setTab('Sent');
      setTimeout(() => setMsg(''), 3000);
    } catch (err) { setMsg(err.message || 'Failed to send'); }
    finally { setSending(false); }
  }

  function toggleCC(id) {
    setForm(f => ({
      ...f,
      cc_ids: f.cc_ids.includes(id) ? f.cc_ids.filter(x => x !== id) : [...f.cc_ids, id],
    }));
  }

  const unread = inbox.filter(m => !m.read_at).length;

  return (
    <div className="page">
      <div className="page-title">Memos</div>

      {/* Tab bar */}
      <div style={{ display: 'flex', borderBottom: '2px solid #e0e0e0', marginBottom: 20 }}>
        {TABS.map(t => (
          <button key={t} onClick={() => { setTab(t); setSelected(null); }}
            style={{ padding: '8px 22px', border: 'none', background: 'none', cursor: 'pointer',
                     fontWeight: tab === t ? 700 : 400, fontSize: 14,
                     color: tab === t ? '#1a73e8' : '#555',
                     borderBottom: tab === t ? '2px solid #1a73e8' : '2px solid transparent',
                     marginBottom: -2 }}>
            {t}
            {t === 'Inbox' && unread > 0 && (
              <span style={{ marginLeft: 7, background: '#e74c3c', color: '#fff',
                             borderRadius: 10, padding: '1px 7px', fontSize: 11 }}>
                {unread}
              </span>
            )}
          </button>
        ))}
      </div>

      {msg && (
        <div className={`alert ${msg.includes('sent') ? 'alert-success' : 'alert-error'}`}
          style={{ marginBottom: 14 }}>
          {msg}
        </div>
      )}

      {/* ── INBOX ── */}
      {tab === 'Inbox' && !selected && (
        loading
          ? <p style={{ color: '#888' }}>Loading…</p>
          : inbox.length === 0
            ? <p style={{ color: '#888', textAlign: 'center', paddingTop: 40 }}>Your inbox is empty.</p>
            : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {inbox.map(m => (
                  <div key={m.id} onClick={() => openMemo(m)}
                    style={{ background: '#fff', borderRadius: 8, padding: '12px 18px',
                             cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                             borderLeft: `4px solid ${m.read_at ? '#ddd' : '#1a73e8'}`,
                             display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                             gap: 12 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: m.read_at ? 400 : 700, fontSize: 14,
                                   whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {m.subject}
                      </div>
                      <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
                        From: {m.from_name}
                        {m.is_cc && (
                          <span style={{ marginLeft: 8, color: '#8e44ad', fontWeight: 600 }}>CC</span>
                        )}
                      </div>
                    </div>
                    <div style={{ fontSize: 11, color: '#aaa', flexShrink: 0 }}>
                      {new Date(m.created_at).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            )
      )}

      {/* ── OPEN MEMO (Inbox detail) ── */}
      {tab === 'Inbox' && selected && (
        <div>
          <button className="btn btn-sm btn-secondary" onClick={() => setSelected(null)}
            style={{ marginBottom: 16 }}>
            ← Back to Inbox
          </button>
          <div className="panel">
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 8 }}>{selected.subject}</div>
              <div style={{ fontSize: 12, color: '#888' }}>
                From: <strong>{selected.from_name}</strong>
                &nbsp;·&nbsp;{new Date(selected.created_at).toLocaleString()}
              </div>
              {selected.is_cc && (
                <div style={{ fontSize: 12, color: '#8e44ad', marginTop: 4 }}>
                  You were copied (CC) on this memo.
                </div>
              )}
              {selected.cc_list?.length > 0 && (
                <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
                  CC: {selected.cc_list.map(c => c.name).join(', ')}
                </div>
              )}
            </div>
            <hr style={{ border: 'none', borderTop: '1px solid #eee', margin: '14px 0' }} />
            <p style={{ fontSize: 14, lineHeight: 1.8, whiteSpace: 'pre-wrap', color: '#333', margin: 0 }}>
              {selected.body || <em style={{ color: '#aaa' }}>No body.</em>}
            </p>
          </div>
        </div>
      )}

      {/* ── SENT ── */}
      {tab === 'Sent' && (
        sent.length === 0
          ? <p style={{ color: '#888', textAlign: 'center', paddingTop: 40 }}>No sent memos.</p>
          : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {sent.map(m => (
                <div key={m.id}
                  style={{ background: '#fff', borderRadius: 8, padding: '12px 18px',
                           boxShadow: '0 1px 3px rgba(0,0,0,0.08)', borderLeft: '4px solid #27ae60',
                           display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 500, fontSize: 14,
                                 whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {m.subject}
                    </div>
                    <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
                      To: {m.to_name}
                      {m.cc_list?.length > 0 && (
                        <> &nbsp;·&nbsp; CC: {m.cc_list.map(c => c.name).join(', ')}</>
                      )}
                      {m.read_at && (
                        <span style={{ marginLeft: 10, color: '#27ae60' }}>✓ Read</span>
                      )}
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: '#aaa', flexShrink: 0 }}>
                    {new Date(m.created_at).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          )
      )}

      {/* ── COMPOSE ── */}
      {tab === 'Compose' && (
        <div className="panel" style={{ maxWidth: 620 }}>
          <form onSubmit={send}>
            <div className="form-group">
              <label>To *</label>
              <select value={form.to_id}
                onChange={e => setForm(f => ({ ...f, to_id: e.target.value, cc_ids: f.cc_ids.filter(id => id !== e.target.value) }))}
                required>
                <option value="">— Select recipient —</option>
                {staff.map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({roleLabel(s.role)})</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>
                CC&nbsp;
                <span style={{ fontWeight: 400, color: '#888', fontSize: 12 }}>(optional)</span>
              </label>
              <div style={{ maxHeight: 150, overflowY: 'auto', border: '1px solid #ddd',
                           borderRadius: 6, padding: '6px 12px' }}>
                {staff.filter(s => s.id !== form.to_id).map(s => (
                  <label key={s.id}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0',
                             cursor: 'pointer', fontSize: 13 }}>
                    <input type="checkbox"
                      checked={form.cc_ids.includes(s.id)}
                      onChange={() => toggleCC(s.id)} />
                    {s.name}
                    <span style={{ color: '#aaa', fontSize: 11 }}>({roleLabel(s.role)})</span>
                  </label>
                ))}
                {staff.length === 0 && (
                  <p style={{ color: '#aaa', fontSize: 13, margin: 4 }}>No other staff members.</p>
                )}
              </div>
            </div>

            <div className="form-group">
              <label>Subject *</label>
              <input value={form.subject}
                onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                required placeholder="Memo subject" />
            </div>

            <div className="form-group">
              <label>Body</label>
              <textarea rows={7} value={form.body}
                onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
                style={{ width: '100%', padding: 10, border: '1px solid #ddd',
                         borderRadius: 6, fontSize: 13, resize: 'vertical' }}
                placeholder="Memo content…" />
            </div>

            <button className="btn btn-primary" disabled={sending}>
              {sending ? 'Sending…' : 'Send Memo'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
