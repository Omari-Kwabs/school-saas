import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useBrand } from '../context/BrandContext';
import { roleLabel } from '../utils/access';
import { api } from '../api';
import SearchModal from './SearchModal';

export default function TopBar({ onMenuClick }) {
  const { user, logout }   = useAuth();
  const { brand, palette } = useBrand();
  const navigate = useNavigate();
  const [dropdownOpen,   setDropdownOpen]   = useState(false);
  const [searchOpen,     setSearchOpen]     = useState(false);
  const [pendingCount,   setPendingCount]   = useState(0);
  const dropdownRef = useRef(null);

  useEffect(() => {
    function onClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') setDropdownOpen(false);
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(o => !o);
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // Fetch pending approval count on mount and every 60 seconds
  useEffect(() => {
    let cancelled = false;
    function fetchCount() {
      api.get('/approvals/pending/count')
        .then(data => { if (!cancelled) setPendingCount(data.count || 0); })
        .catch(() => {});
    }
    fetchCount();
    const interval = setInterval(fetchCount, 60000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  function handleLogout() {
    logout();
    navigate('/login');
  }

  const initials   = user?.name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'U';
  const schoolName = brand.schoolName || user?.school_name || 'Your School';
  const motto      = brand.motto || '';
  const logoUrl    = brand.logoUrl || '';
  const onColor    = palette.textOnPrimary;       // white or dark text depending on primary brightness
  const dimColor   = onColor === '#ffffff' ? 'rgba(255,255,255,0.65)' : 'rgba(30,41,59,0.55)';

  return (
    <>
      <header
        className="sticky top-0 h-14 flex items-center px-4 gap-3 shrink-0 z-10"
        style={{ background: palette.primary, color: onColor }}
      >
        {/* Hamburger */}
        <button
          onClick={onMenuClick}
          className="topbar-surface-btn p-1.5 rounded-md transition-colors"
          style={{ color: onColor }}
          aria-label="Toggle sidebar"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>
        </button>

        {/* School identity */}
        <div className="hidden sm:flex items-center gap-2">
          {logoUrl
            ? <img src={logoUrl} alt="Logo" className="h-8 w-8 object-contain rounded" />
            : (
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0"
                style={{ background: 'rgba(0,0,0,0.2)', color: onColor }}
              >
                {schoolName[0] || 'S'}
              </div>
            )
          }
          <div>
            <p className="text-sm font-semibold leading-tight" style={{ color: onColor }}>{schoolName}</p>
            {motto && <p className="text-[11px] leading-tight italic" style={{ color: dimColor }}>{motto}</p>}
          </div>
        </div>

        <div className="flex-1" />

        {/* Search trigger */}
        <button
          onClick={() => setSearchOpen(true)}
          className="hidden md:flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg transition-colors topbar-surface-btn"
          style={{ background: 'rgba(0,0,0,0.15)', color: onColor }}
          title="Search (Ctrl+K)"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <span>Search</span>
          <kbd
            className="text-[10px] rounded px-1 py-0.5 font-mono"
            style={{ background: 'rgba(0,0,0,0.2)', color: onColor, border: `1px solid ${dimColor}` }}
          >
            Ctrl K
          </kbd>
        </button>

        {/* Notification bell */}
        <button
          onClick={() => navigate('/approvals')}
          className="topbar-surface-btn p-1.5 rounded-md transition-colors"
          style={{ color: onColor, position: 'relative' }}
          title="Pending Approvals"
          aria-label="Pending approvals"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
            strokeWidth={1.5} stroke="currentColor" style={{ width: 20, height: 20 }}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
          </svg>
          {pendingCount > 0 && (
            <span style={{
              position: 'absolute', top: 0, right: 0,
              background: '#f97316', color: '#fff',
              fontSize: 10, fontWeight: 700, lineHeight: 1,
              padding: '2px 5px', borderRadius: 999,
              minWidth: 16, textAlign: 'center',
              transform: 'translate(30%, -30%)',
              pointerEvents: 'none',
            }}>
              {pendingCount > 99 ? '99+' : pendingCount}
            </span>
          )}
        </button>

        {/* Profile dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(o => !o)}
            className="topbar-surface-btn flex items-center gap-2 rounded-full px-1.5 py-1 transition-colors"
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0"
              style={{ background: palette.sidebarBg, color: '#fff' }}
            >
              {initials}
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-sm font-medium leading-tight" style={{ color: onColor }}>{user?.name}</p>
              <p className="text-[11px] leading-tight capitalize" style={{ color: dimColor }}>{roleLabel(user?.role)}</p>
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
              className="w-3.5 h-3.5 hidden sm:block" style={{ color: dimColor }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
          </button>

          {/* Dropdown — always white */}
          {dropdownOpen && (
            <div className="absolute right-0 top-full mt-2 w-52 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100">
                <p className="text-sm font-semibold text-gray-800 truncate">{user?.name}</p>
                <p className="text-xs text-gray-500 capitalize mt-0.5">{roleLabel(user?.role)}</p>
              </div>
              <div className="py-1">
                <button
                  onClick={() => { navigate('/profile'); setDropdownOpen(false); }}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 text-gray-400">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                  </svg>
                  View Profile
                </button>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
                  </svg>
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </header>

      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
