import React, { useState, useEffect } from 'react';
import { api, fmtCurrency, statusBadge, statusLabel } from '../utils/api';
import { Plus, Edit2, Trash2, Search, Filter, RefreshCw, Package, TrendingUp, Bot, X, Save } from 'lucide-react';
import toast from 'react-hot-toast';

const CATEGORIES = ['3D Printers', 'Filaments', 'Tools', 'Meters', 'Soldering', 'Pneumatic', 'Electrical', 'CNC & Laser', 'Microscopes', 'Flow Meters', 'Consumables', 'Other'];
const LOCATIONS = ['Showroom', 'Warehouse'];
const ADJ_TYPES = ['add', 'remove', 'damage', 'loss', 'return', 'transfer'];

const emptyProduct = { sku: '', name: '', brand: '', category: '3D Printers', cost_price: 0, selling_price: 0, vat_applicable: true, stock_qty: 0, low_stock_threshold: 5, location: 'Showroom', serial_tracking: false, expiry_date: '', supplier_id: '', notes: '', unit: 'Pcs', weight: '', size: '', color: '', is_liquid: false };

function ProductForm({ product, suppliers, onSave, onClose }) {
  const [form, setForm] = useState(product || emptyProduct);
  const [saving, setSaving] = useState(false);
  const margin = form.cost_price > 0 ? (((form.selling_price - form.cost_price) / form.cost_price) * 100).toFixed(1) : 0;
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (product?.id) await api.put(`/products/${product.id}`, form);
      else await api.post('/products', form);
      toast.success(product?.id ? 'Product updated' : 'Product added');
      onSave();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content p-6 max-w-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-white">{product?.id ? 'Edit Product' : 'Add Product'}</h2>
          <button onClick={onClose} className="btn-ghost btn-icon btn-sm"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-3">
          <div><label className="label">SKU</label><input className="input-field" value={form.sku} onChange={e => set('sku', e.target.value)} required /></div>
          <div><label className="label">Product Name</label><input className="input-field" value={form.name} onChange={e => set('name', e.target.value)} required /></div>
          <div><label className="label">Brand</label><input className="input-field" value={form.brand} onChange={e => set('brand', e.target.value)} /></div>
          <div>
            <label className="label">Category</label>
            <select className="input-field" value={form.category} onChange={e => set('category', e.target.value)}>
              {CATEGORIES.map(c => <option key={c} className="bg-surface-800">{c}</option>)}
            </select>
          </div>
          <div><label className="label">Cost Price (৳)</label><input type="number" className="input-field" value={form.cost_price} onChange={e => set('cost_price', e.target.value)} /></div>
          <div><label className="label">Selling Price (৳)</label><input type="number" className="input-field" value={form.selling_price} onChange={e => set('selling_price', e.target.value)} /></div>
          <div className="flex items-center gap-2 col-span-2 text-sm text-surface-400">
            <TrendingUp className="w-4 h-4 text-emerald-400" /> Margin: <span className={`font-mono font-bold ${margin >= 20 ? 'text-emerald-400' : margin >= 10 ? 'text-amber-400' : 'text-red-400'}`}>{margin}%</span>
          </div>
          <div><label className="label">Stock Qty</label><input type="number" className="input-field" value={form.stock_qty} onChange={e => set('stock_qty', e.target.value)} /></div>
          <div><label className="label">Low Stock Threshold</label><input type="number" className="input-field" value={form.low_stock_threshold} onChange={e => set('low_stock_threshold', e.target.value)} /></div>
          <div>
            <label className="label">Location</label>
            <select className="input-field" value={form.location} onChange={e => set('location', e.target.value)}>
              {LOCATIONS.map(l => <option key={l} className="bg-surface-800">{l}</option>)}
            </select>
          </div>
          <div><label className="label">Supplier</label>
            <select className="input-field" value={form.supplier_id} onChange={e => set('supplier_id', e.target.value)}>
              <option value="" className="bg-surface-800">— None —</option>
              {suppliers.map(s => <option key={s.id} value={s.id} className="bg-surface-800">{s.name}</option>)}
            </select>
          </div>
          <div className="col-span-2 section-divider" />
          <div>
            <label className="label">Is Liquid?</label>
            <div className="flex items-center gap-3 mt-2">
              <label className="flex items-center gap-2 cursor-pointer text-sm text-surface-300">
                <input type="checkbox" checked={form.is_liquid} onChange={e => {
                  set('is_liquid', e.target.checked);
                  if (e.target.checked) set('unit', 'Liter');
                  else set('unit', 'Pcs');
                }} className="w-4 h-4 accent-brand-500" /> Yes, it's liquid
              </label>
            </div>
          </div>
          <div>
            <label className="label">Unit</label>
            <select className="input-field" value={form.unit} onChange={e => set('unit', e.target.value)}>
              {form.is_liquid ? (
                <>
                  <option value="Liter" className="bg-surface-800">Liter</option>
                  <option value="Kg" className="bg-surface-800">Kg</option>
                  <option value="Bottle" className="bg-surface-800">Bottle</option>
                </>
              ) : (
                <>
                  <option value="Pcs" className="bg-surface-800">Pcs</option>
                  <option value="Box" className="bg-surface-800">Box</option>
                  <option value="Set" className="bg-surface-800">Set</option>
                  <option value="Meter" className="bg-surface-800">Meter</option>
                  <option value="Roll" className="bg-surface-800">Roll</option>
                </>
              )}
            </select>
          </div>
          <div><label className="label">Weight</label><input className="input-field" value={form.weight || ''} onChange={e => set('weight', e.target.value)} placeholder="e.g. 1kg, 500g" /></div>
          <div><label className="label">Size / Dimension</label><input className="input-field" value={form.size || ''} onChange={e => set('size', e.target.value)} placeholder="e.g. XL, 20x30cm" /></div>
          <div><label className="label">Color</label><input className="input-field" value={form.color || ''} onChange={e => set('color', e.target.value)} placeholder="e.g. Black, Silver" /></div>
          <div className="col-span-2 section-divider" />
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer text-sm text-surface-300">
              <input type="checkbox" checked={form.vat_applicable} onChange={e => set('vat_applicable', e.target.checked)} className="w-4 h-4 accent-brand-500" /> VAT Applicable
            </label>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer text-sm text-surface-300">
              <input type="checkbox" checked={form.serial_tracking} onChange={e => set('serial_tracking', e.target.checked)} className="w-4 h-4 accent-brand-500" /> Serial Tracking
            </label>
          </div>
          <div className="col-span-2"><label className="label">Notes</label><textarea className="input-field" rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} /></div>
          <div className="col-span-2 flex gap-2 justify-end mt-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary"><Save className="w-4 h-4" /> Save</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AdjustStockModal({ product, onClose, onSave }) {
  const [adjType, setAdjType] = useState('add');
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post(`/products/${product.id}/adjust-stock`, { adjustment_type: adjType, quantity, reason });
      toast.success('Stock adjusted');
      onSave();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-white">Adjust Stock — {product.name}</h2>
          <button onClick={onClose} className="btn-ghost btn-icon btn-sm"><X className="w-4 h-4" /></button>
        </div>
        <div className="mb-3 text-sm text-surface-400">Current Stock: <span className="font-mono font-bold text-white">{product.stock_qty}</span></div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="label">Adjustment Type</label>
            <select className="input-field" value={adjType} onChange={e => setAdjType(e.target.value)}>
              {ADJ_TYPES.map(t => <option key={t} className="bg-surface-800 capitalize">{t}</option>)}
            </select>
          </div>
          <div><label className="label">Quantity</label><input type="number" className="input-field" min="1" value={quantity} onChange={e => setQuantity(parseInt(e.target.value))} required /></div>
          <div><label className="label">Reason</label><input className="input-field" value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Purchase received" required /></div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary"><Save className="w-4 h-4" /> Apply</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Inventory() {
  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editProduct, setEditProduct] = useState(null);
  const [adjustProduct, setAdjustProduct] = useState(null);

  const load = async () => {
    try {
      setLoading(true);
      let q = '/products?limit=500';
      if (search) q += `&search=${encodeURIComponent(search)}`;
      if (category) q += `&category=${encodeURIComponent(category)}`;
      if (statusFilter) q += `&status=${statusFilter}`;
      const [p, s] = await Promise.all([api.get(q), api.get('/suppliers')]);
      setProducts(p);
      setSuppliers(s);
    } catch { toast.error('Failed to load inventory'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [search, category, statusFilter]);

  const deleteProduct = async (id) => {
    if (!confirm('Delete this product?')) return;
    try { await api.delete(`/products/${id}`); toast.success('Deleted'); load(); }
    catch (err) { toast.error(err.message); }
  };

  const stockStatusColor = (s) => ({ in_stock: 'text-emerald-400', low: 'text-amber-400', critical: 'text-orange-400', out: 'text-red-400' }[s] || 'text-surface-400');

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div><h1 className="page-title">Inventory</h1><p className="page-subtitle">{products.length} products</p></div>
        <button onClick={() => { setEditProduct(null); setShowForm(true); }} className="btn-primary"><Plus className="w-4 h-4" /> Add Product</button>
      </div>

      {/* Filters */}
      <div className="neo-card p-4 mb-5 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" />
          <input className="input-field !pl-9" placeholder="Search by name, SKU, brand..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="input-field w-44" value={category} onChange={e => setCategory(e.target.value)}>
          <option value="" className="bg-surface-800">All Categories</option>
          {CATEGORIES.map(c => <option key={c} className="bg-surface-800">{c}</option>)}
        </select>
        <select className="input-field w-36" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="" className="bg-surface-800">All Status</option>
          <option value="in_stock" className="bg-surface-800">In Stock</option>
          <option value="low" className="bg-surface-800">Low</option>
          <option value="critical" className="bg-surface-800">Critical</option>
          <option value="out" className="bg-surface-800">Out of Stock</option>
        </select>
        <button onClick={load} className="btn-secondary btn-icon"><RefreshCw className="w-4 h-4" /></button>
      </div>

      {/* Table */}
      <div className="table-container">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>SKU</th><th>Product</th><th>Brand</th><th>Category</th>
                <th>Cost</th><th>Price</th><th>Margin</th><th>Stock</th>
                <th>Location</th><th>Status</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? Array(8).fill(0).map((_, i) => (
                <tr key={i}>{Array(11).fill(0).map((_, j) => <td key={j}><div className="h-4 shimmer rounded" /></td>)}</tr>
              )) : products.map(p => (
                <tr key={p.id}>
                  <td><span className="font-mono text-xs text-brand-400">{p.sku}</span></td>
                  <td><div className="font-medium text-surface-100 max-w-48 truncate">{p.name}</div></td>
                  <td><span className="text-xs text-surface-400">{p.brand || '—'}</span></td>
                  <td><span className="text-xs text-surface-400">{p.category}</span></td>
                  <td><span className="font-mono text-xs text-surface-400">{fmtCurrency(p.cost_price)}</span></td>
                  <td><span className="font-mono text-sm font-medium">{fmtCurrency(p.selling_price)}</span></td>
                  <td><span className={`font-mono text-xs ${parseFloat(p.margin_pct) >= 20 ? 'text-emerald-400' : 'text-amber-400'}`}>{p.margin_pct}%</span></td>
                  <td><span className={`font-mono font-bold ${stockStatusColor(p.stock_status)}`}>{p.stock_qty}</span></td>
                  <td><span className="text-xs text-surface-400">{p.location}</span></td>
                  <td><span className={statusBadge(p.stock_status)}>{statusLabel(p.stock_status)}</span></td>
                  <td>
                    <div className="flex gap-1">
                      <button onClick={() => setAdjustProduct(p)} className="btn-ghost btn-icon btn-sm tooltip" title="Adjust Stock">
                        <Package className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => { setEditProduct(p); setShowForm(true); }} className="btn-ghost btn-icon btn-sm">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => deleteProduct(p.id)} className="btn-danger btn-icon btn-sm">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && !products.length && (
                <tr><td colSpan={11} className="text-center text-surface-500 py-12">No products found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && <ProductForm product={editProduct} suppliers={suppliers} onSave={() => { setShowForm(false); load(); }} onClose={() => setShowForm(false)} />}
      {adjustProduct && <AdjustStockModal product={adjustProduct} onClose={() => setAdjustProduct(null)} onSave={() => { setAdjustProduct(null); load(); }} />}
    </div>
  );
}
