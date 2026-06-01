import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import SearchableSelect from '../components/SearchableSelect';

const STATUSES = ['present','absent','late','excused'];
const STATUS_COLOR = { present: '#27ae60', absent: '#e74c3c', late: '#e67e22', excused: '#1a73e8' };

export default function Attendance() {
  const { user } = useAuth();
  const [classes, setClasses]     = useState([]);
  const [classId, setClassId]     = useState('');
  const [date, setDate]           = useState(new Date().toISOString().slice(0, 10));
  const [students, setStudents]   = useState([]);
  const [existing, setExisting]   = useState({});
  const [records, setRecords]     = useState({});
  const [loading, setLoading]     = useState(false);
  const [saving, setSaving]       = useState(false);
  const [msg, setMsg]             = useState('');

  useEffect(() => { document.title = 'Attendance — SchoolSaaS'; }, []);
  const canRecord = ['owner','teacher','headmaster_academics','headmaster_admin','class_teacher'].includes(user?.role);

  useEffect(() => {
    api.get('/classes').then(d => setClasses(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);

  async function loadAttendance() {
    if (!classId || !date) return;
    setLoading(true);
    try {
      const [studs, att] = await Promise.all([
        api.get(`/students?class_id=${classId}`),
        api.get(`/attendance?class_id=${classId}&date=${date}`),
      ]);
      const studList = Array.isArray(studs) ? studs : [];
      setStudents(studList);
      const existingMap = {};
      const recordMap = {};
      studList.forEach(s => { recordMap[s.id] = 'present'; });
      if (Array.isArray(att)) {
        att.forEach(a => { existingMap[a.student_id] = a.status; recordMap[a.student_id] = a.status; });
      }
      setExisting(existingMap);
      setRecords(recordMap);
    } catch {}
    setLoading(false);
  }

  useEffect(() => { loadAttendance(); }, [classId, date]);

  function setStatus(studentId, status) { setRecords(r => ({ ...r, [studentId]: status })); }
  function markAll(status) {
    const next = {};
    students.forEach(s => { next[s.id] = status; });
    setRecords(next);
  }

  async function submit() {
    if (!classId || !date || students.length === 0) return;
    setSaving(true); setMsg('');
    try {
      const recordsList = students.map(s => ({ student_id: s.id, status: records[s.id] || 'present' }));
      await api.post('/attendance/bulk', { class_id: classId, date, records: recordsList });
      setMsg('Attendance saved successfully.');
      setTimeout(() => setMsg(''), 4000);
      loadAttendance();
    } catch (err) { setMsg('Error: ' + err.message); }
    finally { setSaving(false); }
  }

  const counts = STATUSES.reduce((acc, s) => {
    acc[s] = students.filter(st => records[st.id] === s).length;
    return acc;
  }, {});
  const hasExisting = Object.keys(existing).length > 0;

  return (
    <div className="page">
      <div className="page-title">Attendance</div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>Class</label>
          <SearchableSelect
            value={classId}
            onChange={v => setClassId(v)}
            options={classes.map(c => ({ value: c.id, label: c.name }))}
            placeholder="— Select Class —"
          />
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>Date</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} />
        </div>
      </div>

      {!classId && <p style={{ color: '#888' }}>Select a class to view or record attendance.</p>}
      {classId && loading && <p style={{ color: '#888' }}>Loading…</p>}

      {classId && !loading && students.length > 0 && (
        <>
          {hasExisting && (
            <div style={{ background: '#e8f5e9', border: '1px solid #a5d6a7', borderRadius: 6, padding: '8px 14px', marginBottom: 14, fontSize: 13 }}>
              Attendance already recorded for this date. You can update it below.
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
            {STATUSES.map(s => (
              <span key={s} style={{ padding: '4px 12px', borderRadius: 20, background: STATUS_COLOR[s] + '20',
                                      color: STATUS_COLOR[s], fontWeight: 600, fontSize: 13, border: `1px solid ${STATUS_COLOR[s]}40` }}>
                {s}: {counts[s]}
              </span>
            ))}
          </div>

          {canRecord && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              <span style={{ fontSize: 13, color: '#666', alignSelf: 'center' }}>Mark all:</span>
              {STATUSES.map(s => (
                <button key={s} className="btn btn-sm" onClick={() => markAll(s)}
                  style={{ background: STATUS_COLOR[s] + '15', color: STATUS_COLOR[s],
                           border: `1px solid ${STATUS_COLOR[s]}50`, textTransform: 'capitalize' }}>
                  {s}
                </button>
              ))}
            </div>
          )}

          <table>
            <thead><tr><th>#</th><th>Student</th><th>Code</th><th>Status</th></tr></thead>
            <tbody>
              {students.map((s, i) => (
                <tr key={s.id}>
                  <td style={{ color: '#888', fontSize: 12 }}>{i + 1}</td>
                  <td style={{ fontWeight: 500 }}>{s.name}</td>
                  <td style={{ color: '#888', fontSize: 12 }}>{s.student_code}</td>
                  <td>
                    {canRecord
                      ? (
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {STATUSES.map(st => (
                            <button key={st} onClick={() => setStatus(s.id, st)}
                              style={{ padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                                       border: `1.5px solid ${records[s.id] === st ? STATUS_COLOR[st] : '#ddd'}`,
                                       background: records[s.id] === st ? STATUS_COLOR[st] + '20' : 'transparent',
                                       color: records[s.id] === st ? STATUS_COLOR[st] : '#888', textTransform: 'capitalize' }}>
                              {st}
                            </button>
                          ))}
                        </div>
                      )
                      : (
                        <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                                       background: STATUS_COLOR[records[s.id]] + '20', color: STATUS_COLOR[records[s.id]],
                                       textTransform: 'capitalize' }}>
                          {records[s.id] || '—'}
                        </span>
                      )
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {canRecord && (
            <div style={{ marginTop: 20 }}>
              {msg && <div className={`alert ${msg.startsWith('Error') ? 'alert-error' : 'alert-success'}`} style={{ marginBottom: 10 }}>{msg}</div>}
              <button className="btn btn-primary" onClick={submit} disabled={saving}>
                {saving ? 'Saving…' : hasExisting ? 'Update Attendance' : 'Save Attendance'}
              </button>
            </div>
          )}
        </>
      )}

      {classId && !loading && students.length === 0 && (
        <p style={{ color: '#888' }}>No active students in this class.</p>
      )}
    </div>
  );
}
