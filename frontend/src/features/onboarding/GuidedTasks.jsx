import React from 'react';

export default function GuidedTasks({ tasks = [], onTaskClick = () => {} }) {
  const defaultTasks = [
    {
      id: 1,
      title: 'Record Attendance',
      description: 'Mark daily attendance for your students',
      icon: '📋',
      status: 'available',
    },
    {
      id: 2,
      title: 'Record Payment',
      description: 'Log student fee payments and receipts',
      icon: '💳',
      status: 'available',
    },
    {
      id: 3,
      title: 'Create Assessment',
      description: 'Set up your first test or assignment',
      icon: '✏️',
      status: 'available',
    },
    {
      id: 4,
      title: 'Post Announcement',
      description: 'Communicate with staff and parents',
      icon: '📢',
      status: 'available',
    },
  ];

  const displayTasks = tasks.length > 0 ? tasks : defaultTasks;

  return (
    <div className="space-y-3">
      {displayTasks.map((task) => (
        <button
          key={task.id}
          onClick={() => onTaskClick(task.id)}
          className="w-full text-left p-4 bg-white rounded-lg border border-gray-200 hover:border-indigo-300 hover:shadow-md transition-all"
        >
          <div className="flex items-start gap-4">
            <span className="text-3xl">{task.icon}</span>
            <div className="flex-1">
              <p className="font-semibold text-gray-900">{task.title}</p>
              <p className="text-sm text-gray-600 mt-1">{task.description}</p>
            </div>
            <span className="text-gray-400 text-lg">→</span>
          </div>
        </button>
      ))}
    </div>
  );
}
