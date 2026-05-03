import React, { useState, useEffect } from 'react';
import { api, fmtDateTime } from '../utils/api';
import { Trash2, RotateCcw, AlertTriangle, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Trash() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      setLoading(true);
      const data = await api.get('/trash');
      setItems(data);
    } catch (err) { toast.error('Failed to load trash bin'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleRestore = async (table, id) => {
    try {
      await api.post(`/trash/${table}/${id}/restore`);
      toast.success('Record restored successfully');
      load();
    } catch (err) { toast.error(err.message); }
  };

  const handlePermanentDelete = async (table, id) => {
    const code = prompt('WARNING: This action cannot be undone. Type "DELETE" to confirm permanent deletion:');
    if (code !== 'DELETE') {
      if (code !== null) toast.error('Confirmation failed. Record not deleted.');
      return;
    }
    
    try {
      await api.delete(`/trash/${table}/${id}/permanent`, { confirm: 'DELETE' });
      toast.success('Record permanently deleted');
      load();
    } catch (err) { toast.error(err.message); }
  };

  const handleEmptyTrash = async () => {
    if (!confirm('This will purge all items older than 30 days. Are you sure?')) return;
    try {
      const res = await api.delete('/trash/empty');
      toast.success(`Purged ${res.purged} old records`);
      load();
    } catch (err) { toast.error(err.message); }
  };

  const formatTable = (table) => {
    if (table === 'products') return 'Product';
    if (table === 'customers') return 'Customer';
    if (table === 'sales') return 'Sale';
    return table;
  };

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title text-red-400 flex items-center gap-2">
            <Trash2 className="w-6 h-6" /> Trash Bin
          </h1>
          <p className="page-subtitle">Restore soft-deleted records or permanently delete them</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="btn-secondary btn-sm"><RefreshCw className="w-4 h-4" /> Refresh</button>
          <button onClick={handleEmptyTrash} className="btn-danger btn-sm"><AlertTriangle className="w-4 h-4" /> Empty Old Trash</button>
        </div>
      </div>

      <div className="table-container">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Module</th>
                <th>Record ID</th>
                <th>Item / Reference</th>
                <th>Deleted By</th>
                <th>Deleted At</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? Array(5).fill(0).map((_, i) => (
                <tr key={i}>{Array(6).fill(0).map((_, j) => <td key={j}><div className="h-4 shimmer rounded" /></td>)}</tr>
              )) : items.map((item) => (
                <tr key={`${item.table_name}-${item.record_id}`}>
                  <td><span className="badge badge-gray capitalize">{formatTable(item.table_name)}</span></td>
                  <td><span className="font-mono text-xs text-surface-400">{item.record_id}</span></td>
                  <td><span className="font-medium text-white">{item.name_or_ref || '—'}</span></td>
                  <td><span className="text-xs text-surface-400">{item.deleted_by_name || 'System'}</span></td>
                  <td><span className="text-xs text-surface-400">{fmtDateTime(item.deleted_at)}</span></td>
                  <td>
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => handleRestore(item.table_name, item.record_id)} className="btn-success btn-sm">
                        <RotateCcw className="w-3.5 h-3.5" /> Restore
                      </button>
                      <button onClick={() => handlePermanentDelete(item.table_name, item.record_id)} className="btn-danger btn-sm">
                        <Trash2 className="w-3.5 h-3.5" /> Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && !items.length && (
                <tr>
                  <td colSpan={6} className="text-center text-surface-500 py-12">
                    <Trash2 className="w-8 h-8 text-surface-700 mx-auto mb-3" />
                    Trash is empty
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
