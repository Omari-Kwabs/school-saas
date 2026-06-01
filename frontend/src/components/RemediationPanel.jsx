import React, { useState } from 'react';
import Drawer from './Drawer';
import { api } from '../api';

const STATUS_STYLE = {
  pending:     'bg-amber-100 text-amber-700',
  in_progress: 'bg-blue-100 text-blue-700',
  resolved:    'bg-green-100 text-green-700',
};

const STATUS_LABELS = {
  pending:     'Pending',
  in_progress: 'In Progress',
  resolved:    'Resolved',
};

function PerformanceBar({ label, value, max = 100 }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  const color = pct >= 75 ? 'bg-green-500' : pct >= 50 ? 'bg-amber-400' : 'bg-red-500';
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-gray-600 font-medium">{label}</span>
        <span className="text-gray-500">{value}/{max}</span>
      </div>
      <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function RemediationPanel({ item, open, onClose, onUpdated }) {
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');
  const [note, setNote]     = useState('');

  if (!item) return null;

  async function updateStatus(status) {
    setSaving(true); setError('');
    try {
      await api.put(`/remediation/${item.id}`, { status, notes: note || undefined });
      onUpdated?.({ ...item, status });
      onClose?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const nextActions = item.status === 'pending'
    ? [{ label: 'Mark In Progress', status: 'in_progress', style: 'bg-blue-600 text-white hover:bg-blue-700' }]
    : item.status === 'in_progress'
    ? [{ label: 'Mark Resolved', status: 'resolved', style: 'bg-green-600 text-white hover:bg-green-700' }]
    : [];

  return (
    <Drawer open={open} onClose={onClose} title="Remediation Detail">
      {/* Student header */}
      <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100">
        <div className="w-12 h-12 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-sm shrink-0">
          {item.student_name?.[0] || '?'}
        </div>
        <div>
          <p className="font-semibold text-gray-800">{item.student_name}</p>
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLE[item.status] || STATUS_STYLE.pending}`}>
            {STATUS_LABELS[item.status] || item.status}
          </span>
        </div>
      </div>

      {/* Issue */}
      <div className="space-y-4 mb-6">
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Competency</p>
          <p className="text-sm font-medium text-gray-800">{item.competency_name || '—'}</p>
        </div>
        {item.reason && (
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Reason Flagged</p>
            <p className="text-sm text-gray-700 bg-amber-50 border border-amber-100 rounded-lg p-3">{item.reason}</p>
          </div>
        )}
      </div>

      {/* Past performance */}
      {(item.results || []).length > 0 && (
        <div className="mb-6">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Past Performance</p>
          <div className="space-y-3">
            {item.results.map((r, i) => (
              <PerformanceBar
                key={i}
                label={r.assessment_title || `Assessment ${i + 1}`}
                value={r.score}
                max={r.max_score || 100}
              />
            ))}
          </div>
        </div>
      )}

      {/* Suggested action */}
      <div className="mb-6 p-4 bg-indigo-50 border border-indigo-100 rounded-xl">
        <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wide mb-1.5">Suggested Action</p>
        <p className="text-sm text-indigo-800">
          {item.status === 'resolved'
            ? 'Student has been resolved. Continue monitoring performance.'
            : item.status === 'in_progress'
            ? 'Remediation session scheduled. Track progress and update when resolved.'
            : 'Schedule a one-on-one remediation session and notify parents.'
          }
        </p>
      </div>

      {/* Update status */}
      {nextActions.length > 0 && (
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Notes (optional)
            </label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={3}
              placeholder="Add context or session notes…"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          {nextActions.map(a => (
            <button
              key={a.status}
              onClick={() => updateStatus(a.status)}
              disabled={saving}
              className={`w-full py-2.5 text-sm font-semibold rounded-xl transition-colors disabled:opacity-60 ${a.style}`}
            >
              {saving ? 'Saving…' : a.label}
            </button>
          ))}
        </div>
      )}
    </Drawer>
  );
}
