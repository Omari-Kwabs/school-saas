import React, { useState, useEffect } from 'react';
import AdminLayout from '../features/admin/AdminLayout';
import SimpleBarChart from '../features/admin/SimpleBarChart';
import UsageTable from '../features/admin/UsageTable';
import { adminApi } from '../api/admin';

export default function AdminUsage() {
  const [schools, setSchools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  useEffect(() => {
    adminApi.usage()
      .then(setSchools)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const actionsData = schools.slice(0, 10).map(s => ({ label: s.name, value: s.action_count }));
  const usersData   = schools.slice(0, 10).map(s => ({ label: s.name, value: s.active_users }));

  return (
    <AdminLayout pageTitle="Usage Analytics">
      <div className="mb-6">
        <p className="text-gray-600">Track feature adoption and user engagement across all schools (last 30 days).</p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
      )}

      {loading
        ? <div className="text-center text-gray-400 py-12">Loadingâ€¦</div>
        : (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <SimpleBarChart title="Actions by School (30 days)"    data={actionsData} />
              <SimpleBarChart title="Active Users by School (30 days)" data={usersData}  />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Usage Details</h2>
              <UsageTable schools={schools} />
            </div>
          </>
        )
      }
    </AdminLayout>
  );
}

