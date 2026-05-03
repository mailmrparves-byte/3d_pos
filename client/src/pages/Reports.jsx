import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, fmtCurrency, fmtDate } from '../utils/api';
import { BarChart3, Download, Bot, Calendar, RefreshCw, TrendingUp, Package, Users, AlertTriangle, FileText } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { api as apiUtil } from '../utils/api';
import toast from 'react-hot-toast';

const COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#06b6d4','#84cc16'];

const REPORT_TYPES = [
  { id: 'sales', label: 'Sales Report', icon: TrendingUp },
  { id: 'inventory', label: 'Inventory Valuation', icon: Package },
  { id: 'slow-moving', label: 'Slow Moving Stock', icon: AlertTriangle },
  { id: 'profit-loss', label: 'Profit & Loss', icon: TrendingUp },
  { id: 'customer-outstanding', label: 'Outstanding Balances', icon: Users },
  { id: 'preorders', label: 'Preorder Report', icon: Package },
  { id: 'quotations', label: 'Quotation Analysis', icon: FileText },
];

function SalesReport({ data }) {
  if (!data) return null;
  const { overview, by_category, by_payment, daily } = data;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { l: 'Total Sales', v: fmtCurrency(overview?.total_sales), c: 'text-emerald-400' },
          { l: 'Net Revenue', v: fmtCurrency(overview?.net_revenue), c: 'text-purple-400' },
          { l: 'Transactions', v: overview?.transaction_count, c: 'text-amber-400' },
        ].map(s => (
          <div key={s.l} className="stat-card"><div className={`text-xl font-mono font-bold ${s.c}`}>{s.v}</div><div className="text-xs text-surface-400">{s.l}</div></div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="neo-card p-4">
          <h3 className="text-sm font-semibold text-surface-300 mb-3">Daily Sales Trend</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={daily}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} />
              <YAxis tick={{ fontSize: 10, fill: '#64748b' }} />
              <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', fontSize: '12px' }} formatter={v => fmtCurrency(v)} />
              <Bar dataKey="total" fill="#3b82f6" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="neo-card p-4">
          <h3 className="text-sm font-semibold text-surface-300 mb-3">Sales by Category</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={by_category} dataKey="total" nameKey="category" cx="50%" cy="50%" outerRadius={80} label={({ category, percent }) => `${category} ${(percent*100).toFixed(0)}%`} labelLine={false} fontSize={10}>
                {by_category?.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={v => fmtCurrency(v)} contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', fontSize: '12px' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="neo-card p-4">
        <h3 className="text-sm font-semibold text-surface-300 mb-3">By Payment Method</h3>
        <div className="space-y-2">
          {by_payment?.map(p => (
            <div key={p.payment_method} className="flex items-center gap-3">
              <div className="w-28 text-xs text-surface-400 flex-shrink-0">{p.payment_method}</div>
              <div className="flex-1 progress-bar h-2">
                <div className="progress-fill bg-brand-500" style={{ width: `${by_payment[0]?.total > 0 ? (p.total / by_payment[0].total) * 100 : 0}%` }} />
              </div>
              <div className="font-mono text-xs text-white w-28 text-right">{fmtCurrency(p.total)}</div>
              <div className="text-xs text-surface-500 w-12 text-right">{p.count} txn</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TableReport({ data, columns }) {
  if (!Array.isArray(data)) return null;
  return (
    <div className="table-container">
      <table className="data-table">
        <thead><tr>{columns.map(c => <th key={c.key}>{c.label}</th>)}</tr></thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i}>{columns.map(c => <td key={c.key}>{c.format ? c.format(row[c.key]) : row[c.key] ?? '—'}</td>)}</tr>
          ))}
          {!data.length && <tr><td colSpan={columns.length} className="text-center text-surface-500 py-8">No data for this period</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

export default function Reports() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [reportType, setReportType] = useState(searchParams.get('type') || 'sales');
  const [from, setFrom] = useState(() => searchParams.get('from') || (() => { const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0]; })());
  const [to, setTo] = useState(() => searchParams.get('to') || new Date().toISOString().split('T')[0]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  // Sync state back to URL for shareability (optional, but good practice)
  const handleSetReportType = (type) => {
    setReportType(type);
    searchParams.set('type', type);
    setSearchParams(searchParams);
  };

  const loadReport = async () => {
    setLoading(true); setData(null);
    try {
      let result;
      if (reportType === 'sales') result = await api.get(`/reports/sales?from=${from}&to=${to}`);
      else if (reportType === 'inventory') result = await api.get('/reports/inventory-valuation');
      else if (reportType === 'slow-moving') result = await api.get('/reports/slow-moving?days=60');
      else if (reportType === 'profit-loss') result = await api.get(`/reports/profit-loss?from=${from}&to=${to}`);
      else if (reportType === 'customer-outstanding') result = await api.get('/reports/customer-outstanding');
      else if (reportType === 'preorders') result = await api.get(`/reports/preorders?from=${from}&to=${to}`);
      else if (reportType === 'quotations') result = await api.get(`/reports/quotations?from=${from}&to=${to}`);
      setData(result);
    } catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (searchParams.get('autoLoad') === 'true') {
      loadReport();
    }
  }, []); // Run once on mount if autoLoad is present

  const renderReport = () => {
    if (loading) return <div className="space-y-3">{Array(5).fill(0).map((_, i) => <div key={i} className="neo-card h-20 shimmer" />)}</div>;
    if (!data) return <div className="neo-card p-12 text-center text-surface-500">Select a report and click Generate</div>;

    if (reportType === 'sales') return <SalesReport data={data} />;
    if (reportType === 'inventory') return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="stat-card"><div className="text-xl font-mono font-bold text-emerald-400">{fmtCurrency(data.totals?.grand_selling)}</div><div className="text-xs text-surface-400">Total Selling Value</div></div>
          <div className="stat-card"><div className="text-xl font-mono font-bold text-brand-400">{fmtCurrency(data.totals?.grand_cost)}</div><div className="text-xs text-surface-400">Total Cost Value</div></div>
        </div>
        <TableReport data={data.by_category} columns={[
          { key: 'category', label: 'Category' },
          { key: 'product_count', label: 'Products' },
          { key: 'total_cost_value', label: 'Cost Value', format: fmtCurrency },
          { key: 'total_selling_value', label: 'Selling Value', format: fmtCurrency },
          { key: 'potential_profit', label: 'Potential Profit', format: fmtCurrency },
        ]} />
      </div>
    );
    if (reportType === 'slow-moving') return (
      <TableReport data={data} columns={[
        { key: 'sku', label: 'SKU' }, { key: 'name', label: 'Product' },
        { key: 'category', label: 'Category' }, { key: 'stock_qty', label: 'Stock' },
        { key: 'stock_value', label: 'Stock Value', format: fmtCurrency },
        { key: 'last_sale_date', label: 'Last Sold', format: fmtDate },
      ]} />
    );
    if (reportType === 'profit-loss') return (
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <div className="stat-card"><div className="text-xl font-mono font-bold text-white">{fmtCurrency(data.totals?.total_revenue)}</div><div className="text-xs text-surface-400">Total Revenue</div></div>
          <div className="stat-card"><div className="text-xl font-mono font-bold text-red-400">{fmtCurrency(data.totals?.total_cogs)}</div><div className="text-xs text-surface-400">Cost of Goods</div></div>
          <div className="stat-card"><div className="text-xl font-mono font-bold text-emerald-400">{fmtCurrency(data.totals?.total_gross_profit)}</div><div className="text-xs text-surface-400">Gross Profit</div></div>
        </div>
        <TableReport data={data.by_category} columns={[
          { key: 'category', label: 'Category' },
          { key: 'revenue', label: 'Revenue', format: fmtCurrency },
          { key: 'cogs', label: 'COGS', format: fmtCurrency },
          { key: 'gross_profit', label: 'Gross Profit', format: fmtCurrency },
        ]} />
      </div>
    );
    if (reportType === 'customer-outstanding') return (
      <TableReport data={data} columns={[
        { key: 'name', label: 'Customer' }, { key: 'phone', label: 'Phone' },
        { key: 'company', label: 'Company' }, { key: 'type', label: 'Type' },
        { key: 'outstanding_balance', label: 'Outstanding', format: fmtCurrency },
        { key: 'credit_limit', label: 'Credit Limit', format: fmtCurrency },
        { key: 'last_purchase_date', label: 'Last Purchase', format: fmtDate },
      ]} />
    );
    if (reportType === 'preorders') return (
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <div className="stat-card"><div className="text-xl font-mono font-bold text-white">{data.summary?.open || 0}</div><div className="text-xs text-surface-400">Open Preorders</div></div>
          <div className="stat-card"><div className="text-xl font-mono font-bold text-emerald-400">{fmtCurrency(data.summary?.advance_held)}</div><div className="text-xs text-surface-400">Advance Held</div></div>
          <div className="stat-card"><div className="text-xl font-mono font-bold text-red-400">{fmtCurrency(data.summary?.due_to_collect)}</div><div className="text-xs text-surface-400">Due to Collect</div></div>
        </div>
        <TableReport data={data.preorders} columns={[
          { key: 'preorder_no', label: 'PRE No' }, { key: 'customer_name', label: 'Customer' },
          { key: 'total_amount', label: 'Total', format: fmtCurrency },
          { key: 'advance_paid', label: 'Advance', format: fmtCurrency },
          { key: 'due_balance', label: 'Due', format: fmtCurrency },
          { key: 'delivery_date', label: 'Delivery', format: fmtDate },
          { key: 'status', label: 'Status' },
        ]} />
      </div>
    );
    if (reportType === 'quotations') return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="stat-card"><div className="text-xl font-mono font-bold text-white">{data.summary?.total || 0}</div><div className="text-xs text-surface-400">Total Quotations</div></div>
          <div className="stat-card"><div className="text-xl font-mono font-bold text-emerald-400">{((data.summary?.converted / data.summary?.total) * 100 || 0).toFixed(1)}%</div><div className="text-xs text-surface-400">Conversion Rate</div></div>
          <div className="stat-card"><div className="text-xl font-mono font-bold text-amber-400">{data.summary?.pending || 0}</div><div className="text-xs text-surface-400">Pending Quotes</div></div>
          <div className="stat-card"><div className="text-xl font-mono font-bold text-red-400">{data.summary?.cancelled || 0}</div><div className="text-xs text-surface-400">Cancelled</div></div>
        </div>
        <TableReport data={data.list} columns={[
          { key: 'quotation_no', label: 'QT No' },
          { key: 'customer_name', label: 'Customer' },
          { key: 'grand_total', label: 'Total', format: fmtCurrency },
          { key: 'created_at', label: 'Date', format: fmtDate },
          { key: 'status', label: 'Status' },
        ]} />
      </div>
    );
    return null;
  };

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div><h1 className="page-title">Reports</h1><p className="page-subtitle">Business analytics and financial reports</p></div>
      </div>

      <div className="neo-card p-4 mb-5">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex flex-wrap gap-2">
            {REPORT_TYPES.map(r => (
              <button key={r.id} onClick={() => handleSetReportType(r.id)} className={`btn-sm ${reportType === r.id ? 'btn-primary' : 'btn-secondary'}`}>
                <r.icon className="w-3.5 h-3.5" />{r.label}
              </button>
            ))}
          </div>
          <div className="flex gap-2 ml-auto">
            <div><label className="label">From</label><input type="date" className="input-field" value={from} onChange={e => setFrom(e.target.value)} /></div>
            <div><label className="label">To</label><input type="date" className="input-field" value={to} onChange={e => setTo(e.target.value)} /></div>
            <div className="flex items-end">
              <button onClick={loadReport} disabled={loading} className="btn-primary">
                {loading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><RefreshCw className="w-4 h-4" /> Generate</>}
              </button>
            </div>
          </div>
        </div>
      </div>

      {renderReport()}
    </div>
  );
}
