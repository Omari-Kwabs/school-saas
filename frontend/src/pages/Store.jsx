import React, { useEffect, useState } from 'react';
import { api } from '../api';

const emptyItem = { name: '', unit: '', low_stock_threshold: 5 };
const emptyTx = { item_id: '', quantity: '', type: 'restock', notes: '' };

export default function Store() {
  const [items, setItems]         = useState([]);
  const [transactions, setTx]     = useState([]);
  const [lowStock, setLowStock]   = useState([]);
  const [loading, setLoading]     = useState(true);

  const [itemForm, setItemForm]   = useState(emptyItem);
  const [editItemId, setEditItemId] = useState(null);
  const [showItemForm, setShowItemForm] = useState(false);

  const [txForm, setTxForm]       = useState(emptyTx);
  const [txError, setTxError]     = useState('');
  const [txSaving, setTxSaving]   = useState(false);

  async function load() {
    try {
      const [i, t, ls] = await Promise.all([
        api.get('/store/items'),
        api.get('/store/transactions'),
        api.get('/store/low-stock'),
      ]);
      setItems(Array.isArray(i) ? i : []);
      setTx(Array.isArray(t) ? t : []);
      setLowStock(Array.isArray(ls) ? ls : []);
    } catch {}
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function handleItem(e) { setItemForm(f => ({ ...f, [e.target.name]: e.target.value })); }
  function handleTx(e)   { setTxForm(f => ({ ...f, [e.target.name]: e.target.value })); }

  function openAdd() { setItemForm(emptyItem); setEditItemId(null); setShowItemForm(true); }
  function openEdit(item) {
    setItemForm({ name: item.name, unit: item.unit || '', low_stock_threshold: item.low_stock_threshold });
    setEditItemId(item.id);
    setShowItemForm(true);
  }

  async function saveItem(e) {
    e.preventDefault();
    try {
      if (editItemId) {
        await api.put(`/store/items/${editItemId}`, itemForm);
      } else {
        await api.post('/store/items', { ...itemForm, quantity: 0 });
      }
      setShowItemForm(false);
      load();
    } catch {}
  }

  async function saveTx(e) {
    e.preventDefault();
    setTxError('');
    setTxSaving(true);
    try {
      await api.post('/store/transactions', {
        item_id: txForm.item_id,
        quantity: Number(txForm.quantity),
        type: txForm.type,
        notes: txForm.notes || undefined,
      });
      setTxForm(emptyTx);
      load();
    } catch (err) {
      setTxError(err.message || 'Transaction failed');
    } finally {
      setTxSaving(false);
    }
  }

  if (loading) return <div className="page" style={{ color: '#888', paddingTop: 60, textAlign: 'center' }}>Loading…</div>;

  return (
    <div className="page">
      <div className="page-title">Store Management</div>

      {/* Low stock alerts */}
      {lowStock.length > 0 && (
        <div style={{ background: '#fff3cd', border: '1px solid #ffc107', borderRadius: 8, padding: '10px 16px', marginBottom: 20 }}>
          <strong>Low Stock:</strong>{' '}
          {lowStock.map(i => (
            <span key={i.id} style={{ marginRight: 12 }}>
              {i.name} — <strong>{i.quantity}</strong> {i.unit || 'units'}
            </span>
          ))}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>

        {/* Items panel */}
        <div style={{ background: '#fff', borderRadius: 8, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <strong>Inventory Items</strong>
            <button className="btn btn-primary btn-sm" onClick={openAdd}>+ Add Item</button>
          </div>

          {showItemForm && (
            <form onSubmit={saveItem} style={{ background: '#f8f9fa', borderRadius: 6, padding: 14, marginBottom: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                <div className="form-group">
                  <label>Name *</label>
                  <input name="name" value={itemForm.name} onChange={handleItem} required />
                </div>
                <div className="form-group">
                  <label>Unit</label>
                  <input name="unit" value={itemForm.unit} onChange={handleItem} placeholder="e.g. pcs, kg" />
                </div>
                <div className="form-group">
                  <label>Low Stock Threshold</label>
                  <input name="low_stock_threshold" type="number" min="0" value={itemForm.low_stock_threshold} onChange={handleItem} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-primary btn-sm" type="submit">Save</button>
                <button className="btn btn-sm btn-secondary" type="button" onClick={() => setShowItemForm(false)}>Cancel</button>
              </div>
            </form>
          )}

          <table>
            <thead>
              <tr><th>Name</th><th>Qty</th><th>Unit</th><th>Min</th><th></th></tr>
            </thead>
            <tbody>
              {items.map(i => (
                <tr key={i.id} style={{ background: i.quantity <= i.low_stock_threshold ? '#fff8e1' : undefined }}>
                  <td>{i.name}</td>
                  <td><strong style={{ color: i.quantity <= i.low_stock_threshold ? '#e67e22' : 'inherit' }}>{i.quantity}</strong></td>
                  <td>{i.unit || '—'}</td>
                  <td>{i.low_stock_threshold}</td>
                  <td><button className="btn btn-sm btn-secondary" onClick={() => openEdit(i)}>Edit</button></td>
                </tr>
              ))}
              {items.length === 0 && <tr><td colSpan={5} style={{ color: '#999', textAlign: 'center' }}>No items yet</td></tr>}
            </tbody>
          </table>
        </div>

        {/* Transaction form */}
        <div style={{ background: '#fff', borderRadius: 8, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <strong style={{ display: 'block', marginBottom: 14 }}>Record Transaction</strong>
          {txError && <div className="alert alert-error" style={{ marginBottom: 10 }}>{txError}</div>}
          <form onSubmit={saveTx}>
            <div className="form-group">
              <label>Item *</label>
              <select name="item_id" value={txForm.item_id} onChange={handleTx} required>
                <option value="">Select item…</option>
                {items.map(i => <option key={i.id} value={i.id}>{i.name} (stock: {i.quantity})</option>)}
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div className="form-group">
                <label>Type *</label>
                <select name="type" value={txForm.type} onChange={handleTx}>
                  <option value="restock">Restock (add)</option>
                  <option value="issue">Issue (remove)</option>
                </select>
              </div>
              <div className="form-group">
                <label>Quantity *</label>
                <input name="quantity" type="number" min="1" value={txForm.quantity} onChange={handleTx} required />
              </div>
            </div>
            <div className="form-group">
              <label>Notes</label>
              <input name="notes" value={txForm.notes} onChange={handleTx} placeholder="Optional" />
            </div>
            <button className="btn btn-primary" type="submit" disabled={txSaving}>
              {txSaving ? 'Saving…' : 'Submit'}
            </button>
          </form>
        </div>
      </div>

      {/* Transaction log */}
      <div style={{ background: '#fff', borderRadius: 8, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginTop: 24 }}>
        <strong style={{ display: 'block', marginBottom: 14 }}>Transaction Log</strong>
        <table>
          <thead>
            <tr><th>Date</th><th>Item</th><th>Type</th><th>Qty</th><th>Recorded By</th><th>Notes</th></tr>
          </thead>
          <tbody>
            {transactions.map(t => (
              <tr key={t.id}>
                <td>{new Date(t.created_at).toLocaleDateString()}</td>
                <td>{t.item_name}</td>
                <td>
                  <span style={{
                    color: t.type === 'restock' ? '#27ae60' : '#e74c3c',
                    fontWeight: 500,
                    textTransform: 'capitalize'
                  }}>{t.type}</span>
                </td>
                <td>{t.type === 'restock' ? '+' : '-'}{t.quantity}</td>
                <td>{t.recorded_by_name}</td>
                <td style={{ color: '#888' }}>{t.notes || '—'}</td>
              </tr>
            ))}
            {transactions.length === 0 && (
              <tr><td colSpan={6} style={{ color: '#999', textAlign: 'center' }}>No transactions yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
