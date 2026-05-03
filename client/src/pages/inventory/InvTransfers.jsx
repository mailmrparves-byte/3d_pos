import React, { useState, useEffect } from 'react';
import { api, fmtDateTime } from '../../utils/api';
import { ArrowRightLeft, Plus, X, Save } from 'lucide-react';
import ExportButtons from '../../components/ExportButtons';
import toast from 'react-hot-toast';

export default function InvTransfers() {
  const [transfers, setTransfers] = useState([]);
  const [locations, setLocations] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ product_id: '', from_location_id: '', to_location_id: '', qty: 1, notes: '' });
  const [saving, setSaving] = useState(false);
  const [searchQ, setSearchQ] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearch, setShowSearch] = useState(false);
  const [selectedProductName, setSelectedProductName] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [t, l, p] = await Promise.all([
        api.get('/inventory/transfers?limit=100'),
        api.get('/inventory/locations'),
        api.get('/products?limit=500')
      ]);
      setTransfers(t); setLocations(l); setProducts(p);
      
      const warehouse = l.find(loc => loc.name === 'Warehouse');
      const showroom = l.find(loc => loc.name === 'Showroom');
      if (warehouse && showroom) {
        setForm(f => ({ ...f, from_location_id: warehouse.id, to_location_id: showroom.id }));
      }
    } catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.from_location_id === form.to_location_id) { toast.error('Source and destination must differ'); return; }
    setSaving(true);
    try {
      await api.post('/inventory/transfers', form);
      toast.success('Transfer completed'); setShowForm(false); load();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const handleSearch = (q) => {
    setSearchQ(q);
    if (q.length > 1) {
      const results = products.filter(p =>
        p.name.toLowerCase().includes(q.toLowerCase()) || 
        p.sku.toLowerCase().includes(q.toLowerCase()) ||
        (p.category && p.category.toLowerCase().includes(q.toLowerCase())) ||
        (p.brand && p.brand.toLowerCase().includes(q.toLowerCase()))
      ).slice(0, 10);
      setSearchResults(results);
      setShowSearch(true);
    } else {
      setSearchResults([]);
      setShowSearch(false);
    }
  };

  const selectProduct = (p) => {
    setForm(f => ({ ...f, product_id: p.id }));
    setSelectedProductName(p.name);
    setSearchQ(p.name);
    setShowSearch(false);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#3b82f6,#1d4ed8)' }}>
            <ArrowRightLeft className="w-5 h-5 text-white" />
          </div>
          <div><h2 className="text-lg font-bold text-white">Stock Transfers</h2><p className="text-xs text-surface-400">{transfers.length} transfers logged</p></div>
        </div>
        <div className="flex items-center gap-2">
          <ExportButtons 
            title="Stock Transfer Log"
            columns={['Date', 'Product', 'From', 'To', 'Qty', 'By', 'Notes']}
            data={transfers.map(t => [fmtDateTime(t.created_at), t.product_name, t.from_location_name, t.to_location_name, t.qty, t.created_by_name, t.notes || '—'])}
          />
          <button onClick={() => setShowForm(true)} className="btn-primary"><Plus className="w-4 h-4" /> New Transfer</button>
        </div>
      </div>
      <div className="table-container"><div className="overflow-x-auto"><table className="data-table"><thead><tr>
        <th>Date</th><th>Product</th><th>From</th><th>To</th><th>Qty</th><th>By</th><th>Notes</th>
      </tr></thead><tbody>
        {loading ? Array(4).fill(0).map((_,i) => <tr key={i}>{Array(7).fill(0).map((_,j) => <td key={j}><div className="h-4 shimmer rounded" /></td>)}</tr>) :
        transfers.map(t => (
          <tr key={t.id}>
            <td><span className="text-xs text-surface-400">{fmtDateTime(t.created_at)}</span></td>
            <td><span className="text-sm text-surface-100">{t.product_name}</span></td>
            <td><span className="text-xs text-orange-400 font-medium">{t.from_location_name}</span></td>
            <td><span className="text-xs text-emerald-400 font-medium">{t.to_location_name}</span></td>
            <td><span className="font-mono font-bold text-blue-400">{t.qty}</span></td>
            <td><span className="text-xs text-surface-400">{t.created_by_name}</span></td>
            <td><span className="text-xs text-surface-500">{t.notes || '—'}</span></td>
          </tr>
        ))}
        {!loading && !transfers.length && <tr><td colSpan={7} className="text-center text-surface-500 py-12">No transfers yet</td></tr>}
      </tbody></table></div></div>

      {showForm && (
        <div className="modal-overlay"><div className="modal-content p-6" style={{maxWidth:'480px'}}>
          <div className="flex items-center justify-between mb-4"><h2 className="text-base font-bold text-white">New Stock Transfer</h2><button onClick={() => setShowForm(false)} className="btn-ghost btn-icon btn-sm"><X className="w-4 h-4" /></button></div>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div><label className="label">Product</label>
              <div className="relative">
                <input
                  className="input-field"
                  placeholder="Search by SKU, Name, Category, Brand..."
                  value={searchQ}
                  onChange={e => handleSearch(e.target.value)}
                  onFocus={() => { if (searchResults.length > 0) setShowSearch(true); }}
                  onBlur={() => setTimeout(() => setShowSearch(false), 200)}
                  required
                />
                {showSearch && searchResults.length > 0 && (
                  <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-surface-800 border border-surface-700 rounded-xl shadow-2xl max-h-60 overflow-y-auto">
                    {searchResults.map(p => (
                      <div key={p.id} className="px-3 py-2.5 hover:bg-surface-700 cursor-pointer transition-colors border-b border-surface-700/50 last:border-0" onMouseDown={() => selectProduct(p)}>
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="text-sm font-medium text-surface-100">{p.name}</div>
                            <div className="text-[10px] text-surface-400 font-mono uppercase tracking-wider">{p.sku} · {p.brand || 'No Brand'} · {p.category}</div>
                          </div>
                          <div className={`text-xs font-bold font-mono ${p.stock_qty <= 5 ? 'text-red-400' : 'text-emerald-400'}`}>{p.stock_qty}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">From Location</label>
                <select className="input-field" value={form.from_location_id} onChange={e => setForm(f=>({...f, from_location_id: e.target.value}))} required>
                  <option value="" className="bg-surface-800">— Select —</option>
                  {locations.map(l => (
                    <option key={l.id} value={l.id} className="bg-surface-800" disabled={l.total_stock <= 0 && l.id === form.from_location_id}>
                      {l.name} {l.id === form.from_location_id ? `(Avail: ${l.total_stock})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div><label className="label">To Location</label>
                <select className="input-field" value={form.to_location_id} onChange={e => setForm(f=>({...f, to_location_id: e.target.value}))} required>
                  <option value="" className="bg-surface-800">— Select —</option>
                  {locations.map(l => <option key={l.id} value={l.id} className="bg-surface-800">{l.name}</option>)}
                </select>
              </div>
            </div>
            <div><label className="label">Quantity</label><input type="number" min="1" className="input-field" value={form.qty} onChange={e => setForm(f=>({...f, qty: parseInt(e.target.value)}))} required /></div>
            <div><label className="label">Notes</label><input className="input-field" value={form.notes} onChange={e => setForm(f=>({...f, notes: e.target.value}))} placeholder="e.g. Restocking showroom" /></div>
            <div className="flex gap-2 justify-end"><button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button><button type="submit" disabled={saving} className="btn-primary"><Save className="w-4 h-4" /> Transfer</button></div>
          </form>
        </div></div>
      )}
    </div>
  );
}
