import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const P = {
  grid:      'M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z',
  check:     'M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  chart:     'M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z',
  bell:      'M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0',
  currency:  'M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  clipboard: 'M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z',
  heart:     'M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z',
};

const NAV_GROUPS = [
  {
    label: 'Manage',
    short: 'Mgmt',
    icon:  'grid',
    items: [
      { label: 'Schools',    path: '/admin/schools',    icon: 'grid'  },
      { label: 'Onboarding', path: '/admin/onboarding', icon: 'check' },
    ],
  },
  {
    label: 'Monitor',
    short: 'Monitor',
    icon:  'chart',
    items: [
      { label: 'Health', path: '/admin/health', icon: 'heart'     },
      { label: 'Alerts', path: '/admin/alerts', icon: 'bell'      },
      { label: 'Usage',  path: '/admin/usage',  icon: 'chart'     },
      { label: 'Logs',   path: '/admin/logs',   icon: 'clipboard' },
    ],
  },
  {
    label: 'Finance',
    short: 'Fin',
    icon:  'currency',
    items: [
      { label: 'Billing', path: '/admin/billing', icon: 'currency' },
    ],
  },
];

function NavIcon({ name, size = 'w-4 h-4' }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className={`${size} shrink-0`}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d={P[name]} />
    </svg>
  );
}

export default function AdminSidebar({ collapsed, mobileOpen, onClose }) {
  const { user }  = useAuth();
  const location  = useLocation();

  const initials = user?.name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'SA';

  function groupForPath(pathname) {
    for (let i = 0; i < NAV_GROUPS.length; i++) {
      if (NAV_GROUPS[i].items.some(item =>
        item.path === pathname || pathname.startsWith(item.path + '/')
      )) return i;
    }
    return 0;
  }

  const [activeGroup, setActiveGroup] = useState(() => groupForPath(location.pathname));

  useEffect(() => {
    setActiveGroup(groupForPath(location.pathname));
  }, [location.pathname]);

  const activeItems = NAV_GROUPS[activeGroup]?.items || [];

  return (
    <aside
      className={[
        'fixed inset-y-0 left-0 z-30 flex flex-col bg-slate-900 text-white',
        'transition-all duration-200 ease-in-out',
        'lg:relative lg:z-auto lg:translate-x-0',
        mobileOpen ? 'translate-x-0' : '-translate-x-full',
        collapsed ? 'lg:w-16' : 'lg:w-60',
        'w-60',
      ].join(' ')}
    >
      {/* Brand header */}
      <div className="flex items-center gap-3 px-4 h-14 border-b border-slate-700/60 shrink-0">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 font-bold text-sm text-white bg-indigo-600">
          A
        </div>
        {!collapsed && (
          <span className="font-semibold text-sm tracking-wide truncate">Admin Console</span>
        )}
      </div>

      {/* Group tabs */}
      {!collapsed && (
        <div className="flex border-b border-slate-700/60 shrink-0">
          {NAV_GROUPS.map((group, idx) => {
            const isActive = idx === activeGroup;
            return (
              <button
                key={group.label}
                onClick={() => setActiveGroup(idx)}
                title={group.label}
                className={[
                  'flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors',
                  isActive
                    ? 'text-white bg-white/10'
                    : 'text-slate-500 hover:text-slate-300 hover:bg-white/5',
                ].join(' ')}
                style={isActive ? { boxShadow: 'inset 0 -2px 0 #4f46e5' } : {}}
              >
                <NavIcon name={group.icon} size="w-4 h-4" />
                <span>{group.short}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Nav items */}
      <nav className="sidebar-nav flex-1 overflow-y-auto py-2">
        {collapsed
          ? NAV_GROUPS.flatMap(g => g.items).map(item => (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={onClose}
                title={item.label}
                className={({ isActive }) =>
                  [
                    'flex items-center justify-center p-2 mx-1 my-0.5 rounded-lg transition-colors',
                    isActive
                      ? 'bg-white/10 text-white'
                      : 'text-slate-400 hover:text-white hover:bg-white/5',
                  ].join(' ')
                }
              >
                <NavIcon name={item.icon} size="w-5 h-5" />
              </NavLink>
            ))
          : (
            <ul>
              {activeItems.map(item => (
                <li key={item.path}>
                  <NavLink
                    to={item.path}
                    onClick={onClose}
                    className={({ isActive }) =>
                      [
                        'flex items-center gap-2.5 px-3 py-1.5 mx-1 rounded-lg text-sm transition-colors',
                        isActive
                          ? 'bg-white/10 text-white'
                          : 'text-slate-400 hover:text-white hover:bg-white/5',
                      ].join(' ')
                    }
                  >
                    <NavIcon name={item.icon} size="w-5 h-5" />
                    <span className="font-medium">{item.label}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
          )
        }
      </nav>

      {/* User footer */}
      <div className={`border-t border-slate-700/60 shrink-0 ${collapsed ? 'flex justify-center p-3' : 'flex items-center gap-2.5 px-3 py-2.5'}`}>
        <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-[11px] font-bold shrink-0">
          {initials}
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="text-xs font-medium text-slate-300 truncate leading-tight">{user?.name}</p>
            <p className="text-[10px] text-slate-500 leading-tight">System Admin</p>
          </div>
        )}
      </div>
    </aside>
  );
}
