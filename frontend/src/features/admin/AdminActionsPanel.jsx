import React, { useState } from 'react';

const COLORS = {
  indigo:  { base: 'bg-indigo-50 text-indigo-700 border-indigo-200', hover: 'hover:bg-indigo-100' },
  blue:    { base: 'bg-blue-50 text-blue-700 border-blue-200',       hover: 'hover:bg-blue-100'   },
  green:   { base: 'bg-green-50 text-green-700 border-green-200',    hover: 'hover:bg-green-100'  },
  default: { base: 'bg-gray-50 text-gray-700 border-gray-200',       hover: 'hover:bg-gray-100'   },
};

const ACTIONS = [
  { id: 'copy',    label: 'Copy School ID',      icon: '📋', color: 'default' },
  { id: 'resend',  label: 'Resend Invite',        icon: '📧', color: 'indigo'  },
  { id: 'trigger', label: 'Trigger Onboarding',   icon: '🚀', color: 'blue'    },
  { id: 'resolve', label: 'Mark Resolved',        icon: '✓',  color: 'green'   },
];

export default function AdminActionsPanel({ schoolId, onAction = () => {} }) {
  const [states, setStates] = useState({});

  function setState(id, s) {
    setStates(prev => ({ ...prev, [id]: s }));
  }

  async function handleClick(id) {
    if (states[id] === 'loading') return;

    if (id === 'copy') {
      try {
        await navigator.clipboard.writeText(schoolId);
        setState(id, 'done');
      } catch {
        setState(id, 'error');
      }
      setTimeout(() => setState(id, 'idle'), 2000);
      return;
    }

    setState(id, 'loading');
    try {
      await onAction(id, schoolId);
      setState(id, 'done');
      setTimeout(() => setState(id, 'idle'), 2000);
    } catch {
      setState(id, 'error');
      setTimeout(() => setState(id, 'idle'), 3000);
    }
  }

  return (
    <div className="space-y-2">
      {ACTIONS.map(({ id, label, icon, color }) => {
        const s       = states[id] || 'idle';
        const loading = s === 'loading';
        const done    = s === 'done';
        const error   = s === 'error';
        const { base, hover } = COLORS[color];

        return (
          <button
            key={id}
            onClick={() => handleClick(id)}
            disabled={loading}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border transition-colors disabled:opacity-60 disabled:cursor-not-allowed
              ${done  ? 'bg-green-50 text-green-700 border-green-200'
              : error ? 'bg-red-50 text-red-700 border-red-200'
              : `${base} ${hover}`}`}
          >
            <span className="text-lg shrink-0 w-6 text-center">
              {loading ? (
                <svg className="animate-spin w-4 h-4 inline-block" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              ) : done ? '✅' : error ? '❌' : icon}
            </span>
            <span className="font-medium text-sm">
              {loading ? `${label}…`
              : done    ? 'Done!'
              : error   ? 'Failed — try again'
              : label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
