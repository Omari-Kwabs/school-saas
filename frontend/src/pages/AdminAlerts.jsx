import React, { useState, useEffect } from 'react';
import AdminLayout from '../features/admin/AdminLayout';
import AlertFilter from '../features/admin/AlertFilter';
import AlertList from '../features/admin/AlertList';
import { adminApi } from '../api/admin';

export default function AdminAlerts() {
  const [allAlerts, setAllAlerts] = useState([]);
  const [filters,   setFilters]   = useState({});
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');

  useEffect(() => {
    adminApi.alerts()
      .then(setAllAlerts)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleResolve(id) {
    await adminApi.resolveAlert(id).catch(() => {});
    setAllAlerts(prev => prev.filter(a => a.id !== id));
  }

  const filtered = allAlerts.filter(alert => {
    if (filters.severity && filters.severity.length && !filters.severity.includes(alert.severity)) return false;
    if (filters.type     && filters.type.length     && !filters.type.some(t => alert.type.toLowerCase().includes(t.toLowerCase()))) return false;
    return true;
  });

  return (
    <AdminLayout pageTitle="Alerts">
      <div className="mb-6">
        <p className="text-gray-600">Monitor critical alerts across all schools. Filter by type and severity to focus on what matters most.</p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
      )}

      <AlertFilter onFilterChange={setFilters} />

      <div className="mt-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Alerts {!loading && <span className="text-sm font-normal text-gray-500">({filtered.length})</span>}
        </h2>
        {loading
          ? <div className="text-center text-gray-400 py-12">Loadingâ€¦</div>
          : <AlertList alerts={filtered} onResolve={handleResolve} />
        }
      </div>
    </AdminLayout>
  );
}

