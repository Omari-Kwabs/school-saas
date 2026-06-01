import React from 'react';

const LEVEL = {
  high:   { bg: 'bg-green-500',  text: 'text-white', label: 'H' },
  medium: { bg: 'bg-amber-400',  text: 'text-white', label: 'M' },
  low:    { bg: 'bg-red-500',    text: 'text-white', label: 'L' },
};

const LEGEND = [
  { bg: 'bg-green-500', label: 'High' },
  { bg: 'bg-amber-400', label: 'Medium' },
  { bg: 'bg-red-500',   label: 'Low' },
  { bg: 'bg-gray-200',  label: 'N/A' },
];

export default function HeatmapGrid({ students = [], competencies = [], data = [] }) {
  const lookup = {};
  for (const d of data) lookup[`${d.student_id}:${d.competency_id}`] = d.level;

  if (!students.length || !competencies.length) {
    return <p className="text-sm text-gray-400 py-6 text-center">No data to display.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="border-collapse text-xs w-full">
          <thead>
            <tr className="bg-gray-50">
              <th className="sticky left-0 z-10 bg-gray-50 px-3 py-2.5 text-left font-semibold text-gray-600 border-b border-r border-gray-200 min-w-[120px]">
                Student
              </th>
              {competencies.map(c => (
                <th key={c.id} className="px-2 py-2.5 font-semibold text-gray-600 border-b border-gray-200 whitespace-nowrap min-w-[52px] text-center" title={c.name}>
                  {c.code || c.name.slice(0, 6)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {students.map((s, si) => (
              <tr key={s.id} className={si % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                <td className="sticky left-0 z-10 bg-inherit px-3 py-2 font-medium text-gray-700 border-r border-gray-200 whitespace-nowrap">
                  {s.name}
                </td>
                {competencies.map(c => {
                  const level = lookup[`${s.id}:${c.id}`];
                  const scheme = LEVEL[level];
                  return (
                    <td key={c.id} className="px-1 py-1.5 text-center" title={`${s.name} — ${c.name}: ${level || 'N/A'}`}>
                      <span className={`inline-flex items-center justify-center w-8 h-7 rounded font-bold text-xs
                        ${scheme ? `${scheme.bg} ${scheme.text}` : 'bg-gray-200 text-gray-400'}`}>
                        {scheme ? scheme.label : '—'}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-3">
        {LEGEND.map(l => (
          <div key={l.label} className="flex items-center gap-1.5 text-xs text-gray-500">
            <span className={`w-3 h-3 rounded-sm ${l.bg}`} />
            {l.label}
          </div>
        ))}
      </div>
    </div>
  );
}
