import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import Pagination from '../components/Pagination';
import SearchableSelect from '../components/SearchableSelect';

const LIMIT = 50;
const BLOOD_GROUPS = ['A+','A-','B+','B-','AB+','AB-','O+','O-'];

const emptyForm = {
  name: '', student_code: '', class_id: '', dob: '', gender: '',
  nationality: '', religion: '', admission_date: '',
  // Parent / Guardian 1
  parent_name: '', parent_phone: '', parent_email: '',
  // Parent / Guardian 2
  parent2_name: '', parent2_phone: '',
  // Emergency contact
  emergency_contact_name: '', emergency_contact_phone: '', emergency_contact_relation: '',
  // Medical
  blood_group: '', allergies: '', medical_conditions: '',
  // Address
  address: '',
};

export default function Students() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [filterClass, setFilterClass] = useState(searchParams.get('class_id') || '');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [sortBy, setSortBy] = useState('');
  const [sortDir, setSortDir] = useState('asc');

  useEffect(() => {
    document.title = 'Students — SchoolSaaS';
    api.get('/classes').then(setClasses).catch(() => {});
  }, []);

  const load = useCallback(async (p = 1) => {
    setLoading(true);
    setError('');
    try {
      const qs = new URLSearchParams({ page: p, limit: LIMIT });
      if (filterClass) qs.set('class_id', filterClass);
      if (search)      qs.set('search', search);
      const res = await api.get(`/students?${qs}`);
      if (res && !Array.isArray(res)) {
        setStudents(res.data || []);
        setTotal(res.total || 0);
        setPages(res.pages || 1);
        setPage(res.page || 1);
      } else {
        setStudents(Array.isArray(res) ? res : []);
        setTotal(0); setPages(1);
      }
    } catch (err) { setError(err.message || 'Failed to load students.'); }
    setLoading(false);
  }, [filterClass, search]);

  useEffect(() => { setPage(1); load(1); }, [filterClass, search]);
  useEffect(() => { load(page); }, [page]); // eslint-disable-line react-hooks/exhaustive-deps

  function handle(e) { setForm(f => ({ ...f, [e.target.name]: e.target.value })); }

  function openAdd() { setForm(emptyForm); setEditId(null); setError(''); setShowForm(true); }
  function openEdit(s) {
    setForm({
      name: s.name || '', student_code: s.student_code || '',
      class_id: s.class_id || '',
      dob: s.dob ? s.dob.slice(0, 10) : (s.date_of_birth ? s.date_of_birth.slice(0, 10) : ''),
      gender: s.gender || '',
      nationality: s.nationality || '', religion: s.religion || '',
      admission_date: s.admission_date ? s.admission_date.slice(0, 10) : '',
      parent_name: s.parent_name || '', parent_phone: s.parent_phone || '',
      parent_email: s.parent_email || '',
      parent2_name: s.parent2_name || '', parent2_phone: s.parent2_phone || '',
      emergency_contact_name: s.emergency_contact_name || '',
      emergency_contact_phone: s.emergency_contact_phone || '',
      emergency_contact_relation: s.emergency_contact_relation || '',
      blood_group: s.blood_group || '',
      allergies: s.allergies || '',
      medical_conditions: s.medical_conditions || '',
      address: s.address || '',
    });
    setEditId(s.id); setError(''); setShowForm(true);
  }

  async function save(e) {
    e.preventDefault(); setError(''); setSaving(true);
    try {
      const { student_code, ...rest } = form;
      const payload = {
        ...(editId ? form : rest),
        class_id: form.class_id || null,
        dob: form.dob || null,
        admission_date: form.admission_date || null,
      };
      if (editId) await api.put(`/students/${editId}`, payload);
      else        await api.post('/students', payload);
      setShowForm(false);
      load(page);
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  async function deactivate(id) {
    if (!confirm('Deactivate this student?')) return;
    try { await api.delete(`/students/${id}`); load(page); }
    catch (err) { setError(err.message || 'Failed to deactivate student.'); }
  }

  function handleSort(col) {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('asc'); }
  }

  const sortedStudents = useMemo(() =>
    sortBy === 'class_name'
      ? [...students].sort((a, b) => {
          const va = (a.class_name || '').toLowerCase();
          const vb = (b.class_name || '').toLowerCase();
          return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
        })
      : students,
    [students, sortBy, sortDir]
  );

  const canWrite = ['owner', 'teacher'].includes(user.role);

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div className="page-title" style={{ marginBottom: 0 }}>Students</div>
          {total > 0 && <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{total} total</div>}
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <SearchableSelect
            value={filterClass}
            onChange={v => setFilterClass(v)}
            options={classes.map(c => ({ value: c.id, label: c.name }))}
            placeholder="All Classes"
            style={{ minWidth: 160 }}
          />
          {canWrite && <button className="btn btn-primary" onClick={openAdd}>+ Add Student</button>}
        </div>
      </div>

      {showForm && (
        <div className="panel" style={{ marginBottom: 16 }}>
          <div className="panel-header">
            <h3>{editId ? 'Edit Student' : 'Add Student'}</h3>
            <button className="btn btn-sm btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
          {error && <div className="alert alert-error">{error}</div>}
          <form onSubmit={save}>

            {/* ── Basic Information ── */}
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#5a6882', marginBottom: 10, marginTop: 4 }}>Basic Information</div>
            <div className="form-row">
              <div className="form-group"><label>Full Name *</label><input name="name" value={form.name} onChange={handle} required /></div>
              {editId
                ? <div className="form-group"><label>Student Code / ID</label><input name="student_code" value={form.student_code} readOnly style={{ background: '#f5f5f5', cursor: 'default' }} /></div>
                : <div className="form-group"><label>Student Code / ID</label><div style={{ padding: '8px 10px', background: '#f0f7ff', border: '1px solid #bfdbfe', borderRadius: 4, fontSize: 13, color: '#2563eb' }}>Auto-generated from school code</div></div>
              }
              <div className="form-group">
                <label>Class</label>
                <SearchableSelect
                  value={form.class_id}
                  onChange={v => setForm(f => ({ ...f, class_id: v }))}
                  options={classes.map(c => ({ value: c.id, label: c.name }))}
                  placeholder="— None —"
                  style={{ width: '100%' }}
                />
              </div>
              <div className="form-group"><label>Date of Birth</label><input type="date" name="dob" value={form.dob} onChange={handle} max={new Date().toISOString().slice(0,10)} /></div>
              <div className="form-group">
                <label>Gender</label>
                <select name="gender" value={form.gender} onChange={handle}>
                  <option value="">—</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </div>
              <div className="form-group"><label>Nationality</label><input name="nationality" value={form.nationality} onChange={handle} placeholder="e.g. Ghanaian" /></div>
              <div className="form-group"><label>Religion</label><input name="religion" value={form.religion} onChange={handle} placeholder="e.g. Christian" /></div>
              <div className="form-group"><label>Admission Date</label><input type="date" name="admission_date" value={form.admission_date} onChange={handle} /></div>
              <div className="form-group" style={{ gridColumn: 'span 2' }}><label>Home Address</label><input name="address" value={form.address} onChange={handle} placeholder="Full home address" /></div>
            </div>

            {/* ── Parent / Guardian 1 ── */}
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#5a6882', margin: '16px 0 10px' }}>Parent / Guardian 1</div>
            <div className="form-row">
              <div className="form-group"><label>Name</label><input name="parent_name" value={form.parent_name} onChange={handle} placeholder="Full name" /></div>
              <div className="form-group"><label>Phone</label><input name="parent_phone" value={form.parent_phone} onChange={handle} placeholder="+233…" /></div>
              <div className="form-group"><label>Email</label><input type="email" name="parent_email" value={form.parent_email} onChange={handle} placeholder="parent@email.com" /></div>
            </div>

            {/* ── Parent / Guardian 2 ── */}
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#5a6882', margin: '16px 0 10px' }}>Parent / Guardian 2 <span style={{ fontWeight: 400, textTransform: 'none', color: '#9ca3af' }}>(optional)</span></div>
            <div className="form-row">
              <div className="form-group"><label>Name</label><input name="parent2_name" value={form.parent2_name} onChange={handle} placeholder="Full name" /></div>
              <div className="form-group"><label>Phone</label><input name="parent2_phone" value={form.parent2_phone} onChange={handle} placeholder="+233…" /></div>
            </div>

            {/* ── Emergency Contact ── */}
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#dc2626', margin: '16px 0 10px' }}>Emergency Contact</div>
            <div className="form-row">
              <div className="form-group"><label>Name *</label><input name="emergency_contact_name" value={form.emergency_contact_name} onChange={handle} placeholder="Full name" /></div>
              <div className="form-group"><label>Phone *</label><input name="emergency_contact_phone" value={form.emergency_contact_phone} onChange={handle} placeholder="+233…" /></div>
              <div className="form-group"><label>Relationship</label><input name="emergency_contact_relation" value={form.emergency_contact_relation} onChange={handle} placeholder="e.g. Uncle, Aunt, Neighbour" /></div>
            </div>

            {/* ── Medical Information ── */}
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#b45309', margin: '16px 0 10px' }}>Medical Information</div>
            <div className="form-row">
              <div className="form-group">
                <label>Blood Group</label>
                <select name="blood_group" value={form.blood_group} onChange={handle}>
                  <option value="">— Unknown —</option>
                  {BLOOD_GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label>Known Allergies</label>
                <input name="allergies" value={form.allergies} onChange={handle} placeholder="e.g. Penicillin, Peanuts, Bee stings (separate with commas)" />
              </div>
              <div className="form-group" style={{ gridColumn: 'span 3' }}>
                <label>Medical Conditions / Chronic Illnesses</label>
                <input name="medical_conditions" value={form.medical_conditions} onChange={handle} placeholder="e.g. Asthma, Sickle Cell, Epilepsy, Diabetes" />
              </div>
            </div>

            <button className="btn btn-primary" style={{ marginTop: 8 }} disabled={saving}>{saving ? 'Saving…' : 'Save Student'}</button>
          </form>
        </div>
      )}

      <div style={{ marginBottom: 12 }}>
        <input placeholder="Search by name or code…" value={search} onChange={e => setSearch(e.target.value)}
          style={{ padding: '7px 10px', border: '1px solid #ccc', borderRadius: 5, width: 260, fontSize: 13 }} />
      </div>

      {loading && <p style={{ color: '#888', fontSize: 13 }}>Loading…</p>}

      {!loading && (
        <table>
          <thead>
            <tr>
              <th>Code</th>
              <th>Name</th>
              <th style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }} onClick={() => handleSort('class_name')}>
                Class {sortBy === 'class_name' ? (sortDir === 'asc' ? ' ▲' : ' ▼') : <span style={{ color: '#ccc', fontSize: 10 }}> ⇅</span>}
              </th>
              <th>Gender</th><th>Parent</th><th>Status</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedStudents.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', color: '#888', padding: 24 }}>No students found.</td></tr>}
            {sortedStudents.map(s => (
              <tr key={s.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/students/${s.id}`)}>
                <td>{s.student_code || '—'}</td>
                <td style={{ fontWeight: 500 }}>{s.name}</td>
                <td>{s.class_name || '—'}</td>
                <td style={{ textTransform: 'capitalize' }}>{s.gender || '—'}</td>
                <td>{s.parent_name || '—'}</td>
                <td><span style={{ color: s.status === 'active' ? '#27ae60' : '#e74c3c', fontWeight: 500 }}>{s.status}</span></td>
                <td onClick={e => e.stopPropagation()}>
                  {canWrite && <button className="btn btn-sm btn-secondary" style={{ marginRight: 6 }} onClick={() => openEdit(s)}>Edit</button>}
                  {user.role === 'owner' && s.status === 'active' && (
                    <button className="btn btn-sm btn-danger" onClick={() => deactivate(s.id)}>Deactivate</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <Pagination page={page} pages={pages} total={total} limit={LIMIT} onPage={setPage} />
    </div>
  );
}
