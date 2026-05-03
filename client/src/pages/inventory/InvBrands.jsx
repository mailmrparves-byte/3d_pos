import React, { useState } from 'react';
import { api } from '../../utils/api';
import { Plus, Edit2, Trash2, X, Save, Tag } from 'lucide-react';
import toast from 'react-hot-toast';

export default function InvBrands({ brands, onRefresh }) {
  const [showForm, setShowForm] = useState(false);
  const [edit, setEdit] = useState(null);
  const [form, setForm] = useState({ name: '', description: '' });
  const [saving, setSaving] = useState(false);

  const openEdit = (b) => { setEdit(b); setForm({ name: b.name, description: b.description || '' }); setShowForm(true); };
  const openNew = () => { setEdit(null); setForm({ name: '', description: '' }); setShowForm(true); };

  const handleSave = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      if (edit) await api.put(`/inventory/brands/${edit.id}`, form);
      else await api.post('/inventory/brands', form);
      toast.success(edit ? 'Updated' : 'Created'); setShowForm(false); onRefresh();
    } catch (err) { toast.error(err.message); } finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this brand?')) return;
    try { await api.delete(`/inventory/brands/${id}`); toast.success('Deleted'); onRefresh(); }
    catch (err) { toast.error(err.message); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#ec4899,#be185d)' }}>
            <Tag className="w-5 h-5 text-white" />
          </div>
          <div><h2 className="text-lg font-bold text-white">Brands</h2><p className="text-xs text-surface-400">{brands.length} brands</p></div>
        </div>
        <button onClick={openNew} className="btn-primary"><Plus className="w-4 h-4" /> Add Brand</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {brands.map(b => (
          <div key={b.id} className="neo-card p-4 flex items-center justify-between">
            <div>
              <div className="font-medium text-surface-100">{b.name}</div>
              <div className="text-xs text-surface-500 mt-0.5">{b.product_count} products{b.description ? ` · ${b.description}` : ''}</div>
            </div>
            <div className="flex gap-1">
              <button onClick={() => openEdit(b)} className="btn-ghost btn-icon btn-sm"><Edit2 className="w-3.5 h-3.5" /></button>
              <button onClick={() => handleDelete(b.id)} className="btn-danger btn-icon btn-sm"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          </div>
        ))}
      </div>
      {showForm && (
        <div className="modal-overlay"><div className="modal-content p-6">
          <div className="flex items-center justify-between mb-4"><h2 className="text-base font-bold text-white">{edit ? 'Edit' : 'Add'} Brand</h2><button onClick={() => setShowForm(false)} className="btn-ghost btn-icon btn-sm"><X className="w-4 h-4" /></button></div>
          <form onSubmit={handleSave} className="space-y-3">
            <div><label className="label">Brand Name</label><input className="input-field" value={form.name} onChange={e => setForm(f=>({...f, name: e.target.value}))} required /></div>
            <div><label className="label">Description</label><input className="input-field" value={form.description} onChange={e => setForm(f=>({...f, description: e.target.value}))} /></div>
            <div className="flex gap-2 justify-end"><button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button><button type="submit" disabled={saving} className="btn-primary"><Save className="w-4 h-4" /> Save</button></div>
          </form>
        </div></div>
      )}
    </div>
  );
}
