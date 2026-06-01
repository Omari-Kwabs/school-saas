import React, { useState, useEffect, useCallback } from 'react';
import AdminLayout from '../features/admin/AdminLayout';
import BillingTable from '../features/admin/BillingTable';
import { adminApi } from '../api/admin';

function PlanCard({ plan, onSave }) {
  const [editing,  setEditing]  = useState(false);
  const [value,    setValue]    = useState(String(plan.price_ghs));
  const [saving,   setSaving]   = useState(false);
  const [err,      setErr]      = useState('');

  async function handleSave() {
    const price = parseFloat(value);
    if (isNaN(price) || price < 0) { setErr('Enter a valid amount'); return; }
    setSaving(true); setErr('');
    try {
      await onSave(plan.plan, price);
      setEditing(false);
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  }

  const isFree = plan.plan === 'trial';

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full capitalize
          ${plan.plan === 'premium' ? 'bg-indigo-100 text-indigo-700'
          : plan.plan === 'basic'   ? 'bg-blue-100 text-blue-700'
          : 'bg-gray-100 text-gray-600'}`}>
          {plan.label}
        </span>
        {!isFree && !editing && (
          <button onClick={() => { setValue(String(plan.price_ghs)); setErr(''); setEditing(true); }}
            className="text-xs text-indigo-600 hover:underline">Edit</button>
        )}
      </div>

      {editing ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="text-gray-500 text-sm font-medium">â‚µ</span>
            <input
              type="number" min="0" step="0.01"
              value={value} onChange={e => setValue(e.target.value)}
              className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <span className="text-gray-400 text-xs">/mo</span>
          </div>
          {err && <p className="text-xs text-red-600">{err}</p>}
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={saving}
              className="flex-1 py-1.5 text-xs font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50">
              {saving ? 'Savingâ€¦' : 'Save'}
            </button>
            <button onClick={() => setEditing(false)}
              className="flex-1 py-1.5 text-xs text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <p className="text-2xl font-bold text-gray-900">
          {isFree ? 'Free' : `â‚µ${(plan.price_ghs || 0).toLocaleString()}`}
          {!isFree && <span className="text-sm font-normal text-gray-400"> /mo</span>}
        </p>
      )}

      <p className="text-xs text-gray-500">{plan.description}</p>

      <ul className="space-y-1 mt-1">
        {plan.features.map(f => (
          <li key={f} className="flex items-start gap-1.5 text-xs text-gray-600">
            <span className="text-green-500 mt-0.5">âœ“</span>{f}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function AdminBilling() {
  const [data,    setData]    = useState(null);
  const [plans,   setPlans]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  const fmt = n => `â‚µ${(n || 0).toLocaleString()}`;

  const loadAll = useCallback(() => {
    setLoading(true);
    Promise.all([adminApi.billing(), adminApi.plans()])
      .then(([billing, planList]) => { setData(billing); setPlans(planList); })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  async function handleSavePrice(plan, price_ghs) {
    await adminApi.updatePlanPrice(plan, price_ghs);
    setPlans(prev => prev.map(p => p.plan === plan ? { ...p, price_ghs } : p));
    loadAll();
  }

  async function handleChangePlan(schoolId, data) {
    await adminApi.changeSubscription(schoolId, data);
    loadAll();
  }

  return (
    <AdminLayout pageTitle="Billing">
      <div className="mb-6">
        <p className="text-gray-600">Manage subscription plans, monitor expiry dates, and track revenue.</p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
          <p className="text-sm text-gray-600">Active Subscriptions</p>
          <p className="text-3xl font-bold text-green-600 mt-2">{loading ? 'â€”' : data?.active_count ?? 0}</p>
        </div>
        <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
          <p className="text-sm text-gray-600">Monthly Revenue</p>
          <p className="text-3xl font-bold text-indigo-600 mt-2">{loading ? 'â€”' : fmt(data?.total_revenue)}</p>
        </div>
        <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
          <p className="text-sm text-gray-600">Expiring Soon (30 days)</p>
          <p className="text-3xl font-bold text-yellow-600 mt-2">{loading ? 'â€”' : data?.expiring_count ?? 0}</p>
        </div>
      </div>

      <div className="mb-6">
        <h2 className="text-base font-semibold text-gray-900 mb-3">Plan Pricing (GHS)</h2>
        {loading
          ? <div className="text-center text-gray-400 py-8">Loadingâ€¦</div>
          : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {plans.map(p => (
                <PlanCard key={p.plan} plan={p} onSave={handleSavePrice} />
              ))}
            </div>
          )
        }
      </div>

      <h2 className="text-base font-semibold text-gray-900 mb-3">School Subscriptions</h2>
      {loading
        ? <div className="text-center text-gray-400 py-12">Loadingâ€¦</div>
        : (
          <BillingTable
            schools={data?.schools ?? []}
            plans={plans}
            onChangePlan={handleChangePlan}
            onFetchHistory={id => adminApi.schoolSubscriptions(id)}
          />
        )
      }
    </AdminLayout>
  );
}

