import React, { useState, useEffect } from 'react';
import { AlertTriangle, Trash2, X, Shield } from 'lucide-react';
import { api } from '../utils/api';

/*
  Usage:
    <DeleteConfirmModal
      type="product"             // 'product' | 'customer' | 'sale'
      id={123}                   // record id
      name="Some Item"           // display name
      onConfirm={() => {...}}    // called after user confirms
      onClose={() => {...}}      // called on cancel
      critical={false}           // if true, user must type DELETE
    />
*/

const impactEndpoints = {
  product:  (id) => `/products/${id}/delete-impact`,
  customer: (id) => `/customers/${id}/delete-impact`,
  sale:     (id) => `/sales/${id}/delete-impact`,
};

function ImpactLine({ label, count, danger }) {
  if (!count) return null;
  return (
    <div className="flex items-center justify-between py-1.5 px-3 rounded-lg" style={{ backgroundColor: danger ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.03)' }}>
      <span className="text-sm text-surface-300">{label}</span>
      <span className={`font-mono font-bold text-sm ${danger ? 'text-red-400' : 'text-amber-400'}`}>{count}</span>
    </div>
  );
}

export default function DeleteConfirmModal({ type, id, name, onConfirm, onClose, critical = false }) {
  const [impact, setImpact] = useState(null);
  const [loading, setLoading] = useState(true);
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const loadImpact = async () => {
      try {
        const ep = impactEndpoints[type];
        if (ep) {
          const data = await api.get(ep(id));
          setImpact(data);
        }
      } catch {
        setImpact(null);
      } finally {
        setLoading(false);
      }
    };
    loadImpact();
  }, [type, id]);

  const hasCriticalImpact = impact && (
    (impact.linkedSales > 0) ||
    (impact.outstandingBalance > 0) ||
    (impact.hasPreorder)
  );
  const requiresTyping = critical || hasCriticalImpact;
  const canConfirm = requiresTyping ? confirmText === 'DELETE' : true;

  const handleConfirm = async () => {
    setDeleting(true);
    try {
      await onConfirm();
    } finally {
      setDeleting(false);
    }
  };

  const renderImpact = () => {
    if (!impact) return null;
    const lines = [];
    if (type === 'product') {
      lines.push({ label: 'Linked sale records', count: impact.linkedSales, danger: true });
      lines.push({ label: 'Active group buys', count: impact.linkedGroupBuys, danger: true });
    } else if (type === 'customer') {
      lines.push({ label: 'Linked sales', count: impact.linkedSales, danger: true });
      lines.push({ label: 'Active preorders', count: impact.linkedPreorders, danger: true });
      if (impact.outstandingBalance > 0) lines.push({ label: 'Outstanding balance (৳)', count: impact.outstandingBalance.toLocaleString(), danger: true });
    } else if (type === 'sale') {
      lines.push({ label: 'Sale items', count: impact.linkedItems });
      if (impact.hasPreorder) lines.push({ label: `Preorder (${impact.preorderStatus})`, count: 1, danger: true });
    }
    return lines.filter(l => l.count).map((l, i) => <ImpactLine key={i} {...l} />);
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 9999 }}>
      <div className="modal-content p-0" style={{ maxWidth: '440px' }}>
        {/* Header */}
        <div className="flex items-center gap-3 p-5 pb-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)', boxShadow: '0 4px 14px rgba(239,68,68,0.4)' }}>
            <AlertTriangle className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-bold text-white">Confirm Delete</h2>
            <p className="text-xs text-surface-400 mt-0.5">This action moves the item to trash</p>
          </div>
          <button onClick={onClose} className="btn-ghost btn-icon btn-sm"><X className="w-4 h-4" /></button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* What's being deleted */}
          <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)' }}>
            <Trash2 className="w-5 h-5 text-red-400 flex-shrink-0" />
            <div>
              <div className="text-sm font-semibold text-surface-100">{name || 'Unknown'}</div>
              <div className="text-xs text-surface-400 capitalize">{type}</div>
            </div>
          </div>

          {/* Impact */}
          {loading ? (
            <div className="space-y-2">
              <div className="h-8 shimmer rounded-lg" />
              <div className="h-8 shimmer rounded-lg" />
            </div>
          ) : (
            <>
              {renderImpact()?.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-xs font-bold uppercase tracking-wider text-surface-500 mb-2">
                    <Shield className="w-3 h-3 inline mr-1" />Related Records Affected
                  </div>
                  {renderImpact()}
                </div>
              )}
            </>
          )}

          {/* Typing confirmation for critical */}
          {requiresTyping && (
            <div>
              <label className="label text-red-400 text-xs">
                Type <span className="font-mono font-bold">DELETE</span> to confirm
              </label>
              <input
                className="input-field mt-1 font-mono text-center text-sm tracking-widest"
                placeholder="DELETE"
                value={confirmText}
                onChange={e => setConfirmText(e.target.value.toUpperCase())}
                autoFocus
                style={{ borderColor: confirmText === 'DELETE' ? '#10b981' : undefined }}
              />
            </div>
          )}

          {/* Info notice */}
          <div className="text-xs text-surface-500 flex items-start gap-2 p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.02)' }}>
            <span className="text-blue-400 mt-0.5">ℹ</span>
            <span>Deleted items are moved to Trash and can be restored within 30 days. After 30 days, they are permanently removed.</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 justify-end p-5 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button
            onClick={handleConfirm}
            disabled={!canConfirm || deleting || loading}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all duration-200 flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: canConfirm ? 'linear-gradient(135deg, #ef4444, #dc2626)' : 'rgba(239,68,68,0.2)',
              boxShadow: canConfirm ? '0 4px 14px rgba(239,68,68,0.35)' : 'none',
            }}
          >
            <Trash2 className="w-4 h-4" />
            {deleting ? 'Deleting...' : 'Move to Trash'}
          </button>
        </div>
      </div>
    </div>
  );
}
