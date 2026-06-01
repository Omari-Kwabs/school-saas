import React from 'react';
import { timeAgo } from '../../api/admin';

const SEVERITY_STYLE = {
  high:   'bg-red-100 text-red-800 border-red-300',
  medium: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  low:    'bg-blue-100 text-blue-800 border-blue-300',
};

const SEVERITY_DOT = { high: '🔴', medium: '🟡', low: '🔵' };

function iconFor(type = '') {
  if (type.includes('Payment') || type.includes('Trial')) return '💳';
  if (type.includes('Setup'))    return '🚀';
  if (type.includes('Activity')) return '📊';
  if (type.includes('Error'))    return '⚠️';
  return 'ℹ️';
}

export default function AlertList({ alerts = [], onResolve = () => {} }) {
  if (!alerts.length) {
    return (
      <div className="bg-green-50 rounded-lg border border-green-200 p-6 text-center">
        <p className="text-green-800 font-medium">✓ All clear — no active alerts.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {alerts.map(alert => (
        <div key={alert.id} className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow transition-shadow">
          <div className="flex gap-4">
            <div className="text-2xl">{iconFor(alert.type)}</div>
            <div className="flex-1">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="font-semibold text-gray-900">{alert.school}</p>
                  <p className="text-sm text-gray-500">{alert.type}</p>
                </div>
                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${SEVERITY_STYLE[alert.severity] ?? SEVERITY_STYLE.low}`}>
                  {SEVERITY_DOT[alert.severity]} {alert.severity}
                </span>
              </div>
              <p className="text-sm text-gray-700 mb-3">{alert.message}</p>
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-400">{timeAgo(alert.created_at)}</p>
                <button
                  onClick={() => onResolve(alert.id)}
                  className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
                >
                  Mark Resolved
                </button>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
