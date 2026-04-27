import React, { useState, useEffect } from 'react';
import { api, fmtCurrency, fmtDate, statusBadge } from '../utils/api';
import { CheckCircle, Edit2, Send, Eye, RefreshCw, TrendingDown, TrendingUp, Calendar } from 'lucide-react';
import toast from 'react-hot-toast';

function SummaryBar({ summary }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {[
        { label: 'Open Preorders', value: summary?.open_count || 0, color: 'text-brand-400', fmt: false },
        { label: 'Advance Held', value: fmtCurrency(summary?.total_advance), color: 'text-emerald-400', fmt: true },
        { label: 'Due to Collect', value: fmtCurrency(summary?.total_due), color: 'text-amber-400', fmt: true },
        { label: 'Due This Week', value: summary?.due_this_week || 0, color: 'text-red-400', fmt: false },
      ].map(s => (
        <div key={s.label} className="stat-card">
          <div className={`text-xl font-bold font-mono ${s.color}`}>{s.value}</div>
          <div className="text-xs text-surface-400">{s.label}</div>
        </div>
      ))}
    </div>
  );
}

export default function Preorders() {
  const [preorders, setPreorders] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState('all');

  const load = async () => {
    try {
      setLoading(true);
      const [list, sum] = await Promise.all([api.get('/preorders'), api.get('/preorders/summary')]);
      setPreorders(list);
      setSummary(sum);
    } catch { toast.error('Failed to load preorders'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const markDelivered = async (id) => {
    if (!confirm('Mark as delivered and collect due balance?')) return;
    try {
      await api.post(`/preorders/${id}/deliver`, { payment_method: 'Cash' });
      toast.success('Preorder marked as delivered!');
      load();
    } catch (err) { toast.error(err.message); }
  };

  const filtered = filter === 'all' ? preorders : preorders.filter(p => p.status === filter);
  const pctPaid = (p) => p.total_amount > 0 ? Math.min(100, (p.advance_paid / p.total_amount) * 100) : 0;

  const isOverdue = (p) => p.delivery_date && new Date(p.delivery_date) < new Date() && p.status !== 'delivered';
  const getStatus = (p) => isOverdue(p) ? 'overdue' : p.status === 'delivered' ? 'delivered' : 'pending';

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Preorder Management</h1>
          <p className="page-subtitle">Track advances, due balances and delivery dates</p>
        </div>
        <button onClick={load} className="btn-secondary btn-sm"><RefreshCw className="w-3.5 h-3.5" /></button>
      </div>

      <SummaryBar summary={summary} />

      {/* Filters */}
      <div className="flex gap-2 mb-4">
        {['all', 'pending', 'delivered', 'overdue'].map(f => (
          <button key={f} onClick={() => setFilter(f)} className={`btn-sm capitalize ${filter === f ? 'btn-primary' : 'btn-secondary'}`}>{f}</button>
        ))}
      </div>

      {loading ? <div className="space-y-3">{Array(5).fill(0).map((_, i) => <div key={i} className="neo-card h-28 shimmer" />)}</div> : (
        <div className="space-y-3">
          {filtered.map(p => {
            const pct = pctPaid(p);
            const st = getStatus(p);
            return (
              <div key={p.id} className="neo-card p-5 hover:border-surface-700 transition-colors">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="font-mono text-xs text-brand-400 font-bold">{p.preorder_no}</span>
                      <span className={statusBadge(st)}>{st === 'overdue' ? '⚠ Overdue' : st === 'delivered' ? '✓ Delivered' : 'Pending'}</span>
                    </div>
                    <div className="text-white font-semibold">{p.customer_name}</div>
                    <div className="text-xs text-surface-500">{p.customer_phone}</div>
                    <div className="text-sm text-surface-300 mt-1 truncate">{p.product_summary}</div>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <div className="text-sm text-surface-400">Total</div>
                    <div className="font-mono font-bold text-white">{fmtCurrency(p.total_amount)}</div>
                    <div className="text-xs text-emerald-400 mt-1">Paid: {fmtCurrency(p.advance_paid)}</div>
                    <div className="text-xs text-red-400">Due: {fmtCurrency(p.due_balance)}</div>
                    {p.delivery_date && (
                      <div className="flex items-center gap-1 text-xs text-surface-500 mt-1 justify-end">
                        <Calendar className="w-3 h-3" /> {fmtDate(p.delivery_date)}
                      </div>
                    )}
                  </div>
                </div>

                {/* Progress bar */}
                <div className="mt-3">
                  <div className="flex justify-between text-xs text-surface-500 mb-1">
                    <span>Advance paid</span><span>{pct.toFixed(0)}%</span>
                  </div>
                  <div className="progress-bar h-2">
                    <div className="progress-fill bg-gradient-to-r from-brand-500 to-emerald-500" style={{ width: `${pct}%` }} />
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 mt-3 flex-wrap">
                  {p.status !== 'delivered' && (
                    <button onClick={() => markDelivered(p.id)} className="btn-success btn-sm">
                      <CheckCircle className="w-3.5 h-3.5" /> Mark Delivered
                    </button>
                  )}
                  <button onClick={() => setSelected(p)} className="btn-secondary btn-sm">
                    <Eye className="w-3.5 h-3.5" /> View Details
                  </button>
                </div>
              </div>
            );
          })}
          {!filtered.length && (
            <div className="neo-card p-12 text-center text-surface-500">No preorders found</div>
          )}
        </div>
      )}

      {/* Detail Modal */}
      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="modal-content p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white">{selected.preorder_no}</h2>
              <button onClick={() => setSelected(null)} className="btn-ghost btn-sm btn-icon"><RefreshCw className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><div className="text-surface-500 text-xs">Customer</div><div className="text-white">{selected.customer_name}</div></div>
                <div><div className="text-surface-500 text-xs">Phone</div><div>{selected.customer_phone}</div></div>
                <div><div className="text-surface-500 text-xs">Total</div><div className="font-mono text-emerald-400">{fmtCurrency(selected.total_amount)}</div></div>
                <div><div className="text-surface-500 text-xs">Advance</div><div className="font-mono text-brand-400">{fmtCurrency(selected.advance_paid)}</div></div>
                <div><div className="text-surface-500 text-xs">Due Balance</div><div className="font-mono text-red-400">{fmtCurrency(selected.due_balance)}</div></div>
                <div><div className="text-surface-500 text-xs">Delivery Date</div><div>{fmtDate(selected.delivery_date)}</div></div>
              </div>
              {selected.product_summary && <div><div className="text-surface-500 text-xs">Products</div><div className="text-surface-200">{selected.product_summary}</div></div>}
              {selected.variant_instructions && <div><div className="text-surface-500 text-xs">Special Instructions</div><div className="text-surface-200">{selected.variant_instructions}</div></div>}
              {selected.notes && <div><div className="text-surface-500 text-xs">Notes</div><div className="text-surface-200">{selected.notes}</div></div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
