import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { hasPrivilege } from '../utils/access';

function AccessDenied() {
  return (
    <div style={{ padding: 60, textAlign: 'center' }}>
      <div style={{ fontSize: 56, marginBottom: 16 }}>🚫</div>
      <h2 style={{ color: '#e74c3c', marginBottom: 8 }}>Access Denied</h2>
      <p style={{ color: '#666', fontSize: 15 }}>You do not have permission to view this page.</p>
    </div>
  );
}

export default function PrivateRoute({ children, roles, privilege }) {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ padding: 24 }}>Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  // System admins belong in the admin console, not the school management UI
  if (user.role === 'system_admin') return <Navigate to="/admin/schools" replace />;
  if (privilege && !hasPrivilege(user, privilege)) return <AccessDenied />;
  if (roles && !roles.includes(user.role)) return <AccessDenied />;
  return children;
}
