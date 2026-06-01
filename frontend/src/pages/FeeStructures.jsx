import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../api';

function fmtMoney(n) {
  return 'GH₵' + Number(n || 0).toLocaleString('en-GH', { minimumFractionDigits: 2 });
}
function fmtDate(d) {
  if (!d) return null;
  return new Date(d).toLocaleDateString('en-GH', { day: 'numeric', month: 'short', year: 'numeric' });
}

const STATUS_STYLE = {
  active:   { bg: '#dcfce7', color: '#166534', label: 'Active'    },
  upcoming: { bg: '#eff6ff', color: '#1e40af', label: 'Upcoming'  },
  ended:    { bg: '#f3f4f6', color: '#6b7280', label: 'Ended'     },
  inactive: { bg: '#fef9ec', color: '#92400e', label: 'Inactive'  },
  draft:    { bg: '#fdf4ff', color: '#6b21a8', label: 'Draft'     },
};

function StatusChip({ status }) {
  const s = STATUS_STYLE[status] || STATUS_STYLE.draft;
  return (
    <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
      style={{ background: s.bg, color: s.color }}>
      {s.label}
    </span>
  );
}

export default function FeeStructures() {
  const [structures, setStructures] = useState([]);
  const [feeItems, setFeeItems]     = useState([]);
  const [classes, setClasses]       = useState([]);
  const [terms, setTerms]           = useState([]);

  // expanded: which structure id is open for line-item editing
  const [expanded, setExpanded]     = useState(null);
  const [detail, setDetail]         = useState(null);

  // structure form (add/edit)
  const [modal, setModal]           = useState(false);
  const [editId, setEditId]         = useState(null);
  const [form, setForm]             = useState({ name: '', class_id: '', term_id: '', fee_due_date: '' });
  const [formErr, setFormErr]       = useState('');
  const [formSaving, setFormSaving] = useState(false);

  // line-item form
  const [lineForm, setLineForm]     = useState({ fee_item_id: '', amount: '' });
  const [lineErr, setLineErr]       = useState('');
  const [lineSaving, setLineSaving] = useState(false);

  // global fee item creation
  const [itemModal, setItemModal]   = useState(false);
  const [itemName, setItemName]     = useState('');
  const [itemSaving, setItemSaving] = useState(false);

  // clone
  const [cloneModal, setCloneModal]       = useState(null); // { to_term_id, to_term_name }
  const [cloneFromId, setCloneFromId]     = useState('');
  const [cloning, setCloning]             = useState(false);
  const [cloneErr, setCloneErr]           = useState('');

  const [flash, setFlash] = useState('');
  const showFlash = (m) => { setFlash(m); setTimeout(() => setFlash(''), 3000); };

  const load = useCallback(async () => {
    try {
      const [s, fi, c, t] = await Promise.all([
        api.get('/fee-structures'),
        api.get('/fee-structures/items'),
        api.get('/classes'),
        api.get('/terms'),
      ]);
      setStructures(Array.isArray(s) ? s : []);
      setFeeItems(Array.isArray(fi) ? fi : []);
      setClasses(Array.isArray(c) ? c : []);
      setTerms(Array.isArray(t) ? t : []);
    } catch {}
  }, []);

  useEffect(() => { load(); }, [load]);

  async function loadDetail(id) {
    try { setDetail(await api.get(`/fee-structures/${id}`)); }
    catch {}
  }

  function openExpand(id) {
    if (expanded === id) { setExpanded(null); setDetail(null); return; }
    setExpanded(id);
    loadDetail(id);
  }

  // ── Structure CRUD ──────────────────────────────────────────────────────────
  function openAdd(prefill = {}) {
    setEditId(null);
    setForm({ name: '', class_id: '', term_id: '', fee_due_date: '', ...prefill });
    setFormErr('');
    setModal(true);
  }
  function openEdit(s) {
    setEditId(s.id);
    setForm({
      name:         s.name,
      class_id:     s.class_id  || '',
      term_id:      s.term_id   || '',
      fee_due_date: s.fee_due_date ? s.fee_due_date.slice(0, 10) : '',
    });
    setFormErr('');
    setModal(true);
  }
  async function saveStruct() {
    if (!form.name.trim()) { setFormErr('Name is required'); return; }
    setFormSaving(true); setFormErr('');
    const body = {
      name:         form.name.trim(),
      class_id:     form.class_id  || undefined,
      term_id:      form.term_id   || undefined,
      fee_due_date: form.fee_due_date || undefined,
    };
    try {
      if (editId) await api.put(`/fee-structures/${editId}`, body);
      else        await api.post('/fee-structures', body);
      setModal(false);
      load();
      showFlash(editId ? 'Structure updated' : 'Structure created');
    } catch (e) { setFormErr(e.message); }
    finally { setFormSaving(false); }
  }
  async function delStruct(id) {
    if (!confirm('Delete this fee structure?')) return;
    try { await api.delete(`/fee-structures/${id}`); load(); if (expanded === id) { setExpanded(null); setDetail(null); } showFlash('Deleted'); }
    catch (e) { alert(e.message); }
  }

  // ── Line items ──────────────────────────────────────────────────────────────
  async function addLineItem(e) {
    e.preventDefault(); setLineSaving(true); setLineErr('');
    try {
      await api.post(`/fee-structures/${expanded}/items`,
        { fee_item_id: lineForm.fee_item_id, amount: Number(lineForm.amount) });
      setLineForm({ fee_item_id: '', amount: '' });
      loadDetail(expanded); load();
    } catch (e) { setLineErr(e.message); }
    finally { setLineSaving(false); }
  }
  async function removeLineItem(feeItemId) {
    try { await api.delete(`/fee-structures/${expanded}/items/${feeItemId}`); loadDetail(expanded); load(); }
    catch (e) { alert(e.message); }
  }

  // ── Global fee item ─────────────────────────────────────────────────────────
  async function saveItem() {
    if (!itemName.trim()) return;
    setItemSaving(true);
    try { await api.post('/fee-structures/items', { name: itemName }); setItemName(''); setItemModal(false); load(); showFlash('Fee item added'); }
    catch (e) { alert(e.message); }
    finally { setItemSaving(false); }
  }

  // ── Clone ───────────────────────────────────────────────────────────────────
  function openClone(term) {
    setCloneModal(term);
    setCloneFromId('');
    setCloneErr('');
  }
  async function doClone() {
    if (!cloneFromId) { setCloneErr('Select a source term'); return; }
    setCloning(true); setCloneErr('');
    try {
      const r = await api.post('/fee-structures/clone', {
        from_term_id: cloneFromId,
        to_term_id:   cloneModal.id,
      });
      setCloneModal(null);
      load();
      showFlash(`${r.cloned} structure${r.cloned === 1 ? '' : 's'} cloned into ${cloneModal.name}`);
    } catch (e) { setCloneErr(e.message); }
    finally { setCloning(false); }
  }

  // ── Data grouping ───────────────────────────────────────────────────────────
  const structuresByTerm = {};
  for (const s of structures) {
    const key = s.term_id || '__none__';
    if (!structuresByTerm[key]) structuresByTerm[key] = [];
    structuresByTerm[key].push(s);
  }

  // Group terms by academic year, most recent first
  const yearGroups = {};
  for (const t of terms) {
    const yr = t.academic_year || 'No Year';
    if (!yearGroups[yr]) yearGroups[yr] = [];
    yearGroups[yr].push(t);
  }
  const sortedYears = Object.keys(yearGroups).sort((a, b) => b.localeCompare(a));

  // Coverage check: for each term, which class_ids have no structure?
  const classesWithStudents = classes; // all classes shown
  function missingClasses(termId) {
    const covered = new Set((structuresByTerm[termId] || []).map(s => s.class_id).filter(Boolean));
    return classesWithStudents.filter(c => !covered.has(c.id));
  }

  // Terms with structures (for clone source picker)
  const termsWithStructures = terms.filter(t => (structuresByTerm[t.id] || []).length > 0);

  return (
    <div className="max-w-5xl mx-auto space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Fee Structures</h1>
          <p className="text-sm text-gray-500">Manage fees per class and term</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setItemModal(true)}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50">
            + Fee Item
          </button>
          <button onClick={() => openAdd()}
            className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
            + Add Structure
          </button>
        </div>
      </div>

      {flash && <div className="p-3 bg-green-50 border border-green-200 text-green-800 text-sm rounded-lg">{flash}</div>}

      {/* Unassigned structures (no term) */}
      {(structuresByTerm['__none__'] || []).length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-3">
            Structures with no term assigned
          </p>
          {(structuresByTerm['__none__']).map(s => (
            <StructureRow key={s.id} s={s} expanded={expanded} detail={detail}
              onToggle={() => openExpand(s.id)} onEdit={() => openEdit(s)} onDelete={() => delStruct(s.id)}
              feeItems={feeItems} lineForm={lineForm} setLineForm={setLineForm}
              lineErr={lineErr} lineSaving={lineSaving}
              onAddLine={addLineItem} onRemoveLine={removeLineItem} />
          ))}
        </div>
      )}

      {/* Academic year groups */}
      {sortedYears.map(yr => (
        <div key={yr} className="space-y-3">
          <h2 className="text-sm font-bold text-gray-500 uppercase tracking-widest">{yr}</h2>

          {yearGroups[yr].map(term => {
            const termStructures = structuresByTerm[term.id] || [];
            const missing = missingClasses(term.id);
            const isActive = term.status === 'active';

            return (
              <div key={term.id}
                className={`rounded-xl border overflow-hidden ${isActive ? 'border-emerald-300' : 'border-gray-200'}`}>

                {/* Term header */}
                <div className={`px-5 py-3 flex items-center justify-between gap-3 ${isActive ? 'bg-emerald-50' : 'bg-gray-50'}`}>
                  <div className="flex items-center gap-3 min-w-0">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900 text-sm">{term.name}</span>
                        <StatusChip status={term.status} />
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {term.start_date ? `${fmtDate(term.start_date)} — ${fmtDate(term.end_date)}` : 'No dates set'}
                        {' · '}<span className="font-medium">{termStructures.length} structure{termStructures.length !== 1 ? 's' : ''}</span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {/* Coverage warning */}
                    {isActive && missing.length > 0 && (
                      <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-medium"
                        title={`No structure for: ${missing.map(c => c.name).join(', ')}`}>
                        ⚠ {missing.length} class{missing.length !== 1 ? 'es' : ''} uncovered
                      </span>
                    )}
                    <button onClick={() => openClone(term)}
                      className="text-xs px-2.5 py-1 border border-gray-200 bg-white rounded-lg text-gray-600 hover:bg-gray-50">
                      Clone from…
                    </button>
                    <button onClick={() => openAdd({ term_id: term.id })}
                      className="text-xs px-2.5 py-1 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
                      + Add
                    </button>
                  </div>
                </div>

                {/* Coverage detail (active term with gaps) */}
                {isActive && missing.length > 0 && (
                  <div className="px-5 py-2 bg-amber-50 border-t border-amber-100 text-xs text-amber-700">
                    No fee structure for: <span className="font-semibold">{missing.map(c => c.name).join(', ')}</span>
                  </div>
                )}

                {/* Structures */}
                {termStructures.length === 0 ? (
                  <div className="px-5 py-5 text-center">
                    <p className="text-sm text-gray-400">No fee structures for this term.</p>
                    <div className="flex justify-center gap-2 mt-2">
                      <button onClick={() => openAdd({ term_id: term.id })}
                        className="text-xs px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
                        + Create structure
                      </button>
                      {termsWithStructures.length > 0 && (
                        <button onClick={() => openClone(term)}
                          className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">
                          Clone from previous term
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {termStructures.map(s => (
                      <StructureRow key={s.id} s={s} expanded={expanded} detail={detail}
                        onToggle={() => openExpand(s.id)} onEdit={() => openEdit(s)} onDelete={() => delStruct(s.id)}
                        feeItems={feeItems} lineForm={lineForm} setLineForm={setLineForm}
                        lineErr={lineErr} lineSaving={lineSaving}
                        onAddLine={addLineItem} onRemoveLine={removeLineItem} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}

      {terms.length === 0 && structures.length === 0 && (
        <div className="text-center py-12 text-gray-400 text-sm">
          No terms or fee structures yet. Create terms first, then add fee structures.
        </div>
      )}

      {/* Add/Edit structure modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="text-base font-semibold">{editId ? 'Edit Structure' : 'New Fee Structure'}</h2>
              <button onClick={() => setModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="p-5 space-y-3">
              {formErr && <p className="text-sm text-red-600">{formErr}</p>}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Name *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Class 3 Term 1 Fees"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Term</label>
                  <select value={form.term_id} onChange={e => setForm(f => ({ ...f, term_id: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400">
                    <option value="">— Any —</option>
                    {terms.map(t => (
                      <option key={t.id} value={t.id}>
                        {t.name}{t.status === 'active' ? ' (current)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Class</label>
                  <select value={form.class_id} onChange={e => setForm(f => ({ ...f, class_id: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400">
                    <option value="">— Any —</option>
                    {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Fee Due Date</label>
                <input type="date" value={form.fee_due_date}
                  onChange={e => setForm(f => ({ ...f, fee_due_date: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                <p className="text-xs text-gray-400 mt-0.5">When fees must be fully paid by</p>
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100">
              <button onClick={() => setModal(false)}
                className="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">Cancel</button>
              <button onClick={saveStruct} disabled={formSaving}
                className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                {formSaving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clone modal */}
      {cloneModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-sm shadow-xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="text-base font-semibold">Clone into {cloneModal.name}</h2>
              <button onClick={() => setCloneModal(null)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-sm text-gray-600">
                Copy all fee structures from a previous term into <strong>{cloneModal.name}</strong>. Existing structures with the same name will be skipped.
              </p>
              {cloneErr && <p className="text-sm text-red-600">{cloneErr}</p>}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Copy from term</label>
                <select value={cloneFromId} onChange={e => setCloneFromId(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400">
                  <option value="">— Select source term —</option>
                  {termsWithStructures
                    .filter(t => t.id !== cloneModal.id)
                    .map(t => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({(structuresByTerm[t.id] || []).length} structures)
                      </option>
                    ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100">
              <button onClick={() => setCloneModal(null)}
                className="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">Cancel</button>
              <button onClick={doClone} disabled={cloning}
                className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                {cloning ? 'Cloning…' : 'Clone Structures'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fee item modal */}
      {itemModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-xs shadow-xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="text-base font-semibold">New Fee Item</h2>
              <button onClick={() => setItemModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="p-5">
              <label className="block text-xs font-medium text-gray-600 mb-1">Item Name</label>
              <input value={itemName} onChange={e => setItemName(e.target.value)}
                placeholder="e.g. Tuition Fee"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                onKeyDown={e => e.key === 'Enter' && saveItem()} />
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100">
              <button onClick={() => setItemModal(false)}
                className="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">Cancel</button>
              <button onClick={saveItem} disabled={itemSaving}
                className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                {itemSaving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── StructureRow sub-component ────────────────────────────────────────────────
function StructureRow({ s, expanded, detail, onToggle, onEdit, onDelete,
  feeItems, lineForm, setLineForm, lineErr, lineSaving, onAddLine, onRemoveLine }) {

  const isOpen = expanded === s.id;

  return (
    <div className="bg-white">
      {/* Row header */}
      <div className="flex items-center justify-between px-5 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={onToggle}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm text-gray-900">{s.name}</span>
            {s.class_name && (
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{s.class_name}</span>
            )}
            {s.fee_due_date && (
              <span className="text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                Due {fmtDate(s.fee_due_date)}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="font-bold text-emerald-700 text-sm">{fmtMoney(s.total_amount)}</span>
          <button onClick={e => { e.stopPropagation(); onEdit(); }}
            className="text-xs text-indigo-600 hover:text-indigo-800 px-2 py-0.5">Edit</button>
          <button onClick={e => { e.stopPropagation(); onDelete(); }}
            className="text-xs text-red-500 hover:text-red-700 px-2 py-0.5">Delete</button>
          <span className="text-gray-400 text-sm">{isOpen ? '▲' : '▼'}</span>
        </div>
      </div>

      {/* Expanded line items */}
      {isOpen && (
        <div className="border-t border-gray-100 bg-gray-50 px-5 py-4">
          {!detail ? (
            <p className="text-xs text-gray-400">Loading…</p>
          ) : (
            <>
              <table className="w-full text-sm mb-4">
                <thead>
                  <tr className="text-xs text-gray-500 border-b border-gray-200">
                    <th className="text-left py-1">Fee Item</th>
                    <th className="text-right py-1">Amount</th>
                    <th className="py-1 w-16"></th>
                  </tr>
                </thead>
                <tbody>
                  {(detail.items || []).length === 0 && (
                    <tr><td colSpan={3} className="py-3 text-center text-xs text-gray-400">No line items yet</td></tr>
                  )}
                  {(detail.items || []).map(li => (
                    <tr key={li.id} className="border-b border-gray-100">
                      <td className="py-1.5 text-gray-700">{li.item_name}</td>
                      <td className="py-1.5 text-right font-medium">{fmtMoney(li.amount)}</td>
                      <td className="py-1.5 text-right">
                        <button onClick={() => onRemoveLine(li.fee_item_id)}
                          className="text-xs text-red-500 hover:text-red-700">Remove</button>
                      </td>
                    </tr>
                  ))}
                  {(detail.items || []).length > 0 && (
                    <tr className="font-semibold text-sm">
                      <td className="pt-2">Total</td>
                      <td className="pt-2 text-right text-emerald-700">{fmtMoney(detail.total_amount)}</td>
                      <td />
                    </tr>
                  )}
                </tbody>
              </table>

              {/* Add line item */}
              {lineErr && <p className="text-xs text-red-600 mb-2">{lineErr}</p>}
              <form onSubmit={onAddLine} className="flex gap-2 flex-wrap items-end">
                <div>
                  <label className="block text-xs text-gray-500 mb-0.5">Fee Item</label>
                  <select value={lineForm.fee_item_id}
                    onChange={e => setLineForm(f => ({ ...f, fee_item_id: e.target.value }))} required
                    className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400">
                    <option value="">— Select —</option>
                    {feeItems.map(fi => <option key={fi.id} value={fi.id}>{fi.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-0.5">Amount (GH₵)</label>
                  <input type="number" step="0.01" min="0" value={lineForm.amount}
                    onChange={e => setLineForm(f => ({ ...f, amount: e.target.value }))} required
                    className="w-28 border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                </div>
                <button type="submit" disabled={lineSaving}
                  className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                  {lineSaving ? 'Adding…' : 'Add Line'}
                </button>
              </form>
            </>
          )}
        </div>
      )}
    </div>
  );
}
