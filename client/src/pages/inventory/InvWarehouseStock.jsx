import React, { useState, useEffect } from 'react';
import { api } from '../../utils/api';
import { Warehouse } from 'lucide-react';
import ExportButtons from '../../components/ExportButtons';
import toast from 'react-hot-toast';

export default function InvWarehouseStock() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { api.get('/inventory/warehouse-stock').then(setData).catch(() => toast.error('Failed')).finally(() => setLoading(false)); }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#f97316,#ea580c)' }}>
            <Warehouse className="w-5 h-5 text-white" />
          </div>
          <div><h2 className="text-lg font-bold text-white">Warehouse Stock</h2><p className="text-xs text-surface-400">Primary stock location — all incoming stock received here</p></div>
        </div>
        <ExportButtons 
          title="Warehouse Stock Report"
          columns={['SKU', 'Product', 'Brand', 'Category', 'Warehouse Qty', 'Total Qty']}
          data={data.map(p => [p.sku, p.name, p.brand||'—', p.category, p.warehouse_qty, p.total_qty])}
        />
      </div>
      <div className="table-container"><div className="overflow-x-auto"><table className="data-table"><thead><tr>
        <th>SKU</th><th>Product</th><th>Brand</th><th>Category</th><th>Warehouse Qty</th><th>Total Qty</th>
      </tr></thead><tbody>
        {loading ? Array(5).fill(0).map((_,i) => <tr key={i}>{Array(6).fill(0).map((_,j) => <td key={j}><div className="h-4 shimmer rounded" /></td>)}</tr>) :
        data.map(p => (
          <tr key={p.id}>
            <td><span className="font-mono text-xs text-brand-400">{p.sku}</span></td>
            <td><span className="text-sm text-surface-100">{p.name}</span></td>
            <td><span className="text-xs text-surface-400">{p.brand||'—'}</span></td>
            <td><span className="text-xs text-surface-400">{p.category}</span></td>
            <td><span className="font-mono font-bold text-orange-400">{p.warehouse_qty}</span></td>
            <td><span className="font-mono text-surface-300">{p.total_qty}</span></td>
          </tr>
        ))}
        {!loading && !data.length && <tr><td colSpan={6} className="text-center text-surface-500 py-12">No warehouse stock data</td></tr>}
      </tbody></table></div></div>
    </div>
  );
}
