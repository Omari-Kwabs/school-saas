import React, { useEffect, useState, useCallback, useRef } from 'react';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';
import { hasPrivilege, PRIVILEGES } from '../utils/access';

function SearchSelect({ value, onChange, options, placeholder, style }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const selected = options.find(o => o.value === value);

  useEffect(() => {
    function handler(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = options.filter(o => !query || o.label.toLowerCase().includes(query.toLowerCase()));

  return (
    <div ref={ref} style={{ position: 'relative', ...style }}>
      <div
        onClick={() => { setOpen(o => !o); setQuery(''); }}
        style={{ ...style, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                 cursor: 'pointer', userSelect: 'none', padding: '8px 12px',
                 border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 13, background: '#fff',
                 minHeight: 36, boxSizing: 'border-box' }}
      >
        <span style={{ color: selected ? '#111' : '#9ca3af', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selected ? selected.label : placeholder}
        </span>
        <svg style={{ width: 14, height: 14, color: '#6b7280', flexShrink: 0, marginLeft: 6 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/>
        </svg>
      </div>
      {open && (
        <div style={{ position: 'absolute', zIndex: 999, top: '100%', left: 0, right: 0, background: '#fff',
                      border: '1px solid #e5e7eb', borderRadius: 6, boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                      marginTop: 2, maxHeight: 240, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '6px 8px', borderBottom: '1px solid #f3f4f6' }}>
            <input
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Type to search…"
              style={{ width: '100%', border: '1px solid #e5e7eb', borderRadius: 4, padding: '4px 8px', fontSize: 12, boxSizing: 'border-box', outline: 'none' }}
              onClick={e => e.stopPropagation()}
            />
          </div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            <div
              onClick={() => { onChange(''); setOpen(false); setQuery(''); }}
              style={{ padding: '8px 12px', fontSize: 13, cursor: 'pointer', color: '#9ca3af',
                       background: value === '' ? '#eff6ff' : 'transparent' }}
              onMouseEnter={e => e.target.style.background = '#f9fafb'}
              onMouseLeave={e => e.target.style.background = value === '' ? '#eff6ff' : 'transparent'}
            >
              {placeholder}
            </div>
            {filtered.map(o => (
              <div
                key={o.value}
                onClick={() => { onChange(o.value); setOpen(false); setQuery(''); }}
                style={{ padding: '8px 12px', fontSize: 13, cursor: 'pointer',
                         background: value === o.value ? '#eff6ff' : 'transparent',
                         fontWeight: value === o.value ? 600 : 400 }}
                onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
                onMouseLeave={e => e.currentTarget.style.background = value === o.value ? '#eff6ff' : 'transparent'}
              >
                {o.label}
              </div>
            ))}
            {filtered.length === 0 && (
              <div style={{ padding: '8px 12px', fontSize: 13, color: '#9ca3af' }}>No matches</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const ghc = n =>
  `GH₵${parseFloat(n || 0).toLocaleString('en-GH', { minimumFractionDigits: 2 })}`;

function planStatus(p) {
  const eff = parseFloat(p.effective_balance ?? p.balance);
  if (eff <= 0) return eff < -0.005 ? 'credit' : 'paid';
  if (parseFloat(p.overdue_amount) > 0) return 'overdue';
  return 'owing';
}

const STATUS = {
  paid:    { bg: '#e8f8f0', color: '#1a7a46', label: 'Fully Paid' },
  credit:  { bg: '#eff6ff', color: '#1d4ed8', label: 'Overpaid — Credit' },
  owing:   { bg: '#fff3cd', color: '#856404', label: 'Owing' },
  overdue: { bg: '#fde8e8', color: '#9b1c1c', label: 'Overdue' },
};

const PLAN_TYPES = [
  { value: 'full',    label: 'Full Payment (lump sum)' },
  { value: '50_50',   label: '50 / 50 — 2 equal instalments' },
  { value: '60_40',   label: '60 / 40 — 2 instalments' },
  { value: 'weekly',  label: 'Weekly Instalments' },
  { value: 'monthly', label: 'Monthly Instalments' },
];

const emptyPay = {
  student_id: '', plan_id: '', amount: '',
  payment_date: new Date().toISOString().slice(0, 10),
  receipt_number: '', method: 'cash', notes: '',
};
const emptyPlanForm = {
  student_id: '', term_id: '', fee_structure_id: '', plan_type: 'full',
  total_amount: '', start_date: new Date().toISOString().slice(0, 10),
};
const emptyBulkForm = {
  class_id: '', term_id: '', fee_structure_id: '', plan_type: 'full',
  total_amount: '', start_date: new Date().toISOString().slice(0, 10),
};
const emptyCfForm = { student_id: '', from_term_id: '', to_term_id: '', notes: '' };

const TABS = [
  { id: 'plans',     label: 'Payment Plans' },
  { id: 'payments',  label: 'Transactions' },
  { id: 'analytics', label: 'Analytics' },
  { id: 'balance',   label: 'Balance Sheet' },
];

function DraggableFeeSummary({ billed, collected, outstanding, overdue, ghc }) {
  const cardRef  = useRef(null);
  const dragRef  = useRef(null); // { startX, startY, startLeft, startTop }
  const [pos, setPos] = useState(null); // null = use default bottom-right anchor

  function onMouseDown(e) {
    if (e.button !== 0) return;
    e.preventDefault();
    const rect = cardRef.current.getBoundingClientRect();
    // Convert to top/left so we can track freely
    const initLeft = rect.left;
    const initTop  = rect.top;
    dragRef.current = { startX: e.clientX, startY: e.clientY, startLeft: initLeft, startTop: initTop };
    setPos({ left: initLeft, top: initTop }); // switch to absolute coords

    function onMove(ev) {
      const { startX, startY, startLeft, startTop } = dragRef.current;
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      const w  = cardRef.current?.offsetWidth  || 240;
      const h  = cardRef.current?.offsetHeight || 180;
      const maxL = window.innerWidth  - w  - 8;
      const maxT = window.innerHeight - h  - 8;
      setPos({
        left: Math.max(8, Math.min(maxL, startLeft + dx)),
        top:  Math.max(8, Math.min(maxT, startTop  + dy)),
      });
    }
    function onUp() {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup',   onUp);
      dragRef.current = null;
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onUp);
  }

  const pct = billed > 0 ? Math.round((collected / billed) * 100) : 0;

  const posStyle = pos
    ? { left: pos.left, top: pos.top }
    : { bottom: 28, right: 28 };

  return (
    <div
      ref={cardRef}
      style={{
        position: 'fixed', zIndex: 1000,
        background: '#1e293b', color: '#fff',
        borderRadius: 16, padding: '0 0 14px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.28)',
        minWidth: 230, display: 'flex', flexDirection: 'column',
        userSelect: 'none',
        ...posStyle,
      }}
    >
      {/* Drag handle */}
      <div
        onMouseDown={onMouseDown}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 16px 8px',
          cursor: 'grab', borderRadius: '16px 16px 0 0',
          background: '#0f172a',
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: '#94a3b8', textTransform: 'uppercase' }}>
          Fee Summary
        </span>
        {/* drag dots indicator */}
        <svg width="14" height="14" viewBox="0 0 14 14" fill="#475569">
          {[2,6,10].map(cx => [2,7,12].map(cy => (
            <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="1.2" />
          )))}
        </svg>
      </div>

      {/* Rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '10px 16px 0' }}>
        <SummaryRow label="Total Billed"  value={ghc(billed)}      color="#e2e8f0" />
        <SummaryRow label="Collected"     value={ghc(collected)}   color="#4ade80" />
        <SummaryRow label="Owed"          value={ghc(outstanding)} color="#fbbf24" />
        {overdue > 0 && <SummaryRow label="Overdue" value={ghc(overdue)} color="#f87171" />}
        <div style={{ marginTop: 2, height: 6, background: '#334155', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ height: '100%', borderRadius: 3, background: '#4ade80', width: `${pct}%`, transition: 'width .4s ease' }} />
        </div>
        <div style={{ fontSize: 11, color: '#64748b', textAlign: 'right' }}>{pct}% collected</div>
      </div>
    </div>
  );
}

function SummaryRow({ label, value, color }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: 12, color: '#94a3b8' }}>{label}</span>
      <span style={{ fontSize: 15, fontWeight: 700, color }}>{value}</span>
    </div>
  );
}

export default function Fees() {
  const { user } = useAuth();
  const canWrite = hasPrivilege(user, PRIVILEGES.FINANCE_WRITE);

  const [tab, setTab] = useState('plans');

  // Data
  const [plans, setPlans]             = useState([]);
  const [allPlans, setAllPlans]       = useState([]);
  const [payments, setPayments]       = useState([]);
  const [analytics, setAnalytics]     = useState(null);
  const [classes, setClasses]         = useState([]);
  const [terms, setTerms]             = useState([]);
  const [students, setStudents]       = useState([]);
  const [feeStructures, setFeeStructures] = useState([]);

  // Filters
  const [filterClass, setFilterClass]   = useState('');
  const [filterTerm, setFilterTerm]     = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterMethod, setFilterMethod] = useState('');
  const [search, setSearch]             = useState('');

  // Active panel: null | 'payment' | 'plan' | 'bulk'
  const [activePanel, setActivePanel] = useState(null);
  const [msg, setMsg]                 = useState('');

  // Record payment form
  const [form, setForm]           = useState(emptyPay);
  const [saving, setSaving]       = useState(false);
  const [formError, setFormError] = useState('');

  // Assign plan (single student)
  const [planForm, setPlanForm]       = useState(emptyPlanForm);
  const [planSaving, setPlanSaving]   = useState(false);
  const [planError, setPlanError]     = useState('');

  // Bulk assign
  const [bulkForm, setBulkForm]       = useState(emptyBulkForm);
  const [bulkSaving, setBulkSaving]   = useState(false);
  const [bulkError, setBulkError]     = useState('');

  // Carry forward
  const [cfForm, setCfForm]           = useState(emptyCfForm);
  const [cfSaving, setCfSaving]       = useState(false);
  const [cfError, setCfError]         = useState('');
  const [cfPreview, setCfPreview]     = useState(null); // { amount, type } after lookup

  // Loading
  const [plansLoading, setPlansLoading]       = useState(false);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  // Static data — load once
  useEffect(() => {
    document.title = 'Fees & Payments — SchoolSaaS';
    client.get('/classes').then(r => setClasses(r.data)).catch(() => {});
    client.get('/terms').then(r => setTerms(r.data)).catch(() => {});
    client.get('/students').then(r => setStudents(r.data)).catch(() => {});
    client.get('/fee-structures').then(r => setFeeStructures(r.data)).catch(() => {});
    client.get('/payments/plans').then(r => setAllPlans(r.data)).catch(() => {});
  }, []);

  const loadPlans = useCallback(async () => {
    setPlansLoading(true);
    try {
      const p = new URLSearchParams();
      if (filterTerm)  p.set('term_id',  filterTerm);
      if (filterClass) p.set('class_id', filterClass);
      const res = await client.get(`/payments/plans?${p}`);
      setPlans(res.data);
    } catch {}
    setPlansLoading(false);
  }, [filterTerm, filterClass]);

  const loadPayments = useCallback(async () => {
    try { setPayments((await client.get('/payments')).data); } catch {}
  }, []);

  const loadAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    try {
      const p = new URLSearchParams();
      if (filterTerm)  p.set('term_id',  filterTerm);
      if (filterClass) p.set('class_id', filterClass);
      setAnalytics((await client.get(`/payments/analytics?${p}`)).data);
    } catch {}
    setAnalyticsLoading(false);
  }, [filterTerm, filterClass]);

  useEffect(() => { if (tab === 'plans' || tab === 'balance') loadPlans(); }, [tab, loadPlans]);
  useEffect(() => { if (tab === 'payments') loadPayments(); }, [tab, loadPayments]);
  useEffect(() => { if (tab === 'analytics') loadAnalytics(); }, [tab, loadAnalytics]);

  // Client-side filters
  const filteredPlans = plans.filter(p => {
    if (filterStatus !== 'all' && planStatus(p) !== filterStatus) return false;
    const q = search.toLowerCase();
    return !q || p.student_name?.toLowerCase().includes(q);
  });
  const filteredPayments = payments.filter(p => {
    if (filterMethod && p.method !== filterMethod) return false;
    const q = search.toLowerCase();
    return !q || p.student_name?.toLowerCase().includes(q) || p.receipt_number?.toLowerCase().includes(q);
  });

  // Unpaid plans for selected student (payment form)
  const studentPlans = allPlans.filter(
    p => p.student_id === form.student_id && parseFloat(p.balance) > 0
  );

  // Bulk preview: students in selected class
  const bulkClassStudents = bulkForm.class_id
    ? students.filter(s => s.class_id === bulkForm.class_id)
    : [];

  // When a fee structure is selected, auto-fill total_amount
  function applyStructure(structureId, setter) {
    const fs = feeStructures.find(f => f.id === structureId);
    setter(prev => ({
      ...prev,
      fee_structure_id: structureId,
      ...(fs?.total_amount ? { total_amount: String(fs.total_amount) } : {}),
    }));
  }

  function flash(text) { setMsg(text); setTimeout(() => setMsg(''), 5000); }

  function refreshPlans() {
    loadPlans();
    client.get('/payments/plans').then(r => setAllPlans(r.data)).catch(() => {});
  }

  function openPanel(name) {
    setActivePanel(p => p === name ? null : name);
    setFormError(''); setPlanError(''); setBulkError('');
  }

  // ── Record Payment ──────────────────────────────────────────────────────────
  async function recordPayment(e) {
    e.preventDefault();
    setSaving(true); setFormError('');
    try {
      if (!form.student_id) { setFormError('Select a student.'); return; }
      if (!form.amount || parseFloat(form.amount) <= 0) { setFormError('Amount must be greater than 0.'); return; }
      await client.post('/payments', {
        student_id:     form.student_id,
        plan_id:        form.plan_id || undefined,
        amount:         parseFloat(form.amount),
        payment_date:   form.payment_date,
        receipt_number: form.receipt_number || null,
        method:         form.method,
        notes:          form.notes || null,
      });
      setActivePanel(null); setForm(emptyPay);
      flash('Payment recorded.');
      refreshPlans();
      if (tab === 'payments')  loadPayments();
      if (tab === 'analytics') loadAnalytics();
    } catch (err) {
      setFormError(err.response?.data?.error || err.message);
    } finally { setSaving(false); }
  }

  // ── Assign Plan (single student) ────────────────────────────────────────────
  async function createPlan(e) {
    e.preventDefault();
    setPlanSaving(true); setPlanError('');
    try {
      if (!planForm.student_id) { setPlanError('Select a student.'); return; }
      if (!planForm.term_id)    { setPlanError('Select a term.');    return; }
      if (!planForm.total_amount || parseFloat(planForm.total_amount) <= 0) {
        setPlanError('Enter a valid total amount.'); return;
      }
      const res = await client.post('/payments/plans', {
        student_id:       planForm.student_id,
        term_id:          planForm.term_id,
        fee_structure_id: planForm.fee_structure_id || undefined,
        plan_type:        planForm.plan_type,
        total_amount:     parseFloat(planForm.total_amount),
        start_date:       planForm.start_date,
      });
      setActivePanel(null); setPlanForm(emptyPlanForm);
      const cf = res.data?.carry_forward;
      const cfMsg = cf
        ? ` ${cf.amount > 0 ? `Arrears of ${ghc(cf.amount)}` : `Credit of ${ghc(Math.abs(cf.amount))}`} from previous term carried forward automatically.`
        : '';
      flash(`Payment plan created.${cfMsg}`);
      refreshPlans();
    } catch (err) {
      setPlanError(err.response?.data?.error || err.message);
    } finally { setPlanSaving(false); }
  }

  // ── Bulk Assign ─────────────────────────────────────────────────────────────
  async function bulkAssign(e) {
    e.preventDefault();
    setBulkSaving(true); setBulkError('');
    try {
      if (!bulkForm.class_id) { setBulkError('Select a class.'); return; }
      if (!bulkForm.term_id)  { setBulkError('Select a term.'); return; }
      if (!bulkForm.total_amount || parseFloat(bulkForm.total_amount) <= 0) {
        setBulkError('Enter a valid total amount.'); return;
      }
      const res = await client.post('/payments/plans/bulk', {
        class_id:         bulkForm.class_id,
        term_id:          bulkForm.term_id,
        fee_structure_id: bulkForm.fee_structure_id || undefined,
        plan_type:        bulkForm.plan_type,
        total_amount:     parseFloat(bulkForm.total_amount),
        start_date:       bulkForm.start_date,
      });
      setActivePanel(null); setBulkForm(emptyBulkForm);
      const { created, skipped, carry_forwards = 0 } = res.data;
      const cfPart = carry_forwards > 0 ? ` ${carry_forwards} balance${carry_forwards !== 1 ? 's' : ''} carried forward automatically.` : '';
      flash(`Bulk assign done: ${created} plan${created !== 1 ? 's' : ''} created${skipped > 0 ? `, ${skipped} skipped` : ''}.${cfPart}`);
      refreshPlans();
    } catch (err) {
      setBulkError(err.response?.data?.error || err.message);
    } finally { setBulkSaving(false); }
  }

  // ── Carry Forward ──────────────────────────────────────────────────────────
  async function lookupCfBalance() {
    if (!cfForm.student_id || !cfForm.from_term_id) return;
    try {
      const res = await client.get(`/payments/plans?student_id=${cfForm.student_id}&term_id=${cfForm.from_term_id}`);
      const plans = res.data;
      if (!plans.length) { setCfPreview({ error: 'No payment plan found for this student in the source term.' }); return; }
      const eff = parseFloat(plans[0].effective_balance ?? plans[0].balance);
      setCfPreview({
        amount: Math.abs(eff),
        type: eff > 0.005 ? 'arrears' : eff < -0.005 ? 'credit' : 'zero',
      });
    } catch { setCfPreview(null); }
  }

  async function submitCarryForward(e) {
    e.preventDefault();
    setCfSaving(true); setCfError('');
    try {
      if (!cfForm.student_id) { setCfError('Select a student.'); return; }
      if (!cfForm.from_term_id) { setCfError('Select the source term.'); return; }
      if (!cfForm.to_term_id)   { setCfError('Select the destination term.'); return; }
      const res = await client.post('/payments/carry-forward', cfForm);
      const { type, amount } = res.data;
      setActivePanel(null); setCfForm(emptyCfForm); setCfPreview(null);
      const label = type === 'arrears' ? `arrears of ${ghc(amount)}` : `credit of ${ghc(Math.abs(amount))}`;
      flash(`Balance carried forward — ${label} added to destination term.`);
      refreshPlans();
    } catch (err) {
      setCfError(err.response?.data?.error || err.message);
    } finally { setCfSaving(false); }
  }

  // Balance sheet aggregate — billed includes carry-forwards, outstanding uses effective_balance
  const balanceByClass = {};
  plans.forEach(p => {
    const q = search.toLowerCase();
    if (q && !p.student_name?.toLowerCase().includes(q)) return;
    if (filterStatus !== 'all' && planStatus(p) !== filterStatus) return;
    const key = p.class_name || 'No Class';
    if (!balanceByClass[key]) {
      balanceByClass[key] = { class_name: key, students: new Set(), billed: 0, collected: 0, overdue: 0 };
    }
    balanceByClass[key].students.add(p.student_id);
    // billed = term fees + carry-forward (arrears add, credits subtract)
    balanceByClass[key].billed    += parseFloat(p.total_amount || 0) + parseFloat(p.carry_forward || 0);
    balanceByClass[key].collected += parseFloat(p.total_paid     || 0);
    balanceByClass[key].overdue   += parseFloat(p.overdue_amount || 0);
  });
  const balanceRows = Object.values(balanceByClass).map(r => ({
    class_name: r.class_name, students: r.students.size,
    billed: r.billed, collected: r.collected,
    outstanding: Math.max(0, r.billed - r.collected),
    overdue: r.overdue,
    rate: r.billed > 0 ? Math.min(100, Math.round((r.collected / r.billed) * 100)) : 0,
  }));
  const balTotals = balanceRows.reduce(
    (a, r) => ({ billed: a.billed + r.billed, collected: a.collected + r.collected, outstanding: a.outstanding + r.outstanding, overdue: a.overdue + r.overdue }),
    { billed: 0, collected: 0, outstanding: 0, overdue: 0 }
  );

  // Floating summary — billed and outstanding include carry-forwards
  const floatBilled      = allPlans.reduce((s, p) => s + parseFloat(p.total_amount || 0) + parseFloat(p.carry_forward || 0), 0);
  const floatCollected   = allPlans.reduce((s, p) => s + parseFloat(p.total_paid     || 0), 0);
  const floatOutstanding = allPlans.reduce((s, p) => s + Math.max(0, parseFloat(p.effective_balance ?? p.balance) || 0), 0);
  const floatOverdue     = allPlans.reduce((s, p) => s + parseFloat(p.overdue_amount || 0), 0);

  const sel = { padding: '7px 12px', border: '1px solid #ddd', borderRadius: 6, fontSize: 13 };
  const fld = { padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 13, width: '100%', background: '#fff', boxSizing: 'border-box' };

  // Shared form section for plan fields (used in both single + bulk forms)
  function PlanFields({ form: f, setForm: sf, showStudent, showClass }) {
    return (
      <div className="form-row">
        {showStudent && (
          <div className="form-group">
            <label>Student *</label>
            <SearchSelect
              value={f.student_id}
              onChange={v => sf(x => ({ ...x, student_id: v }))}
              options={students.map(s => ({ value: s.id, label: s.name }))}
              placeholder="— Select Student —"
              style={fld}
            />
          </div>
        )}
        {showClass && (
          <div className="form-group">
            <label>Class *</label>
            <SearchSelect
              value={f.class_id}
              onChange={v => sf(x => ({ ...x, class_id: v }))}
              options={classes.map(c => ({ value: c.id, label: c.name }))}
              placeholder="— Select Class —"
              style={fld}
            />
          </div>
        )}
        <div className="form-group">
          <label>Term *</label>
          <select style={fld} value={f.term_id}
            onChange={e => sf(x => ({ ...x, term_id: e.target.value }))}>
            <option value="">— Select Term —</option>
            {terms.map(t => <option key={t.id} value={t.id}>{t.name}{t.is_current ? ' ✓' : ''}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label>Fee Structure <span style={{ color: '#9ca3af', fontWeight: 400 }}>(auto-fills amount)</span></label>
          <select style={fld} value={f.fee_structure_id}
            onChange={e => applyStructure(e.target.value, sf)}>
            <option value="">— None / Enter manually —</option>
            {feeStructures.map(fs => (
              <option key={fs.id} value={fs.id}>
                {fs.name}{fs.class_name ? ` (${fs.class_name})` : ''} — {ghc(fs.total_amount)}
              </option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label>Total Amount (GH₵) *</label>
          <input type="number" step="0.01" min="0.01" style={fld} value={f.total_amount}
            onChange={e => sf(x => ({ ...x, total_amount: e.target.value }))} />
        </div>
        <div className="form-group">
          <label>Plan Type *</label>
          <select style={fld} value={f.plan_type}
            onChange={e => sf(x => ({ ...x, plan_type: e.target.value }))}>
            {PLAN_TYPES.map(pt => <option key={pt.value} value={pt.value}>{pt.label}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label>Start Date *</label>
          <input type="date" style={fld} value={f.start_date}
            onChange={e => sf(x => ({ ...x, start_date: e.target.value }))} />
        </div>
      </div>
    );
  }

  return (
    <div className="page">

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div className="page-title">Fees & Payments</div>
        {canWrite && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-secondary" onClick={() => openPanel('bulk')}
              style={{ background: activePanel === 'bulk' ? '#fef3c7' : undefined }}>
              {activePanel === 'bulk' ? '✕ Cancel' : 'Bulk Assign Fees'}
            </button>
            <button className="btn btn-secondary" onClick={() => openPanel('plan')}
              style={{ background: activePanel === 'plan' ? '#eff6ff' : undefined }}>
              {activePanel === 'plan' ? '✕ Cancel' : '+ Assign to Student'}
            </button>
            <button className="btn btn-secondary" onClick={() => { openPanel('carryforward'); setCfPreview(null); }}
              style={{ background: activePanel === 'carryforward' ? '#fdf4ff' : undefined, borderColor: '#a855f7', color: '#7e22ce' }}>
              {activePanel === 'carryforward' ? '✕ Cancel' : 'Balance B/F'}
            </button>
            <button className="btn btn-primary" onClick={() => openPanel('payment')}>
              {activePanel === 'payment' ? '✕ Cancel' : '+ Record Payment'}
            </button>
          </div>
        )}
      </div>

      {msg && <div className="alert alert-success">{msg}</div>}

      {/* ── Bulk Assign Panel ──────────────────────────────────────────────────── */}
      {activePanel === 'bulk' && (
        <div className="panel" style={{ marginBottom: 16, borderTop: '3px solid #f59e0b' }}>
          <div className="panel-header">
            <div>
              <h3>Bulk Assign Fees to Class</h3>
              <p style={{ fontSize: 12, color: '#6b7280', marginTop: 2, fontWeight: 400 }}>
                Creates a payment plan for every student in the class. Students who already have a plan for the term are automatically skipped.
              </p>
            </div>
          </div>
          {bulkError && <div className="alert alert-error">{bulkError}</div>}
          <form onSubmit={bulkAssign}>
            <PlanFields form={bulkForm} setForm={setBulkForm} showClass />
            {bulkClassStudents.length > 0 && bulkForm.total_amount && (
              <div style={{ display: 'flex', gap: 24, background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '12px 16px', marginBottom: 16, fontSize: 13, flexWrap: 'wrap' }}>
                <div><span style={{ color: '#6b7280' }}>Students in class: </span><strong>{bulkClassStudents.length}</strong></div>
                <div><span style={{ color: '#6b7280' }}>Fee per student: </span><strong>{ghc(bulkForm.total_amount)}</strong></div>
                <div><span style={{ color: '#6b7280' }}>Estimated total: </span><strong style={{ color: '#1d4ed8' }}>{ghc(bulkClassStudents.length * parseFloat(bulkForm.total_amount || 0))}</strong></div>
              </div>
            )}
            <button className="btn btn-primary" disabled={bulkSaving}>
              {bulkSaving
                ? 'Assigning…'
                : `Assign to All Students${bulkClassStudents.length ? ` (${bulkClassStudents.length})` : ''}`}
            </button>
          </form>
        </div>
      )}

      {/* ── Carry Forward Panel ───────────────────────────────────────────────── */}
      {activePanel === 'carryforward' && (
        <div className="panel" style={{ marginBottom: 16, borderTop: '3px solid #a855f7' }}>
          <div className="panel-header">
            <div>
              <h3>Balance Brought Forward</h3>
              <p style={{ fontSize: 12, color: '#6b7280', marginTop: 2, fontWeight: 400 }}>
                Balance carry-forward is applied automatically when a payment plan is created.
                Use this only to manually correct or apply a missed carry-forward.
              </p>
            </div>
          </div>
          {cfError && <div className="alert alert-error">{cfError}</div>}
          <form onSubmit={submitCarryForward}>
            <div className="form-row">
              <div className="form-group">
                <label>Student *</label>
                <SearchSelect
                  value={cfForm.student_id}
                  onChange={v => { setCfForm(f => ({ ...f, student_id: v })); setCfPreview(null); }}
                  options={students.map(s => ({ value: s.id, label: s.name }))}
                  placeholder="— Select Student —"
                  style={fld}
                />
              </div>
              <div className="form-group">
                <label>Source Term (previous term) *</label>
                <select style={fld} value={cfForm.from_term_id}
                  onChange={e => { setCfForm(f => ({ ...f, from_term_id: e.target.value })); setCfPreview(null); }}
                  onBlur={lookupCfBalance}>
                  <option value="">— Select Term —</option>
                  {terms.map(t => <option key={t.id} value={t.id}>{t.name}{t.is_current ? ' ✓' : ''}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Destination Term (new term) *</label>
                <select style={fld} value={cfForm.to_term_id}
                  onChange={e => setCfForm(f => ({ ...f, to_term_id: e.target.value }))}>
                  <option value="">— Select Term —</option>
                  {terms.map(t => <option key={t.id} value={t.id}>{t.name}{t.is_current ? ' ✓' : ''}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label>Notes</label>
                <input style={fld} value={cfForm.notes}
                  onChange={e => setCfForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Optional — e.g. Arrears from Term 1 2024/25" />
              </div>
            </div>

            {cfPreview && !cfPreview.error && (
              <div style={{
                display: 'flex', gap: 16, alignItems: 'center', padding: '12px 16px',
                background: cfPreview.type === 'arrears' ? '#fef9ec' : cfPreview.type === 'credit' ? '#eff6ff' : '#f9fafb',
                border: `1px solid ${cfPreview.type === 'arrears' ? '#fbbf24' : cfPreview.type === 'credit' ? '#bfdbfe' : '#e5e7eb'}`,
                borderRadius: 8, marginBottom: 16, fontSize: 13,
              }}>
                {cfPreview.type === 'zero'
                  ? <span style={{ color: '#6b7280' }}>Balance is zero — nothing to carry forward.</span>
                  : <>
                      <span style={{ fontSize: 22 }}>{cfPreview.type === 'arrears' ? '📋' : '💳'}</span>
                      <div>
                        <div style={{ fontWeight: 700, color: cfPreview.type === 'arrears' ? '#92400e' : '#1e40af' }}>
                          {cfPreview.type === 'arrears' ? 'Arrears to carry forward:' : 'Overpayment credit to carry forward:'}
                        </div>
                        <div style={{ fontSize: 20, fontWeight: 800, color: cfPreview.type === 'arrears' ? '#b45309' : '#2563eb' }}>
                          {ghc(cfPreview.amount)}
                        </div>
                        {cfPreview.type === 'credit' && (
                          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                            This credit will offset the student's fees in the destination term.
                          </div>
                        )}
                      </div>
                    </>
                }
              </div>
            )}
            {cfPreview?.error && (
              <div style={{ padding: '10px 14px', background: '#fde8e8', border: '1px solid #fca5a5', borderRadius: 8, marginBottom: 16, fontSize: 13, color: '#991b1b' }}>
                {cfPreview.error}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="btn btn-secondary" onClick={lookupCfBalance}
                disabled={!cfForm.student_id || !cfForm.from_term_id}>
                Check Balance
              </button>
              <button className="btn btn-primary" disabled={cfSaving || cfPreview?.type === 'zero'}
                style={{ background: '#7e22ce', borderColor: '#7e22ce' }}>
                {cfSaving ? 'Carrying forward…' : 'Carry Forward Balance'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Assign to Student Panel ────────────────────────────────────────────── */}
      {activePanel === 'plan' && (
        <div className="panel" style={{ marginBottom: 16, borderTop: '3px solid #2563eb' }}>
          <div className="panel-header">
            <h3>Assign Payment Plan to Student</h3>
          </div>
          {planError && <div className="alert alert-error">{planError}</div>}
          <form onSubmit={createPlan}>
            <PlanFields form={planForm} setForm={setPlanForm} showStudent />
            <button className="btn btn-primary" disabled={planSaving}>
              {planSaving ? 'Creating…' : 'Create Payment Plan'}
            </button>
          </form>
        </div>
      )}

      {/* ── Record Payment Panel ───────────────────────────────────────────────── */}
      {activePanel === 'payment' && (
        <div className="panel" style={{ marginBottom: 16 }}>
          <div className="panel-header">
            <h3>Record Payment</h3>
          </div>
          {formError && <div className="alert alert-error">{formError}</div>}
          <form onSubmit={recordPayment}>
            <div className="form-row">
              <div className="form-group">
                <label>Student *</label>
                <SearchSelect
                  value={form.student_id}
                  onChange={v => setForm(f => ({ ...f, student_id: v, plan_id: '' }))}
                  options={students.map(s => ({ value: s.id, label: s.name }))}
                  placeholder="— Select Student —"
                />
              </div>
              {studentPlans.length > 0 && (
                <div className="form-group">
                  <label>Payment Plan</label>
                  <select value={form.plan_id} onChange={e => setForm(f => ({ ...f, plan_id: e.target.value }))}>
                    <option value="">— None —</option>
                    {studentPlans.map(p => (
                      <option key={p.id} value={p.id}>{p.term_name} — Balance: {ghc(p.balance)}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="form-group">
                <label>Amount (GH₵) *</label>
                <input type="number" step="0.01" min="0.01" value={form.amount}
                  onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label>Date *</label>
                <input type="date" value={form.payment_date}
                  onChange={e => setForm(f => ({ ...f, payment_date: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label>Method</label>
                <select value={form.method} onChange={e => setForm(f => ({ ...f, method: e.target.value }))}>
                  {['cash', 'mobile_money', 'bank_transfer', 'cheque'].map(m => (
                    <option key={m} value={m}>{m.replace(/_/g, ' ')}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Receipt #</label>
                <input value={form.receipt_number}
                  onChange={e => setForm(f => ({ ...f, receipt_number: e.target.value }))}
                  placeholder="e.g. REC-001" />
              </div>
            </div>
            <button className="btn btn-success" disabled={saving}>
              {saving ? 'Saving…' : 'Record Payment'}
            </button>
          </form>
        </div>
      )}

      {/* Tab Nav */}
      <div style={{ display: 'flex', borderBottom: '2px solid #e5e7eb', marginBottom: 16 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '9px 18px', border: 'none', background: 'none', cursor: 'pointer',
            fontWeight: tab === t.id ? 700 : 400,
            color:      tab === t.id ? '#2563eb' : '#6b7280',
            borderBottom: tab === t.id ? '2px solid #2563eb' : '2px solid transparent',
            marginBottom: -2, fontSize: 14,
          }}>{t.label}</button>
        ))}
      </div>

      {/* Filter Bar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        {tab !== 'analytics' && (
          <input placeholder="Search student…" value={search} onChange={e => setSearch(e.target.value)}
            style={{ ...sel, minWidth: 160 }} />
        )}
        <select value={filterClass} onChange={e => setFilterClass(e.target.value)} style={sel}>
          <option value="">All Classes</option>
          {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={filterTerm} onChange={e => setFilterTerm(e.target.value)} style={sel}>
          <option value="">All Terms</option>
          {terms.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        {(tab === 'plans' || tab === 'balance') && (
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={sel}>
            <option value="all">All Statuses</option>
            <option value="paid">Fully Paid</option>
            <option value="owing">Owing</option>
            <option value="overdue">Overdue</option>
          </select>
        )}
        {tab === 'payments' && (
          <select value={filterMethod} onChange={e => setFilterMethod(e.target.value)} style={sel}>
            <option value="">All Methods</option>
            <option value="cash">Cash</option>
            <option value="mobile_money">Mobile Money</option>
            <option value="bank_transfer">Bank Transfer</option>
            <option value="cheque">Cheque</option>
          </select>
        )}
      </div>

      {/* ── Payment Plans Tab ─────────────────────────────────────────────────── */}
      {tab === 'plans' && (
        <table>
          <thead>
            <tr>
              <th>Student</th><th>Class</th><th>Term</th><th>Plan Type</th>
              <th>Term Fees</th><th>Paid</th><th>Balance</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            {plansLoading ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', color: '#888', padding: 24 }}>Loading…</td></tr>
            ) : filteredPlans.length === 0 ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', color: '#888', padding: 24 }}>No records found.</td></tr>
            ) : filteredPlans.map(p => {
              const st = planStatus(p);
              const sc = STATUS[st];
              const cf = parseFloat(p.carry_forward || 0);
              const effBal = parseFloat(p.effective_balance ?? p.balance);
              return (
                <tr key={p.id}>
                  <td style={{ fontWeight: 600 }}>{p.student_name}</td>
                  <td>{p.class_name || '—'}</td>
                  <td>{p.term_name}</td>
                  <td style={{ textTransform: 'capitalize' }}>{p.plan_type?.replace(/_/g, ' ')}</td>
                  <td>{ghc(p.total_amount)}</td>
                  <td style={{ color: '#16a34a' }}>{ghc(p.total_paid)}</td>
                  <td style={{ color: effBal > 0.005 ? '#dc2626' : effBal < -0.005 ? '#2563eb' : '#16a34a', fontWeight: 600 }}>
                    <div>{ghc(Math.abs(effBal))}{effBal < -0.005 ? ' CR' : ''}</div>
                    {Math.abs(cf) > 0.005 && (
                      <div style={{ fontSize: 11, fontWeight: 400, color: cf > 0 ? '#b45309' : '#1d4ed8', marginTop: 2 }}>
                        {cf > 0 ? `+${ghc(cf)} arrears B/F` : `${ghc(Math.abs(cf))} credit B/F`}
                      </div>
                    )}
                  </td>
                  <td>
                    <span style={{ background: sc.bg, color: sc.color, padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600 }}>
                      {sc.label}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {/* ── Transactions Tab ──────────────────────────────────────────────────── */}
      {tab === 'payments' && (
        <table>
          <thead>
            <tr><th>Student</th><th>Amount</th><th>Date</th><th>Method</th><th>Receipt #</th></tr>
          </thead>
          <tbody>
            {filteredPayments.length === 0 ? (
              <tr><td colSpan={5} style={{ textAlign: 'center', color: '#888', padding: 24 }}>No payments found.</td></tr>
            ) : filteredPayments.map(p => (
              <tr key={p.id}>
                <td>{p.student_name}</td>
                <td style={{ fontWeight: 600, color: '#16a34a' }}>{ghc(p.amount)}</td>
                <td>{p.payment_date ? new Date(p.payment_date).toLocaleDateString('en-GH') : '—'}</td>
                <td style={{ textTransform: 'capitalize' }}>{p.method?.replace(/_/g, ' ')}</td>
                <td>{p.receipt_number || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* ── Analytics Tab ─────────────────────────────────────────────────────── */}
      {tab === 'analytics' && (
        analyticsLoading || !analytics ? (
          <div style={{ textAlign: 'center', padding: 48, color: '#888' }}>Loading analytics…</div>
        ) : (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(185px,1fr))', gap: 16, marginBottom: 24 }}>
              {[
                { label: 'Total Due',     value: analytics.summary.total_billed,    color: '#2563eb' },
                { label: 'Collected',     value: analytics.summary.total_collected,  color: '#16a34a' },
                { label: 'Outstanding',   value: analytics.summary.outstanding,      color: '#d97706' },
                ...(analytics.summary.credit_balance > 0.005
                  ? [{ label: 'Credit (owed to students)', value: analytics.summary.credit_balance, color: '#7e22ce' }]
                  : [{ label: 'Overdue', value: analytics.summary.overdue, color: '#dc2626' }]
                ),
              ].map(c => (
                <div key={c.label} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '16px 20px', borderLeft: `4px solid ${c.color}` }}>
                  <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6, fontWeight: 500 }}>{c.label}</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: c.color }}>{ghc(c.value)}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              <div className="panel">
                <div className="panel-header"><h3>By Class</h3></div>
                <table>
                  <thead><tr><th>Class</th><th>Students</th><th>Billed</th><th>Collected</th><th>Rate</th></tr></thead>
                  <tbody>
                    {analytics.by_class.length === 0
                      ? <tr><td colSpan={5} style={{ textAlign: 'center', color: '#888', padding: 16 }}>No data</td></tr>
                      : analytics.by_class.map(r => (
                        <tr key={r.class_name}>
                          <td>{r.class_name}</td>
                          <td>{r.student_count}</td>
                          <td>{ghc(r.total_billed)}</td>
                          <td style={{ color: '#16a34a' }}>{ghc(r.total_collected)}</td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <div style={{ width: 60, height: 6, background: '#e5e7eb', borderRadius: 3 }}>
                                <div style={{ width: `${r.collection_rate}%`, height: '100%', borderRadius: 3, background: r.collection_rate >= 80 ? '#16a34a' : r.collection_rate >= 50 ? '#d97706' : '#dc2626' }} />
                              </div>
                              <span style={{ fontSize: 12 }}>{r.collection_rate}%</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
              <div className="panel">
                <div className="panel-header"><h3>By Payment Method</h3></div>
                <table>
                  <thead><tr><th>Method</th><th>Transactions</th><th>Total</th></tr></thead>
                  <tbody>
                    {analytics.by_method.length === 0
                      ? <tr><td colSpan={3} style={{ textAlign: 'center', color: '#888', padding: 16 }}>No transactions yet</td></tr>
                      : analytics.by_method.map(r => (
                        <tr key={r.method}>
                          <td style={{ textTransform: 'capitalize' }}>{r.method.replace(/_/g, ' ')}</td>
                          <td>{r.count}</td>
                          <td style={{ color: '#16a34a', fontWeight: 600 }}>{ghc(r.total)}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )
      )}

      {/* ── Balance Sheet Tab ─────────────────────────────────────────────────── */}
      {tab === 'balance' && (
        <div className="panel">
          <div className="panel-header"><h3>Balance Sheet — Fee Collection</h3></div>
          {plansLoading ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#888' }}>Loading…</div>
          ) : (
            <table>
              <thead>
                <tr><th>Class</th><th>Students</th><th>Total Due</th><th>Collected</th><th>Outstanding</th><th>Overdue</th><th>Rate</th></tr>
              </thead>
              <tbody>
                {balanceRows.length === 0
                  ? <tr><td colSpan={7} style={{ textAlign: 'center', color: '#888', padding: 24 }}>No data for selected filters.</td></tr>
                  : balanceRows.map(r => (
                    <tr key={r.class_name}>
                      <td style={{ fontWeight: 600 }}>{r.class_name}</td>
                      <td>{r.students}</td>
                      <td>{ghc(r.billed)}</td>
                      <td style={{ color: '#16a34a', fontWeight: 600 }}>{ghc(r.collected)}</td>
                      <td style={{ color: r.outstanding > 0 ? '#d97706' : '#16a34a' }}>{ghc(r.outstanding)}</td>
                      <td style={{ color: r.overdue > 0 ? '#dc2626' : '#16a34a' }}>{ghc(r.overdue)}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ width: 80, height: 8, background: '#e5e7eb', borderRadius: 4 }}>
                            <div style={{ width: `${r.rate}%`, height: '100%', borderRadius: 4, background: r.rate >= 80 ? '#16a34a' : r.rate >= 50 ? '#d97706' : '#dc2626' }} />
                          </div>
                          <span style={{ fontSize: 13, fontWeight: 600 }}>{r.rate}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
              {balanceRows.length > 0 && (
                <tfoot>
                  <tr style={{ fontWeight: 700, background: '#f8f9fa' }}>
                    <td colSpan={2}>TOTAL</td>
                    <td>{ghc(balTotals.billed)}</td>
                    <td style={{ color: '#16a34a' }}>{ghc(balTotals.collected)}</td>
                    <td style={{ color: balTotals.outstanding > 0 ? '#d97706' : '#16a34a' }}>{ghc(balTotals.outstanding)}</td>
                    <td style={{ color: balTotals.overdue > 0 ? '#dc2626' : '#16a34a' }}>{ghc(balTotals.overdue)}</td>
                    <td>{balTotals.billed > 0 ? Math.round((balTotals.collected / balTotals.billed) * 100) : 0}%</td>
                  </tr>
                </tfoot>
              )}
            </table>
          )}
        </div>
      )}

      {/* ── Floating Summary Card (draggable) ────────────────────────────────── */}
      {allPlans.length > 0 && <DraggableFeeSummary
        billed={floatBilled} collected={floatCollected}
        outstanding={floatOutstanding} overdue={floatOverdue}
        ghc={ghc}
      />}
    </div>
  );
}
