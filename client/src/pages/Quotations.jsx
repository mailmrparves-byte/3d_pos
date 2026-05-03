import React, { useState, useEffect } from 'react';
import { api, fmtCurrency, fmtDate, statusBadge, statusLabel } from '../utils/api';
import { Plus, Trash2, X, Save, FileText, Printer, ArrowRight, Clock, CheckCircle, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import { printHtmlInvoice } from '../utils/printInvoice';

function QuotationModal({ initialData, products, onSave, onClose }) {
  const isEdit = !!initialData;
  const [form, setForm] = useState({
    customer_name: initialData?.customer_name || '',
    customer_phone: initialData?.customer_phone || '',
    customer_address: initialData?.customer_address || '',
    customer_type: initialData?.customer_type || 'walk-in',
    items: initialData?.items || [],
    notes: initialData?.notes || '',
    status: initialData?.status || 'draft',
    discount: initialData?.discount || 0,
    delivery_charge: initialData?.delivery_charge || 0
  });
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerResults, setCustomerResults] = useState([]);
  const [activeSearchField, setActiveSearchField] = useState(null); 
  const [customers, setCustomers] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/customers?limit=1000').then(setCustomers).catch(() => console.error('Failed to load customers'));
  }, []);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const subtotal = form.items.reduce((sum, i) => sum + parseFloat(i.line_total), 0);
  const grandTotal = subtotal - parseFloat(form.discount || 0) + (parseFloat(form.delivery_charge) || 0);

  const handleSearch = (q) => {
    setSearch(q);
    if (q.length > 1) {
      const filtered = products.filter(p =>
        (p.name && p.name.toLowerCase().includes(q.toLowerCase())) ||
        (p.sku && p.sku.toLowerCase().includes(q.toLowerCase())) ||
        (p.brand && p.brand.toLowerCase().includes(q.toLowerCase())) ||
        (p.category && p.category.toLowerCase().includes(q.toLowerCase()))
      ).slice(0, 10);
      setResults(filtered);
    } else {
      setResults([]);
    }
  };

  const handleCustomerSearch = (q, type = 'name') => {
    if (type === 'name') {
      setCustomerSearch(q);
      set('customer_name', q);
    } else {
      set('customer_phone', q);
    }

    if (q.length > 1) {
      const filtered = customers.filter(c =>
        (c.name && c.name.toLowerCase().includes(q.toLowerCase())) ||
        (c.phone && c.phone.includes(q))
      ).slice(0, 5);
      setCustomerResults(filtered);
      setActiveSearchField(type);
    } else {
      setCustomerResults([]);
      setActiveSearchField(null);
    }
  };

  const selectCustomer = (c) => {
    setForm(f => ({
      ...f,
      customer_name: c.name,
      customer_phone: c.phone || '',
      customer_address: c.billing_address || c.address || '',
      customer_type: c.type || 'returning'
    }));
    setCustomerSearch(c.name);
    setCustomerResults([]);
    setActiveSearchField(null);
  };

  const addProduct = (p) => {
    if (form.items.find(x => x.product_id === p.id)) {
      toast.error('Product already added');
      return;
    }
    const newItem = {
      product_id: p.id,
      product_name: p.name,
      quantity: 1,
      unit_price: parseFloat(p.selling_price) || 0,
      discount_pct: 0,
      line_total: parseFloat(p.selling_price) || 0
    };
    set('items', [...form.items, newItem]);
    setSearch('');
    setResults([]);
  };

  const updateItem = (idx, k, v) => {
    const next = [...form.items];
    const item = { ...next[idx], [k]: v };
    const base = (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0);
    item.line_total = base - (base * ((parseFloat(item.discount_pct) || 0) / 100));
    next[idx] = item;
    set('items', next);
  };

  const removeItem = (idx) => {
    const next = [...form.items];
    next.splice(idx, 1);
    set('items', next);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.items.length === 0) return toast.error('Add at least one item');
    
    setSaving(true);
    try {
      const payload = { ...form, subtotal, grand_total: grandTotal };
      if (isEdit) await api.put(`/quotations/${initialData.id}`, payload);
      else await api.post('/quotations', payload);
      toast.success(isEdit ? 'Quotation updated' : 'Quotation created');
      onSave();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content p-6 max-w-3xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-white">{isEdit ? `Edit Quotation: ${initialData.quotation_no}` : 'New Quotation'}</h2>
          <button onClick={onClose} className="btn-ghost btn-icon btn-sm"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="relative">
              <label className="label">Customer Name</label>
              <input className="input-field" value={customerSearch || form.customer_name} onChange={e => handleCustomerSearch(e.target.value, 'name')} placeholder="Search or type name..." required />
              {customerResults.length > 0 && activeSearchField === 'name' && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-surface-800 border border-surface-700 rounded-xl shadow-2xl max-h-48 overflow-y-auto">
                  {customerResults.map(c => (
                    <div key={c.id} className="px-3 py-2 hover:bg-surface-700 cursor-pointer border-b border-surface-700 last:border-0" onClick={() => selectCustomer(c)}>
                      <div className="text-sm font-medium text-white">{c.name}</div>
                      <div className="text-[10px] text-surface-400 font-mono">{c.phone} {c.type ? `· ${c.type}` : ''}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="relative">
              <label className="label">Phone</label>
              <input className="input-field" value={form.customer_phone} onChange={e => handleCustomerSearch(e.target.value, 'phone')} placeholder="Search or type phone..." />
              {customerResults.length > 0 && activeSearchField === 'phone' && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-surface-800 border border-surface-700 rounded-xl shadow-2xl max-h-48 overflow-y-auto">
                  {customerResults.map(c => (
                    <div key={c.id} className="px-3 py-2 hover:bg-surface-700 cursor-pointer border-b border-surface-700 last:border-0" onClick={() => selectCustomer(c)}>
                      <div className="text-sm font-medium text-white">{c.phone}</div>
                      <div className="text-[10px] text-surface-400 font-mono">{c.name} {c.type ? `· ${c.type}` : ''}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="col-span-2"><label className="label">Address</label><input className="input-field" value={form.customer_address} onChange={e => set('customer_address', e.target.value)} /></div>
            
            <div className="col-span-2">
              <label className="label">Search Products</label>
              <div className="relative">
                <input className="input-field" placeholder="Search by name, SKU, brand or category..." value={search} onChange={e => handleSearch(e.target.value)} autoComplete="off" />
                {results.length > 0 && (
                  <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-surface-800 border border-surface-700 rounded-xl shadow-2xl max-h-60 overflow-y-auto">
                    {results.map(p => (
                      <div key={p.id} className="px-3 py-2 hover:bg-surface-700 cursor-pointer flex justify-between items-center border-b border-surface-700 last:border-0" onClick={() => addProduct(p)}>
                        <div className="flex-1 min-w-0 pr-2">
                          <div className="text-sm font-medium text-white truncate">{p.name}</div>
                          <div className="text-[10px] text-surface-400 font-mono flex items-center gap-2">
                            <span>{p.sku}</span>
                            {p.brand && <span>· {p.brand}</span>}
                            {p.category && <span>· {p.category}</span>}
                          </div>
                        </div>
                        <Plus className="w-4 h-4 text-brand-400 flex-shrink-0" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="col-span-2 max-h-60 overflow-y-auto bg-surface-900/30 p-2 rounded-xl border border-surface-800">
              <table className="w-full text-xs">
                <thead><tr className="text-surface-500 uppercase tracking-wider"><th className="text-left pb-2">Item</th><th className="w-16 pb-2">Qty</th><th className="w-24 pb-2">Price</th><th className="w-16 pb-2">Disc%</th><th className="text-right pb-2">Total</th><th className="w-8 pb-2"></th></tr></thead>
                <tbody className="space-y-2">
                  {form.items.map((i, idx) => (
                    <tr key={idx} className="bg-surface-800/50 rounded-lg">
                      <td className="py-2 pl-2 font-medium">{i.product_name}</td>
                      <td><input type="number" className="input-field !py-1 !px-2 text-center" value={i.quantity} onChange={e => updateItem(idx, 'quantity', e.target.value)} /></td>
                      <td><input type="number" className="input-field !py-1 !px-2 text-right" value={i.unit_price} onChange={e => updateItem(idx, 'unit_price', e.target.value)} /></td>
                      <td><input type="number" className="input-field !py-1 !px-2 text-center" value={i.discount_pct} onChange={e => updateItem(idx, 'discount_pct', e.target.value)} /></td>
                      <td className="text-right pr-2 font-mono">{fmtCurrency(i.line_total)}</td>
                      <td><button type="button" onClick={() => removeItem(idx)} className="text-red-400 p-1"><Trash2 className="w-3.5 h-3.5" /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="col-span-2 grid grid-cols-4 gap-4 bg-surface-800/30 p-3 rounded-xl">
              <div><label className="label">Status</label><select className="input-field" value={form.status} onChange={e => set('status', e.target.value)}><option value="draft">Draft</option><option value="sent">Sent</option><option value="accepted">Accepted</option><option value="cancelled">Cancelled</option></select></div>
              <div><label className="label">Discount (৳)</label><input type="number" className="input-field" value={form.discount} onChange={e => set('discount', parseFloat(e.target.value) || 0)} /></div>
              <div><label className="label">Delivery (৳)</label><input type="number" className="input-field" value={form.delivery_charge} onChange={e => set('delivery_charge', parseFloat(e.target.value) || 0)} /></div>
              <div className="text-right flex flex-col justify-end pb-1"><div className="text-xs text-surface-500 uppercase">Grand Total</div><div className="text-xl font-bold font-mono text-emerald-400">{fmtCurrency(grandTotal)}</div></div>
            </div>
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary"><Save className="w-4 h-4" /> {isEdit ? 'Update' : 'Create'} Quotation</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Quotations() {
  const [quotes, setQuotes] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingData, setEditingData] = useState(null);
  const [settings, setSettings] = useState(null);

  const load = async () => {
    try {
      setLoading(true);
      const [q, p, s] = await Promise.all([api.get('/quotations'), api.get('/products?limit=500'), api.get('/settings')]);
      setQuotes(q); setProducts(p); setSettings(s);
    } catch { toast.error('Failed to load data'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleEdit = async (q) => {
    try {
      const detail = await api.get(`/quotations/${q.id}`);
      setEditingData(detail);
    } catch { toast.error('Failed to load detail'); }
  };

  const handlePrint = async (quote) => {
    try {
      const detail = await api.get(`/quotations/${quote.id}`);
      printHtmlInvoice({ ...detail, is_quotation: true, invoice_no: detail.quotation_no }, settings, 'print');
    } catch { toast.error('Failed to load detail'); }
  };

  const handleDownload = async (quote) => {
    try {
      const detail = await api.get(`/quotations/${quote.id}`);
      printHtmlInvoice({ ...detail, is_quotation: true, invoice_no: detail.quotation_no }, settings, 'download');
    } catch { toast.error('Failed to download detail'); }
  };

  const handleConvert = async (quote) => {
    if (!confirm('Convert this quotation to a sales invoice? Stock will be deducted.')) return;
    try {
      const res = await api.post(`/quotations/${quote.id}/convert`);
      toast.success(`Converted to Invoice: ${res.invoice_no}`);
      load();
    } catch (err) { toast.error(err.message); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Move to trash?')) return;
    try { await api.delete(`/quotations/${id}`); toast.success('Moved to trash'); load(); }
    catch (err) { toast.error(err.message); }
  };

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div><h1 className="page-title">Quotations</h1><p className="page-subtitle">{quotes.length} total quotes</p></div>
        <button onClick={() => setShowModal(true)} className="btn-primary"><Plus className="w-4 h-4" /> New Quotation</button>
      </div>

      {loading ? <div className="space-y-3">{Array(4).fill(0).map((_, i) => <div key={i} className="neo-card h-24 shimmer" />)}</div> : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {quotes.map(q => (
            <div key={q.id} className="neo-card p-4 hover:border-surface-600 transition-all group">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <div className="text-xs font-mono text-brand-400 mb-1">{q.quotation_no}</div>
                  <h3 className="font-semibold text-white leading-tight">{q.customer_name}</h3>
                </div>
                <span className={statusBadge(q.status)}>{statusLabel(q.status)}</span>
              </div>
              
              <div className="flex justify-between items-end">
                <div className="text-xs text-surface-500">
                  <div className="flex items-center gap-1.5"><Clock className="w-3 h-3" /> {fmtDate(q.created_at)}</div>
                  {q.converted_at && <div className="flex items-center gap-1.5 text-emerald-400 mt-0.5"><CheckCircle className="w-3 h-3" /> Converted</div>}
                </div>
                <div className="text-right">
                  <div className="text-xs text-surface-400 uppercase tracking-wider mb-0.5">Total</div>
                  <div className="text-lg font-bold font-mono text-white">{fmtCurrency(q.grand_total)}</div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-surface-800">
                <button onClick={() => handlePrint(q)} title="Print" className="btn-secondary btn-sm flex-1 min-w-[60px] flex items-center justify-center gap-1"><Printer className="w-3.5 h-3.5" /> <span className="hidden sm:inline text-xs">Print</span></button>
                <button onClick={() => handleDownload(q)} title="Download" className="btn-secondary btn-sm flex-1 min-w-[60px] flex items-center justify-center gap-1"><Download className="w-3.5 h-3.5" /> <span className="hidden sm:inline text-xs">PDF</span></button>
                <button onClick={() => handleEdit(q)} title="Edit" className="btn-secondary btn-sm flex-1 min-w-[60px] flex items-center justify-center gap-1"><FileText className="w-3.5 h-3.5" /> <span className="hidden sm:inline text-xs">Edit</span></button>
                {q.status !== 'converted' && (
                  <button onClick={() => handleConvert(q)} title="Convert to Invoice" className="btn-success btn-sm flex-1 min-w-[100px] flex items-center justify-center gap-1"><ArrowRight className="w-3.5 h-3.5" /> <span className="text-xs font-semibold">Convert</span></button>
                )}
                <button onClick={() => handleDelete(q.id)} title="Delete" className="btn-danger btn-sm px-3 flex items-center justify-center"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            </div>
          ))}
          {!quotes.length && <div className="col-span-full neo-card p-12 text-center text-surface-500">No quotations found</div>}
        </div>
      )}

      {showModal && <QuotationModal products={products} onSave={() => { setShowModal(false); load(); }} onClose={() => setShowModal(false)} />}
      {editingData && <QuotationModal initialData={editingData} products={products} onSave={() => { setEditingData(null); load(); }} onClose={() => setEditingData(null)} />}
    </div>
  );
}
