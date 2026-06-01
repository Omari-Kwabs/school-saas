import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const PERIODS = [1,2,3,4,5,6,7,8];

export default function Timetable() {
  const { user } = useAuth();
  const [classes, setClasses]   = useState([]);
  const [terms, setTerms]       = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [classId, setClassId]   = useState('');
  const [termId, setTermId]     = useState('');
  const [slots, setSlots]       = useState([]);
  const [loading, setLoading]   = useState(false);

  // modal for editing a cell
  const [modal, setModal]   = useState(null); // { day, period, slot? }
  const [slotForm, setSlotForm] = useState({ subject_id: '', teacher_id: '', start_time: '', end_time: '', label: '' });
  const [slotSaving, setSlotSaving] = useState(false);
  const [slotError, setSlotError]   = useState('');

  const canEdit = ['owner','headmaster_academics','headmaster_admin'].includes(user?.role);

  useEffect(() => {
    Promise.all([
      api.get('/classes'),
      api.get('/terms'),
      api.get('/subjects'),
      api.get('/users').catch(() => []),
    ]).then(([c, t, s, u]) => {
      setClasses(Array.isArray(c) ? c : []);
      setTerms(Array.isArray(t) ? t : []);
      setSubjects(Array.isArray(s) ? s : []);
      setTeachers(Array.isArray(u) ? u.filter(u => ['teacher','class_teacher','department_head'].includes(u.role)) : []);
    }).catch(() => {});
  }, []);

  async function loadSlots() {
    if (!classId) return;
    setLoading(true);
    try {
      const q = termId ? `?class_id=${classId}&term_id=${termId}` : `?class_id=${classId}`;
      const d = await api.get(`/timetable${q}`);
      setSlots(Array.isArray(d) ? d : []);
    } catch {}
    setLoading(false);
  }

  useEffect(() => { loadSlots(); }, [classId, termId]);

  function getSlot(day, period) {
    return slots.find(s => s.day_of_week === day && s.period_num === period);
  }

  function openCell(day, period) {
    if (!canEdit || !classId) return;
    const existing = getSlot(day, period);
    setSlotForm(existing
      ? { subject_id: existing.subject_id || '', teacher_id: existing.teacher_id || '',
          start_time: existing.start_time || '', end_time: existing.end_time || '', label: existing.label || '' }
      : { subject_id: '', teacher_id: '', start_time: '', end_time: '', label: '' }
    );
    setModal({ day, period, slot: existing || null });
    setSlotError('');
  }

  async function saveSlot(e) {
    e.preventDefault(); setSlotSaving(true); setSlotError('');
    try {
      await api.post('/timetable', {
        class_id: classId,
        term_id: termId || undefined,
        day_of_week: modal.day,
        period_num: modal.period,
        subject_id: slotForm.subject_id || undefined,
        teacher_id: slotForm.teacher_id || undefined,
        start_time: slotForm.start_time || undefined,
        end_time:   slotForm.end_time   || undefined,
        label:      slotForm.label      || undefined,
      });
      setModal(null); loadSlots();
    } catch (err) { setSlotError(err.message); }
    finally { setSlotSaving(false); }
  }

  async function deleteSlot() {
    if (!modal?.slot) return;
    try { await api.delete(`/timetable/${modal.slot.id}`); setModal(null); loadSlots(); } catch {}
  }

  // colour cells by subject
  const subjectColors = {};
  subjects.forEach((s, i) => {
    const palette = ['#3498db','#27ae60','#8e44ad','#e67e22','#e74c3c','#16a085','#2c3e50','#d35400'];
    subjectColors[s.id] = palette[i % palette.length];
  });

  return (
    <div className="page">
      <div className="page-title">Timetable</div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>Class</label>
          <select value={classId} onChange={e => setClassId(e.target.value)}>
            <option value="">— Select Class —</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>Term (optional)</label>
          <select value={termId} onChange={e => setTermId(e.target.value)}>
            <option value="">All Terms</option>
            {terms.map(t => <option key={t.id} value={t.id}>{t.name}{t.is_current ? ' (current)' : ''}</option>)}
          </select>
        </div>
      </div>

      {!classId && <p style={{ color: '#888' }}>Select a class to view its timetable.</p>}
      {classId && loading && <p style={{ color: '#888' }}>Loading…</p>}

      {classId && !loading && (
        <>
          {canEdit && <p style={{ color: '#888', fontSize: 13, marginBottom: 12 }}>Click any cell to add or edit a slot.</p>}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ minWidth: 700 }}>
              <thead>
                <tr>
                  <th style={{ width: 60 }}>Period</th>
                  {DAYS.map(d => <th key={d}>{d}</th>)}
                </tr>
              </thead>
              <tbody>
                {PERIODS.map(p => (
                  <tr key={p}>
                    <td style={{ fontWeight: 600, color: '#888', fontSize: 12, textAlign: 'center' }}>{p}</td>
                    {DAYS.map((_, di) => {
                      const slot = getSlot(di, p);
                      const color = slot?.subject_id ? subjectColors[slot.subject_id] : null;
                      return (
                        <td key={di} onClick={() => openCell(di, p)}
                          style={{ cursor: canEdit && classId ? 'pointer' : 'default', padding: 6, verticalAlign: 'top',
                                   background: slot ? (color + '18') : '#fafafa',
                                   borderLeft: slot ? `3px solid ${color}` : '3px solid transparent',
                                   minHeight: 60, minWidth: 110 }}>
                          {slot ? (
                            <div>
                              <div style={{ fontWeight: 600, fontSize: 12, color: color || '#333' }}>
                                {slot.label || slot.subject_name || '—'}
                              </div>
                              {slot.teacher_name && <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{slot.teacher_name}</div>}
                              {(slot.start_time || slot.end_time) && (
                                <div style={{ fontSize: 10, color: '#aaa', marginTop: 2 }}>{slot.start_time}–{slot.end_time}</div>
                              )}
                            </div>
                          ) : (
                            <span style={{ color: '#ddd', fontSize: 12 }}>{canEdit ? '+' : '—'}</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Edit modal */}
      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 10, padding: 24, width: 400, maxWidth: '95vw', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 16 }}>
              {DAYS[modal.day]} · Period {modal.period}
            </div>
            {slotError && <div className="alert alert-error" style={{ marginBottom: 10 }}>{slotError}</div>}
            <form onSubmit={saveSlot}>
              <div className="form-group">
                <label>Subject</label>
                <select value={slotForm.subject_id} onChange={e => setSlotForm(f => ({ ...f, subject_id: e.target.value }))}>
                  <option value="">— Free / Break —</option>
                  {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Teacher</label>
                <select value={slotForm.teacher_id} onChange={e => setSlotForm(f => ({ ...f, teacher_id: e.target.value }))}>
                  <option value="">— None —</option>
                  {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div className="form-group">
                  <label>Start Time</label>
                  <input type="time" value={slotForm.start_time} onChange={e => setSlotForm(f => ({ ...f, start_time: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>End Time</label>
                  <input type="time" value={slotForm.end_time} onChange={e => setSlotForm(f => ({ ...f, end_time: e.target.value }))} />
                </div>
              </div>
              <div className="form-group">
                <label>Label (optional override)</label>
                <input value={slotForm.label} onChange={e => setSlotForm(f => ({ ...f, label: e.target.value }))} placeholder="e.g. Break, Assembly" />
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button className="btn btn-primary" type="submit" disabled={slotSaving}>{slotSaving ? 'Saving…' : 'Save'}</button>
                {modal.slot && <button className="btn btn-danger btn-sm" type="button" onClick={deleteSlot}>Clear Slot</button>}
                <button className="btn btn-secondary" type="button" onClick={() => setModal(null)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
