import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const FINANCE_ROLES  = ['owner','accountant','bursar'];
const ACADEMIC_ROLES = ['owner','teacher','headmaster_academics','department_head','class_teacher'];

export default function QuickActions() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const isFinance  = FINANCE_ROLES.includes(user?.role);
  const isAcademic = ACADEMIC_ROLES.includes(user?.role);

  const actions = [
    { label: 'Students',        icon: '👥', path: '/students',     color: '#8e44ad', show: true },
    { label: 'Attendance',      icon: '✅', path: '/attendance',   color: '#27ae60', show: true },
    { label: 'Enter Scores',    icon: '📝', path: '/results',      color: '#1a73e8', show: isAcademic },
    { label: 'Assessments',     icon: '📋', path: '/assessments',  color: '#2980b9', show: isAcademic },
    { label: 'Record Payment',  icon: '💰', path: '/fees',         color: '#e67e22', show: isFinance },
    { label: 'Announcements',   icon: '📢', path: '/announcements',color: '#16a085', show: true },
    { label: 'Reports',         icon: '📊', path: '/reports',      color: '#7f8c8d', show: isAcademic || ['owner','headmaster_admin'].includes(user?.role) },
  ];

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
      {actions.filter(a => a.show).map(a => (
        <button key={a.label} onClick={() => navigate(a.path)}
          className="btn"
          style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', color: '#333',
                   border: '1px solid #ddd', borderLeft: `4px solid ${a.color}`,
                   padding: '10px 16px', borderRadius: 6, fontWeight: 500 }}>
          <span style={{ fontSize: 18 }}>{a.icon}</span>
          {a.label}
        </button>
      ))}
    </div>
  );
}
