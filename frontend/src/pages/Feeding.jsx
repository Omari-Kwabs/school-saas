import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { useBrand } from '../context/BrandContext';

export default function Feeding() {
  const { brand } = useBrand();
  const [classes, setClasses]           = useState([]);
  const [classId, setClassId]           = useState('');
  const [date, setDate]                 = useState(new Date().toISOString().slice(0, 10));
  const [amount, setAmount]             = useState('5.00');
  const [mealType, setMealType]         = useState('lunch');
  const [students, setStudents]         = useState([]);
  const [fedMap, setFedMap]             = useState({});  // student_id → record_id
  const [dayLoading, setDayLoading]     = useState(false);
  const [saving, setSaving]             = useState(false);
  const [msg, setMsg]                   = useState('');

  // Summary section
  const [summaryFrom, setSummaryFrom]   = useState('');
  const [summaryTo, setSummaryTo]       = useState('');
  const [summary, setSummary]           = useState(null);
  const [sumLoading, setSumLoading]     = useState(false);

  useEffect(() => { api.get('/classes').then(setClasses).catch(() => {}); }, []);

  useEffect(() => {
    if (!classId || !date) return;
    setDayLoading(true);
    setFedMap({});
    Promise.all([
      api.get(`/students?class_id=${classId}`),
      api.get(`/feeding/records?class_id=${classId}&date_from=${date}&date_to=${date}`),
    ]).then(([stds, recs]) => {
      setStudents(Array.isArray(stds) ? stds : (stds?.data ?? []));
      const map = {};
      if (Array.isArray(recs)) recs.forEach(r => { map[r.student_id] = r.id; });
      setFedMap(map);
    }).catch(() => {}).finally(() => setDayLoading(false));
  }, [classId, date]);

  function flash(text) { setMsg(text); setTimeout(() => setMsg(''), 3500); }

  async function toggleFed(student_id) {
    const recordId = fedMap[student_id];
    if (recordId) {
      await api.delete(`/feeding/records/${recordId}`).catch(() => {});
      setFedMap(prev => { const n = { ...prev }; delete n[student_id]; return n; });
    } else {
      const r = await api.post('/feeding/records', {
        student_id, class_id: classId, date,
        amount: parseFloat(amount) || 0,
        meal_type: mealType,
      }).catch(() => null);
      if (r?.id) setFedMap(prev => ({ ...prev, [student_id]: r.id }));
    }
  }

  async function markAll() {
    setSaving(true);
    try {
      await api.post('/feeding/records/bulk', {
        class_id: classId, date,
        amount: parseFloat(amount) || 0,
        meal_type: mealType,
      });
      const recs = await api.get(`/feeding/records?class_id=${classId}&date_from=${date}&date_to=${date}`);
      const map = {};
      if (Array.isArray(recs)) recs.forEach(r => { map[r.student_id] = r.id; });
      setFedMap(map);
      flash(`All ${students.length} students marked as fed.`);
    } catch (err) { flash(err.message || 'Error'); }
    finally { setSaving(false); }
  }

  async function clearAll() {
    if (!window.confirm('Clear all feeding records for this class on this date?')) return;
    setSaving(true);
    try {
      await Promise.all(Object.values(fedMap).map(id => api.delete(`/feeding/records/${id}`)));
      setFedMap({});
      flash('All records cleared.');
    } catch (err) { flash(err.message || 'Error'); }
    finally { setSaving(false); }
  }

  async function loadSummary() {
    if (!classId) return;
    setSumLoading(true);
    try {
      const from = summaryFrom || date.slice(0, 7) + '-01';
      const to   = summaryTo   || date;
      const s    = await api.get(`/feeding/summary/class/${classId}?date_from=${from}&date_to=${to}`);
      setSummary(Array.isArray(s) ? s : []);
    } catch {}
    finally { setSumLoading(false); }
  }

  function printList() {
    const className = classes.find(c => String(c.id) === String(classId))?.name || 'Class';
    const fedStudents = students.filter(s => fedMap[s.id]);
    const total = fedStudents.length * (parseFloat(amount) || 0);
    const formattedDate = new Date(date + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const mealLabel = mealType.charAt(0).toUpperCase() + mealType.slice(1);
    const primaryColor = brand.primaryColor || '#4f46e5';
    const schoolName = brand.schoolName || 'School';

    const rows = students.map((s, i) => {
      const isFed = !!fedMap[s.id];
      return `
        <tr style="background:${i % 2 === 0 ? '#fff' : '#f9fafb'}">
          <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;text-align:center;color:#6b7280;font-size:13px">${i + 1}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;font-weight:500">${s.name}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:13px">${s.student_code || '—'}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;text-align:center">
            ${isFed
              ? `<span style="display:inline-block;padding:2px 12px;border-radius:12px;background:#dcfce7;color:#15803d;font-weight:700;font-size:12px">✓ Fed</span>`
              : `<span style="display:inline-block;width:60px;border-bottom:1px solid #d1d5db;">&nbsp;</span>`}
          </td>
          <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;text-align:center;color:#6b7280;font-size:12px">
            ${isFed ? `GH₵${parseFloat(amount || 0).toFixed(2)}` : '—'}
          </td>
          <td style="padding:8px 40px;border-bottom:1px solid #e5e7eb">&nbsp;</td>
        </tr>`;
    }).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
      <title>Feeding List — ${className} — ${date}</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 14px; color: #111; background: #fff; }
        @media print { body { margin: 0; } @page { size: A4; margin: 18mm 16mm; } }
      </style>
    </head><body style="padding:32px">
      <!-- Header -->
      <div style="display:flex;align-items:center;gap:16px;border-bottom:3px solid ${primaryColor};padding-bottom:14px;margin-bottom:20px">
        ${brand.logoUrl ? `<img src="${brand.logoUrl}" style="width:60px;height:60px;object-fit:contain;border-radius:8px" />` : `<div style="width:60px;height:60px;border-radius:8px;background:${primaryColor};display:flex;align-items:center;justify-content:center;color:#fff;font-size:24px;font-weight:800">${schoolName[0]}</div>`}
        <div>
          <div style="font-size:20px;font-weight:800;color:${primaryColor}">${schoolName}</div>
          ${brand.motto ? `<div style="font-size:12px;color:#6b7280;margin-top:2px;font-style:italic">${brand.motto}</div>` : ''}
        </div>
        <div style="margin-left:auto;text-align:right">
          <div style="font-size:18px;font-weight:700;color:#1e293b">Feeding List</div>
          <div style="font-size:12px;color:#6b7280;margin-top:2px">Prepared: ${new Date().toLocaleDateString('en-GB')}</div>
        </div>
      </div>

      <!-- Info strip -->
      <div style="display:flex;gap:24px;background:#f8fafc;border:1px solid #e5e7eb;border-radius:8px;padding:12px 18px;margin-bottom:20px;flex-wrap:wrap">
        <div><span style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.5px">Class</span><div style="font-weight:700;font-size:15px;margin-top:2px">${className}</div></div>
        <div><span style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.5px">Date</span><div style="font-weight:700;font-size:15px;margin-top:2px">${formattedDate}</div></div>
        <div><span style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.5px">Meal</span><div style="font-weight:700;font-size:15px;margin-top:2px">${mealLabel}</div></div>
        <div><span style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.5px">Rate / Student</span><div style="font-weight:700;font-size:15px;margin-top:2px">GH₵${parseFloat(amount || 0).toFixed(2)}</div></div>
        <div style="margin-left:auto;text-align:right">
          <span style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.5px">Students Fed</span>
          <div style="font-weight:800;font-size:22px;color:${primaryColor};margin-top:2px">${fedStudents.length} <span style="font-size:13px;color:#6b7280;font-weight:400">/ ${students.length}</span></div>
        </div>
      </div>

      <!-- Table -->
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead>
          <tr style="background:${primaryColor}">
            <th style="padding:9px 10px;color:#fff;font-weight:600;text-align:center;width:40px">#</th>
            <th style="padding:9px 10px;color:#fff;font-weight:600;text-align:left">Student Name</th>
            <th style="padding:9px 10px;color:#fff;font-weight:600;text-align:left">ID / Code</th>
            <th style="padding:9px 10px;color:#fff;font-weight:600;text-align:center">Status</th>
            <th style="padding:9px 10px;color:#fff;font-weight:600;text-align:center">Amount</th>
            <th style="padding:9px 10px;color:#fff;font-weight:600;text-align:center">Signature</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
        <tfoot>
          <tr style="background:#f1f5f9">
            <td colspan="4" style="padding:10px 10px;font-weight:700;font-size:13px">TOTAL</td>
            <td style="padding:10px 10px;font-weight:800;font-size:14px;text-align:center;color:${primaryColor}">GH₵${total.toFixed(2)}</td>
            <td></td>
          </tr>
        </tfoot>
      </table>

      <!-- Footer -->
      <div style="margin-top:36px;display:flex;gap:60px">
        <div style="flex:1">
          <div style="font-size:12px;color:#6b7280;margin-bottom:4px">Prepared by (Bursar/Accountant)</div>
          <div style="border-bottom:1px solid #9ca3af;height:28px;margin-bottom:4px"></div>
          <div style="font-size:11px;color:#9ca3af">Name &amp; Signature</div>
        </div>
        <div style="flex:1">
          <div style="font-size:12px;color:#6b7280;margin-bottom:4px">Received by (Serving Staff)</div>
          <div style="border-bottom:1px solid #9ca3af;height:28px;margin-bottom:4px"></div>
          <div style="font-size:11px;color:#9ca3af">Name &amp; Signature</div>
        </div>
        <div style="flex:1">
          <div style="font-size:12px;color:#6b7280;margin-bottom:4px">Date</div>
          <div style="border-bottom:1px solid #9ca3af;height:28px;margin-bottom:4px"></div>
          <div style="font-size:11px;color:#9ca3af">&nbsp;</div>
        </div>
      </div>
    </body></html>`;

    const w = window.open('', '_blank');
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 400);
  }

  function printSummary() {
    const className = classes.find(c => String(c.id) === String(classId))?.name || 'Class';
    const primaryColor = brand.primaryColor || '#4f46e5';
    const schoolName = brand.schoolName || 'School';
    const fromLabel = summaryFrom || '—';
    const toLabel   = summaryTo   || '—';
    const grandTotal = (summary || []).reduce((s, r) => s + parseFloat(r.total_amount || 0), 0);
    const totalDays  = (summary || []).reduce((s, r) => s + (r.days_fed || 0), 0);

    const rows = (summary || []).map((s, i) => `
      <tr style="background:${i % 2 === 0 ? '#fff' : '#f9fafb'}">
        <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;text-align:center;color:#6b7280;font-size:13px">${i + 1}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;font-weight:500">${s.student_name}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:13px">${s.student_code || '—'}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;text-align:center;font-weight:700;color:${s.days_fed > 0 ? '#15803d' : '#9ca3af'}">${s.days_fed}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600">GH₵${parseFloat(s.total_amount).toFixed(2)}</td>
      </tr>`).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
      <title>Feeding Summary — ${className}</title>
      <style>* { box-sizing:border-box;margin:0;padding:0; } body { font-family:'Segoe UI',Arial,sans-serif;font-size:14px;color:#111; }
      @media print { @page { size:A4;margin:18mm 16mm; } }</style>
    </head><body style="padding:32px">
      <div style="display:flex;align-items:center;gap:16px;border-bottom:3px solid ${primaryColor};padding-bottom:14px;margin-bottom:20px">
        ${brand.logoUrl ? `<img src="${brand.logoUrl}" style="width:60px;height:60px;object-fit:contain;border-radius:8px"/>` : `<div style="width:60px;height:60px;border-radius:8px;background:${primaryColor};display:flex;align-items:center;justify-content:center;color:#fff;font-size:24px;font-weight:800">${schoolName[0]}</div>`}
        <div>
          <div style="font-size:20px;font-weight:800;color:${primaryColor}">${schoolName}</div>
          ${brand.motto ? `<div style="font-size:12px;color:#6b7280;margin-top:2px;font-style:italic">${brand.motto}</div>` : ''}
        </div>
        <div style="margin-left:auto;text-align:right">
          <div style="font-size:18px;font-weight:700">Feeding Period Summary</div>
          <div style="font-size:12px;color:#6b7280;margin-top:2px">Printed: ${new Date().toLocaleDateString('en-GB')}</div>
        </div>
      </div>
      <div style="display:flex;gap:24px;background:#f8fafc;border:1px solid #e5e7eb;border-radius:8px;padding:12px 18px;margin-bottom:20px;flex-wrap:wrap">
        <div><span style="font-size:11px;color:#6b7280;text-transform:uppercase">Class</span><div style="font-weight:700;font-size:15px;margin-top:2px">${className}</div></div>
        <div><span style="font-size:11px;color:#6b7280;text-transform:uppercase">Period</span><div style="font-weight:700;font-size:15px;margin-top:2px">${fromLabel} → ${toLabel}</div></div>
        <div style="margin-left:auto;text-align:right">
          <span style="font-size:11px;color:#6b7280;text-transform:uppercase">Grand Total</span>
          <div style="font-weight:800;font-size:22px;color:${primaryColor};margin-top:2px">GH₵${grandTotal.toFixed(2)}</div>
        </div>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead>
          <tr style="background:${primaryColor}">
            <th style="padding:9px 10px;color:#fff;text-align:center;width:40px">#</th>
            <th style="padding:9px 10px;color:#fff;text-align:left">Student Name</th>
            <th style="padding:9px 10px;color:#fff;text-align:left">ID / Code</th>
            <th style="padding:9px 10px;color:#fff;text-align:center">Days Fed</th>
            <th style="padding:9px 10px;color:#fff;text-align:right">Total (GH₵)</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
        <tfoot>
          <tr style="background:#f1f5f9">
            <td colspan="3" style="padding:10px;font-weight:700">TOTAL</td>
            <td style="padding:10px;text-align:center;font-weight:700">${totalDays}</td>
            <td style="padding:10px;text-align:right;font-weight:800;color:${primaryColor}">GH₵${grandTotal.toFixed(2)}</td>
          </tr>
        </tfoot>
      </table>
      <div style="margin-top:36px;display:flex;gap:60px">
        <div style="flex:1"><div style="font-size:12px;color:#6b7280;margin-bottom:4px">Prepared by (Bursar/Accountant)</div><div style="border-bottom:1px solid #9ca3af;height:28px;margin-bottom:4px"></div><div style="font-size:11px;color:#9ca3af">Name &amp; Signature</div></div>
        <div style="flex:1"><div style="font-size:12px;color:#6b7280;margin-bottom:4px">Authorised by</div><div style="border-bottom:1px solid #9ca3af;height:28px;margin-bottom:4px"></div><div style="font-size:11px;color:#9ca3af">Name &amp; Signature</div></div>
        <div style="flex:1"><div style="font-size:12px;color:#6b7280;margin-bottom:4px">Date</div><div style="border-bottom:1px solid #9ca3af;height:28px;margin-bottom:4px"></div></div>
      </div>
    </body></html>`;

    const w = window.open('', '_blank');
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 400);
  }

  const fedCount = Object.keys(fedMap).length;

  return (
    <div className="page">
      <div className="page-title">Feeding Records</div>

      {/* Selectors */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>Class</label>
          <select value={classId} onChange={e => setClassId(e.target.value)}>
            <option value="">— Select Class —</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>Date</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} />
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>Meal</label>
          <select value={mealType} onChange={e => setMealType(e.target.value)}>
            <option value="breakfast">Breakfast</option>
            <option value="lunch">Lunch</option>
            <option value="dinner">Dinner</option>
            <option value="snack">Snack</option>
          </select>
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>Amount (GH₵)</label>
          <input type="number" step="0.01" min="0" value={amount}
            onChange={e => setAmount(e.target.value)} style={{ width: 90 }} />
        </div>
      </div>

      {msg && (
        <div className={`alert ${msg.toLowerCase().includes('error') || msg.toLowerCase().includes('fail') ? 'alert-error' : 'alert-success'}`}
          style={{ marginBottom: 14 }}>
          {msg}
        </div>
      )}

      {!classId && <p style={{ color: '#888' }}>Select a class and date to record feeding.</p>}

      {classId && (
        <>
          <div style={{ display: 'flex', gap: 10, marginBottom: 14, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 14, color: '#555', fontWeight: 500 }}>
              <span style={{ color: '#27ae60' }}>{fedCount}</span> / {students.length} fed today
            </span>
            <button className="btn btn-primary btn-sm" onClick={markAll} disabled={saving || dayLoading}>
              {saving ? 'Saving…' : 'Mark All Fed'}
            </button>
            {fedCount > 0 && (
              <button className="btn btn-danger btn-sm" onClick={clearAll} disabled={saving}>
                Clear All
              </button>
            )}
            <button onClick={printList} disabled={!classId || dayLoading}
              style={{ padding: '5px 14px', border: '1px solid #0ea5e9', background: '#f0f9ff', color: '#0369a1', borderRadius: 6, fontSize: 12, cursor: classId ? 'pointer' : 'not-allowed', fontWeight: 600, marginLeft: 'auto' }}>
              🖨 Print List
            </button>
          </div>

          {dayLoading ? (
            <p style={{ color: '#888', fontSize: 13 }}>Loading…</p>
          ) : (
            <table>
              <thead>
                <tr><th>Student</th><th>Code</th><th>Status</th></tr>
              </thead>
              <tbody>
                {students.length === 0 && (
                  <tr><td colSpan={3} style={{ textAlign: 'center', color: '#888', padding: 24 }}>No active students in this class.</td></tr>
                )}
                {students.map(s => {
                  const isFed = !!fedMap[s.id];
                  return (
                    <tr key={s.id}>
                      <td style={{ fontWeight: 500 }}>{s.name}</td>
                      <td style={{ color: '#888', fontSize: 12 }}>{s.student_code || '—'}</td>
                      <td>
                        <button onClick={() => toggleFed(s.id)}
                          style={{
                            padding: '4px 16px', borderRadius: 16, border: 'none', cursor: 'pointer',
                            fontWeight: 600, fontSize: 12,
                            background: isFed ? '#e8f5e9' : '#f5f5f5',
                            color:      isFed ? '#27ae60' : '#999',
                          }}>
                          {isFed ? '✓ Fed' : '— Unfed'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {/* Summary section */}
          <div style={{ marginTop: 32, background: '#fff', borderRadius: 8, padding: '16px 20px', boxShadow: '0 1px 3px rgba(0,0,0,.08)' }}>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>Period Summary</div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>From</label>
                <input type="date" value={summaryFrom} onChange={e => setSummaryFrom(e.target.value)} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>To</label>
                <input type="date" value={summaryTo} onChange={e => setSummaryTo(e.target.value)} />
              </div>
              <button className="btn btn-secondary btn-sm" onClick={loadSummary} disabled={sumLoading}>
                {sumLoading ? 'Loading…' : 'Load Summary'}
              </button>
              {summary && (
                <button onClick={printSummary}
                  style={{ padding: '5px 14px', border: '1px solid #0ea5e9', background: '#f0f9ff', color: '#0369a1', borderRadius: 6, fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
                  🖨 Print Summary
                </button>
              )}
            </div>

            {summary && (
              <table>
                <thead>
                  <tr><th>Student</th><th>Code</th><th>Days Fed</th><th>Total (GH₵)</th></tr>
                </thead>
                <tbody>
                  {summary.map(s => (
                    <tr key={s.student_id}>
                      <td style={{ fontWeight: 500 }}>{s.student_name}</td>
                      <td style={{ color: '#888', fontSize: 12 }}>{s.student_code || '—'}</td>
                      <td style={{ fontWeight: 700, color: s.days_fed > 0 ? '#27ae60' : '#ccc' }}>{s.days_fed}</td>
                      <td>GH₵{parseFloat(s.total_amount).toFixed(2)}</td>
                    </tr>
                  ))}
                  {summary.length === 0 && (
                    <tr><td colSpan={4} style={{ textAlign: 'center', color: '#888', padding: 16 }}>No records in this period.</td></tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
