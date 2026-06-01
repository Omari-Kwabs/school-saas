import React, { useState, useEffect } from 'react';
import StatusBadge from './StatusBadge';

const PLAN_RANK = { trial: 0, basic: 1, premium: 2 };

function PlanBadge({ plan }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize
      ${plan === 'premium' ? 'bg-indigo-100 text-indigo-700'
      : plan === 'basic'   ? 'bg-blue-100 text-blue-700'
      : 'bg-gray-100 text-gray-600'}`}>
      {plan}
    </span>
  );
}

function PlanChangeModal({ school, plans, onConfirm, onClose }) {
  const [plan, setPlan]           = useState(school.plan);
  const [expiryDate, setExpiry]   = useState('');
  const [notes, setNotes]         = useState('');
  const [saving, setSaving]       = useState(false);
  const [err, setErr]             = useState('');

  const isDowngrade = PLAN_RANK[plan] < PLAN_RANK[school.plan];
  const isSame      = plan === school.plan;
  const selectedMeta = plans.find(p => p.plan === plan);
  const today = new Date().toISOString().split('T')[0];

  async function handleSubmit() {
    if (plan !== 'trial' && !expiryDate) { setErr('Expiry date is required for paid plans'); return; }
    setSaving(true);
    setErr('');
    try {
      await onConfirm(school.id, { plan, expiry_date: expiryDate || null, notes: notes || null });
      onClose();
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  }

  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const actionLabel = isSame
    ? 'Select a different plan'
    : isDowngrade ? `Downgrade to ${cap(plan)}` : `Upgrade to ${cap(plan)}`;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">

        <div className="flex items-center justify-between p-5 border-b border-gray-200 sticky top-0 bg-white z-10">
          <h2 className="text-base font-semibold text-gray-900">Change Plan — {school.name}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>

        <div className="p-5 space-y-4">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-500">Current plan:</span>
            <PlanBadge plan={school.plan} />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">New Plan</label>
            <div className="grid grid-cols-3 gap-2">
              {['trial', 'basic', 'premium'].map(p => {
                const active   = p === plan;
                const isCurrent = p === school.plan;
                const goingDown = PLAN_RANK[p] < PLAN_RANK[school.plan];
                return (
                  <button
                    key={p}
                    onClick={() => !isCurrent && setPlan(p)}
                    disabled={isCurrent}
                    className={`py-2.5 px-3 rounded-lg border text-sm font-medium capitalize transition-colors
                      ${isCurrent
                        ? 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed'
                        : active && goingDown
                          ? 'border-amber-400 bg-amber-50 text-amber-700 ring-1 ring-amber-400'
                          : active
                            ? 'border-indigo-500 bg-indigo-50 text-indigo-700 ring-1 ring-indigo-500'
                            : 'border-gray-200 hover:border-gray-300 text-gray-600 hover:bg-gray-50'}`}
                  >
                    {p}
                    {isCurrent && <span className="block text-xs font-normal mt-0.5">current</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {plan !== 'trial' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Expiry Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={expiryDate}
                onChange={e => setExpiry(e.target.value)}
                min={today}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          )}

          {!isSame && isDowngrade && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm font-semibold text-amber-800">Downgrade warning</p>
              <p className="text-xs text-amber-700 mt-1">
                Some features will be restricted immediately. All school data is preserved — access can be restored by upgrading again.
              </p>
            </div>
          )}

          {selectedMeta && !isSame && (
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-xs font-semibold text-gray-700 mb-1.5">{selectedMeta.label} plan includes:</p>
              <ul className="space-y-1">
                {selectedMeta.features.map(f => (
                  <li key={f} className="flex items-start gap-1.5 text-xs text-gray-600">
                    <span className="text-green-500 mt-0.5 shrink-0">✓</span>{f}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder="e.g. Invoice #123 paid, upgraded for new term"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>

          {err && <p className="text-sm text-red-600">{err}</p>}
        </div>

        <div className="flex gap-3 p-5 border-t border-gray-200">
          <button
            onClick={handleSubmit}
            disabled={saving || isSame}
            className={`flex-1 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50 transition-colors
              ${isDowngrade && !isSame ? 'bg-amber-600 hover:bg-amber-700' : 'bg-indigo-600 hover:bg-indigo-700'}`}
          >
            {saving ? 'Saving…' : actionLabel}
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function HistoryModal({ school, onFetchHistory, onClose }) {
  const [rows, setRows]       = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    onFetchHistory(school.id)
      .then(setRows)
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [school.id, onFetchHistory]);

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">

        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">Subscription History — {school.name}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>

        <div className="overflow-y-auto flex-1">
          {loading ? (
            <div className="p-8 text-center text-gray-400 text-sm">Loading…</div>
          ) : !rows.length ? (
            <div className="p-8 text-center text-gray-400 text-sm">No subscription history found.</div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                <tr>
                  {['Plan', 'Status', 'Expiry', 'Changed On', 'Changed By'].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-5 py-3"><PlanBadge plan={r.plan} /></td>
                    <td className="px-5 py-3">
                      <span className={`text-xs font-medium capitalize
                        ${r.status === 'active'    ? 'text-green-600'
                        : r.status === 'cancelled' ? 'text-gray-400'
                        : 'text-red-500'}`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-sm text-gray-600">
                      {r.expiry_date ? new Date(r.expiry_date).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-5 py-3 text-sm text-gray-600">
                      {new Date(r.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3 text-sm text-gray-600">{r.changed_by || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

export default function BillingTable({ schools = [], plans = [], onChangePlan, onFetchHistory }) {
  const [planModal, setPlanModal] = useState(null);
  const [histModal, setHistModal] = useState(null);

  if (!schools.length) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-12 text-center text-gray-400">
        No billing data.
      </div>
    );
  }

  const totalRevenue = schools
    .filter(s => s.status === 'active')
    .reduce((sum, s) => sum + (s.amount || 0), 0);

  return (
    <>
      <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['School', 'Plan', 'Status', 'Expiry', 'Amount/mo', 'Actions'].map(h => (
                  <th key={h} className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {schools.map(row => {
                const expiryDate = row.plan === 'trial' ? row.trial_end_date : row.subscription_expiry;
                const daysLeft   = row.plan === 'trial' ? row.days_left      : row.sub_days_left;

                return (
                  <tr key={row.id} className="border-b border-gray-200 hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-medium text-gray-900">{row.name}</p>
                    </td>
                    <td className="px-6 py-4"><PlanBadge plan={row.plan} /></td>
                    <td className="px-6 py-4"><StatusBadge status={row.status} /></td>
                    <td className="px-6 py-4">
                      {expiryDate ? (
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {new Date(expiryDate).toLocaleDateString()}
                          </p>
                          <p className={`text-xs ${
                            daysLeft == null  ? 'text-gray-400'
                            : daysLeft < 0    ? 'text-red-600'
                            : daysLeft <= 7   ? 'text-red-500'
                            : daysLeft <= 30  ? 'text-amber-600'
                            : 'text-gray-500'
                          }`}>
                            {daysLeft == null ? '—' : daysLeft < 0 ? 'Expired' : `${daysLeft} days left`}
                          </p>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-semibold text-gray-900">
                        {row.amount ? `₵${row.amount.toLocaleString()}` : '—'}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {onChangePlan && (
                          <button
                            onClick={() => setPlanModal(row)}
                            className="text-xs font-medium text-indigo-600 hover:text-indigo-800 hover:underline whitespace-nowrap"
                          >
                            Change Plan
                          </button>
                        )}
                        {onFetchHistory && (
                          <button
                            onClick={() => setHistModal(row)}
                            className="text-xs font-medium text-gray-500 hover:text-gray-700 hover:underline"
                          >
                            History
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="bg-gray-50 px-6 py-3 border-t border-gray-200 text-sm text-gray-600">
          Total active revenue: <span className="font-semibold">₵{totalRevenue.toLocaleString()}/mo</span>
        </div>
      </div>

      {planModal && (
        <PlanChangeModal
          school={planModal}
          plans={plans}
          onConfirm={onChangePlan}
          onClose={() => setPlanModal(null)}
        />
      )}

      {histModal && onFetchHistory && (
        <HistoryModal
          school={histModal}
          onFetchHistory={onFetchHistory}
          onClose={() => setHistModal(null)}
        />
      )}
    </>
  );
}
