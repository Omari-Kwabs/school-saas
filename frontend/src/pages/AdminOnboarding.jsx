import React, { useState, useEffect } from 'react';
import AdminLayout from '../features/admin/AdminLayout';
import OnboardingTable from '../features/admin/OnboardingTable';
import SchoolDetailView from '../features/admin/SchoolDetailView';
import { adminApi } from '../api/admin';

const EMPTY_FORM = {
  school_name: '', school_code: '', school_address: '', school_phone: '', school_email: '',
  owner_name: '', owner_email: '', owner_password: '', plan: 'trial',
};

export default function AdminOnboarding() {
  const [data,    setData]    = useState(null);
  const [plans,   setPlans]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  const [selectedSchoolId, setSelectedSchoolId] = useState(null);
  const [detailOpen,       setDetailOpen]       = useState(false);

  const [modalOpen,   setModalOpen]   = useState(false);
  const [form,        setForm]        = useState(EMPTY_FORM);
  const [submitting,  setSubmitting]  = useState(false);
  const [formError,   setFormError]   = useState('');

  function loadData() {
    setLoading(true);
    Promise.all([adminApi.onboarding(), adminApi.plans()])
      .then(([onboarding, planList]) => { setData(onboarding); setPlans(planList); })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadData(); }, []);

  async function handleAction(action, schoolId) {
    if (action === 'trigger') {
      await adminApi.triggerOnboarding(schoolId).catch(() => {});
    }
    if (action === 'resolve') setDetailOpen(false);
  }

  function handleFormChange(e) {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);
    try {
      await adminApi.createSchool(form);
      setModalOpen(false);
      setForm(EMPTY_FORM);
      loadData();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const total      = data?.total       ?? 0;
  const completed  = data?.completed   ?? 0;
  const inProgress = data?.in_progress ?? 0;
  const notStarted = data?.not_started ?? 0;
  const rate       = total ? Math.round((completed / total) * 100) : 0;

  return (
    <>
      <AdminLayout pageTitle="Onboarding Progress">
        <div className="mb-6 flex items-center justify-between">
          <p className="text-gray-600">Track onboarding progress across all schools. Identify stalled or incomplete setups.</p>
          <button
            onClick={() => { setFormError(''); setModalOpen(true); }}
            className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
          >
            + Onboard New School
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
        )}

        <div className="bg-white rounded-lg shadow border border-gray-200 p-4 mb-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-gray-600">Completed</p>
            <p className="text-2xl font-bold text-green-600">{loading ? 'â€”' : `${completed}/${total}`}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">In Progress</p>
            <p className="text-2xl font-bold text-blue-600">{loading ? 'â€”' : `${inProgress}/${total}`}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Not Started</p>
            <p className="text-2xl font-bold text-gray-600">{loading ? 'â€”' : `${notStarted}/${total}`}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Completion Rate</p>
            <p className="text-2xl font-bold text-indigo-600">{loading ? 'â€”' : `${rate}%`}</p>
          </div>
        </div>

        {loading
          ? <div className="text-center text-gray-400 py-12">Loadingâ€¦</div>
          : <OnboardingTable
              schools={data?.schools ?? []}
              onRowClick={id => { setSelectedSchoolId(id); setDetailOpen(true); }}
            />
        }
      </AdminLayout>

      <SchoolDetailView
        isOpen={detailOpen}
        schoolId={selectedSchoolId}
        onClose={() => setDetailOpen(false)}
        onAction={handleAction}
      />

      {/* Onboard New School Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Onboard New School</h2>
              <button onClick={() => setModalOpen(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{formError}</div>
              )}

              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">School Details</p>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">School Name *</label>
                  <input name="school_name" value={form.school_name} onChange={handleFormChange} required
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">School Code *</label>
                  <input name="school_code" value={form.school_code} onChange={handleFormChange} required
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">School Email</label>
                  <input name="school_email" type="email" value={form.school_email} onChange={handleFormChange}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <input name="school_phone" value={form.school_phone} onChange={handleFormChange}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                <input name="school_address" value={form.school_address} onChange={handleFormChange}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Plan</label>
                <select name="plan" value={form.plan} onChange={handleFormChange}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  {plans.length > 0
                    ? plans.map(p => (
                        <option key={p.plan} value={p.plan}>
                          {p.label} â€” {p.price_ghs === 0 ? '4 months free' : `â‚µ${p.price_ghs.toLocaleString()}/mo`}
                        </option>
                      ))
                    : <>
                        <option value="trial">Trial (4 months free)</option>
                        <option value="basic">Basic</option>
                        <option value="premium">Premium</option>
                      </>
                  }
                </select>
              </div>

              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide pt-2">Owner Account</p>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Owner Name *</label>
                  <input name="owner_name" value={form.owner_name} onChange={handleFormChange} required
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Owner Email *</label>
                  <input name="owner_email" type="email" value={form.owner_email} onChange={handleFormChange} required
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Temporary Password *</label>
                <input name="owner_password" type="password" value={form.owner_password} onChange={handleFormChange} required minLength={6}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Min. 6 characters" />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">
                  Cancel
                </button>
                <button type="submit" disabled={submitting}
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                  {submitting ? 'Creatingâ€¦' : 'Create School'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

