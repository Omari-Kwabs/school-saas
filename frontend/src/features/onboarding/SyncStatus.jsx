import React from 'react';

export default function SyncStatus({ pendingCount = 0, lastSync = null, isSyncing = false }) {
  const lastSyncTime = lastSync ? new Date(lastSync).toLocaleTimeString() : 'Never';

  return (
    <div className="fixed bottom-4 left-4 bg-white border border-gray-200 rounded-lg shadow-lg p-4 max-w-xs">
      <div className="space-y-2">
        {/* Status */}
        <div className="flex items-center gap-2">
          {isSyncing ? (
            <>
              <span className="text-blue-600 text-lg animate-spin">⟳</span>
              <span className="text-sm font-medium text-gray-700">Syncing...</span>
            </>
          ) : pendingCount > 0 ? (
            <>
              <span className="text-yellow-600 text-lg">⚠</span>
              <span className="text-sm font-medium text-gray-700">{pendingCount} pending</span>
            </>
          ) : (
            <>
              <span className="text-green-600 text-lg">✓</span>
              <span className="text-sm font-medium text-gray-700">Up to date</span>
            </>
          )}
        </div>

        {/* Last sync time */}
        <p className="text-xs text-gray-500">Last sync: {lastSyncTime}</p>

        {/* Pending details */}
        {pendingCount > 0 && (
          <p className="text-xs text-yellow-700 mt-2">
            {pendingCount} change{pendingCount !== 1 ? 's' : ''} waiting to sync
          </p>
        )}
      </div>
    </div>
  );
}
