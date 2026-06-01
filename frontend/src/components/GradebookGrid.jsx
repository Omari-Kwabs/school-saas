import React, { useState, useCallback, useRef } from 'react';

const LEVELS = ['low', 'medium', 'high'];
const LEVEL_NEXT = { low: 'medium', medium: 'high', high: 'low' };
const LEVEL_STYLE = {
  low:    'bg-red-500 text-white hover:bg-red-600',
  medium: 'bg-amber-400 text-white hover:bg-amber-500',
  high:   'bg-green-500 text-white hover:bg-green-600',
};

export default function GradebookGrid({
  students = [],
  competencies = [],
  scores = {},
  levels = {},
  onScoreChange,
  onLevelChange,
  onFeedback,
  onFlag,
  flagged = new Set(),
  hasFeedback = new Set(),
}) {
  const [saving, setSaving] = useState({});
  const saveTimer = useRef({});

  const scheduleAutoSave = useCallback((key, fn) => {
    clearTimeout(saveTimer.current[key]);
    saveTimer.current[key] = setTimeout(async () => {
      setSaving(s => ({ ...s, [key]: true }));
      try { await fn(); } catch {}
      setSaving(s => ({ ...s, [key]: false }));
    }, 600);
  }, []);

  function handleScore(studentId, compId, value) {
    const key = `score:${studentId}:${compId}`;
    onScoreChange?.(studentId, compId, value);
    scheduleAutoSave(key, () => onScoreChange?.(studentId, compId, value, true));
  }

  function handleLevel(studentId, compId) {
    const cur = levels[`${studentId}:${compId}`];
    const next = LEVEL_NEXT[cur] || 'low';
    onLevelChange?.(studentId, compId, next);
  }

  if (!students.length) {
    return <p className="text-sm text-gray-400 py-6 text-center">No students in this class.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
      <table className="border-collapse text-xs w-full">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            <th className="sticky left-0 z-20 bg-gray-50 px-3 py-3 text-left font-semibold text-gray-600 min-w-[150px] border-r border-gray-200">
              Student
            </th>
            {competencies.map(c => (
              <th key={c.id} className="px-2 py-3 text-center font-semibold text-gray-600 min-w-[90px] whitespace-nowrap" title={c.name}>
                {c.code || c.name.slice(0, 8)}
              </th>
            ))}
            <th className="px-2 py-3 text-center font-semibold text-gray-600 min-w-[70px]">Score</th>
            <th className="px-2 py-3 text-center font-semibold text-gray-600 min-w-[80px]">Actions</th>
          </tr>
        </thead>
        <tbody>
          {students.map((s, si) => {
            const isFlagged = flagged.has(s.id);
            const hasFb     = hasFeedback.has(s.id);
            return (
              <tr
                key={s.id}
                className={`border-b border-gray-100 transition-colors
                  ${si % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}
                  ${isFlagged ? 'bg-red-50/60 hover:bg-red-50' : 'hover:bg-indigo-50/20'}`}
              >
                {/* Student name */}
                <td className="sticky left-0 z-10 bg-inherit px-3 py-2 border-r border-gray-200">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-slate-700 text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                      {s.name?.[0] || '?'}
                    </div>
                    <span className="font-medium text-gray-700 whitespace-nowrap">{s.name}</span>
                    {isFlagged && <span className="text-red-500 text-[10px]">🚩</span>}
                  </div>
                </td>

                {/* Competency toggles */}
                {competencies.map(c => {
                  const key   = `${s.id}:${c.id}`;
                  const level = levels[key];
                  return (
                    <td key={c.id} className="px-2 py-2 text-center">
                      <button
                        onClick={() => handleLevel(s.id, c.id)}
                        title={`Click to cycle: low → medium → high`}
                        className={`w-9 h-7 rounded font-bold text-[10px] uppercase transition-colors
                          ${level ? LEVEL_STYLE[level] : 'bg-gray-200 text-gray-400 hover:bg-gray-300'}`}
                      >
                        {level ? level[0].toUpperCase() : '—'}
                      </button>
                    </td>
                  );
                })}

                {/* Score input */}
                <td className="px-2 py-2 text-center">
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      value={scores[s.id] ?? ''}
                      onChange={e => handleScore(s.id, null, e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Tab') return;
                        if (e.key === 'Enter') e.target.blur();
                      }}
                      className="w-16 px-2 py-1 text-center text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="—"
                    />
                    {saving[`score:${s.id}`] && (
                      <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                    )}
                  </div>
                </td>

                {/* Action icons */}
                <td className="px-2 py-2 text-center">
                  <div className="flex items-center justify-center gap-1.5">
                    <button
                      onClick={() => onFeedback?.(s)}
                      title="Add feedback"
                      className={`p-1 rounded hover:bg-indigo-100 transition-colors
                        ${hasFb ? 'text-indigo-600' : 'text-gray-300 hover:text-indigo-400'}`}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => onFlag?.(s)}
                      title={isFlagged ? 'Unflag student' : 'Flag for remediation'}
                      className={`p-1 rounded hover:bg-red-100 transition-colors
                        ${isFlagged ? 'text-red-500' : 'text-gray-300 hover:text-red-400'}`}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v1.5M3 21v-6m0 0l2.77-.693a9 9 0 016.208.682l.108.054a9 9 0 006.086.71l3.114-.732a48.524 48.524 0 01-.005-10.499l-3.11.732a9 9 0 01-6.085-.711l-.108-.054a9 9 0 00-6.208-.682L3 4.5M3 15V4.5" />
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
