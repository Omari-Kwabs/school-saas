import React from 'react';

export default function UsageTable({ schools = [] }) {
  if (!schools.length) {
    return <div className="bg-white rounded-lg border border-gray-200 p-12 text-center text-gray-400">No usage data.</div>;
  }

  const maxActions = Math.max(...schools.map(s => s.action_count), 1);

  function actionColor(count) {
    if (count > 2000) return 'text-green-600';
    if (count > 500)  return 'text-blue-600';
    return 'text-gray-600';
  }

  return (
    <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">School</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Active Users</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Actions (30d)</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Features Used</th>
            </tr>
          </thead>
          <tbody>
            {schools.map(row => (
              <tr key={row.id} className="border-b border-gray-200 hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4">
                  <p className="font-medium text-gray-900">{row.name}</p>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <div className="w-16 bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-indigo-600 h-2 rounded-full"
                        style={{ width: `${Math.min((row.active_users / Math.max(...schools.map(s => s.active_users), 1)) * 100, 100)}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium text-gray-700 w-8 text-right">{row.active_users}</span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <div className="w-20 bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-green-500 h-2 rounded-full"
                        style={{ width: `${Math.min((row.action_count / maxActions) * 100, 100)}%` }}
                      />
                    </div>
                    <span className={`text-sm font-medium ${actionColor(row.action_count)}`}>
                      {row.action_count.toLocaleString()}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  {!row.features?.length ? (
                    <span className="text-xs text-gray-400">—</span>
                  ) : (
                    <div className="flex gap-1 flex-wrap">
                      {row.features.slice(0, 3).map(f => (
                        <span key={f} className="inline-block px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs capitalize">
                          {f}
                        </span>
                      ))}
                      {row.features.length > 3 && (
                        <span className="inline-block px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                          +{row.features.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="bg-gray-50 px-6 py-3 border-t border-gray-200 text-sm text-gray-600">
        {schools.length} school{schools.length !== 1 ? 's' : ''} · last 30 days
      </div>
    </div>
  );
}
