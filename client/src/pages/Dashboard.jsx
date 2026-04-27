import React, { useState, useEffect } from 'react';
import { api, fmtCurrency, fmtDateTime, statusBadge, statusLabel } from '../utils/api';
import { TrendingUp, Package, AlertTriangle, Users, Bot, RefreshCw, ShoppingBag, Layers, Printer } from 'lucide-react';
import AIPanel from '../components/AIPanel';
import SaleDetail from '../components/SaleDetail';
import toast from 'react-hot-toast';

function StatCard({ title, value, icon: Icon, color, sub }) {
  return (
    <div className="stat-card animate-fade-in">
      <div className="flex items-start justify-between">
        <div className={`p-2.5 rounded-xl ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <div className="font-mono text-2xl font-bold text-white mt-2">{value}</div>
      <div className="text-xs text-surface-400">{title}</div>
      {sub && <div className="text-xs text-surface-500 mt-0.5">{sub}</div>}
    </div>
  );
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAI, setShowAI] = useState(true);
  const [viewInvoiceId, setViewInvoiceId] = useState(null);

  const load = async () => {
    try {
      setLoading(true);
      const d = await api.get('/dashboard');
      setData(d);
    } catch (err) {
      toast.error('Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (loading) return (
    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
      {Array(6).fill(0).map((_, i) => <div key={i} className="stat-card h-28 shimmer" />)}
    </div>
  );

  return (
    <div className="flex gap-5 h-full">
      {/* Main content */}
      <div className="flex-1 min-w-0 space-y-6 animate-fade-in">
        {/* Header */}
        <div className="page-header">
          <div>
            <h1 className="page-title">Dashboard</h1>
            <p className="page-subtitle">Industrial 3D Solution — Live Overview</p>
          </div>
          <div className="flex gap-2">
            <button onClick={load} className="btn-secondary btn-sm">
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
            <button onClick={() => setShowAI(!showAI)} className={`btn-sm ${showAI ? 'btn-primary' : 'btn-secondary'}`}>
              <Bot className="w-3.5 h-3.5" /> AI Assistant
            </button>
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <StatCard title="Today's Sales" value={fmtCurrency(data?.today_sales)} icon={TrendingUp} color="bg-emerald-500/10 text-emerald-400" sub={`${data?.today_transaction_count || 0} transactions`} />
          <StatCard title="Advance Held" value={fmtCurrency(data?.preorder_advance_held)} icon={ShoppingBag} color="bg-brand-500/10 text-brand-400" sub="Open preorders" />
          <StatCard title="Due to Collect" value={fmtCurrency(data?.preorder_due_balance)} icon={TrendingUp} color="bg-amber-500/10 text-amber-400" sub="On delivery" />
          <StatCard title="Low Stock" value={data?.low_stock_count || 0} icon={Package} color="bg-orange-500/10 text-orange-400" sub="Items below threshold" />
          <StatCard title="Overdue Credit" value={data?.overdue_customers || 0} icon={Users} color="bg-red-500/10 text-red-400" sub="Customers with balance" />
          <StatCard title="Active Group Buys" value={data?.active_group_buys || 0} icon={Layers} color="bg-purple-500/10 text-purple-400" sub="Open group buys" />
        </div>

        {/* Tables */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          {/* Recent Transactions */}
          <div className="table-container">
            <div className="p-4 border-b border-surface-800 flex items-center justify-between">
              <h2 className="font-semibold text-white text-sm">Recent Transactions</h2>
              <span className="badge badge-blue">{data?.recent_transactions?.length || 0}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Invoice</th>
                    <th>Customer</th>
                    <th>Total</th>
                    <th>Method</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.recent_transactions || []).map(t => (
                    <tr key={t.invoice_no}>
                      <td>
                        <button onClick={() => setViewInvoiceId(t.id)} className="font-mono text-xs text-brand-400 hover:text-brand-300 hover:underline transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 rounded px-1 -ml-1">
                          {t.invoice_no}
                        </button>
                      </td>
                      <td>
                        <div className="text-sm">{t.customer_name || 'Walk-in'}</div>
                        <div className="text-xs text-surface-500 truncate max-w-32">{t.products}</div>
                      </td>
                      <td><span className="amount font-mono text-sm">{fmtCurrency(t.grand_total)}</span></td>
                      <td><span className="text-xs text-surface-400">{t.payment_method}</span></td>
                      <td>
                        <span className={statusBadge(t.is_preorder ? 'preorder' : t.status)}>
                          {t.is_preorder ? 'Preorder' : statusLabel(t.status)}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {!data?.recent_transactions?.length && (
                    <tr><td colSpan={5} className="text-center text-surface-500 py-8">No transactions today</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Low Stock Alerts */}
          <div className="table-container">
            <div className="p-4 border-b border-surface-800 flex items-center justify-between">
              <h2 className="font-semibold text-white text-sm flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                Low Stock Alerts
              </h2>
              <span className="badge badge-red">{data?.low_stock_items?.length || 0}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Category</th>
                    <th>Stock</th>
                    <th>Reorder</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.low_stock_items || []).map(p => (
                    <tr key={p.id}>
                      <td>
                        <div className="text-sm font-medium">{p.name}</div>
                        <div className="text-xs text-surface-500">{p.brand} · {p.location}</div>
                      </td>
                      <td><span className="text-xs text-surface-400">{p.category}</span></td>
                      <td><span className={`font-mono text-sm font-bold ${p.stock_qty === 0 ? 'text-red-400' : 'text-amber-400'}`}>{p.stock_qty}</span></td>
                      <td><span className="font-mono text-xs text-surface-400">{p.low_stock_threshold}</span></td>
                      <td>
                        <span className={statusBadge(p.stock_status)}>
                          {p.stock_status === 'out' ? 'Out' : p.stock_status === 'critical' ? 'Critical' : 'Low'}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {!data?.low_stock_items?.length && (
                    <tr><td colSpan={5} className="text-center text-emerald-500 py-8">✓ All items are well-stocked</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* AI Sidebar */}
      {showAI && (
        <div className="w-80 flex-shrink-0 neo-card overflow-hidden flex flex-col" style={{ height: 'calc(100vh - 96px)' }}>
          <AIPanel context={{ dashboard: data }} onClose={() => setShowAI(false)} />
        </div>
      )}

      {/* Invoice Detail Modal */}
      {viewInvoiceId && <SaleDetail id={viewInvoiceId} onClose={() => setViewInvoiceId(null)} />}
    </div>
  );
}
