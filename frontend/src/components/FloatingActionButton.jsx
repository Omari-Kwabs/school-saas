import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const ACTIONS = [
  {
    label: 'Add Note',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
      </svg>
    ),
    path: null,
    bg: 'bg-indigo-500',
  },
  {
    label: 'Record Feeding',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8.25v-1.5m0 1.5c-1.355 0-2.697.056-4.024.166C6.845 8.51 6 9.473 6 10.608v2.513m6-4.87c1.355 0 2.697.055 4.024.165C17.155 8.51 18 9.473 18 10.608v2.513m-3-4.87v-1.5" />
      </svg>
    ),
    path: '/feeding',
    bg: 'bg-orange-500',
  },
  {
    label: 'Log Incident',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
      </svg>
    ),
    path: '/announcements',
    bg: 'bg-red-500',
  },
];

export default function FloatingActionButton({ onNote }) {
  const [open, setOpen]   = useState(false);
  const navigate          = useNavigate();
  const wrapRef           = useRef(null);

  useEffect(() => {
    function onClickOutside(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  function handleAction(action) {
    setOpen(false);
    if (action.path) navigate(action.path);
    else if (action.label === 'Add Note') onNote?.();
  }

  return (
    <div ref={wrapRef} className="fixed bottom-6 right-6 z-50 flex flex-col-reverse items-end gap-3">
      {/* Action buttons */}
      {open && ACTIONS.map((action, i) => (
        <div
          key={action.label}
          className="flex items-center gap-3 animate-in slide-in-from-bottom-2"
          style={{ animationDelay: `${i * 40}ms` }}
        >
          <span className="text-xs font-semibold text-white bg-gray-800/80 backdrop-blur-sm px-2.5 py-1 rounded-lg shadow">
            {action.label}
          </span>
          <button
            onClick={() => handleAction(action)}
            className={`w-12 h-12 rounded-full ${action.bg} text-white shadow-lg flex items-center justify-center hover:scale-110 transition-transform`}
          >
            {action.icon}
          </button>
        </div>
      ))}

      {/* Main FAB */}
      <button
        onClick={() => setOpen(o => !o)}
        className={`w-14 h-14 rounded-full bg-indigo-600 text-white shadow-xl flex items-center justify-center transition-all hover:bg-indigo-700 hover:shadow-2xl
          ${open ? 'rotate-45' : 'rotate-0'}`}
        aria-label="Quick actions"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-6 h-6 transition-transform duration-200">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
      </button>
    </div>
  );
}
