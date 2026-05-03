import React, { useState, useEffect } from 'react';
import { api } from '../../utils/api';
import { Plus, Edit2, Trash2, X, Save, FolderTree } from 'lucide-react';
import toast from 'react-hot-toast';

export default function InvCategories({ categories, onRefresh }) {
  const [showForm, setShowForm] = useState(false);
  const [edit, setEdit] = useState(null);
  const [form, setForm] = useState({ name: '', parent_id: '', description: '' });
  const [saving, setSaving] = useState(false);

  const openEdit = (c) => { setEdit(c); setForm({ name: c.name, parent_id: c.parent_id || '', description: c.description || '' }); setShowForm(true); };
  const openNew = () => { setEdit(null); setForm({ name: '', parent_id: '', description: '' }); setShowForm(true); };

  const handleSave = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      if (edit) await api.put(`/inventory/categories/${edit.id}`, form);
      else await api.post('/inventory/categories', form);
      toast.success(edit ? 'Updated' : 'Created'); setShowForm(false); onRefresh();
    } catch (err) { toast.error(err.message); } finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this category?')) return;
    try { await api.delete(`/inventory/categories/${id}`); toast.success('Deleted'); onRefresh(); }
    catch (err) { toast.error(err.message); }
  };

  const roots = categories.filter(c => !c.parent_id);
  const children = (pid) => categories.filter(c => c.parent_id === pid);

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#06b6d4,#0891b2)' }}>
            <FolderTree className="w-5 h-5 text-white" />
          </div>
          <div><h2 className="text-lg font-bold text-white">Categories</h2><p className="text-xs text-surface-400">{categories.length} categories</p></div>
        </div>
        <button onClick={openNew} className="btn-primary"><Plus className="w-4 h-4" /> Add Category</button>
      </div>
      <div className="space-y-2">
        {roots.map(c => (
          <div key={c.id}>
            <div className="neo-card p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FolderTree className="w-4 h-4 text-cyan-400" />
                <span className="font-medium text-surface-100">{c.name}</span>
                <span className="text-xs text-surface-500">{c.product_count} products</span>
              </div>
              <div className="flex gap-1">
                <button onClick={() => openEdit(c)} className="btn-ghost btn-icon btn-sm"><Edit2 className="w-3.5 h-3.5" /></button>
                <button onClick={() => handleDelete(c.id)} className="btn-danger btn-icon btn-sm"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            </div>
            {children(c.id).map(ch => (
              <div key={ch.id} className="ml-8 mt-1 neo-card p-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-surface-500">└</span>
                  <span className="text-sm text-surface-200">{ch.name}</span>
                  <span className="text-xs text-surface-500">{ch.product_count} products</span>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(ch)} className="btn-ghost btn-icon btn-sm"><Edit2 className="w-3.5 h-3.5" /></button>
                  <button onClick={() => handleDelete(ch.id)} className="btn-danger btn-icon btn-sm"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
      {showForm && (
        <div className="modal-overlay"><div className="modal-content p-6">
          <div className="flex items-center justify-between mb-4"><h2 className="text-base font-bold text-white">{edit ? 'Edit' : 'Add'} Category</h2><button onClick={() => setShowForm(false)} className="btn-ghost btn-icon btn-sm"><X className="w-4 h-4" /></button></div>
          <form onSubmit={handleSave} className="space-y-3">
            <div><label className="label">Name</label><input className="input-field" value={form.name} onChange={e => setForm(f=>({...f, name: e.target.value}))} required /></div>
            <div><label className="label">Parent Category</label>
              <select className="input-field" value={form.parent_id} onChange={e => setForm(f=>({...f, parent_id: e.target.value || null}))}>
                <option value="" className="bg-surface-800">— None (Root) —</option>
                {roots.map(c => <option key={c.id} value={c.id} className="bg-surface-800">{c.name}</option>)}
              </select>
            </div>
            <div><label className="label">Description</label><input className="input-field" value={form.description} onChange={e => setForm(f=>({...f, description: e.target.value}))} /></div>
            <div className="flex gap-2 justify-end"><button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button><button type="submit" disabled={saving} className="btn-primary"><Save className="w-4 h-4" /> Save</button></div>
          </form>
        </div></div>
      )}
    </div>
  );
}
