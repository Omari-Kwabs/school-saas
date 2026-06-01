import React from 'react';

export default function RiskBadge({ level = 'low' }) {
  const styles = {
    low: 'bg-green-100 text-green-800 border-green-300',
    medium: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    high: 'bg-red-100 text-red-800 border-red-300',
  };

  const icons = {
    low: '✓',
    medium: '⚠️',
    high: '🔴',
  };

  const labels = {
    low: 'Low',
    medium: 'Medium',
    high: 'High',
  };

  return (
    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium border ${styles[level] || styles.low}`}>
      <span>{icons[level]}</span>
      {labels[level]}
    </span>
  );
}
