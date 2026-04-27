import React, { useState, useEffect } from 'react';
import { api, fmtCurrency, fmtDate, statusBadge } from '../utils/api';
import { Plus, Trash2, Users, X, Save, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';

function NewGroupBuyForm({ products, onSave, onClose }) {
  const [form, setForm] = useState({ product_name: '', product_id: '', target_price: 0, min_participants: 5, deadline: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const handleSubmit = async (e) => {
    e.preventDefault(); setSaving(true);
    try { await api.post('/group-buys', form); toast.success('Group buy created'); onSave(); }
    catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };
  return (
    <div className="modal-overlay">
      <div className="modal-content p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-white">New Group Buy</h2>
          <button onClick={onClose} className="btn-ghost btn-icon btn-sm"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div><label className="label">Product Name *</label><input className="input-field" value={form.product_name} onChange={e => set('product_name', e.target.value)} required /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Target Price (৳)</label><input type="number" className="input-field" value={form.target_price} onChange={e => set('target_price', e.target.value)} /></div>
            <div><label className="label">Min Participants</label><input type="number" className="input-field" value={form.min_participants} onChange={e => set('min_participants', e.target.value)} /></div>
            <div><label className="label">Deadline</label><input type="date" className="input-field" value={form.deadline} onChange={e => set('deadline', e.target.value)} /></div>
          </div>
          <div><label className="label">Notes</label><textarea className="input-field" rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} /></div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary"><Save className="w-4 h-4" /> Create</button>
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
      await api.put(`/group-buys/${id}`, { status: action === 'place' ? 'order_placed' : 'failed' });
      toast.success(action === 'place' ? 'Order placed!' : 'Group buy closed');
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
            const pct = gb.min_participants > 0 ? Math.min(100, ((gb.participant_count || 0) / gb.min_participants) * 100) : 0;
            const met = (gb.participant_count || 0) >= gb.min_participants;
            const d = details[gb.id];

            return (
              <div key={gb.id} className="neo-card p-5">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`badge ${gb.status === 'open' ? 'badge-blue' : gb.status === 'order_placed' ? 'badge-green' : 'badge-red'}`}>{gb.status?.replace('_', ' ')}</span>
                      {met && <span className="badge badge-green">✓ Target Met</span>}
                    </div>
                    <h3 className="font-semibold text-white">{gb.product_name}</h3>
                    <div className="text-sm text-surface-400 mt-0.5">Target: {fmtCurrency(gb.target_price)} · Deadline: {fmtDate(gb.deadline)}</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-2xl font-bold font-mono text-white">{gb.participant_count || 0}<span className="text-surface-500 text-base">/{gb.min_participants}</span></div>
                    <div className="text-xs text-surface-400">Participants</div>
                    <div className="text-xs text-emerald-400 mt-1">{fmtCurrency(gb.total_advance_collected)} collected</div>
                  </div>
                </div>

                <div className="mt-3">
                  <div className="flex justify-between text-xs text-surface-500 mb-1"><span>Progress</span><span>{pct.toFixed(0)}%</span></div>
                  <div className="progress-bar h-2.5">
                    <div className={`progress-fill ${met ? 'bg-gradient-to-r from-emerald-500 to-green-400' : 'bg-gradient-to-r from-brand-500 to-blue-400'}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>

                <div className="flex gap-2 mt-3 flex-wrap">
                  <button onClick={() => setAddParticipantTo(gb.id)} className="btn-secondary btn-sm"><Users className="w-3.5 h-3.5" /> Add Participant</button>
                  <button onClick={() => expand(gb.id)} className="btn-secondary btn-sm">{expandedId === gb.id ? 'Hide' : 'View'} Participants</button>
                  {gb.status === 'open' && met && (
                    <button onClick={() => closeGroupBuy(gb.id, 'place')} className="btn-success btn-sm"><CheckCircle className="w-3.5 h-3.5" /> Place Order</button>
                  )}
                  {gb.status === 'open' && (
                    <button onClick={() => closeGroupBuy(gb.id, 'close')} className="btn-danger btn-sm"><X className="w-3.5 h-3.5" /> Close & Refund</button>
                  )}
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

      {showForm && <NewGroupBuyForm products={products} onSave={() => { setShowForm(false); load(); }} onClose={() => setShowForm(false)} />}
      {addParticipantTo && <AddParticipantModal groupBuyId={addParticipantTo} onSave={() => { setAddParticipantTo(null); load(); }} onClose={() => setAddParticipantTo(null)} />}
    </div>
  );
}
