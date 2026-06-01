import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { hasPrivilege, hasAccess } from '../utils/access';
import { api } from '../api';

const NAV_ITEMS = [
  { label: 'Dashboard',            path: '/dashboard',            always: true },
  { label: 'Students',             path: '/students',             always: true },
  { label: 'Announcements',        path: '/announcements',        always: true },
  { label: 'Memos',                path: '/memos',                always: true },
  { label: 'Profile',              path: '/profile',              always: true },
  { label: 'Assessments',          path: '/assessments',          privilege: 'academic:read' },
  { label: 'Grades',               path: '/grades',               privilege: 'academic:read' },
  { label: 'Results',              path: '/results',              privilege: 'academic:read' },
  { label: 'Intelligence',         path: '/intelligence',         privilege: 'academic:read' },
  { label: 'Reports',              path: '/reports',              privilege: 'reports:read' },
  { label: 'Fees & Payments',      path: '/fees',                 privilege: 'finance:read' },
  { label: 'Fee Structures',       path: '/fee-structures',       privilege: 'finance:read' },
  { label: 'Attendance',           path: '/attendance',           privilege: 'attendance:write' },
  { label: 'Feeding',              path: '/feeding',              privilege: 'feeding:write' },
  { label: 'Timetable',            path: '/timetable',            privilege: 'timetable:manage' },
  { label: 'Classes',              path: '/classes',              privilege: 'classes:manage' },
  { label: 'Users',                path: '/users',                privilege: 'users:manage' },
  { label: 'Store',                path: '/store',                roles: ['owner'] },
  { label: 'Teacher Performance',  path: '/teacher-performance',  roles: ['owner','headmaster_academics','headmaster_admin'] },
];

function Icon({ d }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
      strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 shrink-0 text-gray-400">
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  );
}

const SEARCH_ICON = 'M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z';
const PAGE_ICON   = 'M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25';
const USER_ICON   = 'M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z';

export default function SearchModal({ open, onClose }) {
  const { user }      = useAuth();
  const navigate      = useNavigate();
  const inputRef      = useRef(null);
  const listRef       = useRef(null);

  const [query,      setQuery]      = useState('');
  const [students,   setStudents]   = useState([]);
  const [loadingStd, setLoadingStd] = useState(false);
  const [cursor,     setCursor]     = useState(0);
  const debounceRef  = useRef(null);

  const pages = NAV_ITEMS.filter(item => {
    if (item.always) return true;
    if (item.roles)      return hasAccess(user, item.roles);
    if (item.privilege)  return hasPrivilege(user, item.privilege);
    return true;
  });

  const filteredPages = query.trim()
    ? pages.filter(p => p.label.toLowerCase().includes(query.toLowerCase()))
    : pages;

  const results = [
    ...filteredPages.map(p => ({ type: 'page', label: p.label, path: p.path })),
    ...students.map(s => ({ type: 'student', label: s.name, sub: s.student_code, path: `/students/${s.id}` })),
  ];

  useEffect(() => {
    if (open) {
      setQuery('');
      setStudents([]);
      setCursor(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  useEffect(() => {
    setCursor(0);
  }, [query]);

  const fetchStudents = useCallback((q) => {
    if (q.length < 2) { setStudents([]); return; }
    setLoadingStd(true);
    api.get(`/students?search=${encodeURIComponent(q)}&limit=5`)
      .then(d => setStudents(Array.isArray(d) ? d : []))
      .catch(() => setStudents([]))
      .finally(() => setLoadingStd(false));
  }, []);

  function handleQueryChange(e) {
    const q = e.target.value;
    setQuery(q);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchStudents(q), 300);
  }

  function go(path) {
    navigate(path);
    onClose();
  }

  function handleKeyDown(e) {
    if (e.key === 'Escape') { onClose(); return; }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setCursor(c => Math.min(c + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setCursor(c => Math.max(c - 1, 0));
    } else if (e.key === 'Enter' && results[cursor]) {
      go(results[cursor].path);
    }
  }

  useEffect(() => {
    if (!listRef.current) return;
    const active = listRef.current.querySelector('[data-active="true"]');
    active?.scrollIntoView({ block: 'nearest' });
  }, [cursor]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4"
      style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(2px)' }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden"
        onKeyDown={handleKeyDown}
      >
        {/* Input */}
        <div className="flex items-center gap-3 px-4 border-b border-gray-100">
          <Icon d={SEARCH_ICON} />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search pages or students…"
            value={query}
            onChange={handleQueryChange}
            className="flex-1 py-4 text-sm text-gray-800 placeholder-gray-400 outline-none bg-transparent"
          />
          {loadingStd && (
            <span className="text-xs text-gray-400">Searching…</span>
          )}
          <kbd className="text-[10px] bg-gray-100 border border-gray-200 rounded px-1.5 py-0.5 text-gray-500 font-mono">
            Esc
          </kbd>
        </div>

        {/* Results */}
        <ul ref={listRef} className="max-h-80 overflow-y-auto py-2">
          {results.length === 0 && (
            <li className="px-4 py-6 text-sm text-gray-400 text-center">
              {query.length >= 2 && !loadingStd ? 'No results found.' : 'Type to search…'}
            </li>
          )}

          {results.length > 0 && filteredPages.length > 0 && (
            <li className="px-4 pt-1 pb-0.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
              Pages
            </li>
          )}

          {results.map((item, i) => {
            const isFirst = i === filteredPages.length && item.type === 'student';
            return (
              <React.Fragment key={item.path + item.label}>
                {isFirst && (
                  <li className="px-4 pt-3 pb-0.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                    Students
                  </li>
                )}
                <li>
                  <button
                    data-active={cursor === i ? 'true' : 'false'}
                    onClick={() => go(item.path)}
                    onMouseEnter={() => setCursor(i)}
                    className={[
                      'w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors',
                      cursor === i ? 'bg-indigo-50 text-indigo-700' : 'text-gray-700 hover:bg-gray-50',
                    ].join(' ')}
                  >
                    <Icon d={item.type === 'student' ? USER_ICON : PAGE_ICON} />
                    <span className="flex-1 font-medium">{item.label}</span>
                    {item.sub && <span className="text-xs text-gray-400">{item.sub}</span>}
                    {cursor === i && (
                      <span className="text-[10px] text-indigo-400 font-mono">↵</span>
                    )}
                  </button>
                </li>
              </React.Fragment>
            );
          })}
        </ul>

        {/* Footer hint */}
        <div className="flex items-center gap-4 px-4 py-2 border-t border-gray-100 text-[11px] text-gray-400">
          <span><kbd className="font-mono bg-gray-100 rounded px-1">↑↓</kbd> navigate</span>
          <span><kbd className="font-mono bg-gray-100 rounded px-1">↵</kbd> open</span>
          <span><kbd className="font-mono bg-gray-100 rounded px-1">Esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
}
