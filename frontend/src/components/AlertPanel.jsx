import React from 'react';

const SCHEMES = {
  danger:  { wrap: 'bg-red-50 border-red-200',    dot: 'bg-red-500',    title: 'text-red-700',    msg: 'text-red-600'    },
  warning: { wrap: 'bg-amber-50 border-amber-200', dot: 'bg-amber-500',  title: 'text-amber-700',  msg: 'text-amber-600'  },
  info:    { wrap: 'bg-blue-50 border-blue-200',   dot: 'bg-blue-500',   title: 'text-blue-700',   msg: 'text-blue-600'   },
  success: { wrap: 'bg-green-50 border-green-200', dot: 'bg-green-500',  title: 'text-green-700',  msg: 'text-green-600'  },
};

export default function AlertPanel({ alerts = [] }) {
  if (!alerts.length) {
    return <p className="text-sm text-gray-400 py-4 text-center">No alerts at this time.</p>;
  }
  return (
    <div className="space-y-2">
      {alerts.map((a, i) => {
        const s = SCHEMES[a.type] || SCHEMES.info;
        return (
          <div key={i} className={`flex gap-3 p-3 rounded-lg border ${s.wrap}`}>
            <span className={`w-2 h-2 rounded-full ${s.dot} shrink-0 mt-1.5`} />
            <div className="min-w-0">
              <p className={`text-sm font-semibold leading-tight ${s.title}`}>{a.title}</p>
              {a.message && (
                <p className={`text-xs mt-0.5 leading-relaxed opacity-80 ${s.msg}`}>{a.message}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
