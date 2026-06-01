import React from 'react';

export default function ProgressBar({ percentage = 0, label = '', size = 'md', showLabel = true }) {
  const heights = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-3',
  };

  const barHeight = heights[size] || heights.md;

  return (
    <div className="flex items-center gap-2">
      <div className={`flex-1 ${barHeight} bg-gray-200 rounded-full overflow-hidden`}>
        <div
          className="bg-gradient-to-r from-indigo-500 to-indigo-600 h-full rounded-full transition-all duration-300"
          style={{ width: `${Math.min(Math.max(percentage, 0), 100)}%` }}
        />
      </div>
      {showLabel && (
        <span className="text-sm font-medium text-gray-700 w-12 text-right">
          {label || `${percentage}%`}
        </span>
      )}
    </div>
  );
}
