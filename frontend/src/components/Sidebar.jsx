import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useBrand } from '../context/BrandContext';
import { hasPrivilege, hasAccess } from '../utils/access';

const P = {
  home: 'M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25',
  clipboard: 'M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z',
  star: 'M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z',
  chart: 'M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z',
  document: 'M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z',
  currency: 'M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  table: 'M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0112 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125h7.5c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m-7.5 0h7.5',
  check: 'M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  utensils: 'M12 8.25v-1.5m0 1.5c-1.355 0-2.697.056-4.024.166C6.845 8.51 6 9.473 6 10.608v2.513m6-4.87c1.355 0 2.697.055 4.024.165C17.155 8.51 18 9.473 18 10.608v2.513m-3-4.87v-1.5m-6 1.5v-1.5m12 9.75l-1.5.75a3.354 3.354 0 01-3 0 3.354 3.354 0 00-3 0 3.354 3.354 0 01-3 0 3.354 3.354 0 00-3 0L3 16.5m15-3.38a48.474 48.474 0 00-6-.37c-2.032 0-4.034.125-6 .37m12 0c.39.049.777.102 1.163.16 1.07.16 1.837 1.094 1.837 2.175v5.17c0 .62-.504 1.124-1.125 1.124H4.125A1.125 1.125 0 013 20.625v-5.17c0-1.08.768-2.014 1.837-2.174A47.78 47.78 0 016 13.12',
  calendar: 'M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5',
  bell: 'M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0',
  mail: 'M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75',
  box: 'M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z',
  users: 'M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z',
  grid: 'M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z',
  userCog: 'M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z',
  award: 'M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 002.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 012.916.52 6.003 6.003 0 01-5.395 4.972m0 0a6.726 6.726 0 01-2.749 1.35m0 0a6.772 6.772 0 01-3.044 0',
  person: 'M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z',
  brain: 'M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23-.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5',
  cog: 'M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
};

const NAV_GROUPS = [
  {
    label: 'Academics',
    short: 'Acad',
    icon: 'star',
    items: [
      { label: 'Dashboard',    path: '/dashboard',    icon: 'home',      always: true },
      { label: 'Assessments',       path: '/assessments', icon: 'clipboard', privilege: 'academic:read' },
      { label: 'Academic Records',  path: '/grades',      icon: 'chart',     privilege: 'academic:read' },
      { label: 'Intelligence', path: '/intelligence', icon: 'brain',     privilege: 'academic:read' },
      { label: 'Reports',      path: '/reports',      icon: 'document',  privilege: 'reports:read'  },
      { label: 'Approvals',    path: '/approvals',    icon: 'check',     always: true               },
    ],
  },
  {
    label: 'Finance',
    short: 'Fin',
    icon: 'currency',
    items: [
      { label: 'Fees',           path: '/fees',           icon: 'currency', privilege: 'finance:read' },
      { label: 'Fee Structures', path: '/fee-structures', icon: 'table',    privilege: 'finance:read' },
      { label: 'Expenses',       path: '/expenses',       icon: 'document', privilege: 'finance:read' },
    ],
  },
  {
    label: 'Operations',
    short: 'Ops',
    icon: 'calendar',
    items: [
      { label: 'Attendance',    path: '/attendance',    icon: 'check',    privilege: 'attendance:write' },
      { label: 'Feeding',       path: '/feeding',       icon: 'utensils', privilege: 'feeding:write'    },
      { label: 'Timetable',     path: '/timetable',     icon: 'calendar', privilege: 'timetable:manage' },
      { label: 'Calendar',      path: '/calendar',      icon: 'calendar', always: true                  },
      { label: 'Announcements', path: '/announcements', icon: 'bell',     always: true                  },
      { label: 'Memos',         path: '/memos',         icon: 'mail',     always: true                  },
      { label: 'Store',             path: '/store',             icon: 'box',      roles: ['owner']            },
      { label: 'Deletion Requests', path: '/deletion-requests', icon: 'document', roles: ['owner']            },
      { label: 'Terms',             path: '/terms',             icon: 'calendar', privilege: 'classes:manage' },
      { label: 'Archive',       path: '/archive',       icon: 'document', privilege: 'classes:manage'   },
    ],
  },
  {
    label: 'People',
    short: 'People',
    icon: 'users',
    items: [
      { label: 'Students',            path: '/students',            icon: 'users',   always: true                                                },
      { label: 'Classes',             path: '/classes',             icon: 'grid',    privilege: 'classes:manage'                                 },
      { label: 'Users',               path: '/users',               icon: 'userCog', privilege: 'users:manage'                                   },
      { label: 'Teacher Performance', path: '/teacher-performance', icon: 'award',   roles: ['owner', 'headmaster_academics', 'headmaster_admin'] },
      { label: 'My Dashboard',        path: '/my-dashboard',        icon: 'chart',   roles: ['teacher', 'class_teacher', 'department_head'] },
    ],
  },
  {
    label: 'Settings',
    short: 'Setup',
    icon: 'cog',
    items: [
      { label: 'Profile', path: '/profile', icon: 'person', always: true },
    ],
  },
];

