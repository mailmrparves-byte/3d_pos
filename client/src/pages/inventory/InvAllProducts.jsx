import React, { useState, useEffect } from 'react';
import { api, fmtCurrency, statusBadge, statusLabel } from '../../utils/api';
import { Plus, Edit2, Trash2, Search, RefreshCw, Package, TrendingUp, X, Save } from 'lucide-react';
import DeleteConfirmModal from '../../components/DeleteConfirmModal';
import ExportButtons from '../../components/ExportButtons';
import toast from 'react-hot-toast';

// VAT options removed
const LOCATIONS = ['Warehouse', 'Showroom'];
const ADJ_TYPES = ['add', 'remove', 'damage', 'loss', 'return', 'transfer'];

const emptyProduct = { sku:'',name:'',brand:'',category:'',cost_price:0,selling_price:0,stock_qty:0,low_stock_threshold:5,location:'Warehouse',serial_tracking:false,expiry_date:'',notes:'',unit:'Pcs',weight:'',size:'',color:'',is_liquid:false };

function ProductForm({ product, categories, brands, onSave, onClose }) {
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
          <div><label className="label">Brand</label>
            <select className="input-field" value={form.brand} onChange={e => set('brand', e.target.value)}>
              <option value="" className="bg-surface-800">— Select Brand —</option>
              {brands.map(b => <option key={b.id} value={b.name} className="bg-surface-800">{b.name}</option>)}
            </select>
          </div>
          <div><label className="label">Category</label>
            <select className="input-field" value={form.category} onChange={e => set('category', e.target.value)}>
              <option value="" className="bg-surface-800">— Select Category —</option>
              {categories.map(c => <option key={c.id} value={c.name} className="bg-surface-800">{c.parent_name ? `${c.parent_name} / ` : ''}{c.name}</option>)}
            </select>
          </div>
          <div><label className="label">Cost Price (৳)</label><input type="number" className="input-field" value={form.cost_price} onChange={e => set('cost_price', e.target.value)} /></div>
          <div><label className="label">Selling Price (৳)</label><input type="number" className="input-field" value={form.selling_price} onChange={e => set('selling_price', e.target.value)} /></div>
          <div className="flex items-center gap-2 col-span-2 text-sm text-surface-400">
            <TrendingUp className="w-4 h-4 text-emerald-400" /> Margin: <span className={`font-mono font-bold ${margin >= 20 ? 'text-emerald-400' : margin >= 10 ? 'text-amber-400' : 'text-red-400'}`}>{margin}%</span>
          </div>
          {!product?.id && <div><label className="label">Stock Qty</label><input type="number" className="input-field" value={form.stock_qty} onChange={e => set('stock_qty', e.target.value)} /></div>}
          <div><label className="label">Low Stock Threshold</label><input type="number" className="input-field" value={form.low_stock_threshold} onChange={e => set('low_stock_threshold', e.target.value)} /></div>
          <div><label className="label">Location</label>
            <select className="input-field" value={form.location} onChange={e => set('location', e.target.value)}>
              {LOCATIONS.map(l => <option key={l} className="bg-surface-800">{l}</option>)}
            </select>
          </div>

          <div className="col-span-2 section-divider" />
          <div><label className="label">Unit</label>
            <select className="input-field" value={form.unit} onChange={e => set('unit', e.target.value)}>
              {['Pcs','Box','Set','Meter','Roll','Liter','Kg','Bottle'].map(u => <option key={u} className="bg-surface-800">{u}</option>)}
            </select>
          </div>
          <div><label className="label">Weight</label><input className="input-field" value={form.weight||''} onChange={e => set('weight', e.target.value)} placeholder="e.g. 1kg" /></div>
          <div><label className="label">Color</label><input className="input-field" value={form.color||''} onChange={e => set('color', e.target.value)} /></div>
          <div><label className="label">Size</label><input className="input-field" value={form.size||''} onChange={e => set('size', e.target.value)} /></div>
          <div className="col-span-2"><label className="label">Notes</label><textarea className="input-field" rows={2} value={form.notes||''} onChange={e => set('notes', e.target.value)} /></div>
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
    e.preventDefault(); setSaving(true);
    try { await api.post(`/products/${product.id}/adjust-stock`, { adjustment_type: adjType, quantity, reason, from_location: product.location }); toast.success('Stock adjusted'); onSave(); }
    catch (err) { toast.error(err.message); } finally { setSaving(false); }
  };
  return (
    <div className="modal-overlay"><div className="modal-content p-6">
      <div className="flex items-center justify-between mb-4"><h2 className="text-base font-bold text-white">Adjust Stock — {product.name}</h2><button onClick={onClose} className="btn-ghost btn-icon btn-sm"><X className="w-4 h-4" /></button></div>
      <div className="mb-3 text-sm text-surface-400">Current Stock: <span className="font-mono font-bold text-white">{product.stock_qty}</span></div>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div><label className="label">Type</label><select className="input-field" value={adjType} onChange={e => setAdjType(e.target.value)}>{ADJ_TYPES.map(t => <option key={t} className="bg-surface-800 capitalize">{t}</option>)}</select></div>
        <div><label className="label">Quantity</label><input type="number" className="input-field" min="1" value={quantity} onChange={e => setQuantity(parseInt(e.target.value))} required /></div>
        <div><label className="label">Reason</label><input className="input-field" value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Purchase received" required /></div>
        <div className="flex gap-2 justify-end"><button type="button" onClick={onClose} className="btn-secondary">Cancel</button><button type="submit" disabled={saving} className="btn-primary"><Save className="w-4 h-4" /> Apply</button></div>
      </form>
    </div></div>
  );
}

