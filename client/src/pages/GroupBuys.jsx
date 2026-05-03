import React, { useState, useEffect } from 'react';
import { api, fmtCurrency, fmtDate, statusBadge } from '../utils/api';
import { Plus, Trash2, Users, X, Save, CheckCircle, Edit, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

function GroupBuyModal({ initialData, products, onSave, onClose }) {
  const isEdit = !!initialData;
  const [form, setForm] = useState({ 
    name: initialData?.product_name || '', 
    products: initialData?.products || [], 
    deadline: initialData?.deadline ? new Date(initialData.deadline).toISOString().split('T')[0] : '', 
    notes: initialData?.notes || '',
    status: initialData?.status || 'open'
  });
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [saving, setSaving] = useState(false);
  
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSearch = (q) => {
    setSearch(q);
    if (q.length > 1) {
      const filtered = products.filter(p => 
        p.name.toLowerCase().includes(q.toLowerCase()) || 
        p.sku.toLowerCase().includes(q.toLowerCase())
      ).slice(0, 8);
      setResults(filtered);
    } else {
      setResults([]);
    }
  };

  const addProduct = (p) => {
    if (form.products.find(x => x.product_id === p.id)) {
      toast.error('Product already added');
      return;
    }
    if (p.stock_qty <= 0) {
      toast.error(`${p.name} is out of stock`);
    }
    set('products', [...form.products, { product_id: p.id, product_name: p.name, quantity: 1, target_price: p.selling_price }]);
    setSearch('');
    setResults([]);
  };

  const removeProduct = (idx) => {
    const next = [...form.products];
    next.splice(idx, 1);
    set('products', next);
  };

  const updateProduct = (idx, k, v) => {
    const next = [...form.products];
    next[idx] = { ...next[idx], [k]: v };
    set('products', next);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.products.length === 0) {
      toast.error('Please add at least one product');
      return;
    }
    
    const payload = {
      ...form,
      product_name: form.name || (form.products.length > 0 ? form.products[0].product_name : '')
    };

    setSaving(true);
    try { 
      if (isEdit) {
        await api.put(`/group-buys/${initialData.id}`, payload);
        toast.success('Group buy updated');
      } else {
        await api.post('/group-buys', payload); 
        toast.success('Group buy created'); 
      }
      onSave(); 
    } catch (err) { 
      toast.error(err.message); 
    } finally { 
      setSaving(false); 
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content p-6 max-w-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-white">{isEdit ? 'Modify Group Buy' : 'New Group Buy Event'}</h2>
          <button onClick={onClose} className="btn-ghost btn-icon btn-sm"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className={`${isEdit ? 'col-span-1' : 'col-span-2'}`}>
              <label className="label">Event Name</label>
              <input className="input-field" placeholder="e.g. Summer 3D Printer Bundle" value={form.name} onChange={e => set('name', e.target.value)} />
            </div>
            {isEdit && (
              <div>
                <label className="label">Status</label>
                <select className="input-field" value={form.status} onChange={e => set('status', e.target.value)}>
                  <option value="open" className="bg-surface-800">Open</option>
                  <option value="order_placed" className="bg-surface-800">Order Placed</option>
                  <option value="failed" className="bg-surface-800">Failed / Closed</option>
                </select>
              </div>
            )}
            
            <div className="col-span-2">
              <label className="label">Search & Add Products</label>
              <div className="relative">
                <input className="input-field" placeholder="Search by name or SKU..." value={search} onChange={e => handleSearch(e.target.value)} />
                {results.length > 0 && (
                  <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-surface-800 border border-surface-700 rounded-xl shadow-2xl max-h-60 overflow-y-auto">
                    {results.map(p => (
                      <div key={p.id} className="px-3 py-2 hover:bg-surface-700 cursor-pointer flex justify-between items-center" onClick={() => addProduct(p)}>
                        <div className="flex-1">
                          <div className="text-sm font-medium">{p.name}</div>
                          <div className="text-[10px] text-surface-400 font-mono">{p.sku}</div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <div className={`text-[10px] font-bold font-mono ${p.stock_qty <= 0 ? 'text-red-400' : p.stock_qty <= (p.low_stock_threshold || 5) ? 'text-amber-400' : 'text-emerald-400'}`}>
                              {p.stock_qty <= 0 ? 'OUT OF STOCK' : `Stock: ${p.stock_qty}`}
                            </div>
                          </div>
                          <Plus className="w-3.5 h-3.5 text-brand-400" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {form.products.length > 0 && (
              <div className="col-span-2 space-y-2 max-h-48 overflow-y-auto pr-1 bg-surface-900/30 p-2 rounded-xl border border-surface-800">
                {form.products.map((p, idx) => (
                  <div key={idx} className="flex items-center gap-3 bg-surface-800/50 p-2 rounded-lg border border-surface-700/50">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium truncate">{p.product_name}</div>
                    </div>
                    <div className="w-20">
                      <input type="number" className="input-field !py-1 !px-2 text-xs" placeholder="Qty" value={p.quantity} onChange={e => updateProduct(idx, 'quantity', parseInt(e.target.value))} />
                    </div>
                    <div className="w-24">
                      <input type="number" className="input-field !py-1 !px-2 text-xs" placeholder="Price" value={p.target_price} onChange={e => updateProduct(idx, 'target_price', parseFloat(e.target.value))} />
                    </div>
                    <button type="button" onClick={() => removeProduct(idx)} className="text-red-400 hover:text-red-300"><Trash2 className="w-4 h-4" /></button>
                  </div>
                ))}
              </div>
            )}

            <div className="col-span-2"><label className="label">Deadline</label><input type="date" className="input-field" value={form.deadline} onChange={e => set('deadline', e.target.value)} /></div>
          </div>
          <div><label className="label">Notes</label><textarea className="input-field" rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} /></div>
          <div className="flex gap-2 justify-end pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary"><Save className="w-4 h-4" /> {isEdit ? 'Update Event' : 'Create Event'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AddParticipantModal({ groupBuyId, onSave, onClose }) {
  const [form, setForm] = useState({ customer_name: '', phone: '', email: '', advance_paid: 0 });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const handleSubmit = async (e) => {
    e.preventDefault(); setSaving(true);
    try { await api.post(`/group-buys/${groupBuyId}/participants`, form); toast.success('Participant added'); onSave(); }
    catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };
  return (
    <div className="modal-overlay">
      <div className="modal-content p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-white">Add Participant</h2>
          <button onClick={onClose} className="btn-ghost btn-icon btn-sm"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div><label className="label">Name *</label><input className="input-field" value={form.customer_name} onChange={e => set('customer_name', e.target.value)} required /></div>
          <div><label className="label">Phone</label><input className="input-field" value={form.phone} onChange={e => set('phone', e.target.value)} /></div>
          <div><label className="label">Advance Paid (৳)</label><input type="number" className="input-field" value={form.advance_paid} onChange={e => set('advance_paid', e.target.value)} /></div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary"><Save className="w-4 h-4" /> Add</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function GroupBuys() {
  const [groupBuys, setGroupBuys] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingGb, setEditingGb] = useState(null);
  const [addParticipantTo, setAddParticipantTo] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [details, setDetails] = useState({});

  const load = async () => {
    try {
      setLoading(true);
      const [gb, p] = await Promise.all([api.get('/group-buys'), api.get('/products?limit=200')]);
      setGroupBuys(gb); setProducts(p);
    } catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const expand = async (id) => {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    if (!details[id]) {
      try { const d = await api.get(`/group-buys/${id}`); setDetails(prev => ({ ...prev, [id]: d })); }
      catch { toast.error('Failed to load details'); }
    }
  };

  const closeGroupBuy = async (id, action) => {
    if (!confirm(`${action === 'place' ? 'Place order' : 'Close and refund'}?`)) return;
    try {
      const gb = groupBuys.find(g => g.id === id);
      await api.put(`/group-buys/${id}`, { 
        name: gb.product_name,
        deadline: gb.deadline,
        notes: gb.notes,
        products: gb.products || [],
        status: action === 'place' ? 'order_placed' : 'failed' 
      });
      toast.success(action === 'place' ? 'Order placed!' : 'Group buy closed');
      load();
    } catch (err) { toast.error(err.message); }
  };

  const deleteGroupBuy = async (id) => {
    if (!confirm('Are you sure? This will delete all products and participants for this event.')) return;
    try {
      await api.delete(`/group-buys/${id}`);
      toast.success('Group buy deleted');
      load();
    } catch (err) { toast.error(err.message); }
  };

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div><h1 className="page-title">Group Buy Management</h1><p className="page-subtitle">{groupBuys.length} group buys</p></div>
        <button onClick={() => setShowForm(true)} className="btn-primary"><Plus className="w-4 h-4" /> New Group Buy</button>
      </div>

      {loading ? <div className="space-y-3">{Array(4).fill(0).map((_, i) => <div key={i} className="neo-card h-32 shimmer" />)}</div> : (
        <div className="space-y-4">
          {groupBuys.map(gb => {
            const d = details[gb.id];
            return (
              <div key={gb.id} className="neo-card p-5">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`badge ${gb.status === 'open' ? 'badge-blue' : gb.status === 'order_placed' ? 'badge-green' : 'badge-red'}`}>{gb.status?.replace('_', ' ')}</span>
                    </div>
                    <h3 className="font-semibold text-white">{gb.product_name}</h3>
                    <div className="text-xs text-surface-400 mt-1 space-y-1">
                      {gb.products?.map((p, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-brand-500" />
                          <span>{p.product_name} <span className="text-[10px] bg-surface-800 px-1.5 py-0.5 rounded border border-surface-700/50 ml-1">Qty: {p.quantity} · {fmtCurrency(p.target_price)}</span></span>
                        </div>
                      ))}
                    </div>
                    <div className="text-sm text-surface-500 mt-2 font-medium">Deadline: {fmtDate(gb.deadline)}</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-2xl font-bold font-mono text-white">{gb.participant_count || 0}</div>
                    <div className="text-xs text-surface-400">Participants</div>
                    <div className="text-xs text-emerald-400 mt-1">{fmtCurrency(gb.total_advance_collected)} collected</div>
                  </div>
                </div>

                <div className="flex gap-2 mt-3 flex-wrap">
                  <button onClick={() => setAddParticipantTo(gb.id)} className="btn-secondary btn-sm"><Users className="w-3.5 h-3.5" /> Add Participant</button>
                  <button onClick={() => expand(gb.id)} className="btn-secondary btn-sm">{expandedId === gb.id ? 'Hide' : 'View'} Participants</button>
                  <button onClick={() => setEditingGb(gb)} className="btn-secondary btn-sm"><Edit className="w-3.5 h-3.5" /> Edit</button>
                  {gb.status === 'open' && (
                    <button onClick={() => closeGroupBuy(gb.id, 'place')} className="btn-success btn-sm"><CheckCircle className="w-3.5 h-3.5" /> Place Order</button>
                  )}
                  <button onClick={() => deleteGroupBuy(gb.id)} className="btn-danger btn-sm"><Trash2 className="w-3.5 h-3.5" /> Delete</button>
                </div>

                {expandedId === gb.id && d && (
                  <div className="mt-4 pt-4 border-t border-surface-800">
                    <div className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-2">Participants</div>
                    <div className="space-y-1.5">
                      {(d.participants || []).map(p => (
                        <div key={p.id} className="flex justify-between items-center px-3 py-2 bg-surface-800/50 rounded-lg text-sm">
                          <span className="font-medium">{p.customer_name}</span>
                          <span className="text-surface-500 text-xs">{p.phone}</span>
                          <span className="font-mono text-emerald-400">{fmtCurrency(p.advance_paid)}</span>
                        </div>
                      ))}
                      {!d.participants?.length && <div className="text-surface-500 text-sm text-center py-3">No participants yet</div>}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {!groupBuys.length && <div className="neo-card p-12 text-center text-surface-500">No group buys yet</div>}
        </div>
      )}

      {showForm && <GroupBuyModal products={products} onSave={() => { setShowForm(false); load(); }} onClose={() => setShowForm(false)} />}
      {editingGb && <GroupBuyModal initialData={editingGb} products={products} onSave={() => { setEditingGb(null); load(); }} onClose={() => setEditingGb(null)} />}
      {addParticipantTo && <AddParticipantModal groupBuyId={addParticipantTo} onSave={() => { setAddParticipantTo(null); load(); }} onClose={() => setAddParticipantTo(null)} />}
    </div>
  );
}
