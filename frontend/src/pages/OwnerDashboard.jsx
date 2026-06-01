import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { ALL_PRIVILEGES, roleLabel } from '../utils/access';
import { useAuth } from '../context/AuthContext';

// ── helpers ──────────────────────────────────────────────────────────────────
const ROLES = ['teacher','class_teacher','department_head','headmaster_academics','headmaster_admin','accountant','bursar'];
const FINANCE_ROLES = ['owner','bursar','headmaster_admin'];

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: '#444', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>{title}</div>
      {children}
    </div>
  );
}

function Stat({ label, value, color = '#1a73e8' }) {
  return (
    <div className="card" style={{ borderTop: `4px solid ${color}`, flex: 1, minWidth: 140 }}>
      <div className="card-label">{label}</div>
      <div className="card-value" style={{ color }}>{value ?? '—'}</div>
    </div>
  );
}

const ALL_TABS = ['Overview','Users','Academics','Administration','Finance','Store','Roles','Audit'];

// Tabs each role may see (owner sees all)
const ROLE_TABS = {
  headmaster_admin:    ['Overview','Users','Academics','Administration','Finance','Audit'],
  headmaster_academics:['Overview','Academics','Administration','Finance','Audit'],
};

export default function OwnerDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const tabs = ROLE_TABS[user?.role] ?? ALL_TABS;
  const [tab, setTab] = useState('Overview');

  return (
    <div className="page">
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <div className="page-title" style={{ marginBottom:0 }}>School Dashboard</div>
      </div>

      {/* Tab bar */}
      <div className="tabs" style={{ marginBottom: 24 }}>
        {tabs.map(t => (
          <div key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>{t}</div>
        ))}
      </div>

      {tab === 'Overview'        && <OverviewTab navigate={navigate} />}
      {tab === 'Users'           && <UsersTab />}
      {tab === 'Academics'       && <AcademicsTab />}
      {tab === 'Administration'  && <AdministrationTab />}
      {tab === 'Finance'         && <FinanceTab />}
      {tab === 'Store'           && <StoreTab />}
      {tab === 'Roles'           && <RolesTab />}
      {tab === 'Audit'           && <AuditTab />}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB: OVERVIEW  (Quick Actions first, then data)
// ─────────────────────────────────────────────────────────────────────────────
const QUICK_ACTIONS = [
  { label: 'Add Student',       icon: '👤', path: '/students',      desc: 'Enroll a new student',        color: '#1a73e8' },
  { label: 'Record Payment',    icon: '💳', path: '/fees',           desc: 'Log a fee payment',           color: '#27ae60' },
  { label: 'Take Attendance',   icon: '✅', path: '/attendance',     desc: 'Mark today\'s attendance',    color: '#16a085' },
  { label: 'Enter Grades',      icon: '📝', path: '/grades',         desc: 'Enter subject scores',        color: '#8e44ad' },
  { label: 'Post Announcement', icon: '📢', path: '/announcements',  desc: 'Notify staff or students',    color: '#e67e22' },
  { label: 'View Reports',      icon: '📊', path: '/reports',        desc: 'Generate report cards',       color: '#2c3e50' },
  { label: 'Manage Users',      icon: '👥', path: '/users',          desc: 'Add or edit staff accounts',  color: '#7f8c8d' },
  { label: 'Feeding Records',   icon: '🍽', path: '/feeding',        desc: 'Record daily canteen meals',  color: '#d35400' },
];

function OverviewTab({ navigate }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    Promise.all([
      api.get('/students').catch(() => []),
      api.get('/users').catch(() => []),
      api.get('/payments').catch(() => []),
      api.get('/store/low-stock').catch(() => []),
      api.get('/audit?limit=8').catch(() => []),
      api.get('/remediation').catch(() => []),
    ]).then(([students, users, payments, lowStock, auditRes, remediation]) => {
      const stds = Array.isArray(students) ? students : (students?.data ?? []);
      const collected = Array.isArray(payments) ? payments.reduce((s,p) => s + parseFloat(p.amount||0), 0) : 0;
      const audit = Array.isArray(auditRes) ? auditRes : (auditRes?.logs ?? []);
      setData({ students: stds, users, payments, collected, lowStock, audit, remediation });
    });
  }, []);

  if (!data) return <div style={{ color:'#888', padding:24 }}>Loading…</div>;

  const pendingAlerts = Array.isArray(data.remediation) ? data.remediation.filter(r => r.status === 'pending') : [];

  return (
    <>
      {/* ── Quick Actions ─────────────────────────────────────────────── */}
      <Section title="Quick Actions">
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(160px,1fr))', gap:12 }}>
          {QUICK_ACTIONS.map(a => (
            <div key={a.path} onClick={() => navigate(a.path)}
              style={{ background:'#fff', border:`2px solid ${a.color}20`, borderRadius:10,
                       padding:'16px 14px', cursor:'pointer', textAlign:'center',
                       transition:'transform 0.12s, box-shadow 0.12s',
                       boxShadow:'0 1px 4px rgba(0,0,0,.07)' }}
              onMouseEnter={e => { e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow='0 4px 12px rgba(0,0,0,.12)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform=''; e.currentTarget.style.boxShadow='0 1px 4px rgba(0,0,0,.07)'; }}>
              <div style={{ fontSize:28, marginBottom:6 }}>{a.icon}</div>
              <div style={{ fontWeight:700, fontSize:13, color: a.color, marginBottom:4 }}>{a.label}</div>
              <div style={{ fontSize:11, color:'#888', lineHeight:1.3 }}>{a.desc}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* ── At a Glance ───────────────────────────────────────────────── */}
      <Section title="At a Glance">
        <div className="cards-row">
          <Stat label="Total Students"   value={data.students.length}                              color="#1a73e8" />
          <Stat label="Total Staff"      value={data.users.filter(u => u.role !== 'owner').length}  color="#8e44ad" />
          <Stat label="Fees Collected"   value={`GH₵${data.collected.toLocaleString('en-GH',{minimumFractionDigits:2})}`} color="#27ae60" />
          <Stat label="Low Stock Alerts" value={data.lowStock.length}                              color={data.lowStock.length > 0 ? '#e74c3c' : '#27ae60'} />
          <Stat label="Pending Flags"    value={pendingAlerts.length}                              color={pendingAlerts.length > 0 ? '#e67e22' : '#27ae60'} />
        </div>
      </Section>

      {data.lowStock.length > 0 && (
        <Section title="⚠ Low Stock">
          <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
            {data.lowStock.map(item => (
              <span key={item.id} style={{ background:'#fdecea', color:'#c0392b', padding:'4px 10px', borderRadius:20, fontSize:12, fontWeight:600 }}>
                {item.name}: {item.quantity} {item.unit || 'units'} left
              </span>
            ))}
          </div>
        </Section>
      )}

      <Section title="Recent Activity">
        {!data.audit.length
          ? <p style={{ color:'#aaa', fontSize:13 }}>No recent actions.</p>
          : <table>
              <thead><tr><th>User</th><th>Action</th><th>Entity</th><th>Time</th></tr></thead>
              <tbody>
                {data.audit.map(a => (
                  <tr key={a.id}>
                    <td>{a.user_name || '—'}</td>
                    <td style={{ textTransform:'capitalize' }}>{a.action}</td>
                    <td>{a.entity} {a.entity_id ? `#${String(a.entity_id).slice(0,8)}` : ''}</td>
                    <td style={{ color:'#aaa', fontSize:12 }}>{new Date(a.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
        }
      </Section>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB: USERS
// ─────────────────────────────────────────────────────────────────────────────
function UsersTab() {
  const [users, setUsers]     = useState([]);
  const [filter, setFilter]   = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId]   = useState(null);
  const [form, setForm]       = useState({ name:'', email:'', password:'', role:'teacher' });
  const [error, setError]     = useState('');
  const [saving, setSaving]   = useState(false);

  const load = useCallback(() => api.get('/users').then(setUsers).catch(() => {}), []);
  useEffect(() => { load(); }, [load]);

  function handle(e) { setForm(f => ({ ...f, [e.target.name]: e.target.value })); }

  function openAdd() { setForm({ name:'', email:'', password:'', role:'teacher' }); setEditId(null); setError(''); setShowForm(true); }
  function openEdit(u) { setForm({ name:u.name, email:u.email, password:'', role:u.role }); setEditId(u.id); setError(''); setShowForm(true); }

  async function save(e) {
    e.preventDefault(); setError(''); setSaving(true);
    try {
      if (editId) await api.put(`/users/${editId}`, { name:form.name, role:form.role, is_active:true });
      else        await api.post('/users', form);
      setShowForm(false); load();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  async function deactivate(id) {
    if (!confirm('Deactivate this user?')) return;
    await api.delete(`/users/${id}`).catch(() => {});
    load();
  }

  const filtered = users.filter(u =>
    (!filter || u.role === filter) &&
    (u.name + u.email + u.role).toLowerCase().includes('')
  );

  return (
    <>
      <Section title="User Control">
        <div style={{ display:'flex', gap:10, marginBottom:14, flexWrap:'wrap' }}>
          <select value={filter} onChange={e => setFilter(e.target.value)} style={{ padding:'7px 10px', border:'1px solid #ccc', borderRadius:5, fontSize:13 }}>
            <option value="">All Roles</option>
            {['owner',...ROLES].map(r => <option key={r} value={r}>{roleLabel(r)}</option>)}
          </select>
          <button className="btn btn-primary" onClick={openAdd}>+ Add User</button>
        </div>

        {showForm && (
          <div className="panel" style={{ marginBottom:14 }}>
            <div className="panel-header">
              <h3>{editId ? 'Edit User' : 'New User'}</h3>
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
                    {ROLES.map(r => <option key={r} value={r}>{r.replace(/_/g,' ')}</option>)}
                  </select>
                </div>
              </div>
              <button className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
            </form>
          </div>
        )}

        <table>
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {filtered.map(u => (
              <tr key={u.id}>
                <td style={{ fontWeight:500 }}>{u.name}</td>
                <td>{u.email}</td>
                <td style={{ textTransform:'capitalize' }}>{roleLabel(u.role)}</td>
                <td><span style={{ color: u.is_active ? '#27ae60' : '#e74c3c', fontWeight:500 }}>{u.is_active ? 'Active' : 'Inactive'}</span></td>
                <td>
                  <button className="btn btn-sm btn-secondary" style={{ marginRight:6 }} onClick={() => openEdit(u)}>Edit</button>
                  {u.is_active && <button className="btn btn-sm btn-danger" onClick={() => deactivate(u.id)}>Deactivate</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB: ACADEMICS
// ─────────────────────────────────────────────────────────────────────────────
function AcademicsTab() {
  const [classes, setClasses]       = useState([]);
  const [subjects, setSubjects]     = useState([]);
  const [terms, setTerms]           = useState([]);
  const [teachers, setTeachers]     = useState([]);
  const [assignments, setAssign]    = useState([]);
  const [classif, setClassif]       = useState([]);
  const [form, setForm]                       = useState({ teacher_id:'', class_id:'', subject_id:'', term_id:'' });
  const [cfForm, setCfForm]                   = useState({ name:'', head_teacher_id:'' });
  const [showAssign, setShowAssign]           = useState(false);
  const [showCf, setShowCf]                   = useState(false);
  const [error, setError]                     = useState('');
  const [assignView, setAssignView]           = useState('teacher');
  const [assignFilterTeacher, setAFTeacher]   = useState('');
  const [assignFilterClass, setAFClass]       = useState('');

  useEffect(() => {
    api.get('/classes').then(setClasses).catch(() => {});
    api.get('/subjects').then(setSubjects).catch(() => {});
    api.get('/terms').then(setTerms).catch(() => {});
    api.get('/users').then(u => setTeachers(u.filter(x => x.role !== 'owner' && !FINANCE_ROLES.includes(x.role) && x.is_active))).catch(() => {});
    api.get('/teaching-assignments').then(setAssign).catch(() => {});
    api.get('/classifications').then(setClassif).catch(() => {});
  }, []);

  function handle(e) { setForm(f => ({...f, [e.target.name]: e.target.value})); }
  function cfHandle(e) { setCfForm(f => ({...f, [e.target.name]: e.target.value})); }

  async function addAssignment(e) {
    e.preventDefault(); setError('');
    try {
      const a = await api.post('/teaching-assignments', form);
      setAssign(prev => [...prev, a]);
      setShowAssign(false);
    } catch (err) { setError(err.message); }
  }

  async function removeAssignment(id) {
    await api.delete(`/teaching-assignments/${id}`).catch(() => {});
    setAssign(prev => prev.filter(a => a.id !== id));
  }

  async function addClassification(e) {
    e.preventDefault(); setError('');
    try {
      const c = await api.post('/classifications', cfForm);
      setClassif(prev => [...prev, c]);
      setShowCf(false);
      setCfForm({ name:'', head_teacher_id:'' });
    } catch (err) { setError(err.message); }
  }

  return (
    <>
      {error && <div className="alert alert-error">{error}</div>}

      <Section title="Classifications">
        <button className="btn btn-primary btn-sm" style={{ marginBottom:10 }} onClick={() => setShowCf(v => !v)}>
          {showCf ? 'Cancel' : '+ Add Classification'}
        </button>
        {showCf && (
          <form onSubmit={addClassification} style={{ display:'flex', gap:10, flexWrap:'wrap', marginBottom:10 }}>
            <input required placeholder="e.g. Primary" name="name" value={cfForm.name} onChange={cfHandle} style={{ padding:'7px 10px', border:'1px solid #ccc', borderRadius:5, fontSize:13 }} />
            <select name="head_teacher_id" value={cfForm.head_teacher_id} onChange={cfHandle} style={{ padding:'7px 10px', border:'1px solid #ccc', borderRadius:5, fontSize:13 }}>
              <option value="">No Head Teacher</option>
              {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <button className="btn btn-primary btn-sm">Save</button>
          </form>
        )}
        <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
          {classif.map(c => (
            <span key={c.id} style={{ padding:'6px 14px', background:'#e8f0fe', borderRadius:20, fontSize:13, fontWeight:500 }}>
              {c.name}{c.head_teacher_name ? ` · ${c.head_teacher_name}` : ''}
            </span>
          ))}
          {!classif.length && <p style={{ color:'#aaa', fontSize:13 }}>No classifications yet.</p>}
        </div>
      </Section>

      <Section title="Classes">
        <table>
          <thead><tr><th>Class</th><th>Order</th></tr></thead>
          <tbody>
            {classes.map(c => <tr key={c.id}><td>{c.name}</td><td>{c.order_num}</td></tr>)}
          </tbody>
        </table>
      </Section>

      <Section title="Teaching Assignments">
        <button className="btn btn-primary btn-sm" style={{ marginBottom:10 }} onClick={() => setShowAssign(v => !v)}>
          {showAssign ? 'Cancel' : '+ Assign Teacher'}
        </button>
        {showAssign && (
          <form onSubmit={addAssignment} style={{ display:'flex', gap:10, flexWrap:'wrap', marginBottom:10 }}>
            {[
              ['teacher_id', 'Teacher',  teachers,  'name'],
              ['class_id',   'Class',    classes,   'name'],
              ['subject_id', 'Subject',  subjects,  'name'],
              ['term_id',    'Term',     terms,     'name'],
            ].map(([key, lbl, opts, labelKey]) => (
              <div key={key}>
                <label style={{ fontSize:11, color:'#666', display:'block', marginBottom:2 }}>{lbl}</label>
                <select required={key !== 'term_id'} name={key} value={form[key]} onChange={handle}
                  style={{ padding:'7px 10px', border:'1px solid #ccc', borderRadius:5, fontSize:13 }}>
                  <option value="">— {lbl} —</option>
                  {opts.map(o => <option key={o.id} value={o.id}>{o[labelKey]}</option>)}
                </select>
              </div>
            ))}
            <div style={{ display:'flex', alignItems:'flex-end' }}>
              <button className="btn btn-primary btn-sm">Assign</button>
            </div>
          </form>
        )}
        <table>
          <thead><tr><th>Teacher</th><th>Role</th><th>Class</th><th>Subject</th><th>Term</th><th></th></tr></thead>
          <tbody>
            {!assignments.length && <tr><td colSpan={6} style={{ color:'#aaa', textAlign:'center' }}>No assignments yet.</td></tr>}
            {assignments.map(a => (
              <tr key={a.id}>
                <td>{a.teacher_name}</td>
                <td style={{ fontSize:12, color:'#888', textTransform:'capitalize' }}>{roleLabel(a.teacher_role || '')}</td>
                <td>{a.class_name}</td>
                <td>{a.subject_name}</td>
                <td>{a.term_name || '—'}</td>
                <td><button className="btn btn-sm btn-danger" onClick={() => removeAssignment(a.id)}>Remove</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB: ADMINISTRATION
// ─────────────────────────────────────────────────────────────────────────────
function AdministrationTab() {
  const [departments, setDepts] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [students, setStudents] = useState([]);
  const [classes, setClasses]   = useState([]);
  const [form, setForm]         = useState({ name:'', head_id:'' });
  const [showForm, setShowForm] = useState(false);
  const [moveForm, setMoveForm] = useState({ student_id:'', class_id:'' });
  const [error, setError]       = useState('');

  useEffect(() => {
    api.get('/departments').then(setDepts).catch(() => {});
    api.get('/users').then(u => setTeachers(u.filter(x => x.is_active && !FINANCE_ROLES.includes(x.role)))).catch(() => {});
    api.get('/students').then(setStudents).catch(() => {});
    api.get('/classes').then(setClasses).catch(() => {});
  }, []);

  function handle(e) { setForm(f => ({...f, [e.target.name]: e.target.value})); }

  async function addDept(e) {
    e.preventDefault(); setError('');
    try {
      const d = await api.post('/departments', form);
      setDepts(prev => [...prev, d]);
      setShowForm(false); setForm({ name:'', head_id:'' });
    } catch (err) { setError(err.message); }
  }

  async function moveStudent(e) {
    e.preventDefault(); setError('');
    try {
      await api.put(`/students/${moveForm.student_id}`, { class_id: moveForm.class_id });
      setStudents(prev => prev.map(s => s.id === moveForm.student_id ? { ...s, class_id: moveForm.class_id } : s));
      setMoveForm({ student_id:'', class_id:'' });
    } catch (err) { setError(err.message); }
  }

  return (
    <>
      {error && <div className="alert alert-error">{error}</div>}

      <Section title="Departments">
        <button className="btn btn-primary btn-sm" style={{ marginBottom:10 }} onClick={() => setShowForm(v => !v)}>
          {showForm ? 'Cancel' : '+ Add Department'}
        </button>
        {showForm && (
          <form onSubmit={addDept} style={{ display:'flex', gap:10, flexWrap:'wrap', marginBottom:10 }}>
            <input required placeholder="Department name" name="name" value={form.name} onChange={handle}
              style={{ padding:'7px 10px', border:'1px solid #ccc', borderRadius:5, fontSize:13 }} />
            <select name="head_id" value={form.head_id} onChange={handle}
              style={{ padding:'7px 10px', border:'1px solid #ccc', borderRadius:5, fontSize:13 }}>
              <option value="">No Head</option>
              {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <button className="btn btn-primary btn-sm">Save</button>
          </form>
        )}
        <table>
          <thead><tr><th>Department</th><th>Head</th></tr></thead>
          <tbody>
            {!departments.length && <tr><td colSpan={2} style={{ color:'#aaa', textAlign:'center' }}>No departments yet.</td></tr>}
            {departments.map(d => <tr key={d.id}><td>{d.name}</td><td>{d.head_name || '—'}</td></tr>)}
          </tbody>
        </table>
      </Section>

      <Section title="Move Student Between Classes">
        <form onSubmit={moveStudent} style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
          <select required value={moveForm.student_id} onChange={e => setMoveForm(f => ({...f, student_id: e.target.value}))}
            style={{ padding:'7px 10px', border:'1px solid #ccc', borderRadius:5, fontSize:13, minWidth:200 }}>
            <option value="">— Select Student —</option>
            {students.map(s => <option key={s.id} value={s.id}>{s.name} ({s.class_name || 'no class'})</option>)}
          </select>
          <select required value={moveForm.class_id} onChange={e => setMoveForm(f => ({...f, class_id: e.target.value}))}
            style={{ padding:'7px 10px', border:'1px solid #ccc', borderRadius:5, fontSize:13 }}>
            <option value="">— New Class —</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button className="btn btn-primary btn-sm">Move</button>
        </form>
      </Section>

      <Section title={`Students (${students.length})`}>
        <table>
          <thead><tr><th>Code</th><th>Name</th><th>Class</th><th>Status</th></tr></thead>
          <tbody>
            {students.slice(0,20).map(s => (
              <tr key={s.id}>
                <td>{s.student_code}</td>
                <td>{s.name}</td>
                <td>{s.class_name || '—'}</td>
                <td><span style={{ color: s.status==='active' ? '#27ae60' : '#e74c3c', fontWeight:500 }}>{s.status}</span></td>
              </tr>
            ))}
            {students.length > 20 && <tr><td colSpan={4} style={{ color:'#aaa', textAlign:'center', fontSize:12 }}>… and {students.length - 20} more</td></tr>}
          </tbody>
        </table>
      </Section>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB: FINANCE
// ─────────────────────────────────────────────────────────────────────────────
function FinanceTab() {
  const [payments, setPayments]     = useState([]);
  const [structures, setStructures] = useState([]);
  const [students, setStudents]     = useState([]);
  const [filterClass, setFilter]    = useState('');
  const [classes, setClasses]       = useState([]);

  useEffect(() => {
    api.get('/payments').then(setPayments).catch(() => {});
    api.get('/fee-structures').then(setStructures).catch(() => {});
    api.get('/students').then(setStudents).catch(() => {});
    api.get('/classes').then(setClasses).catch(() => {});
  }, []);

  const totalCollected = payments.reduce((s,p) => s + parseFloat(p.amount||0), 0);

  // Defaulters: students with no payment
  const paidIds = new Set(payments.map(p => p.student_id));
  const defaulters = students.filter(s => !paidIds.has(s.id) && (!filterClass || s.class_id === filterClass));

  const filteredPayments = filterClass
    ? payments.filter(p => students.find(s => s.id === p.student_id && s.class_id === filterClass))
    : payments;

  return (
    <>
      <Section title="Summary">
        <div className="cards-row">
          <Stat label="Total Collected" value={`GH₵${totalCollected.toLocaleString('en-GH',{minimumFractionDigits:2})}`} color="#27ae60" />
          <Stat label="Payment Records" value={payments.length}    color="#1a73e8" />
          <Stat label="Defaulters"      value={defaulters.length}  color="#e74c3c" />
          <Stat label="Fee Structures"  value={structures.length}  color="#8e44ad" />
        </div>
      </Section>

      <Section title="Filter by Class">
        <select value={filterClass} onChange={e => setFilter(e.target.value)}
          style={{ padding:'7px 10px', border:'1px solid #ccc', borderRadius:5, fontSize:13 }}>
          <option value="">All Classes</option>
          {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </Section>

      {defaulters.length > 0 && (
        <Section title={`Defaulters (${defaulters.length})`}>
          <table>
            <thead><tr><th>Student</th><th>Code</th><th>Class</th></tr></thead>
            <tbody>
              {defaulters.map(s => (
                <tr key={s.id}>
                  <td style={{ color:'#e74c3c', fontWeight:500 }}>{s.name}</td>
                  <td>{s.student_code}</td>
                  <td>{s.class_name || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      <Section title="All Payments">
        <table>
          <thead><tr><th>Student</th><th>Amount</th><th>Date</th><th>Method</th><th>Reference</th></tr></thead>
          <tbody>
            {!filteredPayments.length && <tr><td colSpan={5} style={{ color:'#aaa', textAlign:'center' }}>No payments.</td></tr>}
            {filteredPayments.map(p => (
              <tr key={p.id}>
                <td>{p.student_name}</td>
                <td style={{ fontWeight:600, color:'#27ae60' }}>GH₵{parseFloat(p.amount).toFixed(2)}</td>
                <td>{new Date(p.payment_date).toLocaleDateString()}</td>
                <td style={{ textTransform:'capitalize' }}>{p.method?.replace('_',' ')}</td>
                <td>{p.reference || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title="Fee Structures">
        <table>
          <thead><tr><th>Name</th><th>Total</th><th>Term</th></tr></thead>
          <tbody>
            {structures.map(f => (
              <tr key={f.id}>
                <td>{f.label || f.name}</td>
                <td>GH₵{parseFloat(f.total_amount||0).toFixed(2)}</td>
                <td>{f.term_name || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB: STORE
// ─────────────────────────────────────────────────────────────────────────────
function StoreTab() {
  const [items, setItems]       = useState([]);
  const [txs, setTxs]           = useState([]);
  const [showItem, setShowItem] = useState(false);
  const [showTx, setShowTx]     = useState(false);
  const [iForm, setIForm]       = useState({ name:'', quantity:0, unit:'', low_stock_threshold:5 });
  const [tForm, setTForm]       = useState({ item_id:'', quantity:'', type:'issue', notes:'' });
  const [error, setError]       = useState('');

  const loadItems = () => api.get('/store/items').then(setItems).catch(() => {});
  const loadTxs   = () => api.get('/store/transactions').then(setTxs).catch(() => {});

  useEffect(() => { loadItems(); loadTxs(); }, []);

  async function addItem(e) {
    e.preventDefault(); setError('');
    try {
      await api.post('/store/items', { ...iForm, quantity: parseInt(iForm.quantity), low_stock_threshold: parseInt(iForm.low_stock_threshold) });
      setShowItem(false); setIForm({ name:'', quantity:0, unit:'', low_stock_threshold:5 }); loadItems();
    } catch (err) { setError(err.message); }
  }

  async function recordTx(e) {
    e.preventDefault(); setError('');
    try {
      await api.post('/store/transactions', { ...tForm, quantity: parseInt(tForm.quantity) });
      setShowTx(false); setTForm({ item_id:'', quantity:'', type:'issue', notes:'' }); loadItems(); loadTxs();
    } catch (err) { setError(err.message); }
  }

  const lowStock = items.filter(i => i.quantity <= i.low_stock_threshold);

  return (
    <>
      {error && <div className="alert alert-error">{error}</div>}

      <Section title="Items">
        <div style={{ display:'flex', gap:8, marginBottom:10 }}>
          <button className="btn btn-primary btn-sm" onClick={() => setShowItem(v => !v)}>{showItem ? 'Cancel' : '+ Add Item'}</button>
          <button className="btn btn-secondary btn-sm" onClick={() => setShowTx(v => !v)}>{showTx ? 'Cancel' : '+ Issue / Restock'}</button>
        </div>

        {showItem && (
          <form onSubmit={addItem} style={{ display:'flex', gap:10, flexWrap:'wrap', marginBottom:10 }}>
            <input required placeholder="Item name" value={iForm.name} onChange={e => setIForm(f=>({...f,name:e.target.value}))} style={{ padding:'7px 10px', border:'1px solid #ccc', borderRadius:5, fontSize:13 }} />
            <input type="number" min="0" placeholder="Qty" value={iForm.quantity} onChange={e => setIForm(f=>({...f,quantity:e.target.value}))} style={{ padding:'7px 10px', border:'1px solid #ccc', borderRadius:5, fontSize:13, width:70 }} />
            <input placeholder="Unit (e.g. pcs)" value={iForm.unit} onChange={e => setIForm(f=>({...f,unit:e.target.value}))} style={{ padding:'7px 10px', border:'1px solid #ccc', borderRadius:5, fontSize:13, width:120 }} />
            <input type="number" min="0" placeholder="Low threshold" value={iForm.low_stock_threshold} onChange={e => setIForm(f=>({...f,low_stock_threshold:e.target.value}))} style={{ padding:'7px 10px', border:'1px solid #ccc', borderRadius:5, fontSize:13, width:110 }} />
            <button className="btn btn-primary btn-sm">Save</button>
          </form>
        )}

        {showTx && (
          <form onSubmit={recordTx} style={{ display:'flex', gap:10, flexWrap:'wrap', marginBottom:10 }}>
            <select required value={tForm.item_id} onChange={e => setTForm(f=>({...f,item_id:e.target.value}))} style={{ padding:'7px 10px', border:'1px solid #ccc', borderRadius:5, fontSize:13 }}>
              <option value="">— Item —</option>
              {items.map(i => <option key={i.id} value={i.id}>{i.name} ({i.quantity} {i.unit||''})</option>)}
            </select>
            <select value={tForm.type} onChange={e => setTForm(f=>({...f,type:e.target.value}))} style={{ padding:'7px 10px', border:'1px solid #ccc', borderRadius:5, fontSize:13 }}>
              <option value="issue">Issue</option>
              <option value="restock">Restock</option>
            </select>
            <input required type="number" min="1" placeholder="Qty" value={tForm.quantity} onChange={e => setTForm(f=>({...f,quantity:e.target.value}))} style={{ padding:'7px 10px', border:'1px solid #ccc', borderRadius:5, fontSize:13, width:70 }} />
            <input placeholder="Notes (optional)" value={tForm.notes} onChange={e => setTForm(f=>({...f,notes:e.target.value}))} style={{ padding:'7px 10px', border:'1px solid #ccc', borderRadius:5, fontSize:13 }} />
            <button className="btn btn-primary btn-sm">Record</button>
          </form>
        )}

        {lowStock.length > 0 && (
          <div style={{ marginBottom:10 }}>
            {lowStock.map(i => (
              <span key={i.id} style={{ display:'inline-block', margin:'0 6px 6px 0', padding:'3px 10px', background:'#fdecea', color:'#c0392b', borderRadius:20, fontSize:12, fontWeight:600 }}>
                ⚠ {i.name}: {i.quantity} left
              </span>
            ))}
          </div>
        )}

        <table>
          <thead><tr><th>Item</th><th>Qty</th><th>Unit</th><th>Low Threshold</th><th>Status</th></tr></thead>
          <tbody>
            {!items.length && <tr><td colSpan={5} style={{ color:'#aaa', textAlign:'center' }}>No items yet.</td></tr>}
            {items.map(i => (
              <tr key={i.id}>
                <td style={{ fontWeight:500 }}>{i.name}</td>
                <td style={{ fontWeight:700, color: i.quantity <= i.low_stock_threshold ? '#e74c3c' : '#27ae60' }}>{i.quantity}</td>
                <td>{i.unit || '—'}</td>
                <td>{i.low_stock_threshold}</td>
                <td>{i.quantity <= i.low_stock_threshold ? <span style={{ color:'#e74c3c', fontWeight:600 }}>LOW</span> : <span style={{ color:'#27ae60' }}>OK</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title="Recent Transactions">
        <table>
          <thead><tr><th>Item</th><th>Type</th><th>Qty</th><th>By</th><th>Notes</th><th>Time</th></tr></thead>
          <tbody>
            {!txs.length && <tr><td colSpan={6} style={{ color:'#aaa', textAlign:'center' }}>No transactions yet.</td></tr>}
            {txs.slice(0,20).map(t => (
              <tr key={t.id}>
                <td>{t.item_name}</td>
                <td><span style={{ fontWeight:600, color: t.type==='restock' ? '#27ae60' : '#e67e22', textTransform:'uppercase', fontSize:11 }}>{t.type}</span></td>
                <td style={{ fontWeight:600 }}>{t.type==='issue' ? '-' : '+'}{t.quantity}</td>
                <td>{t.recorded_by_name}</td>
                <td>{t.notes || '—'}</td>
                <td style={{ color:'#aaa', fontSize:12 }}>{new Date(t.created_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB: ROLES
// ─────────────────────────────────────────────────────────────────────────────
function RolesTab() {
  const [roles, setRoles]         = useState([]);
  const [expanded, setExpanded]   = useState(null);  // role id being edited
  const [editPrivs, setEditPrivs] = useState([]);
  const [showNew, setShowNew]     = useState(false);
  const [newLabel, setNewLabel]   = useState('');
  const [newPrivs, setNewPrivs]   = useState([]);
  const [saving, setSaving]       = useState(false);
  const [msg, setMsg]             = useState('');
  const [seeding, setSeeding]     = useState(false);

  function flash(t) { setMsg(t); setTimeout(() => setMsg(''), 3000); }

  const load = useCallback(() => api.get('/roles').then(setRoles).catch(() => {}), []);
  useEffect(() => { load(); }, [load]);

  async function seed() {
    setSeeding(true);
    try { await api.post('/roles/seed'); load(); flash('Default roles seeded.'); }
    catch (err) { flash(err.message); }
    finally { setSeeding(false); }
  }

  function openEdit(role) {
    setExpanded(role.id);
    setEditPrivs(Array.isArray(role.privileges) ? [...role.privileges] : []);
  }

  function toggleEditPriv(key) {
    setEditPrivs(prev => prev.includes(key) ? prev.filter(p => p !== key) : [...prev, key]);
  }

  async function savePrivileges(roleId) {
    setSaving(true);
    try {
      await api.put(`/roles/${roleId}/privileges`, { privileges: editPrivs });
      load(); setExpanded(null); flash('Privileges saved.');
    } catch (err) { flash(err.message); }
    finally { setSaving(false); }
  }

  async function deleteRole(id) {
    if (!window.confirm('Delete this custom role?')) return;
    await api.delete(`/roles/${id}`).catch(() => {});
    load();
  }

  async function createRole(e) {
    e.preventDefault(); setSaving(true);
    try {
      await api.post('/roles', { label: newLabel, privileges: newPrivs });
      setShowNew(false); setNewLabel(''); setNewPrivs([]); load(); flash('Role created.');
    } catch (err) { flash(err.message); }
    finally { setSaving(false); }
  }

  function toggleNewPriv(key) {
    setNewPrivs(prev => prev.includes(key) ? prev.filter(p => p !== key) : [...prev, key]);
  }

  return (
    <>
      {msg && <div className="alert alert-success" style={{ marginBottom:12 }}>{msg}</div>}

      <Section title="Role Management">
        <div style={{ display:'flex', gap:10, marginBottom:14, flexWrap:'wrap' }}>
          <button className="btn btn-primary btn-sm" onClick={() => setShowNew(v => !v)}>
            {showNew ? 'Cancel' : '+ Custom Role'}
          </button>
          <button className="btn btn-secondary btn-sm" onClick={seed} disabled={seeding}>
            {seeding ? 'Seeding…' : 'Re-seed Defaults'}
          </button>
        </div>

        {showNew && (
          <div className="panel" style={{ marginBottom:14 }}>
            <div style={{ fontWeight:600, marginBottom:10 }}>New Custom Role</div>
            <form onSubmit={createRole}>
              <div style={{ marginBottom:10 }}>
                <label style={{ fontSize:12, color:'#666', display:'block', marginBottom:4 }}>Role Label *</label>
                <input required value={newLabel} onChange={e => setNewLabel(e.target.value)}
                  placeholder="e.g. Assistant Bursar"
                  style={{ padding:'7px 10px', border:'1px solid #ccc', borderRadius:5, fontSize:13, width:260 }} />
              </div>
              <div style={{ marginBottom:10 }}>
                <div style={{ fontSize:12, color:'#666', marginBottom:6 }}>Privileges</div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                  {ALL_PRIVILEGES.map(p => (
                    <label key={p.key} style={{ display:'flex', alignItems:'center', gap:5, fontSize:13, cursor:'pointer',
                                                background: newPrivs.includes(p.key) ? '#e8f0fe' : '#f9f9f9',
                                                padding:'4px 10px', borderRadius:16, border:'1px solid #ddd' }}>
                      <input type="checkbox" checked={newPrivs.includes(p.key)} onChange={() => toggleNewPriv(p.key)} />
                      {p.label}
                    </label>
                  ))}
                </div>
              </div>
              <button className="btn btn-primary btn-sm" disabled={saving}>{saving ? 'Saving…' : 'Create Role'}</button>
            </form>
          </div>
        )}

        {roles.map(role => (
          <div key={role.id} style={{ marginBottom:10, border:'1px solid #eee', borderRadius:8, overflow:'hidden' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
                          padding:'10px 14px', background: role.is_system ? '#f9f9ff' : '#fff', cursor:'pointer' }}
              onClick={() => expanded === role.id ? setExpanded(null) : openEdit(role)}>
              <div>
                <span style={{ fontWeight:600, fontSize:14 }}>{role.label}</span>
                {role.is_system && <span style={{ marginLeft:8, fontSize:11, color:'#888', background:'#eee', padding:'1px 7px', borderRadius:10 }}>system</span>}
                <span style={{ marginLeft:8, fontSize:12, color:'#aaa' }}>
                  {role.privileges?.length ?? 0} privilege{role.privileges?.length !== 1 ? 's' : ''}
                </span>
              </div>
              <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                {!role.is_system && (
                  <button className="btn btn-sm btn-danger" onClick={e => { e.stopPropagation(); deleteRole(role.id); }}>
                    Delete
                  </button>
                )}
                <span style={{ color:'#aaa', fontSize:12 }}>{expanded === role.id ? '▲' : '▼'}</span>
              </div>
            </div>

            {expanded === role.id && (
              <div style={{ padding:'12px 14px', borderTop:'1px solid #eee', background:'#fafafa' }}>
                <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:12 }}>
                  {ALL_PRIVILEGES.map(p => (
                    <label key={p.key} style={{ display:'flex', alignItems:'center', gap:5, fontSize:13, cursor:'pointer',
                                                background: editPrivs.includes(p.key) ? '#e8f0fe' : '#f9f9f9',
                                                padding:'4px 10px', borderRadius:16, border:'1px solid #ddd' }}>
                      <input type="checkbox" checked={editPrivs.includes(p.key)} onChange={() => toggleEditPriv(p.key)} />
                      {p.label}
                    </label>
                  ))}
                </div>
                <button className="btn btn-primary btn-sm" onClick={() => savePrivileges(role.id)} disabled={saving}>
                  {saving ? 'Saving…' : 'Save Privileges'}
                </button>
                <button className="btn btn-secondary btn-sm" style={{ marginLeft:8 }} onClick={() => setExpanded(null)}>
                  Cancel
                </button>
              </div>
            )}
          </div>
        ))}

        {!roles.length && (
          <p style={{ color:'#aaa', fontSize:13 }}>
            No roles found. Click "Re-seed Defaults" to initialise the 8 system roles.
          </p>
        )}
      </Section>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB: AUDIT
// ─────────────────────────────────────────────────────────────────────────────
function AuditTab() {
  const [logs, setLogs]         = useState([]);
  const [users, setUsers]       = useState([]);
  const [filterUser, setFUser]  = useState('');
  const [filterAction, setFAct] = useState('');

  useEffect(() => {
    api.get('/audit?limit=200').then(r => setLogs(Array.isArray(r) ? r : (r?.logs ?? []))).catch(() => {});
    api.get('/users').then(setUsers).catch(() => {});
  }, []);

  const filtered = logs.filter(l =>
    (!filterUser   || l.user_id === filterUser) &&
    (!filterAction || l.action?.toLowerCase().includes(filterAction.toLowerCase()))
  );

  const actions = [...new Set(logs.map(l => l.action).filter(Boolean))];

  return (
    <Section title="Audit Log">
      <div style={{ display:'flex', gap:10, marginBottom:12, flexWrap:'wrap' }}>
        <select value={filterUser} onChange={e => setFUser(e.target.value)}
          style={{ padding:'7px 10px', border:'1px solid #ccc', borderRadius:5, fontSize:13 }}>
          <option value="">All Users</option>
          {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        <select value={filterAction} onChange={e => setFAct(e.target.value)}
          style={{ padding:'7px 10px', border:'1px solid #ccc', borderRadius:5, fontSize:13 }}>
          <option value="">All Actions</option>
          {actions.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <span style={{ fontSize:13, color:'#888', lineHeight:'34px' }}>{filtered.length} entries</span>
      </div>
      <table>
        <thead><tr><th>User</th><th>Action</th><th>Entity</th><th>Record</th><th>Time</th></tr></thead>
        <tbody>
          {!filtered.length && <tr><td colSpan={5} style={{ color:'#aaa', textAlign:'center' }}>No log entries.</td></tr>}
          {filtered.map(l => (
            <tr key={l.id}>
              <td>{l.user_name || '—'}</td>
              <td style={{ fontWeight:500, textTransform:'capitalize' }}>{l.action}</td>
              <td>{l.entity || '—'}</td>
              <td style={{ fontSize:12, color:'#aaa' }}>{l.entity_id ? String(l.entity_id).slice(0,8) : '—'}</td>
              <td style={{ fontSize:12, color:'#aaa' }}>{new Date(l.created_at).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Section>
  );
}
