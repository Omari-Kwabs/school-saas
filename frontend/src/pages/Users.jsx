import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { roleLabel } from '../utils/access';

const empty = { name: '', email: '', password: '', role: 'teacher' };

const PRIV_LABELS = {
  'finance:read':      'View Finances',
  'finance:write':     'Record Payments & Manage Fees',
  'academic:read':     'View Grades & Assessments',
  'academic:write':    'Manage Grades & Assessments',
  'attendance:write':  'Record Attendance',
  'reports:read':      'View Reports',
  'users:manage':      'Manage Users',
  'classes:manage':    'Manage Classes & Terms',
  'timetable:manage':  'Manage Timetable',
  'announcements:post':'Post Announcements',
  'feeding:write':     'Record Feeding',
  'store:manage':      'Manage Store',
  'roles:manage':      'Manage Roles',
  'calendar:manage':   'Manage Calendar',
};

const PRIV_ORDER = Object.keys(PRIV_LABELS);

export default function Users() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');
  const [showPerms, setShowPerms] = useState(false);
  const [rolePerms, setRolePerms] = useState([]);
  const [editPerms, setEditPerms] = useState(false);
  const [savingCell, setSavingCell] = useState(null); // 'roleId:priv'

  async function load() {
    try {
      const data = await api.get('/users');
      setUsers(Array.isArray(data) ? data : []);
    } catch (err) { setError(err.message || 'Failed to load users.'); }
  }

  useEffect(() => { document.title = 'Users — SchoolSaaS'; load(); }, []);

  function handle(e) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  }

  function openAdd() {
    setForm(empty);
    setEditId(null);
    setError('');
    setShowForm(true);
  }

  function openEdit(u) {
    setForm({ name: u.name, email: u.email, password: '', role: u.role });
    setEditId(u.id);
    setError('');
    setShowForm(true);
  }

  async function save(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      if (editId) {
        await api.put(`/users/${editId}`, { name: form.name, role: form.role, is_active: true });
      } else {
        await api.post('/users', form);
      }
      setShowForm(false);
      load();
    } catch (err) {
      setError(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function togglePerms() {
    if (showPerms) { setShowPerms(false); setEditPerms(false); return; }
    try {
      const data = await api.get('/roles');
      setRolePerms(Array.isArray(data) ? data.filter(r => r.is_system) : []);
    } catch {}
    setShowPerms(true);
  }

  async function togglePrivilege(role, priv) {
    if (role.name === 'owner') return;
    const key = `${role.id}:${priv}`;
    setSavingCell(key);
    const current = role.privileges || [];
    const updated = current.includes(priv)
      ? current.filter(p => p !== priv)
      : [...current, priv];
    try {
      await api.put(`/roles/${role.id}/privileges`, { privileges: updated });
      setRolePerms(prev => prev.map(r => r.id === role.id ? { ...r, privileges: updated } : r));
    } catch (err) {
      alert(err.message || 'Failed to update permission');
    } finally {
      setSavingCell(null);
    }
  }

  async function syncRoles() {
    if (!confirm('This will update all role permissions in the database to match the latest defaults. Affected users must log out and back in. Proceed?')) return;
    setSyncing(true);
    setSyncMsg('');
    try {
      await api.post('/roles/seed', {});
      setSyncMsg('success');
    } catch (err) {
      setSyncMsg('error:' + (err.message || 'Failed'));
    } finally {
      setSyncing(false);
    }
  }

  async function deactivate(id) {
    if (!confirm('Deactivate this user?')) return;
    try {
      await api.delete(`/users/${id}`);
      load();
    } catch {}
  }

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div className="page-title" style={{ marginBottom: 0 }}>Users</div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <input placeholder="Search name or email…" value={search} onChange={e => setSearch(e.target.value)}
            style={{ padding: '7px 12px', border: '1px solid #ddd', borderRadius: 6, fontSize: 13, minWidth: 180 }} />
          <select value={filterRole} onChange={e => setFilterRole(e.target.value)}
            style={{ padding: '7px 10px', border: '1px solid #ddd', borderRadius: 6, fontSize: 13 }}>
            <option value="">All Roles</option>
            <option value="owner">Proprietor / Director</option>
            <option value="teacher">Teacher</option>
            <option value="class_teacher">Class Teacher</option>
            <option value="department_head">Department Head</option>
            <option value="headmaster_academics">Headmaster (Academics)</option>
            <option value="headmaster_admin">Headmaster (Admin)</option>
            <option value="accountant">Accountant</option>
            <option value="bursar">Bursar</option>
          </select>
          <button onClick={togglePerms}
            style={{ padding: '7px 14px', border: '1px solid #6366f1', background: showPerms ? '#eef2ff' : '#fff', color: '#4338ca', borderRadius: 6, fontSize: 13, cursor: 'pointer', fontWeight: 500 }}>
            {showPerms ? 'Hide Permissions' : 'View Permissions'}
          </button>
          <button onClick={syncRoles} disabled={syncing}
            style={{ padding: '7px 14px', border: '1px solid #d97706', background: syncing ? '#fef3c7' : '#fffbeb', color: '#92400e', borderRadius: 6, fontSize: 13, cursor: syncing ? 'not-allowed' : 'pointer', fontWeight: 500 }}>
            {syncing ? 'Syncing...' : 'Sync Role Permissions'}
          </button>
          <button className="btn btn-primary" onClick={openAdd}>+ Add User</button>
        </div>
      </div>

      {syncMsg === 'success' && (
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '12px 16px', marginBottom: 16, color: '#166534', fontSize: 14 }}>
          Role permissions updated successfully. Ask any Headmaster users to <strong>log out and log back in</strong> for the changes to take effect.
          <button onClick={() => setSyncMsg('')} style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer', color: '#166534', fontSize: 16, lineHeight: 1 }}>×</button>
        </div>
      )}
      {syncMsg.startsWith('error:') && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '12px 16px', marginBottom: 16, color: '#991b1b', fontSize: 14 }}>
          {syncMsg.replace('error:', '')}
          <button onClick={() => setSyncMsg('')} style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer', color: '#991b1b', fontSize: 16, lineHeight: 1 }}>×</button>
        </div>
      )}

      {showPerms && rolePerms.length > 0 && (
        <div style={{ marginBottom: 20, border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ background: '#f8fafc', borderBottom: '1px solid #e5e7eb', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ fontWeight: 600, fontSize: 14, color: '#1e293b' }}>Role Permissions Matrix</span>
              {editPerms && <span style={{ marginLeft: 10, fontSize: 11, color: '#d97706', background: '#fef3c7', padding: '2px 8px', borderRadius: 10, fontWeight: 500 }}>Editing — changes save instantly</span>}
            </div>
            <button onClick={() => setEditPerms(e => !e)}
              style={{ padding: '5px 12px', border: `1px solid ${editPerms ? '#d97706' : '#6366f1'}`, background: editPerms ? '#fef3c7' : '#eef2ff', color: editPerms ? '#92400e' : '#4338ca', borderRadius: 6, fontSize: 12, cursor: 'pointer', fontWeight: 500 }}>
              {editPerms ? 'Done Editing' : 'Edit Permissions'}
            </button>
          </div>
          {editPerms && (
            <div style={{ background: '#fffbeb', borderBottom: '1px solid #fde68a', padding: '8px 16px', fontSize: 12, color: '#92400e' }}>
              Click any cell to grant or revoke that permission. Owner role is locked. Affected users must re-login for changes to take effect.
            </div>
          )}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '10px 14px', background: '#f1f5f9', color: '#475569', fontWeight: 600, borderBottom: '1px solid #e5e7eb', minWidth: 220, position: 'sticky', left: 0, zIndex: 1 }}>
                    Permission
                  </th>
                  {rolePerms.map(r => (
                    <th key={r.id} style={{ padding: '10px 10px', background: '#f1f5f9', color: r.name === 'owner' ? '#94a3b8' : '#475569', fontWeight: 600, borderBottom: '1px solid #e5e7eb', textAlign: 'center', whiteSpace: 'nowrap' }}>
                      {r.label}
                      {r.name === 'owner' && <div style={{ fontSize: 9, fontWeight: 400, color: '#94a3b8' }}>locked</div>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PRIV_ORDER.map((priv, i) => (
                  <tr key={priv} style={{ background: i % 2 === 0 ? '#fff' : '#f8fafc' }}>
                    <td style={{ padding: '9px 14px', borderBottom: '1px solid #f1f5f9', position: 'sticky', left: 0, background: i % 2 === 0 ? '#fff' : '#f8fafc', zIndex: 1 }}>
                      <div style={{ fontWeight: 600, color: '#1e293b' }}>{PRIV_LABELS[priv]}</div>
                      <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 1 }}>{priv}</div>
                    </td>
                    {rolePerms.map(r => {
                      const has = r.privileges.includes(priv);
                      const isOwner = r.name === 'owner';
                      const cellKey = `${r.id}:${priv}`;
                      const isSaving = savingCell === cellKey;
                      const clickable = editPerms && !isOwner;
                      return (
                        <td key={r.id} style={{ textAlign: 'center', padding: '9px 10px', borderBottom: '1px solid #f1f5f9' }}>
                          <button
                            disabled={!clickable || isSaving}
                            onClick={() => clickable && togglePrivilege(r, priv)}
                            title={isOwner ? 'Owner role is locked' : editPerms ? (has ? 'Click to revoke' : 'Click to grant') : ''}
                            style={{
                              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                              width: 26, height: 26, borderRadius: '50%', border: 'none',
                              cursor: clickable ? 'pointer' : 'default',
                              background: isSaving ? '#fef3c7' : has ? '#dcfce7' : '#f1f5f9',
                              color: isSaving ? '#d97706' : has ? '#16a34a' : '#cbd5e1',
                              fontWeight: 700, fontSize: 13,
                              transition: 'all 0.15s',
                              outline: clickable && !isSaving ? (has ? '2px solid transparent' : '2px solid transparent') : 'none',
                              boxShadow: clickable && !isSaving ? '0 0 0 0 transparent' : 'none',
                            }}
                            onMouseEnter={e => { if (clickable && !isSaving) e.currentTarget.style.transform = 'scale(1.2)'; }}
                            onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
                          >
                            {isSaving ? '…' : has ? '✓' : '—'}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showForm && (
        <div className="panel" style={{ marginBottom: 16 }}>
          <div className="panel-header">
            <h3>{editId ? 'Edit User' : 'Add User'}</h3>
            <button className="btn btn-sm btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
          {error && <div className="alert alert-error">{error}</div>}
          <form onSubmit={save}>
            <div className="form-row">
              <div className="form-group"><label>Name *</label><input name="name" value={form.name} onChange={handle} required /></div>
              {!editId && <div className="form-group"><label>Email *</label><input name="email" type="email" value={form.email} onChange={handle} required /></div>}
              {!editId && <div className="form-group"><label>Password *</label><input name="password" type="password" value={form.password} onChange={handle} required /></div>}
              <div className="form-group">
                <label>Role *</label>
                <select name="role" value={form.role} onChange={handle}>
                  <option value="teacher">Teacher</option>
                  <option value="class_teacher">Class Teacher</option>
                  <option value="department_head">Department Head</option>
                  <option value="headmaster_academics">Headmaster (Academics)</option>
                  <option value="headmaster_admin">Headmaster (Admin)</option>
                  <option value="accountant">Accountant</option>
                  <option value="bursar">Bursar</option>
                </select>
              </div>
            </div>
            <button className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
          </form>
        </div>
      )}

      <table>
        <thead>
          <tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Actions</th></tr>
        </thead>
        <tbody>
          {users.filter(u => {
            const q = search.toLowerCase();
            return (!q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
              && (!filterRole || u.role === filterRole);
          }).map(u => (
            <tr key={u.id}>
              <td>{u.name}</td>
              <td>{u.email}</td>
              <td style={{ textTransform: 'capitalize' }}>{roleLabel(u.role)}</td>
              <td>
                <span style={{ color: u.is_active ? '#27ae60' : '#e74c3c', fontWeight: 500 }}>
                  {u.is_active ? 'Active' : 'Inactive'}
                </span>
              </td>
              <td>
                <button className="btn btn-sm btn-secondary" style={{ marginRight: 6 }} onClick={() => openEdit(u)}>Edit</button>
                {u.id !== user.id && u.is_active && (
                  <button className="btn btn-sm btn-danger" onClick={() => deactivate(u.id)}>Deactivate</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
