import React, { useState, useEffect } from 'react';
import { api, fmtCurrency } from '../../utils/api';
import { Clock } from 'lucide-react';
import ExportButtons from '../../components/ExportButtons';
import toast from 'react-hot-toast';

export default function InvSlowMoving() {
  const [products, setProducts] = useState([]);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api.get(`/reports/slow-moving?days=${days}`).then(setProducts).catch(() => toast.error('Failed')).finally(() => setLoading(false));
  };
  useEffect(load, [days]);

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#8b5cf6,#6d28d9)' }}>
            <Clock className="w-5 h-5 text-white" />
          </div>
          <div><h2 className="text-lg font-bold text-white">Slow Moving</h2><p className="text-xs text-surface-400">{products.length} products with no sales in {days} days</p></div>
        </div>
        <div className="flex items-center gap-2">
          {[30,60,90].map(d => (
            <button key={d} onClick={() => setDays(d)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${days===d?'bg-brand-500 text-white':'bg-surface-700 text-surface-300 hover:bg-surface-600'}`}>{d} Days</button>
          ))}
          <div className="w-px h-6 bg-surface-700 mx-1" />
          <ExportButtons 
            title="Slow Moving Report"
            columns={['SKU', 'Product', 'Brand', 'Category', 'Stock', 'Price', `Sold (${days}d)`]}
            data={products.map(p => [p.sku, p.name, p.brand||'—', p.category, p.stock_qty, fmtCurrency(p.selling_price), p.total_sold_period || 0])}
            filters={{ Days: days }}
          />
        </div>
      </div>
      <div className="table-container"><div className="overflow-x-auto"><table className="data-table"><thead><tr>
        <th>SKU</th><th>Product</th><th>Brand</th><th>Category</th><th>Stock</th><th>Price</th><th>Sold ({days}d)</th>
      </tr></thead><tbody>
        {loading ? Array(5).fill(0).map((_,i) => <tr key={i}>{Array(7).fill(0).map((_,j) => <td key={j}><div className="h-4 shimmer rounded" /></td>)}</tr>) :
        products.map(p => (
          <tr key={p.id}>
            <td><span className="font-mono text-xs text-brand-400">{p.sku}</span></td>
            <td><span className="text-sm text-surface-100">{p.name}</span></td>
            <td><span className="text-xs text-surface-400">{p.brand||'—'}</span></td>
            <td><span className="text-xs text-surface-400">{p.category}</span></td>
            <td><span className="font-mono font-bold text-surface-200">{p.stock_qty}</span></td>
            <td><span className="font-mono text-sm">{fmtCurrency(p.selling_price)}</span></td>
            <td><span className="font-mono text-xs text-red-400">{p.total_sold_period || 0}</span></td>
          </tr>
        ))}
        {!loading && !products.length && <tr><td colSpan={7} className="text-center text-surface-500 py-12">No slow-moving products 🎉</td></tr>}
      </tbody></table></div></div>
    </div>
  );
}
