import React, { useState, useEffect } from 'react';
import { api, fmtCurrency, fmtDate, statusBadge } from '../utils/api';
import { Plus, Edit2, Trash2, Search, Eye, X, Save } from 'lucide-react';
import SaleDetail from '../components/SaleDetail';
import toast from 'react-hot-toast';

const emptyCustomer = { name: '', phone: '', email: '', address: '', billing_address: '', company: '', type: 'walk-in', credit_limit: 0, payment_terms: 'Net 15', notes: '' };

function CustomerForm({ customer, onSave, onClose }) {
  const [form, setForm] = useState(customer || emptyCustomer);
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      if (customer?.id) await api.put(`/customers/${customer.id}`, form);
      else await api.post('/customers', form);
      toast.success(customer?.id ? 'Customer updated' : 'Customer added');
      onSave();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-white">{customer?.id ? 'Edit Customer' : 'Add Customer'}</h2>
          <button onClick={onClose} className="btn-ghost btn-icon btn-sm"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-3">
          <div><label className="label">Full Name *</label><input className="input-field" value={form.name} onChange={e => set('name', e.target.value)} required /></div>
          <div><label className="label">Phone</label><input className="input-field" value={form.phone} onChange={e => set('phone', e.target.value)} /></div>
          <div><label className="label">Email</label><input type="email" className="input-field" value={form.email} onChange={e => set('email', e.target.value)} /></div>
          <div><label className="label">Company</label><input className="input-field" value={form.company} onChange={e => set('company', e.target.value)} /></div>
          <div className="col-span-2"><label className="label">Company / Living Address</label><input className="input-field" value={form.address} onChange={e => set('address', e.target.value)} placeholder="Physical location for information only" /></div>
          <div className="col-span-2"><label className="label">Billing Address (For Invoice)</label><input className="input-field" value={form.billing_address || ''} onChange={e => set('billing_address', e.target.value)} placeholder="Will be printed on invoices" /></div>
          <div>
            <label className="label">Type</label>
            <select className="input-field" value={form.type} onChange={e => set('type', e.target.value)}>
              {['walk-in','corporate','returning'].map(t => <option key={t} className="bg-surface-800 capitalize">{t}</option>)}
            </select>
          </div>
          {form.type === 'corporate' && (
            <>
              <div><label className="label">Credit Limit (৳)</label><input type="number" className="input-field" value={form.credit_limit} onChange={e => set('credit_limit', e.target.value)} /></div>
              <div>
                <label className="label">Payment Terms</label>
                <select className="input-field" value={form.payment_terms} onChange={e => set('payment_terms', e.target.value)}>
                  {['Net 15','Net 30','Net 45'].map(t => <option key={t} className="bg-surface-800">{t}</option>)}
                </select>
              </div>
            </>
          )}
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

function CustomerDetail({ id, onClose }) {
  const [data, setData] = useState(null);
  const [viewInvoiceId, setViewInvoiceId] = useState(null);
  
  useEffect(() => { api.get(`/customers/${id}`).then(setData).catch(() => toast.error('Load failed')); }, [id]);
  if (!data) return <div className="modal-overlay"><div className="modal-content p-8 text-center"><div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto" /></div></div>;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content p-6 max-w-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-white">{data.name}</h2>
          <button onClick={onClose} className="btn-ghost btn-icon btn-sm"><X className="w-4 h-4" /></button>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
          <div><div className="text-surface-500 text-xs">Phone</div><div>{data.phone || '—'}</div></div>
          <div><div className="text-surface-500 text-xs">Email</div><div>{data.email || '—'}</div></div>
          <div><div className="text-surface-500 text-xs">Type</div><div className="capitalize">{data.type}</div></div>
          <div><div className="text-surface-500 text-xs">Company</div><div>{data.company || '—'}</div></div>
          <div className="col-span-2"><div className="text-surface-500 text-xs">Address</div><div>{data.address || '—'}</div></div>
          <div className="col-span-2"><div className="text-surface-500 text-xs">Billing Address</div><div>{data.billing_address || '—'}</div></div>
          <div><div className="text-surface-500 text-xs">Total Purchases</div><div className="font-mono text-emerald-400">{fmtCurrency(data.total_purchases)}</div></div>
          <div><div className="text-surface-500 text-xs">Outstanding</div><div className="font-mono text-red-400">{fmtCurrency(data.outstanding_balance)}</div></div>
          {data.type === 'corporate' && <div><div className="text-surface-500 text-xs">Credit Limit</div><div className="font-mono">{fmtCurrency(data.credit_limit)}</div></div>}
        </div>
        <div>
          <div className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-2">Purchase History</div>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {(data.sales || []).map(s => (
              <div key={s.id} className="flex justify-between items-center py-1.5 px-3 bg-surface-800/50 rounded-lg text-xs">
                <button onClick={() => setViewInvoiceId(s.id)} className="font-mono text-brand-400 hover:text-brand-300 hover:underline focus:outline-none rounded -ml-1 px-1">{s.invoice_no}</button>
                <span className="text-surface-400">{fmtDate(s.created_at)}</span>
                <span className="font-mono text-white">{fmtCurrency(s.grand_total)}</span>
                <span className={statusBadge(s.status)}>{s.status}</span>
              </div>
            ))}
            {!data.sales?.length && <div className="text-surface-500 text-center py-4">No purchases yet</div>}
          </div>
        </div>
      </div>
      
      {/* Nested Invoice Detail Modal */}
      {viewInvoiceId && <SaleDetail id={viewInvoiceId} onClose={() => setViewInvoiceId(null)} />}
    </div>
  );
}

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editCustomer, setEditCustomer] = useState(null);
  const [viewId, setViewId] = useState(null);
  const [viewInvoiceId, setViewInvoiceId] = useState(null);

  const load = async () => {
    try {
      setLoading(true);
      const data = await api.get(`/customers?limit=300${search ? `&search=${encodeURIComponent(search)}` : ''}`);
      setCustomers(data);
    } catch { toast.error('Failed to load customers'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [search]);

  const deleteCustomer = async (id) => {
    if (!confirm('Delete this customer?')) return;
    try { await api.delete(`/customers/${id}`); toast.success('Deleted'); load(); }
    catch (err) { toast.error(err.message); }
  };

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div><h1 className="page-title">Customers</h1><p className="page-subtitle">{customers.length} customers</p></div>
        <button onClick={() => { setEditCustomer(null); setShowForm(true); }} className="btn-primary"><Plus className="w-4 h-4" /> Add Customer</button>
      </div>

      <div className="neo-card p-4 mb-5">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" />
          <input className="input-field !pl-9 max-w-md" placeholder="Search by name, phone, email..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr><th>Name</th><th>Phone</th><th>Type</th><th>Company</th><th>Total Purchases</th><th>Outstanding</th><th>Last Purchase</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {loading ? Array(6).fill(0).map((_, i) => (
              <tr key={i}>{Array(8).fill(0).map((_, j) => <td key={j}><div className="h-4 shimmer rounded" /></td>)}</tr>
            )) : customers.map(c => (
              <tr key={c.id}>
                <td className="font-medium text-surface-100">{c.name}</td>
                <td className="font-mono text-xs">{c.phone || '—'}</td>
                <td><span className={`badge ${c.type === 'corporate' ? 'badge-blue' : c.type === 'returning' ? 'badge-green' : 'badge-gray'} capitalize`}>{c.type}</span></td>
                <td className="text-surface-400 text-xs">{c.company || '—'}</td>
                <td><span className="font-mono text-sm text-emerald-400">{fmtCurrency(c.total_purchases)}</span></td>
                <td><span className={`font-mono text-sm ${c.outstanding_balance > 0 ? 'text-red-400' : 'text-surface-500'}`}>{fmtCurrency(c.outstanding_balance)}</span></td>
                <td>
                  {c.last_invoice_no ? (
                    <div className="flex flex-col">
                      <button onClick={() => setViewInvoiceId(c.last_sale_id)} className="text-left font-mono text-xs text-brand-400 hover:text-brand-300 hover:underline focus:outline-none">{c.last_invoice_no}</button>
                      <span className="text-[10px] text-surface-500">{fmtDate(c.last_purchase_date)}</span>
                    </div>
                  ) : (
                    <span className="text-xs text-surface-500">—</span>
                  )}
                </td>
                <td>
                  <div className="flex gap-1">
                    <button onClick={() => setViewId(c.id)} className="btn-ghost btn-icon btn-sm"><Eye className="w-3.5 h-3.5" /></button>
                    <button onClick={() => { setEditCustomer(c); setShowForm(true); }} className="btn-ghost btn-icon btn-sm"><Edit2 className="w-3.5 h-3.5" /></button>
                    <button onClick={() => deleteCustomer(c.id)} className="btn-danger btn-icon btn-sm"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </td>
              </tr>
            ))}
            {!loading && !customers.length && <tr><td colSpan={8} className="text-center text-surface-500 py-12">No customers found</td></tr>}
          </tbody>
        </table>
      </div>

      {showForm && <CustomerForm customer={editCustomer} onSave={() => { setShowForm(false); load(); }} onClose={() => setShowForm(false)} />}
      {viewId && <CustomerDetail id={viewId} onClose={() => setViewId(null)} />}
      {viewInvoiceId && <SaleDetail id={viewInvoiceId} onClose={() => setViewInvoiceId(null)} />}
    </div>
  );
}
