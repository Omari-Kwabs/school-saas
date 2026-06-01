import React from 'react';

const SCHEMES = {
  blue:   { bg: 'bg-blue-50',   border: 'border-blue-500',   text: 'text-blue-600',   icon: 'bg-blue-100'   },
  green:  { bg: 'bg-green-50',  border: 'border-green-500',  text: 'text-green-600',  icon: 'bg-green-100'  },
  red:    { bg: 'bg-red-50',    border: 'border-red-500',    text: 'text-red-600',    icon: 'bg-red-100'    },
  amber:  { bg: 'bg-amber-50',  border: 'border-amber-500',  text: 'text-amber-600',  icon: 'bg-amber-100'  },
  purple: { bg: 'bg-purple-50', border: 'border-purple-500', text: 'text-purple-600', icon: 'bg-purple-100' },
};

export default function StatCard({ title, value, sub, color = 'blue', icon, trend }) {
  const s = SCHEMES[color] || SCHEMES.blue;
  return (
    <div className={`relative bg-white rounded-xl border-l-4 ${s.border} p-5 shadow-sm flex flex-col gap-2 min-w-0`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider leading-tight">{title}</p>
        {icon && (
          <span className={`w-9 h-9 rounded-lg ${s.icon} flex items-center justify-center text-lg shrink-0`}>
            {icon}
          </span>
        )}
      </div>
      <p className={`text-2xl font-bold ${s.text} leading-none`}>{value ?? '—'}</p>
      {(sub || trend != null) && (
        <div className="flex items-center gap-2 mt-0.5">
          {trend != null && (
            <span className={`text-xs font-semibold ${trend >= 0 ? 'text-green-600' : 'text-red-500'}`}>
              {trend >= 0 ? '▲' : '▼'} {Math.abs(trend)}%
            </span>
          )}
          {sub && <p className="text-xs text-gray-400">{sub}</p>}
        </div>
      )}
    </div>
  );
}
