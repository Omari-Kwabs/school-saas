import React, { useEffect, useState, useCallback } from 'react';
import { api } from '../api';

const DEFAULT_CATEGORIES = [
  'Salaries & Staff',
  'Utilities',
  'Maintenance & Repairs',
  'Teaching & Learning Materials',
  'Office Supplies',
  'Transport & Logistics',
  'Events & Programs',
  'Food & Catering',
  'Security',
  'IT & Technology',
  'Bank Charges',
  'Miscellaneous',
];

function fmt(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GH', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtMoney(n) {
  return `GH₵${Number(n || 0).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const EMPTY = {
  receipt_number: '',
  category: '',
  description: '',
  amount: '',
  expense_date: new Date().toISOString().slice(0, 10),
  paid_to: '',
  notes: '',
};

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}
function monthBounds(ym) {
  const [y, m] = ym.split('-').map(Number);
  const from = `${ym}-01`;
  const last  = new Date(y, m, 0).getDate();
  const to   = `${ym}-${String(last).padStart(2, '0')}`;
  return { from, to };
}

function SummaryView({ usedCategories }) {
  const [month, setMonth]         = useState(currentMonth());
  const [useCustom, setUseCustom] = useState(false);
  const [customFrom, setFrom]     = useState('');
  const [customTo, setTo]         = useState('');

  const [summary, setSummary]     = useState(null);
  const [loading, setLoading]     = useState(false);

  const [editBal, setEditBal]     = useState(false);
  const [balInput, setBalInput]   = useState('');
  const [balNotes, setBalNotes]   = useState('');
  const [savingBal, setSavingBal] = useState(false);
  const [flash, setFlash]         = useState('');

  const showFlash = (m) => { setFlash(m); setTimeout(() => setFlash(''), 3000); };

  const fetch = useCallback(async () => {
    const { from, to } = useCustom && customFrom && customTo
      ? { from: customFrom, to: customTo }
      : monthBounds(month);
    const pk = useCustom ? `${from}_${to}` : month;
    setLoading(true);
    try {
      const data = await api.get(
        `/expenses/summary?date_from=${from}&date_to=${to}&period_key=${pk}`,
      );
      setSummary(data);
      setBalInput(String(data.opening_balance));
      setBalNotes(data.opening_notes || '');
    } catch { /* handled globally */ }
    finally { setLoading(false); }
  }, [month, useCustom, customFrom, customTo]);

  useEffect(() => { fetch(); }, [fetch]);

  async function saveBal() {
    if (!summary) return;
    setSavingBal(true);
    try {
      await api.put(`/expenses/opening-balance/${summary.period_key}`, {
        opening_balance: Number(balInput) || 0,
        notes: balNotes,
      });
      setEditBal(false);
      showFlash('Opening balance saved');
      fetch();
    } catch (e) {
      alert(e.message || 'Save failed');
    } finally {
      setSavingBal(false);
    }
  }

  const s = summary;

  return (
    <div className="space-y-4">
      {flash && <div className="p-3 bg-green-50 border border-green-200 text-green-800 text-sm rounded-lg">{flash}</div>}

      {/* Period picker */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">View by</label>
          <select value={useCustom ? 'custom' : 'month'}
            onChange={e => setUseCustom(e.target.value === 'custom')}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400">
            <option value="month">Month</option>
            <option value="custom">Custom Range</option>
          </select>
        </div>
        {!useCustom ? (
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Month</label>
            <input type="month" value={month} onChange={e => setMonth(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
          </div>
        ) : (
          <>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">From</label>
              <input type="date" value={customFrom} onChange={e => setFrom(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">To</label>
              <input type="date" value={customTo} onChange={e => setTo(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            </div>
          </>
        )}
      </div>

      {loading && <div className="text-center py-8 text-gray-400 text-sm">Loading…</div>}

      {!loading && s && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">

          {/* Period header */}
          <div className="px-6 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700">
              Financial Statement
              <span className="ml-2 text-gray-400 font-normal">
                {new Date(s.date_from).toLocaleDateString('en-GH', { day: 'numeric', month: 'short', year: 'numeric' })}
                {' — '}
                {new Date(s.date_to).toLocaleDateString('en-GH', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            </h2>
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${s.surplus ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
              {s.surplus ? 'Surplus' : 'Deficit'}
            </span>
          </div>

          <div className="divide-y divide-gray-100">

            {/* Opening balance */}
            <div className="px-6 py-4 flex items-center justify-between gap-4">
              <div className="flex-1">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Opening Balance</p>
                {s.opening_notes && <p className="text-xs text-gray-400 mt-0.5">{s.opening_notes}</p>}
              </div>
              {editBal ? (
                <div className="flex items-center gap-2 flex-wrap justify-end">
                  <input type="number" value={balInput} onChange={e => setBalInput(e.target.value)}
                    className="w-36 border border-gray-300 rounded-lg px-3 py-1.5 text-sm font-mono text-right focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                  <input value={balNotes} onChange={e => setBalNotes(e.target.value)}
                    placeholder="Notes (optional)"
                    className="w-44 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                  <button onClick={saveBal} disabled={savingBal}
                    className="px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                    {savingBal ? 'Saving…' : 'Save'}
                  </button>
                  <button onClick={() => setEditBal(false)}
                    className="px-3 py-1.5 text-xs text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <span className="text-lg font-bold text-gray-900">{fmtMoney(s.opening_balance)}</span>
                  <button onClick={() => setEditBal(true)}
                    className="text-xs text-indigo-600 hover:text-indigo-800 underline">Edit</button>
                </div>
              )}
            </div>

            {/* Income section */}
            <div className="px-6 py-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">Income — Fees Collected</p>
                <span className="text-sm font-bold text-emerald-700">+ {fmtMoney(s.income.total)}</span>
              </div>
              {s.income.by_method.length === 0
                ? <p className="text-xs text-gray-400">No payments recorded in this period</p>
                : (
                  <div className="space-y-1.5">
                    {s.income.by_method.map(row => (
                      <div key={row.method} className="flex justify-between text-sm">
                        <span className="text-gray-600 capitalize">{row.method}</span>
                        <span className="text-gray-800 font-medium">{fmtMoney(row.total)}
                          <span className="text-gray-400 text-xs ml-1">({row.count} payments)</span>
                        </span>
                      </div>
                    ))}
                  </div>
                )
              }
              <div className="mt-3 pt-2 border-t border-gray-100 flex justify-between text-sm font-semibold text-emerald-700">
                <span>Total Income</span><span>{fmtMoney(s.income.total)}</span>
              </div>
            </div>

            {/* Expenditure section */}
            <div className="px-6 py-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-red-600 uppercase tracking-wide">Expenditure</p>
                <span className="text-sm font-bold text-red-600">− {fmtMoney(s.expenditure.total)}</span>
              </div>
              {s.expenditure.by_category.length === 0
                ? <p className="text-xs text-gray-400">No expenses recorded in this period</p>
                : (
                  <div className="space-y-1.5">
                    {s.expenditure.by_category.map(row => (
                      <div key={row.category} className="flex justify-between text-sm">
                        <span className="text-gray-600">{row.category}</span>
                        <span className="text-gray-800 font-medium">{fmtMoney(row.total)}
                          <span className="text-gray-400 text-xs ml-1">({row.count} {Number(row.count) === 1 ? 'item' : 'items'})</span>
                        </span>
                      </div>
                    ))}
                  </div>
                )
              }
              <div className="mt-3 pt-2 border-t border-gray-100 flex justify-between text-sm font-semibold text-red-600">
                <span>Total Expenditure</span><span>{fmtMoney(s.expenditure.total)}</span>
              </div>
            </div>

            {/* Closing balance */}
            <div className={`px-6 py-5 flex items-center justify-between ${s.surplus ? 'bg-emerald-50' : 'bg-red-50'}`}>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">Closing Balance</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Opening ({fmtMoney(s.opening_balance)}) + Income ({fmtMoney(s.income.total)}) − Expenditure ({fmtMoney(s.expenditure.total)})
                </p>
              </div>
              <span className={`text-2xl font-bold ${s.surplus ? 'text-emerald-700' : 'text-red-700'}`}>
                {fmtMoney(s.closing_balance)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Expenses() {
  const [expenses, setExpenses]     = useState([]);
  const [total, setTotal]           = useState(0);
  const [analytics, setAnalytics]   = useState(null);
  const [usedCategories, setUsed]   = useState([]);

  const [view, setView] = useState('list'); // 'list' | 'analytics' | 'summary'

  const [search, setSearch]       = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [dateFrom, setDateFrom]   = useState('');
  const [dateTo, setDateTo]       = useState('');

  const [modal, setModal]   = useState(false);
  const [editRow, setEdit]  = useState(null);
  const [form, setForm]     = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [flash, setFlash]   = useState('');
  const [err, setErr]       = useState('');

  const [delId, setDelId] = useState(null);

  const showFlash = (msg) => { setFlash(msg); setTimeout(() => setFlash(''), 3500); };
  const showErr   = (msg) => { setErr(msg);   setTimeout(() => setErr(''),   5000); };

  const load = useCallback(async () => {
    const params = new URLSearchParams({ limit: 200 });
    if (catFilter) params.set('category', catFilter);
    if (dateFrom)  params.set('date_from', dateFrom);
    if (dateTo)    params.set('date_to', dateTo);
    if (search)    params.set('search', search);
    try {
      const data = await api.get(`/expenses?${params}`);
      setExpenses(data.expenses);
      setTotal(data.total);
    } catch { /* handled globally */ }
  }, [catFilter, dateFrom, dateTo, search]);

  const loadAnalytics = useCallback(async () => {
    const params = new URLSearchParams();
    if (dateFrom) params.set('date_from', dateFrom);
    if (dateTo)   params.set('date_to', dateTo);
    try {
      const data = await api.get(`/expenses/analytics?${params}`);
      setAnalytics(data);
    } catch { /* handled globally */ }
  }, [dateFrom, dateTo]);

  const loadCategories = useCallback(async () => {
    try { setUsed(await api.get('/expenses/categories')); }
    catch { /* ok */ }
  }, []);

  useEffect(() => { load(); loadCategories(); }, [load, loadCategories]);
  useEffect(() => { if (view === 'analytics') loadAnalytics(); }, [view, loadAnalytics]);

  function openAdd() {
    setEdit(null);
    setForm(EMPTY);
    setModal(true);
  }

  function openEdit(row) {
    setEdit(row);
    setForm({
      receipt_number: row.receipt_number,
      category:       row.category,
      description:    row.description,
      amount:         String(row.amount),
      expense_date:   row.expense_date?.slice(0, 10) || '',
      paid_to:        row.paid_to || '',
      notes:          row.notes || '',
    });
    setModal(true);
  }

  async function save() {
    setSaving(true);
    try {
      if (editRow) {
        await api.put(`/expenses/${editRow.id}`, form);
        showFlash('Expense updated');
      } else {
        await api.post('/expenses', form);
        showFlash('Expense recorded');
      }
      setModal(false);
      load();
      loadCategories();
      if (view === 'analytics') loadAnalytics();
    } catch (e) {
      showErr(e.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    try {
      await api.delete(`/expenses/${delId}`);
      setDelId(null);
      showFlash('Expense deleted');
      load();
      if (view === 'analytics') loadAnalytics();
    } catch (e) {
      setDelId(null);
      showErr(e.message || 'Delete failed');
    }
  }

  // Summary figures from current list
  const thisMonth = new Date().toISOString().slice(0, 7);
  const monthTotal = expenses.filter(e => e.expense_date?.slice(0, 7) === thisMonth)
    .reduce((s, e) => s + Number(e.amount), 0);
  const grandTotal = expenses.reduce((s, e) => s + Number(e.amount), 0);

  const allCategories = [...new Set([...DEFAULT_CATEGORIES, ...usedCategories])].sort();

  return (
    <div className="max-w-7xl mx-auto space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Expenses</h1>
          <p className="text-sm text-gray-500">Track school expenditure by category and receipt</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
            {[['list','List'],['analytics','Analytics'],['summary','Summary']].map(([v,l]) => (
              <button key={v} onClick={() => setView(v)}
                className={`px-3 py-1.5 font-medium transition-colors ${view === v ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
                {l}
              </button>
            ))}
          </div>
          {view !== 'summary' && (
            <button onClick={openAdd}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Record Expense
            </button>
          )}
        </div>
      </div>

      {flash && <div className="p-3 bg-green-50 border border-green-200 text-green-800 text-sm rounded-lg">{flash}</div>}
      {err   && <div className="p-3 bg-red-50 border border-red-200 text-red-800 text-sm rounded-lg">{err}</div>}

      {/* Summary cards — not shown on Summary tab */}
      {view !== 'summary' && <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total (filtered)', value: fmtMoney(grandTotal), sub: `${expenses.length} entries` },
          { label: 'This Month', value: fmtMoney(monthTotal), sub: new Date().toLocaleDateString('en-GH', { month: 'long', year: 'numeric' }) },
          { label: 'Categories Used', value: usedCategories.length, sub: 'distinct categories' },
          { label: 'Total Records', value: total, sub: 'all time' },
        ].map(c => (
          <div key={c.label} className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-xs text-gray-500 mb-1">{c.label}</p>
            <p className="text-lg font-bold text-gray-900">{c.value}</p>
            <p className="text-xs text-gray-400">{c.sub}</p>
          </div>
        ))}
      </div>}

      {/* Filters — only for List and Analytics */}
      {view !== 'summary' && <div className="bg-white rounded-lg border border-gray-200 p-3 flex flex-wrap gap-2">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search receipt, description, paid to…"
          className="flex-1 min-w-[180px] border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
        <select value={catFilter} onChange={e => setCatFilter(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400">
          <option value="">All Categories</option>
          {allCategories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
        {(search || catFilter || dateFrom || dateTo) && (
          <button onClick={() => { setSearch(''); setCatFilter(''); setDateFrom(''); setDateTo(''); }}
            className="text-xs text-gray-500 hover:text-gray-700 px-2 underline">Clear</button>
        )}
      </div>}

      {/* LIST VIEW */}
      {view === 'list' && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  {['Receipt #', 'Date', 'Category', 'Description', 'Paid To', 'Amount', ''].map(h => (
                    <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {expenses.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400 text-sm">No expenses found. Click "Record Expense" to add one.</td></tr>
                )}
                {expenses.map(e => (
                  <tr key={e.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-2.5">
                      <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded text-gray-700">{e.receipt_number}</span>
                    </td>
                    <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">{fmt(e.expense_date)}</td>
                    <td className="px-4 py-2.5">
                      <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700">{e.category}</span>
                    </td>
                    <td className="px-4 py-2.5 text-gray-800 max-w-xs">
                      <p className="truncate">{e.description}</p>
                      {e.notes && <p className="text-xs text-gray-400 truncate">{e.notes}</p>}
                    </td>
                    <td className="px-4 py-2.5 text-gray-600">{e.paid_to || '—'}</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-gray-900 whitespace-nowrap">{fmtMoney(e.amount)}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <button onClick={() => openEdit(e)} className="text-xs text-indigo-600 hover:text-indigo-800">Edit</button>
                        <button onClick={() => setDelId(e.id)} className="text-xs text-red-500 hover:text-red-700">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              {expenses.length > 0 && (
                <tfoot>
                  <tr className="bg-gray-50 border-t border-gray-200">
                    <td colSpan={5} className="px-4 py-2.5 text-sm font-semibold text-gray-700">Total</td>
                    <td className="px-4 py-2.5 text-right font-bold text-gray-900">{fmtMoney(grandTotal)}</td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/* ANALYTICS VIEW */}
      {view === 'analytics' && (
        <div className="space-y-4">
          {!analytics ? (
            <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-400 text-sm">Loading analytics…</div>
          ) : (
            <>
              {/* By-category breakdown */}
              <div className="bg-white rounded-lg border border-gray-200 p-5">
                <h2 className="text-sm font-semibold text-gray-800 mb-4">Spending by Category</h2>
                {analytics.by_category.length === 0
                  ? <p className="text-sm text-gray-400">No data</p>
                  : (
                    <div className="space-y-3">
                      {analytics.by_category.map(row => {
                        const pct = analytics.grand_total > 0
                          ? Math.round((Number(row.total) / analytics.grand_total) * 100)
                          : 0;
                        return (
                          <div key={row.category}>
                            <div className="flex justify-between text-xs text-gray-600 mb-0.5">
                              <span className="font-medium">{row.category}</span>
                              <span className="text-gray-500">{fmtMoney(row.total)} <span className="text-gray-400">({pct}%)</span></span>
                            </div>
                            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                            </div>
                            <p className="text-xs text-gray-400 mt-0.5">{row.count} {Number(row.count) === 1 ? 'entry' : 'entries'}</p>
                          </div>
                        );
                      })}
                      <div className="pt-2 border-t border-gray-100 flex justify-between text-sm font-semibold">
                        <span>Grand Total</span>
                        <span>{fmtMoney(analytics.grand_total)}</span>
                      </div>
                    </div>
                  )
                }
              </div>

              {/* Monthly breakdown */}
              <div className="bg-white rounded-lg border border-gray-200 p-5">
                <h2 className="text-sm font-semibold text-gray-800 mb-4">Monthly Breakdown (last 12 months)</h2>
                {analytics.by_month.length === 0
                  ? <p className="text-sm text-gray-400">No data</p>
                  : (() => {
                    const maxVal = Math.max(...analytics.by_month.map(r => Number(r.total)));
                    return (
                      <div className="space-y-2">
                        {analytics.by_month.map(row => {
                          const pct = maxVal > 0 ? Math.round((Number(row.total) / maxVal) * 100) : 0;
                          const [y, m] = row.month.split('-');
                          const label = new Date(Number(y), Number(m) - 1).toLocaleDateString('en-GH', { month: 'short', year: 'numeric' });
                          return (
                            <div key={row.month} className="flex items-center gap-3">
                              <span className="text-xs text-gray-500 w-24 shrink-0">{label}</span>
                              <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden">
                                <div className="h-full bg-emerald-400 rounded-full transition-all flex items-center justify-end pr-2"
                                  style={{ width: `${Math.max(pct, 2)}%` }}>
                                </div>
                              </div>
                              <span className="text-xs font-medium text-gray-700 w-32 text-right shrink-0">{fmtMoney(row.total)}</span>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()
                }
              </div>
            </>
          )}
        </div>
      )}

      {/* SUMMARY VIEW */}
      {view === 'summary' && <SummaryView usedCategories={usedCategories} />}

      {/* Add/Edit Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-lg shadow-xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="text-base font-semibold">{editRow ? 'Edit Expense' : 'Record Expense'}</h2>
              <button onClick={() => setModal(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Receipt Number <span className="text-red-500">*</span></label>
                  <input value={form.receipt_number}
                    onChange={e => setForm(f => ({ ...f, receipt_number: e.target.value }))}
                    placeholder="e.g. RV-0042"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Date <span className="text-red-500">*</span></label>
                  <input type="date" value={form.expense_date}
                    onChange={e => setForm(f => ({ ...f, expense_date: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Category <span className="text-red-500">*</span></label>
                <input list="expense-cats" value={form.category}
                  onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  placeholder="Select or type a category"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                <datalist id="expense-cats">
                  {allCategories.map(c => <option key={c} value={c} />)}
                </datalist>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Description <span className="text-red-500">*</span></label>
                <input value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="What was purchased / paid for?"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Amount (GH₵) <span className="text-red-500">*</span></label>
                  <input type="number" min="0.01" step="0.01" value={form.amount}
                    onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                    placeholder="0.00"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Paid To</label>
                  <input value={form.paid_to}
                    onChange={e => setForm(f => ({ ...f, paid_to: e.target.value }))}
                    placeholder="Supplier / vendor name"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
                <textarea value={form.notes} rows={2}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Any additional notes…"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none" />
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100">
              <button onClick={() => setModal(false)}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={save} disabled={saving}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                {saving ? 'Saving…' : (editRow ? 'Save Changes' : 'Record Expense')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {delId && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-sm shadow-xl p-6 space-y-4">
            <h2 className="text-base font-semibold text-gray-900">Delete Expense?</h2>
            <p className="text-sm text-gray-600">This action cannot be undone.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDelId(null)}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={confirmDelete}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
