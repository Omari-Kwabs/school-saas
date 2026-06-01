import React from 'react';
import { useNavigate } from 'react-router-dom';

function TaskItem({ icon, label, count, to, urgent }) {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => to && navigate(to)}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors text-left
        ${urgent
          ? 'bg-red-50 border-red-200 hover:bg-red-100'
          : 'bg-white border-gray-100 hover:bg-gray-50'
        }`}
    >
      <span className="text-xl shrink-0">{icon}</span>
      <span className={`flex-1 text-sm font-medium ${urgent ? 'text-red-700' : 'text-gray-700'}`}>{label}</span>
      <span className={`text-xs font-bold px-2 py-0.5 rounded-full
        ${count > 0
          ? urgent
            ? 'bg-red-500 text-white'
            : 'bg-indigo-600 text-white'
          : 'bg-gray-100 text-gray-400'
        }`}>
        {count}
      </span>
    </button>
  );
}

export default function TaskPanel({ pendingGrading = 0, feedbackPending = 0, flaggedStudents = 0 }) {
  return (
    <div className="space-y-2">
      <TaskItem
        icon="📝"
        label="Assessments awaiting grades"
        count={pendingGrading}
        to="/grades"
        urgent={pendingGrading > 0}
      />
      <TaskItem
        icon="💬"
        label="Feedback to be given"
        count={feedbackPending}
        to="/assessments"
        urgent={false}
      />
      <TaskItem
        icon="🚩"
        label="Students flagged for remediation"
        count={flaggedStudents}
        to="/students"
        urgent={flaggedStudents > 3}
      />
    </div>
  );
}
