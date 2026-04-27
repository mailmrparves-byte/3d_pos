import React, { useState, useEffect } from 'react';
import { api, fmtCurrency, fmtDate, statusBadge, statusLabel } from '../utils/api';
import { Plus, Edit2, Trash2, Search, Eye, X, Save, FileText } from 'lucide-react';
import toast from 'react-hot-toast';

const PO_STATUSES = ['proforma_received', 'paid', 'shipped', 'received'];
const emptySupplier = { name: '', country: '', contact_name: '', phone: '', email: '', address: '', products_supplied: '', notes: '' };

function SupplierForm({ supplier, onSave, onClose }) {
  const [form, setForm] = useState(supplier || emptySupplier);
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const handleSubmit = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      if (supplier?.id) await api.put(`/suppliers/${supplier.id}`, form);
      else await api.post('/suppliers', form);
      toast.success('Saved'); onSave();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };
  return (
    <div className="modal-overlay">
      <div className="modal-content p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-white">{supplier?.id ? 'Edit Supplier' : 'Add Supplier'}</h2>
          <button onClick={onClose} className="btn-ghost btn-icon btn-sm"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-3">
          <div><label className="label">Company Name *</label><input className="input-field" value={form.name} onChange={e => set('name', e.target.value)} required /></div>
          <div><label className="label">Country</label><input className="input-field" value={form.country} onChange={e => set('country', e.target.value)} /></div>
          <div><label className="label">Contact Person</label><input className="input-field" value={form.contact_name} onChange={e => set('contact_name', e.target.value)} /></div>
          <div><label className="label">Phone</label><input className="input-field" value={form.phone} onChange={e => set('phone', e.target.value)} /></div>
          <div><label className="label">Email</label><input type="email" className="input-field" value={form.email} onChange={e => set('email', e.target.value)} /></div>
          <div><label className="label">Products Supplied</label><input className="input-field" value={form.products_supplied} onChange={e => set('products_supplied', e.target.value)} /></div>
          <div className="col-span-2"><label className="label">Notes</label><textarea className="input-field" rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} /></div>
          <div className="col-span-2 flex gap-2 justify-end">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary"><Save className="w-4 h-4" /> Save</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function POForm({ suppliers, products, onSave, onClose }) {
  const [supplierId, setSupplierId] = useState('');
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0]);
  const [expectedArrival, setExpectedArrival] = useState('');
  const [items, setItems] = useState([{ product_id: '', product_name: '', quantity: 1, unit_cost_usd: 0 }]);
  const [exchangeRate, setExchangeRate] = useState(120);
  const [shippingCost, setShippingCost] = useState(0);
  const [customsDutyPct, setCustomsDutyPct] = useState(0);
  const [status, setStatus] = useState('proforma_received');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const totalUsd = items.reduce((s, i) => s + i.quantity * i.unit_cost_usd, 0);
  const landedCost = (totalUsd * exchangeRate) * (1 + customsDutyPct / 100) + parseFloat(shippingCost);

  const handleSubmit = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      await api.post('/suppliers/purchase-orders', { supplier_id: supplierId, order_date: orderDate, expected_arrival: expectedArrival, items, total_usd: totalUsd, exchange_rate: exchangeRate, shipping_cost: shippingCost, customs_duty_pct: customsDutyPct, landed_cost_bdt: landedCost, status, notes });
      toast.success('Purchase order created'); onSave();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content p-6 max-w-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-white">New Purchase Order</h2>
          <button onClick={onClose} className="btn-ghost btn-icon btn-sm"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Supplier *</label>
              <select className="input-field" value={supplierId} onChange={e => setSupplierId(e.target.value)} required>
                <option value="" className="bg-surface-800">Select supplier...</option>
                {suppliers.map(s => <option key={s.id} value={s.id} className="bg-surface-800">{s.name}</option>)}
              </select>
            </div>
            <div><label className="label">Status</label>
              <select className="input-field" value={status} onChange={e => setStatus(e.target.value)}>
                {PO_STATUSES.map(s => <option key={s} className="bg-surface-800 capitalize">{s.replace('_', ' ')}</option>)}
              </select>
            </div>
            <div><label className="label">Order Date</label><input type="date" className="input-field" value={orderDate} onChange={e => setOrderDate(e.target.value)} /></div>
            <div><label className="label">Expected Arrival</label><input type="date" className="input-field" value={expectedArrival} onChange={e => setExpectedArrival(e.target.value)} /></div>
          </div>

          <div className="form-section-title mt-4">Order Items (USD)</div>
          {items.map((item, idx) => (
            <div key={idx} className="grid grid-cols-12 gap-2 items-end">
              <div className="col-span-5">
                <input className="input-field" placeholder="Product name" value={item.product_name} onChange={e => { const u=[...items]; u[idx]={...u[idx], product_name: e.target.value}; setItems(u); }} />
              </div>
              <div className="col-span-2"><input type="number" className="input-field" placeholder="Qty" value={item.quantity} onChange={e => { const u=[...items]; u[idx]={...u[idx], quantity: parseInt(e.target.value)||1}; setItems(u); }} /></div>
              <div className="col-span-3"><input type="number" className="input-field" placeholder="Unit $ USD" value={item.unit_cost_usd} onChange={e => { const u=[...items]; u[idx]={...u[idx], unit_cost_usd: parseFloat(e.target.value)||0}; setItems(u); }} /></div>
              <div className="col-span-2 text-xs font-mono text-surface-400">${(item.quantity * item.unit_cost_usd).toFixed(0)}</div>
            </div>
          ))}
          <button type="button" onClick={() => setItems([...items, { product_id: '', product_name: '', quantity: 1, unit_cost_usd: 0 }])} className="btn-secondary btn-sm"><Plus className="w-3.5 h-3.5" /> Add Item</button>

          <div className="grid grid-cols-3 gap-3 mt-3">
            <div><label className="label">Exchange Rate (৳/$)</label><input type="number" className="input-field" value={exchangeRate} onChange={e => setExchangeRate(parseFloat(e.target.value))} /></div>
            <div><label className="label">Shipping Cost (৳)</label><input type="number" className="input-field" value={shippingCost} onChange={e => setShippingCost(parseFloat(e.target.value))} /></div>
            <div><label className="label">Customs Duty %</label><input type="number" className="input-field" value={customsDutyPct} onChange={e => setCustomsDutyPct(parseFloat(e.target.value))} /></div>
          </div>
          <div className="p-3 bg-brand-500/10 border border-brand-500/20 rounded-xl text-sm">
            <div className="flex justify-between"><span className="text-surface-400">Total USD</span><span className="font-mono">${totalUsd.toFixed(2)}</span></div>
            <div className="flex justify-between font-bold text-brand-400 mt-1"><span>Landed Cost (৳)</span><span className="font-mono">{fmtCurrency(landedCost)}</span></div>
          </div>
          <div><label className="label">Notes</label><textarea className="input-field" rows={2} value={notes} onChange={e => setNotes(e.target.value)} /></div>
          <div className="flex gap-2 justify-end"><button type="button" onClick={onClose} className="btn-secondary">Cancel</button><button type="submit" disabled={saving} className="btn-primary"><Save className="w-4 h-4" /> Create PO</button></div>
        </form>
      </div>
    </div>
  );
}

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState([]);
  const [pos, setPOs] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('suppliers');
  const [showForm, setShowForm] = useState(false);
  const [editSupplier, setEditSupplier] = useState(null);
  const [showPOForm, setShowPOForm] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const [s, p, pr] = await Promise.all([api.get('/suppliers'), api.get('/suppliers/purchase-orders/all'), api.get('/products?limit=200')]);
      setSuppliers(s); setPOs(p); setProducts(pr);
    } catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div><h1 className="page-title">Suppliers & Purchase Orders</h1></div>
        <div className="flex gap-2">
          {tab === 'suppliers' ? (
            <button onClick={() => { setEditSupplier(null); setShowForm(true); }} className="btn-primary"><Plus className="w-4 h-4" /> Add Supplier</button>
          ) : (
            <button onClick={() => setShowPOForm(true)} className="btn-primary"><Plus className="w-4 h-4" /> New PO</button>
          )}
        </div>
      </div>

      <div className="flex gap-2 mb-5">
        {['suppliers', 'purchase-orders'].map(t => (
          <button key={t} onClick={() => setTab(t)} className={`btn-sm capitalize ${tab === t ? 'btn-primary' : 'btn-secondary'}`}>{t.replace('-', ' ')}</button>
        ))}
      </div>

      {tab === 'suppliers' ? (
        <div className="table-container">
          <table className="data-table">
            <thead><tr><th>Name</th><th>Country</th><th>Contact</th><th>Products</th><th>Open POs</th><th>Actions</th></tr></thead>
            <tbody>
              {loading ? Array(5).fill(0).map((_, i) => <tr key={i}>{Array(6).fill(0).map((_, j) => <td key={j}><div className="h-4 shimmer rounded" /></td>)}</tr>)
              : suppliers.map(s => (
                <tr key={s.id}>
                  <td className="font-medium text-surface-100">{s.name}</td>
                  <td className="text-surface-400 text-xs">{s.country}</td>
                  <td><div className="text-sm">{s.contact_name}</div><div className="text-xs text-surface-500">{s.phone}</div></td>
                  <td className="text-xs text-surface-400 max-w-40 truncate">{s.products_supplied}</td>
                  <td><span className="badge badge-blue">{s.open_pos || 0}</span></td>
                  <td>
                    <div className="flex gap-1">
                      <button onClick={() => { setEditSupplier(s); setShowForm(true); }} className="btn-ghost btn-icon btn-sm"><Edit2 className="w-3.5 h-3.5" /></button>
                      <button onClick={async () => { if(confirm('Delete?')) { await api.delete(`/suppliers/${s.id}`); toast.success('Deleted'); load(); } }} className="btn-danger btn-icon btn-sm"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && !suppliers.length && <tr><td colSpan={6} className="text-center text-surface-500 py-8">No suppliers</td></tr>}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead><tr><th>PO Number</th><th>Supplier</th><th>Order Date</th><th>Expected</th><th>Total USD</th><th>Landed Cost</th><th>Status</th></tr></thead>
            <tbody>
              {loading ? Array(5).fill(0).map((_, i) => <tr key={i}>{Array(7).fill(0).map((_, j) => <td key={j}><div className="h-4 shimmer rounded" /></td>)}</tr>)
              : pos.map(p => (
                <tr key={p.id}>
                  <td><span className="font-mono text-xs text-brand-400">{p.po_number}</span></td>
                  <td>{p.supplier_name}</td>
                  <td className="text-xs text-surface-400">{fmtDate(p.order_date)}</td>
                  <td className="text-xs text-surface-400">{fmtDate(p.expected_arrival)}</td>
                  <td><span className="font-mono text-sm">${parseFloat(p.total_usd).toFixed(2)}</span></td>
                  <td><span className="font-mono text-sm text-brand-400">{fmtCurrency(p.landed_cost_bdt)}</span></td>
                  <td><span className={statusBadge(p.status)}>{statusLabel(p.status)}</span></td>
                </tr>
              ))}
              {!loading && !pos.length && <tr><td colSpan={7} className="text-center text-surface-500 py-8">No purchase orders</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {showForm && <SupplierForm supplier={editSupplier} onSave={() => { setShowForm(false); load(); }} onClose={() => setShowForm(false)} />}
      {showPOForm && <POForm suppliers={suppliers} products={products} onSave={() => { setShowPOForm(false); load(); }} onClose={() => setShowPOForm(false)} />}
    </div>
  );
}