function NavIcon({ name, size = 'w-4 h-4' }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
      strokeWidth={1.5} stroke="currentColor" className={`${size} shrink-0`}>
      <path strokeLinecap="round" strokeLinejoin="round" d={P[name]} />
    </svg>
  );
}

export default function Sidebar({ collapsed, mobileOpen, onClose }) {
  const { user }           = useAuth();
  const { brand, palette } = useBrand();
  const location           = useLocation();

  function visible(item) {
    if (item.always) return true;
    if (item.roles) return hasAccess(user, item.roles);
    if (item.privilege) return hasPrivilege(user, item.privilege);
    return true;
  }

  const visibleGroups = NAV_GROUPS
    .map(g => ({ ...g, items: g.items.filter(visible) }))
    .filter(g => g.items.length > 0);

  function groupForPath(pathname) {
    for (let i = 0; i < visibleGroups.length; i++) {
      if (visibleGroups[i].items.some(item =>
        item.path === pathname || (item.path !== '/' && pathname.startsWith(item.path + '/'))
      )) return i;
    }
    return 0;
  }

  const [activeGroup, setActiveGroup] = useState(() => groupForPath(location.pathname));

  useEffect(() => {
    setActiveGroup(groupForPath(location.pathname));
  }, [location.pathname]);

  const initials    = user?.name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'U';
  const activeItems = visibleGroups[activeGroup]?.items || [];

  return (
    <aside
      className={[
        'fixed inset-y-0 left-0 z-30 flex flex-col text-white',
        'transition-all duration-200 ease-in-out',
        'lg:relative lg:z-auto lg:translate-x-0',
        mobileOpen ? 'translate-x-0' : '-translate-x-full',
        collapsed ? 'lg:w-16' : 'lg:w-60',
        'w-60',
      ].join(' ')}
      style={{ background: palette.sidebarBg }}
    >
      {/* Brand header */}
      <div className="flex items-center gap-3 px-4 h-14 border-b border-white/10 shrink-0">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 font-bold text-sm text-white overflow-hidden"
          style={{ background: palette.primary }}
        >
          {brand.logoUrl
            ? <img src={brand.logoUrl} alt="" className="w-full h-full object-contain" />
            : (brand.schoolName?.[0] || 'S')}
        </div>
        {!collapsed && (
          <span className="font-semibold text-sm tracking-wide truncate text-white">
            {brand.schoolName || 'SchoolSaaS'}
          </span>
        )}
      </div>

      {/* Group tabs */}
      {!collapsed && (
        <div className="flex border-b border-white/10 shrink-0">
          {visibleGroups.map((group, idx) => {
            const isActive = idx === activeGroup;
            return (
              <button
                key={group.label}
                onClick={() => setActiveGroup(idx)}
                title={group.label}
                className="flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors"
                style={{
                  color: isActive ? '#fff' : 'rgba(255,255,255,0.4)',
                  background: isActive ? 'rgba(255,255,255,0.08)' : 'transparent',
                  boxShadow: isActive ? `inset 0 -2px 0 ${palette.primary}` : 'none',
                }}
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
          ? visibleGroups.flatMap(g => g.items).map(item => (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={onClose}
                title={item.label}
                className={({ isActive }) =>
                  `sidebar-item flex items-center justify-center p-2 mx-1 my-0.5 rounded-lg${isActive ? ' sidebar-item-active' : ''}`
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
                      `sidebar-item flex items-center gap-2.5 px-3 py-1.5 mx-1 rounded-lg text-sm${isActive ? ' sidebar-item-active' : ''}`
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
      <div
        className={`border-t border-white/10 shrink-0 ${collapsed ? 'flex justify-center p-3' : 'flex items-center gap-2.5 px-3 py-2.5'}`}
      >
        <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 bg-white/15">
          {initials}
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="text-xs font-medium text-white/80 truncate leading-tight">{user?.name}</p>
            <p className="text-[10px] text-white/40 capitalize leading-tight">{user?.role?.replace(/_/g, ' ')}</p>
          </div>
        )}
      </div>
    </aside>
  );
}
