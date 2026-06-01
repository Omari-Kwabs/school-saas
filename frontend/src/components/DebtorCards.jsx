import React from 'react';

function fmt(n) {
  if (n == null) return '—';
  return 'GH₵ ' + Number(n).toLocaleString('en-GH', { minimumFractionDigits: 2 });
}

function Avatar({ name }) {
  const initials = name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';
  return (
    <div className="w-10 h-10 rounded-full bg-red-100 text-red-700 flex items-center justify-center font-bold text-sm shrink-0">
      {initials}
    </div>
  );
}

function DebtorCard({ debtor, onRemind }) {
  const overdue = parseFloat(debtor.overdue_amount || 0);
  const balance = parseFloat(debtor.balance || 0);

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <Avatar name={debtor.student_name} />
        <div className="min-w-0">
          <p className="font-semibold text-gray-800 text-sm truncate">{debtor.student_name}</p>
          <p className="text-xs text-gray-400">{debtor.class_name || 'Unknown class'}</p>
        </div>
        {overdue > 0 && (
          <span className="ml-auto shrink-0 text-[10px] font-bold bg-red-100 text-red-600 px-2 py-0.5 rounded-full uppercase tracking-wide">
            Overdue
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="bg-gray-50 rounded-lg p-2">
          <p className="text-gray-400 mb-0.5">Balance</p>
          <p className="font-bold text-red-600">{fmt(balance)}</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-2">
          <p className="text-gray-400 mb-0.5">Overdue</p>
          <p className={`font-bold ${overdue > 0 ? 'text-orange-600' : 'text-gray-400'}`}>{fmt(overdue)}</p>
        </div>
      </div>

      {debtor.parent_phone && (
        <p className="text-xs text-gray-400 truncate">
          <span className="font-medium text-gray-500">Phone:</span> {debtor.parent_phone}
        </p>
      )}

      {onRemind && (
        <button
          onClick={() => onRemind(debtor)}
          className="w-full mt-1 py-1.5 text-xs font-semibold text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors"
        >
          Remind Parent
        </button>
      )}
    </div>
  );
}

export default function DebtorCards({ debtors = [], onRemind }) {
  if (!debtors.length) {
    return (
      <div className="text-center py-10 text-gray-400 text-sm">
        No outstanding debtors.
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {debtors.map((d, i) => (
        <DebtorCard key={d.plan_id || d.student_id || i} debtor={d} onRemind={onRemind} />
      ))}
    </div>
  );
}
