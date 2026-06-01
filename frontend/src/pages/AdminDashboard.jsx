import React, { useState, useEffect } from 'react';
import AdminLayout from '../features/admin/AdminLayout';
import SchoolsTable from '../features/admin/SchoolsTable';
import SchoolDetailView from '../features/admin/SchoolDetailView';
import AlertList from '../features/admin/AlertList';
import { adminApi } from '../api/admin';

export default function AdminDashboard() {
  const [stats,   setStats]   = useState(null);
  const [schools, setSchools] = useState([]);
  const [alerts,  setAlerts]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  const [selectedSchoolId, setSelectedSchoolId] = useState(null);
  const [detailOpen,       setDetailOpen]       = useState(false);

  useEffect(() => {
    Promise.all([adminApi.stats(), adminApi.schools(), adminApi.alerts()])
      .then(([s, sc, al]) => { setStats(s); setSchools(sc); setAlerts(al.slice(0, 5)); })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleAction(action, schoolId) {
    if (action === 'resend')  await adminApi.resendInvite(schoolId);
    if (action === 'trigger') await adminApi.triggerOnboarding(schoolId);
    if (action === 'resolve') setDetailOpen(false);
  }

  async function handleResolve(id) {
    await adminApi.resolveAlert(id).catch(() => {});
    setAlerts(prev => prev.filter(a => a.id !== id));
  }

  const setupComplete   = schools.filter(s => s.setup_score === 100).length;
  const setupInProgress = schools.filter(s => s.setup_score > 0 && s.setup_score < 100).length;
  const setupNotStarted = schools.filter(s => s.setup_score === 0).length;

  const planCounts = schools.reduce((acc, s) => {
    acc[s.plan] = (acc[s.plan] || 0) + 1;
    return acc;
  }, {});

  return (
    <>
      <AdminLayout pageTitle="Dashboard">
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
            <p className="text-sm text-gray-600 font-medium">Total Schools</p>
            <p className="text-4xl font-bold text-indigo-600 mt-2">{loading ? 'â€”' : stats?.total_schools ?? 0}</p>
            <p className="text-xs text-gray-500 mt-2">{stats?.active_schools ?? 0} active</p>
          </div>
          <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
            <p className="text-sm text-gray-600 font-medium">Total Users</p>
            <p className="text-4xl font-bold text-blue-600 mt-2">{loading ? 'â€”' : stats?.total_users ?? 0}</p>
            <p className="text-xs text-gray-500 mt-2">Across all schools</p>
          </div>
          <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
            <p className="text-sm text-gray-600 font-medium">Active Alerts</p>
            <p className="text-4xl font-bold text-red-600 mt-2">{loading ? 'â€”' : alerts.length}</p>
            <p className="text-xs text-red-600 mt-2">
              {alerts.filter(a => a.severity === 'high').length} high severity
            </p>
          </div>
          <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
            <p className="text-sm text-gray-600 font-medium">Setup Complete</p>
            <p className="text-4xl font-bold text-green-600 mt-2">{loading ? 'â€”' : setupComplete}</p>
            <p className="text-xs text-gray-500 mt-2">of {schools.length} schools</p>
          </div>
        </div>

        {/* Main Sections */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Schools Overview</h2>
            {loading
              ? <div className="bg-white rounded-lg border border-gray-200 p-12 text-center text-gray-400">Loadingâ€¦</div>
              : <SchoolsTable schools={schools} onRowClick={id => { setSelectedSchoolId(id); setDetailOpen(true); }} />
            }
          </div>

          <div className="space-y-4">
            <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
              <h3 className="font-semibold text-gray-900 mb-3">Setup Status</h3>
              <div className="space-y-2">
                <div><p className="text-sm text-gray-600 mb-1">Completed</p><p className="text-2xl font-bold text-green-600">{setupComplete}</p></div>
                <div><p className="text-sm text-gray-600 mb-1">In Progress</p><p className="text-2xl font-bold text-blue-600">{setupInProgress}</p></div>
                <div><p className="text-sm text-gray-600 mb-1">Not Started</p><p className="text-2xl font-bold text-gray-600">{setupNotStarted}</p></div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
              <h3 className="font-semibold text-gray-900 mb-3">Plan Distribution</h3>
              <div className="space-y-2 text-sm">
                {Object.entries(planCounts).map(([plan, count]) => (
                  <div key={plan} className="flex justify-between">
                    <span className="text-gray-600 capitalize">{plan}</span>
                    <span className="font-semibold text-gray-900">{count}</span>
                  </div>
                ))}
                {!loading && Object.keys(planCounts).length === 0 && (
                  <p className="text-gray-400 text-xs">No schools yet</p>
                )}
              </div>
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-4">Recent Alerts</h2>
          {loading
            ? <div className="text-gray-400 text-sm">Loadingâ€¦</div>
            : <AlertList alerts={alerts} onResolve={handleResolve} />
          }
        </div>
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

