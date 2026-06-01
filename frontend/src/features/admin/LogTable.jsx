import React from 'react';

const STATUS_STYLE = {
  success: 'bg-green-100 text-green-800 border-green-300',
  error:   'bg-red-100 text-red-800 border-red-300',
  pending: 'bg-blue-100 text-blue-800 border-blue-300',
};
const STATUS_ICON = { success: '✓', error: '✕', pending: '⏳' };

function fmtTs(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

export default function LogTable({ logs = [] }) {
  if (!logs.length) {
    return <div className="bg-white rounded-lg border border-gray-200 p-12 text-center text-gray-400">No log entries found.</div>;
  }

  return (
    <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Timestamp</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">School</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">User</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Event</th>
            </tr>
          </thead>
          <tbody>
            {logs.map(log => (
              <tr key={log.id} className="border-b border-gray-200 hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4">
                  <p className="text-xs font-mono text-gray-500 whitespace-nowrap">{fmtTs(log.created_at)}</p>
                </td>
                <td className="px-6 py-4">
                  <p className="text-sm font-medium text-gray-900">{log.school_name ?? '—'}</p>
                </td>
                <td className="px-6 py-4">
                  <p className="text-sm text-gray-600">{log.user_name ?? 'system'}</p>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-700 capitalize">{log.action}</span>
                    {log.entity && (
                      <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded capitalize">{log.entity}</span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="bg-gray-50 px-6 py-3 border-t border-gray-200 text-sm text-gray-600">
        Showing {logs.length} entries
      </div>
    </div>
  );
}
