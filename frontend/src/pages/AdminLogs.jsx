import React, { useState, useEffect, useCallback } from 'react';
import AdminLayout from '../features/admin/AdminLayout';
import LogTable from '../features/admin/LogTable';
import { adminApi } from '../api/admin';

export default function AdminLogs() {
  const [result,  setResult]  = useState({ logs: [], total: 0 });
  const [search,  setSearch]  = useState('');
  const [entity,  setEntity]  = useState('');
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  const load = useCallback(() => {
    setLoading(true);
    adminApi.logs({ search: search || undefined, entity: entity || undefined })
      .then(setResult)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [search, entity]);

  useEffect(() => { load(); }, []);

  function handleSearch(e) {
    e.preventDefault();
    load();
  }

  const ENTITY_OPTIONS = ['', 'student', 'user', 'payment', 'grade', 'result', 'assessment', 'attendance', 'class'];

  return (
    <AdminLayout pageTitle="Event Logs">
      <div className="mb-6">
        <p className="text-gray-600">View system events and user actions across all schools.</p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
      )}

      <form onSubmit={handleSearch} className="mb-6 flex gap-3">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search school, action, entityâ€¦"
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <select
          value={entity}
          onChange={e => setEntity(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">All Entities</option>
          {ENTITY_OPTIONS.filter(Boolean).map(o => (
            <option key={o} value={o} className="capitalize">{o}</option>
          ))}
        </select>
        <button
          type="submit"
          className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 transition-colors"
        >
          Search
        </button>
      </form>

      {loading
        ? <div className="text-center text-gray-400 py-12">Loadingâ€¦</div>
        : (
          <>
            <p className="text-sm text-gray-500 mb-3">{result.total} events found</p>
            <LogTable logs={result.logs} />
          </>
        )
      }
    </AdminLayout>
  );
}

