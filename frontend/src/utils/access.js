// ── Privilege keys ────────────────────────────────────────────────────────────
export const PRIVILEGES = {
  FINANCE_READ:     'finance:read',
  FINANCE_WRITE:    'finance:write',
  ACADEMIC_READ:    'academic:read',
  ACADEMIC_WRITE:   'academic:write',
  ATTENDANCE_WRITE: 'attendance:write',
  REPORTS_READ:     'reports:read',
  USERS_MANAGE:     'users:manage',
  CLASSES_MANAGE:   'classes:manage',
  TIMETABLE_MANAGE: 'timetable:manage',
  ANNOUNCE_POST:    'announcements:post',
  STORE_MANAGE:     'store:manage',
  FEEDING_WRITE:    'feeding:write',
  ROLES_MANAGE:     'roles:manage',
  CALENDAR_MANAGE:  'calendar:manage',
};

// Human-readable list used in the Roles management UI
export const ALL_PRIVILEGES = [
  { key: 'finance:read',       label: 'View Finance (fees, payments, debtors)' },
  { key: 'finance:write',      label: 'Record Payments' },
  { key: 'academic:read',      label: 'View Grades & Results' },
  { key: 'academic:write',     label: 'Enter Grades & Results' },
  { key: 'attendance:write',   label: 'Record Attendance' },
  { key: 'reports:read',       label: 'Generate & View Reports' },
  { key: 'users:manage',       label: 'Manage Staff Users' },
  { key: 'classes:manage',     label: 'Manage Classes' },
  { key: 'timetable:manage',   label: 'Manage Timetable' },
  { key: 'announcements:post', label: 'Post Announcements' },
  { key: 'store:manage',       label: 'Manage Store Inventory' },
  { key: 'feeding:write',      label: 'Record Daily Feeding' },
  { key: 'roles:manage',       label: 'Manage Roles & Privileges' },
  { key: 'calendar:manage',    label: 'Manage School Calendar & Events' },
];

// Fallback for JWT tokens issued before this privilege system was deployed.
// Only used when user.privileges is undefined (i.e. old token).
const ROLE_DEFAULTS = {
  owner: Object.values(PRIVILEGES),
  teacher:             ['academic:read','academic:write','attendance:write','reports:read','feeding:write'],
  class_teacher:       ['academic:read','academic:write','attendance:write','reports:read','feeding:write'],
  department_head:     ['academic:read','academic:write','attendance:write','reports:read'],
  headmaster_academics:['academic:read','academic:write','attendance:write','reports:read','timetable:manage','announcements:post','feeding:write','calendar:manage'],
  headmaster_admin:    ['finance:read','finance:write','academic:read','attendance:write','reports:read','users:manage','classes:manage','timetable:manage','announcements:post','calendar:manage'],
  accountant:          ['finance:read','finance:write'],
  bursar:              ['finance:read','finance:write'],
};

export function hasPrivilege(user, privilege) {
  if (!user) return false;
  // New tokens: privileges array embedded in JWT
  if (Array.isArray(user.privileges)) return user.privileges.includes(privilege);
  // Legacy tokens: derive from role
  return ROLE_DEFAULTS[user.role]?.includes(privilege) ?? false;
}

// ── Legacy role-array helpers (kept for any remaining checks) ─────────────────
export const FINANCE_ROLES  = ['owner', 'bursar', 'headmaster_admin'];
export const ACADEMIC_ROLES = ['owner', 'teacher', 'headmaster_academics', 'department_head', 'class_teacher'];
export const ADMIN_ROLES    = ['owner', 'headmaster_admin'];
export const MANAGE_ROLES   = ['owner', 'headmaster_admin', 'headmaster_academics'];

export function roleLabel(role) {
  if (!role) return 'Unknown';
  if (role === 'owner') return 'Proprietor / Director';
  return role.replace(/_/g, ' ');
}

export function hasAccess(user, roles) {
  if (!user) return false;
  if (!roles || roles.length === 0) return true;
  return roles.includes(user.role);
}
