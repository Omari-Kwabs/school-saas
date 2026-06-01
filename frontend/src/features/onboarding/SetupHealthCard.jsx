import React from 'react';

export default function SetupHealthCard({ score = 75, label = 'Good' }) {
  const getColor = (val) => {
    if (val >= 80) return { bg: 'bg-green-50', border: 'border-green-200', progress: 'bg-green-600', text: 'text-green-800' };
    if (val >= 50) return { bg: 'bg-yellow-50', border: 'border-yellow-200', progress: 'bg-yellow-600', text: 'text-yellow-800' };
    return { bg: 'bg-red-50', border: 'border-red-200', progress: 'bg-red-600', text: 'text-red-800' };
  };

  const colors = getColor(score);

  return (
    <div className={`${colors.bg} p-6 rounded-lg border ${colors.border}`}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-sm text-gray-600">Setup Health</p>
          <p className={`text-3xl font-bold ${colors.text}`}>{score}%</p>
        </div>
        <span className={`px-4 py-2 rounded-full text-sm font-semibold ${colors.text} bg-white border ${colors.border}`}>
          {label}
        </span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className={`${colors.progress} h-2 rounded-full transition-all`}
          style={{ width: `${score}%` }}
        />
      </div>
      {score < 80 && (
        <p className="text-xs text-gray-600 mt-3">Complete remaining setup steps to improve your score</p>
      )}
    </div>
  );
}
