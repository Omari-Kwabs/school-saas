import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { hasPrivilege, PRIVILEGES, roleLabel } from '../utils/access';

function NavGroup({ label, children }) {
  const items = React.Children.toArray(children);
  if (!items.length) return null;
  return (
    <div className="nav-group">
      <span className="nav-group-label">{label}</span>
      <div className="nav-dropdown">{items}</div>
    </div>
  );
}

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() { logout(); navigate('/login'); }

  if (!user) return null;

  const P = PRIVILEGES;

  return (
    <nav>
      <span className="brand">SchoolSaaS</span>
      <NavLink to="/dashboard">Dashboard</NavLink>
      <NavLink to="/students">Students</NavLink>

      <NavGroup label="Academics">
        {hasPrivilege(user, P.ACADEMIC_READ)  && <NavLink to="/results">Results</NavLink>}
        {hasPrivilege(user, P.ACADEMIC_WRITE) && <NavLink to="/grades">Grades</NavLink>}
        {hasPrivilege(user, P.ACADEMIC_READ)  && <NavLink to="/assessments">Assessments</NavLink>}
        {hasPrivilege(user, P.ACADEMIC_READ)  && <NavLink to="/intelligence">Intelligence</NavLink>}
        {hasPrivilege(user, P.REPORTS_READ)   && <NavLink to="/reports">Reports</NavLink>}
      </NavGroup>

      <NavGroup label="Operations">
        {hasPrivilege(user, P.ATTENDANCE_WRITE) && <NavLink to="/attendance">Attendance</NavLink>}
        {hasPrivilege(user, P.FEEDING_WRITE)    && <NavLink to="/feeding">Feeding</NavLink>}
        {hasPrivilege(user, P.TIMETABLE_MANAGE) && <NavLink to="/timetable">Timetable</NavLink>}
      </NavGroup>

      <NavGroup label="Finance">
        {hasPrivilege(user, P.FINANCE_READ) && <NavLink to="/fees">Fees</NavLink>}
        {hasPrivilege(user, P.FINANCE_READ) && <NavLink to="/fee-structures">Fee Structures</NavLink>}
      </NavGroup>

      <NavGroup label="Admin">
        {hasPrivilege(user, P.CLASSES_MANAGE) && <NavLink to="/classes">Classes</NavLink>}
        {hasPrivilege(user, P.USERS_MANAGE)   && <NavLink to="/users">Users</NavLink>}
        {user.role === 'owner'                && <NavLink to="/store">Store</NavLink>}
        {['owner','headmaster_academics','headmaster_admin'].includes(user.role) && (
          <NavLink to="/teacher-performance">Teacher Performance</NavLink>
        )}
      </NavGroup>

      <NavLink to="/announcements">Announcements</NavLink>
      <NavLink to="/memos">Memos</NavLink>
      {user.role === 'owner' && <NavLink to="/onboarding">Setup Wizard</NavLink>}

      <div className="nav-end">
        <NavLink to="/profile" style={{ color: 'inherit', textDecoration: 'none' }}>
          <span style={{ textTransform: 'capitalize' }}>{user.name} · {roleLabel(user.role)}</span>
        </NavLink>
        <button className="btn btn-sm" style={{ background: '#e74c3c', color: '#fff' }} onClick={handleLogout}>
          Logout
        </button>
      </div>
    </nav>
  );
}
