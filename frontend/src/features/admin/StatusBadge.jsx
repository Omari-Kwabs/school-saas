import React from 'react';

export default function StatusBadge({ status = 'active' }) {
  const styles = {
    active: 'bg-green-100 text-green-800 border-green-300',
    trial: 'bg-blue-100 text-blue-800 border-blue-300',
    expired: 'bg-red-100 text-red-800 border-red-300',
    pending: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  };

  const icons = {
    active: '✓',
    trial: '⏳',
    expired: '✕',
    pending: '⚠️',
  };

  const labels = {
    active: 'Active',
    trial: 'Trial',
    expired: 'Expired',
    pending: 'Pending',
  };

  return (
    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium border ${styles[status] || styles.active}`}>
      <span>{icons[status]}</span>
      {labels[status]}
    </span>
  );
}
