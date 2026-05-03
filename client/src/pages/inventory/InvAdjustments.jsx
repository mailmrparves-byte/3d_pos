import React, { useState, useEffect } from 'react';
import { api, fmtDateTime } from '../../utils/api';
import { ClipboardList } from 'lucide-react';
import ExportButtons from '../../components/ExportButtons';
import toast from 'react-hot-toast';

export default function InvAdjustments() {
  const [adjustments, setAdjustments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/inventory/adjustments?limit=200').then(setAdjustments).catch(() => toast.error('Failed')).finally(() => setLoading(false));
  }, []);

  const typeColor = (t) => ({ add:'text-emerald-400', purchase:'text-emerald-400', remove:'text-red-400', damage:'text-orange-400', loss:'text-red-400', return:'text-blue-400', transfer:'text-cyan-400' }[t] || 'text-surface-400');

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#a855f7,#7c3aed)' }}>
            <ClipboardList className="w-5 h-5 text-white" />
          </div>
          <div><h2 className="text-lg font-bold text-white">Stock Adjustments</h2><p className="text-xs text-surface-400">{adjustments.length} adjustment records</p></div>
        </div>
        <ExportButtons 
          title="Stock Adjustment Log"
          columns={['Date', 'Product', 'SKU', 'Type', 'Qty', 'Reason', 'By']}
          data={adjustments.map(a => [fmtDateTime(a.created_at), a.product_name || '—', a.sku || '—', a.adjustment_type, a.quantity, a.reason || '—', a.user_name || '—'])}
        />
      </div>
      <div className="table-container"><div className="overflow-x-auto"><table className="data-table"><thead><tr>
        <th>Date</th><th>Product</th><th>SKU</th><th>Type</th><th>Qty</th><th>Reason</th><th>By</th>
      </tr></thead><tbody>
        {loading ? Array(5).fill(0).map((_,i) => <tr key={i}>{Array(7).fill(0).map((_,j) => <td key={j}><div className="h-4 shimmer rounded" /></td>)}</tr>) :
        adjustments.map(a => (
          <tr key={a.id}>
            <td><span className="text-xs text-surface-400">{fmtDateTime(a.created_at)}</span></td>
            <td><span className="text-sm text-surface-100">{a.product_name || '—'}</span></td>
            <td><span className="font-mono text-xs text-brand-400">{a.sku || '—'}</span></td>
            <td><span className={`text-xs font-semibold capitalize ${typeColor(a.adjustment_type)}`}>{a.adjustment_type}</span></td>
            <td><span className="font-mono font-bold text-surface-200">{a.quantity}</span></td>
            <td><span className="text-xs text-surface-400">{a.reason || '—'}</span></td>
            <td><span className="text-xs text-surface-400">{a.user_name || '—'}</span></td>
          </tr>
        ))}
        {!loading && !adjustments.length && <tr><td colSpan={7} className="text-center text-surface-500 py-12">No adjustments recorded</td></tr>}
      </tbody></table></div></div>
    </div>
  );
}
