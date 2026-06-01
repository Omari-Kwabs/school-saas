import React, { useState } from 'react';

export default function IssueFixButton({ issue = {}, onFix = () => {}, loading = false }) {
  const [showConfirm, setShowConfirm] = useState(false);

  function handleFix() {
    if (issue.requiresConfirm) {
      setShowConfirm(true);
    } else {
      onFix(issue.id);
    }
  }

  if (showConfirm) {
    return (
      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <p className="text-sm text-gray-700 mb-4">{issue.confirmMessage || 'Are you sure?'}</p>
        <div className="flex gap-2">
          <button
            onClick={() => onFix(issue.id)}
            className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium transition-colors disabled:opacity-50"
            disabled={loading}
          >
            {loading ? 'Fixing...' : 'Yes, Fix It'}
          </button>
          <button
            onClick={() => setShowConfirm(false)}
            className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm font-medium transition-colors disabled:opacity-50"
            disabled={loading}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={handleFix}
      disabled={loading}
      className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
    >
      {loading ? '⏳ Fixing...' : `Fix: ${issue.title || 'Issue'}`}
    </button>
  );
}
