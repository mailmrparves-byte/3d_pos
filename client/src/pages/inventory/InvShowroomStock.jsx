import React, { useState, useEffect } from 'react';
import { api } from '../../utils/api';
import { Store } from 'lucide-react';
import ExportButtons from '../../components/ExportButtons';
import toast from 'react-hot-toast';

export default function InvShowroomStock() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { api.get('/inventory/showroom-stock').then(setData).catch(() => toast.error('Failed')).finally(() => setLoading(false)); }, []);

  const grouped = {};
  data.forEach(d => { if (!grouped[d.location_name]) grouped[d.location_name] = []; grouped[d.location_name].push(d); });

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#10b981,#059669)' }}>
            <Store className="w-5 h-5 text-white" />
          </div>
          <div><h2 className="text-lg font-bold text-white">Showroom Stock</h2><p className="text-xs text-surface-400">Distributed stock per outlet</p></div>
        </div>
        <ExportButtons 
          title="Showroom Stock Report"
          columns={['Location', 'SKU', 'Product', 'Brand', 'Qty', 'Total Qty']}
          data={data.map(p => [p.location_name, p.sku, p.name, p.brand||'—', p.location_qty, p.total_qty])}
        />
      </div>
      {loading ? <div className="space-y-3">{Array(3).fill(0).map((_,i)=><div key={i} className="h-16 shimmer rounded-xl"/>)}</div> :
      Object.keys(grouped).length === 0 ? <div className="text-center text-surface-500 py-12">No showroom stock distributed yet</div> :
      Object.entries(grouped).map(([loc, items]) => (
        <div key={loc} className="mb-6">
          <h3 className="text-sm font-bold text-surface-200 mb-3 flex items-center gap-2"><Store className="w-4 h-4 text-emerald-400" />{loc}</h3>
          <div className="table-container"><div className="overflow-x-auto"><table className="data-table"><thead><tr>
            <th>SKU</th><th>Product</th><th>Brand</th><th>Qty at {loc}</th><th>Total Qty</th>
          </tr></thead><tbody>
            {items.map(p => (
              <tr key={`${p.id}-${p.location_id}`}>
                <td><span className="font-mono text-xs text-brand-400">{p.sku}</span></td>
                <td><span className="text-sm text-surface-100">{p.name}</span></td>
                <td><span className="text-xs text-surface-400">{p.brand||'—'}</span></td>
                <td><span className="font-mono font-bold text-emerald-400">{p.location_qty}</span></td>
                <td><span className="font-mono text-surface-300">{p.total_qty}</span></td>
              </tr>
            ))}
          </tbody></table></div></div>
        </div>
      ))}
    </div>
  );
}
