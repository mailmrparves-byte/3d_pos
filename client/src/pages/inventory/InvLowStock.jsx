import React, { useState, useEffect } from 'react';
import { api, fmtCurrency, statusLabel } from '../../utils/api';
import { AlertTriangle, ShoppingCart } from 'lucide-react';
import ExportButtons from '../../components/ExportButtons';
import toast from 'react-hot-toast';

export default function InvLowStock() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/products/low-stock').then(setProducts).catch(() => toast.error('Failed')).finally(() => setLoading(false));
  }, []);

  const stockColor = (s) => ({ low:'text-amber-400', critical:'text-orange-400', out:'text-red-400' }[s] || 'text-surface-400');

  return (
    <>
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)' }}>
            <AlertTriangle className="w-5 h-5 text-white" />
          </div>
          <div><h2 className="text-lg font-bold text-white">Low Stock</h2><p className="text-xs text-surface-400">{products.length} products need attention</p></div>
        </div>
        <ExportButtons 
          title="Low Stock Report"
          columns={['SKU', 'Product', 'Stock', 'Threshold', 'Brand', 'Category', 'Price', 'Status']}
          data={products.map(p => [p.sku, p.name, p.stock_qty, p.low_stock_threshold, p.brand||'—', p.category, fmtCurrency(p.selling_price), statusLabel(p.stock_status)])}
        />
      </div>
      {loading ? <div className="space-y-3">{Array(4).fill(0).map((_,i)=><div key={i} className="h-20 shimmer rounded-xl"/>)}</div> :
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {products.map(p => (
          <div key={p.id} className="neo-card p-4 flex flex-col gap-3">
            <div className="flex items-start justify-between">
              <div><div className="font-medium text-surface-100 text-sm">{p.name}</div><div className="text-xs text-surface-500 font-mono">{p.sku}</div></div>
              <span className={`font-mono font-bold text-lg ${stockColor(p.stock_status)}`}>{p.stock_qty}</span>
            </div>
            <div className="flex items-center justify-between text-xs text-surface-400">
              <span>Threshold: {p.low_stock_threshold}</span>
              <span>{p.brand} · {p.category}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-mono">{fmtCurrency(p.selling_price)}</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${p.stock_status==='out'?'bg-red-500/15 text-red-400':p.stock_status==='critical'?'bg-orange-500/15 text-orange-400':'bg-amber-500/15 text-amber-400'}`}>
                {p.stock_status === 'out' ? 'Out of Stock' : p.stock_status === 'critical' ? 'Critical' : 'Low'}
              </span>
            </div>
          </div>
        ))}
        {!products.length && <div className="col-span-3 text-center text-surface-500 py-12">All products are well stocked 🎉</div>}
      </div>}
    </>
  );
}
