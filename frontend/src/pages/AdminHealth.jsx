import React, { useState, useEffect } from 'react';
import AdminLayout from '../features/admin/AdminLayout';
import HealthDashboard from '../features/admin/HealthDashboard';
import SchoolDetailView from '../features/admin/SchoolDetailView';
import { adminApi } from '../api/admin';

export default function AdminHealth() {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  const [selectedSchoolId, setSelectedSchoolId] = useState(null);
  const [detailOpen,       setDetailOpen]       = useState(false);

  useEffect(() => {
    adminApi.health()
      .then(setData)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleAction(action, schoolId) {
    if (action === 'resend')  await adminApi.resendInvite(schoolId).catch(() => {});
    if (action === 'trigger') await adminApi.triggerOnboarding(schoolId).catch(() => {});
    if (action === 'resolve') setDetailOpen(false);
  }

  return (
    <>
      <AdminLayout pageTitle="Health Monitor">
        <div className="mb-6">
          <p className="text-gray-600">Monitor the overall health and activity of all schools.</p>
        </div>
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
        )}
        {loading
          ? <div className="text-center text-gray-400 py-12">Loadingâ€¦</div>
          : <HealthDashboard data={data} onCardClick={id => { setSelectedSchoolId(id); setDetailOpen(true); }} />
        }
      </AdminLayout>

      <SchoolDetailView
        isOpen={detailOpen}
        schoolId={selectedSchoolId}
        onClose={() => setDetailOpen(false)}
        onAction={handleAction}
      />
    </>
  );
}

