import React from 'react';

export default function IssueList({ issues = [], onFix = () => {} }) {
  if (issues.length === 0) {
    return (
      <div className="bg-green-50 p-4 rounded-lg border border-green-200 text-center">
        <p className="text-green-800 text-sm font-medium">✓ All systems operational</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {issues.map((issue) => (
        <div
          key={issue.id}
          className="flex items-center justify-between bg-red-50 p-4 rounded-lg border border-red-200"
        >
          <div className="flex items-start gap-3">
            <span className="text-red-600 text-lg mt-0.5">⚠</span>
            <div>
              <p className="font-medium text-gray-900 text-sm">{issue.title}</p>
              <p className="text-xs text-gray-600 mt-1">{issue.message}</p>
              {issue.suggestion && (
                <p className="text-xs text-gray-500 mt-2 italic">💡 Suggestion: {issue.suggestion}</p>
              )}
            </div>
          </div>
          <button
            onClick={() => onFix(issue.id)}
            className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors whitespace-nowrap ml-4 flex-shrink-0"
          >
            Fix Now
          </button>
        </div>
      ))}
    </div>
  );
}