export default function InvAllProducts({ categories, brands, onRefresh }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editProduct, setEditProduct] = useState(null);
  const [adjustProduct, setAdjustProduct] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const load = async () => {
    try {
      setLoading(true);
      let q = '/products?limit=500';
      if (search) q += `&search=${encodeURIComponent(search)}`;
      if (category) q += `&category=${encodeURIComponent(category)}`;
      if (statusFilter) q += `&status=${statusFilter}`;
      const p = await api.get(q);
      setProducts(p);
    } catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [search, category, statusFilter]);

  const handleDelete = async (p) => {
    try { await api.delete(`/products/${p.id}`); toast.success('Moved to trash'); setDeleteTarget(null); load(); if(onRefresh) onRefresh(); }
    catch (err) { toast.error(err.message); }
  };

  const stockColor = (s) => ({ in_stock:'text-emerald-400', low:'text-amber-400', critical:'text-orange-400', out:'text-red-400' }[s] || 'text-surface-400');

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div><h2 className="text-lg font-bold text-white">All Products</h2><p className="text-xs text-surface-400">{products.length} products</p></div>
        <div className="flex items-center gap-2">
          <ExportButtons 
            title="All Products"
            columns={['SKU', 'Product', 'Brand', 'Category', 'Cost', 'Price', 'Margin', 'Stock', 'Status']}
            data={products.map(p => [p.sku, p.name, p.brand||'—', p.category, fmtCurrency(p.cost_price), fmtCurrency(p.selling_price), p.margin_pct+'%', p.stock_qty, statusLabel(p.stock_status)])}
            filters={{ Search: search, Category: category, Status: statusFilter }}
          />
          <button onClick={() => { setEditProduct(null); setShowForm(true); }} className="btn-primary"><Plus className="w-4 h-4" /> Add Product</button>
        </div>
      </div>
      <div className="neo-card p-4 mb-5 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" /><input className="input-field !pl-9" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} /></div>
        <select className="input-field w-44" value={category} onChange={e => setCategory(e.target.value)}>
          <option value="" className="bg-surface-800">All Categories</option>
          {categories.map(c => <option key={c.id} className="bg-surface-800">{c.name}</option>)}
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
      <div className="table-container"><div className="overflow-x-auto"><table className="data-table"><thead><tr>
        <th>SKU</th><th>Product</th><th>Brand</th><th>Category</th><th>Cost</th><th>Price</th><th>Margin</th><th>Stock</th><th>Status</th><th>Actions</th>
      </tr></thead><tbody>
        {loading ? Array(6).fill(0).map((_, i) => <tr key={i}>{Array(10).fill(0).map((_, j) => <td key={j}><div className="h-4 shimmer rounded" /></td>)}</tr>) :
        products.map(p => (
          <tr key={p.id}>
            <td><span className="font-mono text-xs text-brand-400">{p.sku}</span></td>
            <td><div className="font-medium text-surface-100 max-w-48 truncate">{p.name}</div></td>
            <td><span className="text-xs text-surface-400">{p.brand||'—'}</span></td>
            <td><span className="text-xs text-surface-400">{p.category}</span></td>
            <td><span className="font-mono text-xs text-surface-400">{fmtCurrency(p.cost_price)}</span></td>
            <td><span className="font-mono text-sm font-medium">{fmtCurrency(p.selling_price)}</span></td>

            <td><span className={`font-mono text-xs ${parseFloat(p.margin_pct) >= 20 ? 'text-emerald-400' : 'text-amber-400'}`}>{p.margin_pct}%</span></td>
            <td><span className={`font-mono font-bold ${stockColor(p.stock_status)}`}>{p.stock_qty}</span></td>
            <td><span className={statusBadge(p.stock_status)}>{statusLabel(p.stock_status)}</span></td>
            <td><div className="flex gap-1">
              <button onClick={() => setAdjustProduct(p)} className="btn-ghost btn-icon btn-sm" title="Adjust Stock"><Package className="w-3.5 h-3.5" /></button>
              <button onClick={() => { setEditProduct(p); setShowForm(true); }} className="btn-ghost btn-icon btn-sm"><Edit2 className="w-3.5 h-3.5" /></button>
              <button onClick={() => setDeleteTarget(p)} className="btn-danger btn-icon btn-sm"><Trash2 className="w-3.5 h-3.5" /></button>
            </div></td>
          </tr>
        ))}
        {!loading && !products.length && <tr><td colSpan={10} className="text-center text-surface-500 py-12">No products found</td></tr>}
      </tbody></table></div></div>
      {showForm && <ProductForm product={editProduct} categories={categories} brands={brands} onSave={() => { setShowForm(false); load(); if(onRefresh) onRefresh(); }} onClose={() => setShowForm(false)} />}
      {adjustProduct && <AdjustStockModal product={adjustProduct} onClose={() => setAdjustProduct(null)} onSave={() => { setAdjustProduct(null); load(); }} />}
      {deleteTarget && <DeleteConfirmModal type="product" id={deleteTarget.id} name={deleteTarget.name} onConfirm={() => handleDelete(deleteTarget)} onClose={() => setDeleteTarget(null)} />}
    </div>
  );
}
