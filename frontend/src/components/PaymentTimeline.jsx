import React from 'react';

function fmt(n) {
  return 'GH₵ ' + Number(n || 0).toLocaleString('en-GH', { minimumFractionDigits: 2 });
}

export default function PaymentTimeline({ paid = 0, overdue = 0, upcoming = 0, label }) {
  const total = paid + overdue + upcoming;
  if (total === 0) {
    return <p className="text-sm text-gray-400">No payment data.</p>;
  }

  const paidPct    = (paid    / total) * 100;
  const overduePct = (overdue / total) * 100;
  const upcomingPct = (upcoming / total) * 100;

  return (
    <div className="space-y-3">
      {label && <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</p>}

      {/* Bar */}
      <div className="w-full h-4 rounded-full overflow-hidden bg-gray-100 flex">
        {paidPct > 0 && (
          <div
            className="h-full bg-green-500 transition-all duration-500"
            style={{ width: `${paidPct}%` }}
            title={`Paid: ${fmt(paid)}`}
          />
        )}
        {overduePct > 0 && (
          <div
            className="h-full bg-red-500 transition-all duration-500"
            style={{ width: `${overduePct}%` }}
            title={`Overdue: ${fmt(overdue)}`}
          />
        )}
        {upcomingPct > 0 && (
          <div
            className="h-full bg-gray-300 transition-all duration-500"
            style={{ width: `${upcomingPct}%` }}
            title={`Upcoming: ${fmt(upcoming)}`}
          />
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-green-500 shrink-0" />
          <span className="text-gray-600">Paid <span className="font-semibold text-gray-800">{fmt(paid)}</span></span>
        </div>
        {overdue > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0" />
            <span className="text-gray-600">Overdue <span className="font-semibold text-red-600">{fmt(overdue)}</span></span>
          </div>
        )}
        {upcoming > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-gray-300 shrink-0" />
            <span className="text-gray-600">Upcoming <span className="font-semibold text-gray-700">{fmt(upcoming)}</span></span>
          </div>
        )}
      </div>
    </div>
  );
}
