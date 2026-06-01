import React, { useEffect, useState, useCallback } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { roleLabel } from '../utils/access';

// ── Tier display helpers ───────────────────────────────────────────────────────
const CLASS_TEACHER_ROLES = ['teacher', 'class_teacher'];
const HEADMASTER_ROLES    = ['headmaster_academics', 'headmaster_admin', 'owner'];

function tierForRole(role) {
  if (CLASS_TEACHER_ROLES.includes(role)) return 'class_teacher';
  if (HEADMASTER_ROLES.includes(role))    return 'headmaster';
  return null;
}

const TIER_LABELS = {
  class_teacher: 'Class Teacher Tier',
  headmaster:    'Headmaster Tier',
};

function formatDate(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function Approvals() {
  const { user } = useAuth();
  const role     = user?.role || '';
  const tier     = tierForRole(role);

  const [items,        setItems]        = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState('');
  const [msg,          setMsg]          = useState('');
  const [selected,     setSelected]     = useState(new Set());
  const [approved,     setApproved]     = useState({}); // id -> {approved_at, approver_name}
  const [working,      setWorking]      = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.get('/approvals/pending');
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Failed to load pending approvals.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    document.title = 'Approvals — SchoolSaaS';
    load();
    api.get('/profile/me')
      .then(d => setHasSignature(Boolean(d?.signature_data)))
      .catch(() => {});
  }, [load]);

  // ── Selection ────────────────────────────────────────────────────────────────
  const pendingIds = items.filter(i => !approved[i.id]).map(i => i.id);
  const allSelected = pendingIds.length > 0 && pendingIds.every(id => selected.has(id));

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(pendingIds));
    }
  }

  function toggleOne(id) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // ── Single approve ───────────────────────────────────────────────────────────
  async function approveOne(id) {
    setWorking(true);
    setMsg('');
    try {
      await api.post(`/approvals/${id}/approve`, {});
      setApproved(prev => ({ ...prev, [id]: { approved_at: new Date().toISOString(), approver_name: user?.name } }));
      setSelected(prev => { const next = new Set(prev); next.delete(id); return next; });
      setMsg('Approved successfully.');
      setTimeout(() => setMsg(''), 3000);
    } catch (err) {
      setMsg(err.message || 'Failed to approve.');
    } finally {
      setWorking(false);
    }
  }

  // ── Bulk approve ─────────────────────────────────────────────────────────────
  async function approveSelected() {
    if (!selected.size) return;
    setWorking(true);
    setMsg('');
    try {
      const ids = Array.from(selected);
      const res = await api.post('/approvals/bulk-approve', { ids });
      const now = new Date().toISOString();
      setApproved(prev => {
        const next = { ...prev };
        ids.forEach(id => { next[id] = { approved_at: now, approver_name: user?.name }; });
        return next;
      });
      setSelected(new Set());
      setMsg(`Approved ${res.approved} item(s). Skipped: ${res.skipped}.`);
      setTimeout(() => setMsg(''), 4000);
    } catch (err) {
      setMsg(err.message || 'Bulk approve failed.');
    } finally {
      setWorking(false);
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  const selectedCount = selected.size;

  return (
    <div className="page">
      <div className="page-title">Document Approvals</div>

      {/* Subtitle — role + tier info */}
      <div style={{ marginBottom: 16, color: '#6b7280', fontSize: 14 }}>
        Your role: <strong style={{ color: '#374151' }}>{roleLabel(role)}</strong>
        {tier
          ? <> — you can approve the <strong style={{ color: '#2563eb' }}>{TIER_LABELS[tier]}</strong></>
          : <> — your role has no approval tier</>
        }
      </div>

      {/* No-signature warning */}
      {!hasSignature && (
        <div style={{
          background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 8,
          padding: '12px 16px', marginBottom: 16, fontSize: 13, color: '#92400e',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
            strokeWidth={1.5} stroke="currentColor" style={{ width: 20, height: 20, flexShrink: 0 }}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          <span>
            You haven't set your digital signature yet. Go to <strong>Profile &rarr; Digital Authority Stamp</strong> to set it before you can approve.
          </span>
        </div>
      )}

      {/* Messages */}
      {msg && (
        <div className={`alert ${msg.toLowerCase().includes('fail') || msg.toLowerCase().includes('error') ? 'alert-error' : 'alert-success'}`}
          style={{ marginBottom: 14 }}>
          {msg}
        </div>
      )}
      {error && <div className="alert alert-error" style={{ marginBottom: 14 }}>{error}</div>}

      {/* Bulk action toolbar */}
      {selectedCount > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, background: '#eff6ff',
          border: '1px solid #bfdbfe', borderRadius: 8, padding: '10px 16px', marginBottom: 14,
        }}>
          <span style={{ fontSize: 13, color: '#1d4ed8', fontWeight: 600 }}>
            {selectedCount} item{selectedCount !== 1 ? 's' : ''} selected
          </span>
          <button
            onClick={approveSelected}
            disabled={working || !hasSignature}
            style={{
              padding: '6px 18px', background: '#16a34a', color: '#fff',
              border: 'none', borderRadius: 6, fontWeight: 700, fontSize: 13,
              cursor: working || !hasSignature ? 'not-allowed' : 'pointer',
              opacity: working || !hasSignature ? 0.6 : 1,
            }}
          >
            {working ? 'Approving…' : `Approve Selected (${selectedCount})`}
          </button>
          <button
            onClick={() => setSelected(new Set())}
            style={{
              padding: '6px 14px', background: 'transparent',
              border: '1px solid #bfdbfe', borderRadius: 6,
              fontSize: 13, cursor: 'pointer', color: '#6b7280',
            }}
          >
            Clear
          </button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#9ca3af' }}>
          Loading approvals…
        </div>
      )}

      {/* Approvals table */}
      {!loading && items.length === 0 && (
        <div style={{
          textAlign: 'center', padding: '48px 0', color: '#9ca3af',
          background: '#f9fafb', borderRadius: 12, border: '1px dashed #e5e7eb',
        }}>
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
            strokeWidth={1.5} stroke="currentColor"
            style={{ width: 40, height: 40, marginBottom: 12, color: '#d1d5db' }}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div style={{ fontSize: 15, fontWeight: 600 }}>No approvals pending for your role.</div>
          <div style={{ fontSize: 13, marginTop: 4 }}>All documents have been approved or none have been requested yet.</div>
        </div>
      )}

      {!loading && items.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#1e293b', color: '#fff' }}>
                <th style={{ padding: '10px 12px', textAlign: 'center', width: 40 }}>
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    style={{ cursor: 'pointer', width: 15, height: 15 }}
                  />
                </th>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.5px' }}>Student</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.5px' }}>Class</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.5px' }}>Term</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.5px' }}>Document</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.5px' }}>Requested By</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.5px' }}>Requested</th>
                <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.5px' }}>Status / Action</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => {
                const isApproved = Boolean(approved[item.id]);
                const approvalInfo = approved[item.id];
                const isChecked = selected.has(item.id);
                const even = i % 2 === 0;

                return (
                  <tr
                    key={item.id}
                    style={{
                      background: isApproved ? '#f0fdf4' : even ? '#fff' : '#f9fafb',
                      borderBottom: '1px solid #f0f0f0',
                      transition: 'background .2s',
                    }}
                  >
                    {/* Checkbox */}
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                      {!isApproved && (
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleOne(item.id)}
                          style={{ cursor: 'pointer', width: 15, height: 15 }}
                        />
                      )}
                    </td>

                    {/* Student name */}
                    <td style={{ padding: '10px 12px', fontWeight: 600, color: '#1a1a2e' }}>
                      {item.student_name || '—'}
                    </td>

                    {/* Class */}
                    <td style={{ padding: '10px 12px', color: '#374151' }}>
                      {item.class_name || '—'}
                    </td>

                    {/* Term */}
                    <td style={{ padding: '10px 12px', color: '#374151' }}>
                      {item.term_name || '—'}
                    </td>

                    {/* Document type */}
                    <td style={{ padding: '10px 12px', color: '#6b7280', textTransform: 'capitalize' }}>
                      {(item.document_type || 'report_card').replace(/_/g, ' ')}
                    </td>

                    {/* Requested by */}
                    <td style={{ padding: '10px 12px', color: '#6b7280' }}>
                      {item.requested_by_name || '—'}
                    </td>

                    {/* Requested at */}
                    <td style={{ padding: '10px 12px', color: '#9ca3af', fontSize: 12 }}>
                      {formatDate(item.requested_at)}
                    </td>

                    {/* Status / Action */}
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                      {isApproved ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            background: '#dcfce7', color: '#166534',
                            padding: '3px 10px', borderRadius: 20,
                            fontWeight: 700, fontSize: 12,
                          }}>
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                              strokeWidth={2.5} stroke="currentColor" style={{ width: 12, height: 12 }}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                            </svg>
                            Approved
                          </span>
                          <span style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
                            {formatDate(approvalInfo.approved_at)}
                          </span>
                        </div>
                      ) : (
                        <button
                          onClick={() => approveOne(item.id)}
                          disabled={working || !hasSignature}
                          style={{
                            padding: '5px 16px', background: '#2563eb', color: '#fff',
                            border: 'none', borderRadius: 6, fontWeight: 600, fontSize: 12,
                            cursor: working || !hasSignature ? 'not-allowed' : 'pointer',
                            opacity: working || !hasSignature ? 0.6 : 1,
                          }}
                        >
                          Approve
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
