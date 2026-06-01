import React, { useState, useRef } from 'react';

const STATUS = { present: 'Present', absent: 'Absent', late: 'Late', excused: 'Excused' };

const STATUS_STYLE = {
  present: { card: 'border-green-400 bg-green-50',  badge: 'bg-green-500 text-white',  icon: '✓' },
  absent:  { card: 'border-red-400 bg-red-50',    badge: 'bg-red-500 text-white',    icon: '✗' },
  late:    { card: 'border-amber-400 bg-amber-50', badge: 'bg-amber-500 text-white',  icon: '⏱' },
  excused: { card: 'border-blue-400 bg-blue-50',   badge: 'bg-blue-500 text-white',   icon: 'E' },
};

function SwipeCard({ student, status, onSwipe, onTap }) {
  const startX = useRef(null);
  const cardRef = useRef(null);
  const [offset, setOffset] = useState(0);
  const [swiping, setSwiping] = useState(false);

  const THRESHOLD = 80;

  function onTouchStart(e) {
    startX.current = e.touches[0].clientX;
    setSwiping(true);
  }

  function onTouchMove(e) {
    if (startX.current === null) return;
    const dx = e.touches[0].clientX - startX.current;
    setOffset(Math.max(-THRESHOLD * 1.5, Math.min(THRESHOLD * 1.5, dx)));
  }

  function onTouchEnd() {
    if (offset > THRESHOLD) onSwipe?.(student.id, 'present');
    else if (offset < -THRESHOLD) onSwipe?.(student.id, 'absent');
    setOffset(0);
    setSwiping(false);
    startX.current = null;
  }

  const s = STATUS_STYLE[status] || {};

  return (
    <div className="relative overflow-hidden rounded-xl mb-2">
      {/* Swipe hint backgrounds */}
      <div className="absolute inset-0 flex">
        <div className="flex-1 bg-green-500 flex items-center pl-5">
          <span className="text-white font-bold text-lg">✓ Present</span>
        </div>
        <div className="flex-1 bg-red-500 flex items-center justify-end pr-5">
          <span className="text-white font-bold text-lg">✗ Absent</span>
        </div>
      </div>

      {/* Card */}
      <div
        ref={cardRef}
        className={`relative flex items-center gap-3 p-4 bg-white border-2 rounded-xl cursor-pointer select-none
          ${status ? s.card : 'border-gray-200 bg-white'}
          ${swiping ? '' : 'transition-transform duration-150'}`}
        style={{ transform: `translateX(${offset}px)` }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onClick={() => !swiping && onTap?.(student.id)}
      >
        {/* Avatar */}
        <div className="w-10 h-10 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-sm shrink-0">
          {student.name?.[0] || '?'}
        </div>

        {/* Name */}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-800 text-sm truncate">{student.name}</p>
          {student.student_code && (
            <p className="text-xs text-gray-400">{student.student_code}</p>
          )}
        </div>

        {/* Status badge */}
        {status ? (
          <span className={`px-3 py-1 rounded-full text-xs font-bold ${s.badge}`}>
            {s.icon} {STATUS[status]}
          </span>
        ) : (
          <span className="text-xs text-gray-300 italic">Swipe or tap</span>
        )}
      </div>
    </div>
  );
}

export default function AttendanceSwipe({ students = [], onSave }) {
  const [statuses, setStatuses] = useState({});

  function setStatus(studentId, status) {
    setStatuses(s => ({ ...s, [studentId]: status }));
  }

  function cycleTap(studentId) {
    const cur = statuses[studentId];
    const opts = Object.keys(STATUS);
    const next = opts[(opts.indexOf(cur) + 1) % opts.length];
    setStatus(studentId, next);
  }

  const marked   = Object.keys(statuses).length;
  const total    = students.length;
  const complete = marked === total && total > 0;

  return (
    <div className="space-y-4">
      {/* Progress header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">
          <span className="font-bold text-gray-800">{marked}</span> / {total} marked
        </p>
        {complete && (
          <button
            onClick={() => onSave?.(statuses)}
            className="px-4 py-1.5 text-sm font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Save Attendance
          </button>
        )}
      </div>

      {/* Swipe hint */}
      <p className="text-xs text-center text-gray-400 pb-1">
        Swipe right = Present · Swipe left = Absent · Tap to cycle statuses
      </p>

      {/* Student cards */}
      <div>
        {students.map(s => (
          <SwipeCard
            key={s.id}
            student={s}
            status={statuses[s.id]}
            onSwipe={setStatus}
            onTap={cycleTap}
          />
        ))}
      </div>

      {/* Summary chips */}
      {marked > 0 && (
        <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
          {Object.entries(STATUS).map(([key, label]) => {
            const count = Object.values(statuses).filter(v => v === key).length;
            if (!count) return null;
            const s = STATUS_STYLE[key];
            return (
              <span key={key} className={`px-2.5 py-1 rounded-full text-xs font-semibold ${s.badge}`}>
                {label}: {count}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
