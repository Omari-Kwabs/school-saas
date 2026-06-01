import React, { useEffect, useState, useCallback } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

function fmt(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GH', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GH', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtMoney(n) {
  if (n == null) return '—';
  return `GH₵${Number(n).toLocaleString('en-GH', { minimumFractionDigits: 2 })}`;
}

const TYPE_LABELS = {
  class: 'Class',
  expense: 'Expense',
  fee_structure: 'Fee Structure',
  announcement: 'Announcement',
  student: 'Student',
  user: 'Staff Account',
};

const TYPE_COLORS = {
  class: 'bg-blue-100 text-blue-800',
  expense: 'bg-orange-100 text-orange-800',
  fee_structure: 'bg-purple-100 text-purple-800',
  announcement: 'bg-yellow-100 text-yellow-800',
  student: 'bg-emerald-100 text-emerald-800',
  user: 'bg-rose-100 text-rose-800',
};

const STATUS_COLORS = {
  pending: 'bg-amber-100 text-amber-800',
  approved: 'bg-red-100 text-red-800',
  rejected: 'bg-emerald-100 text-emerald-800',
};

// ─── Print document renderer ──────────────────────────────────────────────────
function SnapshotDocument({ request }) {
  const { entity_type, entity_name, entity_snapshot: s, requested_by_name, requested_at, reason } = request;

  function renderClassSnapshot() {
    return (
      <table className="w-full text-sm border-collapse border border-gray-300">
        <tbody>
          <tr><td className="border border-gray-300 px-3 py-2 font-medium w-40">Class Name</td><td className="border border-gray-300 px-3 py-2">{s.name}</td></tr>
          <tr><td className="border border-gray-300 px-3 py-2 font-medium">Order</td><td className="border border-gray-300 px-3 py-2">{s.order_num}</td></tr>
          <tr><td className="border border-gray-300 px-3 py-2 font-medium">Special Class</td><td className="border border-gray-300 px-3 py-2">{s.is_special ? 'Yes' : 'No'}</td></tr>
          <tr><td className="border border-gray-300 px-3 py-2 font-medium">Class Fee</td><td className="border border-gray-300 px-3 py-2">{fmtMoney(s.class_fee)}</td></tr>
          <tr><td className="border border-gray-300 px-3 py-2 font-medium">Students (total)</td><td className="border border-gray-300 px-3 py-2">{s.student_count ?? '—'}</td></tr>
          <tr><td className="border border-gray-300 px-3 py-2 font-medium">Created</td><td className="border border-gray-300 px-3 py-2">{fmtDate(s.created_at)}</td></tr>
        </tbody>
      </table>
    );
  }

  function renderExpenseSnapshot() {
    return (
      <table className="w-full text-sm border-collapse border border-gray-300">
        <tbody>
          <tr><td className="border border-gray-300 px-3 py-2 font-medium w-40">Receipt #</td><td className="border border-gray-300 px-3 py-2">{s.receipt_number}</td></tr>
          <tr><td className="border border-gray-300 px-3 py-2 font-medium">Category</td><td className="border border-gray-300 px-3 py-2">{s.category}</td></tr>
          <tr><td className="border border-gray-300 px-3 py-2 font-medium">Description</td><td className="border border-gray-300 px-3 py-2">{s.description}</td></tr>
          <tr><td className="border border-gray-300 px-3 py-2 font-medium">Amount</td><td className="border border-gray-300 px-3 py-2 font-semibold">{fmtMoney(s.amount)}</td></tr>
          <tr><td className="border border-gray-300 px-3 py-2 font-medium">Date</td><td className="border border-gray-300 px-3 py-2">{fmtDate(s.expense_date)}</td></tr>
          <tr><td className="border border-gray-300 px-3 py-2 font-medium">Paid To</td><td className="border border-gray-300 px-3 py-2">{s.paid_to || '—'}</td></tr>
          {s.notes && <tr><td className="border border-gray-300 px-3 py-2 font-medium">Notes</td><td className="border border-gray-300 px-3 py-2">{s.notes}</td></tr>}
          <tr><td className="border border-gray-300 px-3 py-2 font-medium">Recorded By</td><td className="border border-gray-300 px-3 py-2">{s.created_by_name || '—'}</td></tr>
          <tr><td className="border border-gray-300 px-3 py-2 font-medium">Recorded On</td><td className="border border-gray-300 px-3 py-2">{fmtDate(s.created_at)}</td></tr>
        </tbody>
      </table>
    );
  }

  function renderFeeStructureSnapshot() {
    return (
      <div className="space-y-3">
        <table className="w-full text-sm border-collapse border border-gray-300">
          <tbody>
            <tr><td className="border border-gray-300 px-3 py-2 font-medium w-40">Name</td><td className="border border-gray-300 px-3 py-2">{s.name}</td></tr>
            <tr><td className="border border-gray-300 px-3 py-2 font-medium">Class</td><td className="border border-gray-300 px-3 py-2">{s.class_name || '—'}</td></tr>
            <tr><td className="border border-gray-300 px-3 py-2 font-medium">Term</td><td className="border border-gray-300 px-3 py-2">{s.term_name || '—'}</td></tr>
            <tr><td className="border border-gray-300 px-3 py-2 font-medium">Academic Year</td><td className="border border-gray-300 px-3 py-2">{s.academic_year || '—'}</td></tr>
            <tr><td className="border border-gray-300 px-3 py-2 font-medium">Due Date</td><td className="border border-gray-300 px-3 py-2">{fmtDate(s.fee_due_date)}</td></tr>
            <tr><td className="border border-gray-300 px-3 py-2 font-medium">Total Amount</td><td className="border border-gray-300 px-3 py-2 font-semibold">{fmtMoney(s.total_amount)}</td></tr>
          </tbody>
        </table>
        {s.items && s.items.length > 0 && (
          <div>
            <p className="font-medium text-sm mb-1">Line Items</p>
            <table className="w-full text-sm border-collapse border border-gray-300">
              <thead>
                <tr className="bg-gray-50">
                  <th className="border border-gray-300 px-3 py-2 text-left">Item</th>
                  <th className="border border-gray-300 px-3 py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {s.items.map((item, i) => (
                  <tr key={i}>
                    <td className="border border-gray-300 px-3 py-2">{item.item_name}</td>
                    <td className="border border-gray-300 px-3 py-2 text-right">{fmtMoney(item.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  function renderAnnouncementSnapshot() {
    return (
      <table className="w-full text-sm border-collapse border border-gray-300">
        <tbody>
          <tr><td className="border border-gray-300 px-3 py-2 font-medium w-40">Title</td><td className="border border-gray-300 px-3 py-2">{s.title}</td></tr>
          <tr><td className="border border-gray-300 px-3 py-2 font-medium">Audience</td><td className="border border-gray-300 px-3 py-2 capitalize">{s.audience}</td></tr>
          <tr><td className="border border-gray-300 px-3 py-2 font-medium">Posted By</td><td className="border border-gray-300 px-3 py-2">{s.posted_by_name || '—'}</td></tr>
          <tr><td className="border border-gray-300 px-3 py-2 font-medium">Posted On</td><td className="border border-gray-300 px-3 py-2">{fmtDate(s.created_at)}</td></tr>
          {s.expires_at && <tr><td className="border border-gray-300 px-3 py-2 font-medium">Expires</td><td className="border border-gray-300 px-3 py-2">{fmtDate(s.expires_at)}</td></tr>}
          {s.body && <tr><td className="border border-gray-300 px-3 py-2 font-medium align-top">Body</td><td className="border border-gray-300 px-3 py-2 whitespace-pre-wrap">{s.body}</td></tr>}
        </tbody>
      </table>
    );
  }

  function renderStudentSnapshot() {
    return (
      <table className="w-full text-sm border-collapse border border-gray-300">
        <tbody>
          <tr><td className="border border-gray-300 px-3 py-2 font-medium w-40">Name</td><td className="border border-gray-300 px-3 py-2">{s.name}</td></tr>
          <tr><td className="border border-gray-300 px-3 py-2 font-medium">Student Code</td><td className="border border-gray-300 px-3 py-2">{s.student_code || '—'}</td></tr>
          <tr><td className="border border-gray-300 px-3 py-2 font-medium">Class</td><td className="border border-gray-300 px-3 py-2">{s.class_name || '—'}</td></tr>
          <tr><td className="border border-gray-300 px-3 py-2 font-medium">Gender</td><td className="border border-gray-300 px-3 py-2 capitalize">{s.gender || '—'}</td></tr>
          <tr><td className="border border-gray-300 px-3 py-2 font-medium">Date of Birth</td><td className="border border-gray-300 px-3 py-2">{fmtDate(s.dob)}</td></tr>
          <tr><td className="border border-gray-300 px-3 py-2 font-medium">Parent/Guardian</td><td className="border border-gray-300 px-3 py-2">{s.parent_name || '—'}</td></tr>
          <tr><td className="border border-gray-300 px-3 py-2 font-medium">Parent Phone</td><td className="border border-gray-300 px-3 py-2">{s.parent_phone || '—'}</td></tr>
          <tr><td className="border border-gray-300 px-3 py-2 font-medium">Status</td><td className="border border-gray-300 px-3 py-2">{s.status}</td></tr>
          <tr><td className="border border-gray-300 px-3 py-2 font-medium">Admission Date</td><td className="border border-gray-300 px-3 py-2">{fmtDate(s.admission_date)}</td></tr>
        </tbody>
      </table>
    );
  }

  function renderUserSnapshot() {
    return (
      <table className="w-full text-sm border-collapse border border-gray-300">
        <tbody>
          <tr><td className="border border-gray-300 px-3 py-2 font-medium w-40">Name</td><td className="border border-gray-300 px-3 py-2">{s.name}</td></tr>
          <tr><td className="border border-gray-300 px-3 py-2 font-medium">Email</td><td className="border border-gray-300 px-3 py-2">{s.email}</td></tr>
          <tr><td className="border border-gray-300 px-3 py-2 font-medium">Username</td><td className="border border-gray-300 px-3 py-2">{s.username || '—'}</td></tr>
          <tr><td className="border border-gray-300 px-3 py-2 font-medium">Role</td><td className="border border-gray-300 px-3 py-2 capitalize">{s.role}</td></tr>
          <tr><td className="border border-gray-300 px-3 py-2 font-medium">Account Created</td><td className="border border-gray-300 px-3 py-2">{fmtDate(s.created_at)}</td></tr>
        </tbody>
      </table>
    );
  }

  function renderSnapshot() {
    switch (entity_type) {
      case 'class':         return renderClassSnapshot();
      case 'expense':       return renderExpenseSnapshot();
      case 'fee_structure': return renderFeeStructureSnapshot();
      case 'announcement':  return renderAnnouncementSnapshot();
      case 'student':       return renderStudentSnapshot();
      case 'user':          return renderUserSnapshot();
      default: return <pre className="text-xs">{JSON.stringify(s, null, 2)}</pre>;
    }
  }

  return (
    <div className="p-8 max-w-3xl mx-auto font-sans text-gray-900 print:p-0">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold">Deletion Request Record</h1>
        <p className="text-gray-500 text-sm mt-1">Confidential — For Owner Review Only</p>
      </div>

      <div className="border border-gray-300 rounded p-4 mb-6 bg-gray-50">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div><span className="font-medium">Record Type:</span> {TYPE_LABELS[entity_type] || entity_type}</div>
          <div><span className="font-medium">Record Name:</span> {entity_name}</div>
          <div><span className="font-medium">Requested By:</span> {requested_by_name || '—'}</div>
          <div><span className="font-medium">Requested On:</span> {fmt(requested_at)}</div>
          {reason && <div className="col-span-2"><span className="font-medium">Reason:</span> {reason}</div>}
        </div>
      </div>

      <h2 className="font-semibold text-lg mb-3">Record Details</h2>
      {renderSnapshot()}

      <div className="mt-8 pt-4 border-t border-gray-300 text-sm text-gray-500">
        <p>This document was generated automatically upon deactivation of the above record.</p>
        <p>Approving this deletion will permanently remove the record from the system.</p>
        <div className="mt-6 flex gap-16">
          <div>
            <div className="h-10 border-b border-gray-400 w-48 mb-1"></div>
            <p>Owner Signature</p>
          </div>
          <div>
            <div className="h-10 border-b border-gray-400 w-48 mb-1"></div>
            <p>Date</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function DeletionRequests() {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [printRequest, setPrintRequest] = useState(null);
  const [actionId, setActionId] = useState(null);
  const [rejectNotes, setRejectNotes] = useState('');
  const [rejectTarget, setRejectTarget] = useState(null);
  const [err, setErr] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    api.get(`/deletion-requests?status=${statusFilter}`)
      .then(setRequests)
      .catch(() => setErr('Failed to load deletion requests'))
      .finally(() => setLoading(false));
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  async function approve(req) {
    if (!window.confirm(`Permanently delete "${req.entity_name}"? This cannot be undone.`)) return;
    setActionId(req.id);
    try {
      await api.put(`/deletion-requests/${req.id}/approve`, {});
      load();
    } catch (e) {
      setErr(e.response?.data?.error || 'Approval failed');
    } finally {
      setActionId(null);
    }
  }

  async function submitReject() {
    if (!rejectTarget) return;
    setActionId(rejectTarget.id);
    try {
      await api.put(`/deletion-requests/${rejectTarget.id}/reject`, { review_notes: rejectNotes });
      setRejectTarget(null);
      setRejectNotes('');
      load();
    } catch (e) {
      setErr(e.response?.data?.error || 'Rejection failed');
    } finally {
      setActionId(null);
    }
  }

  if (user?.role !== 'owner') {
    return (
      <div className="p-8 text-center text-gray-500">
        <p className="text-lg font-medium">Owner Access Only</p>
        <p className="text-sm mt-1">This page is restricted to the school owner.</p>
      </div>
    );
  }

  // Print view
  if (printRequest) {
    return (
      <div>
        <div className="print:hidden flex items-center gap-3 p-4 border-b bg-white sticky top-0 z-10">
          <button
            onClick={() => setPrintRequest(null)}
            className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1"
          >
            ← Back to list
          </button>
          <button
            onClick={() => window.print()}
            className="ml-auto bg-gray-900 text-white text-sm px-4 py-2 rounded hover:bg-gray-700"
          >
            Print / Save PDF
          </button>
        </div>
        <SnapshotDocument request={printRequest} />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Deletion Requests</h1>
          <p className="text-sm text-gray-500 mt-0.5">Review deactivated records before permanent deletion</p>
        </div>
        <div className="flex gap-2">
          {['pending','approved','rejected','all'].map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 text-sm rounded capitalize ${statusFilter === s ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {err && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm flex justify-between">
          {err}
          <button onClick={() => setErr('')} className="text-red-400 hover:text-red-600">✕</button>
        </div>
      )}

      {loading ? (
        <div className="text-center py-16 text-gray-400">Loading...</div>
      ) : requests.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-gray-400 text-lg">
            {statusFilter === 'pending' ? 'No pending deletion requests' : `No ${statusFilter} requests`}
          </p>
          {statusFilter === 'pending' && (
            <p className="text-gray-400 text-sm mt-1">
              Deletion requests appear here when records are deactivated through the system.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map(req => (
            <div key={req.id} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${TYPE_COLORS[req.entity_type] || 'bg-gray-100 text-gray-700'}`}>
                      {TYPE_LABELS[req.entity_type] || req.entity_type}
                    </span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[req.status] || 'bg-gray-100'}`}>
                      {req.status}
                    </span>
                  </div>
                  <p className="font-semibold text-gray-900 truncate">{req.entity_name}</p>
                  <p className="text-sm text-gray-500 mt-0.5">
                    Requested by <span className="font-medium text-gray-700">{req.requested_by_name || 'Unknown'}</span>
                    {' · '}{fmt(req.requested_at)}
                  </p>
                  {req.reason && (
                    <p className="text-sm text-gray-600 mt-1 italic">"{req.reason}"</p>
                  )}
                  {req.status !== 'pending' && req.reviewed_by_name && (
                    <p className="text-xs text-gray-400 mt-1">
                      {req.status === 'approved' ? 'Approved' : 'Rejected'} by {req.reviewed_by_name} · {fmt(req.reviewed_at)}
                      {req.review_notes && ` — ${req.review_notes}`}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => setPrintRequest(req)}
                    className="text-sm px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded"
                  >
                    View Document
                  </button>
                  {req.status === 'pending' && (
                    <>
                      <button
                        disabled={actionId === req.id}
                        onClick={() => { setRejectTarget(req); setRejectNotes(''); }}
                        className="text-sm px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded disabled:opacity-50"
                      >
                        Reject
                      </button>
                      <button
                        disabled={actionId === req.id}
                        onClick={() => approve(req)}
                        className="text-sm px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded disabled:opacity-50"
                      >
                        {actionId === req.id ? 'Processing…' : 'Approve Deletion'}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reject modal */}
      {rejectTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="font-semibold text-lg mb-1">Reject Deletion Request</h2>
            <p className="text-sm text-gray-500 mb-4">
              Rejecting will restore <span className="font-medium text-gray-900">"{rejectTarget.entity_name}"</span> to active status.
            </p>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
            <textarea
              value={rejectNotes}
              onChange={e => setRejectNotes(e.target.value)}
              rows={3}
              placeholder="Reason for rejection..."
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => setRejectTarget(null)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
              >
                Cancel
              </button>
              <button
                disabled={actionId === rejectTarget.id}
                onClick={submitReject}
                className="px-4 py-2 text-sm bg-amber-600 hover:bg-amber-700 text-white rounded disabled:opacity-50"
              >
                {actionId === rejectTarget.id ? 'Processing…' : 'Confirm Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
