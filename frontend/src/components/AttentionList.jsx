import React from 'react';
import { useNavigate } from 'react-router-dom';

const SUGGESTIONS = {
  low:    'Schedule remediation session',
  medium: 'Review recent assessments',
  weak:   'Monitor progress closely',
};

const RISK_STYLE = {
  low:    'bg-red-100 text-red-700',
  medium: 'bg-amber-100 text-amber-700',
  high:   'bg-green-100 text-green-700',
};

function Avatar({ name }) {
  const init = name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';
  return (
    <div className="w-9 h-9 rounded-full bg-slate-800 text-white flex items-center justify-center text-xs font-bold shrink-0">
      {init}
    </div>
  );
}

export default function AttentionList({ items = [] }) {
  const navigate = useNavigate();

  if (!items.length) {
    return <p className="text-sm text-gray-400 py-6 text-center">No students need attention right now.</p>;
  }

  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div
          key={i}
          onClick={() => item.student_id && navigate(`/students/${item.student_id}`)}
          className={`flex items-center gap-3 p-3 bg-white border border-gray-100 rounded-xl shadow-sm transition-colors
            ${item.student_id ? 'cursor-pointer hover:border-indigo-200 hover:bg-indigo-50/30' : ''}`}
        >
          <Avatar name={item.student_name} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-800 truncate">{item.student_name}</p>
            <p className="text-xs text-gray-400 mt-0.5 truncate">
              Weak: <span className="font-medium text-gray-600">{item.competency_name}</span>
            </p>
          </div>
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${RISK_STYLE[item.level] || RISK_STYLE.medium}`}>
              {item.level || 'weak'}
            </span>
            <p className="text-[10px] text-gray-400 text-right max-w-[120px] leading-tight">
              {SUGGESTIONS[item.level] || SUGGESTIONS.weak}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
