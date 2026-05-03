import React, { useState, useEffect } from 'react';
import { api, fmtCurrency, fmtDateTime, statusBadge, statusLabel } from '../utils/api';
import { X, Download, Printer } from 'lucide-react';
import toast from 'react-hot-toast';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { printHtmlInvoice } from '../utils/printInvoice';

export default function SaleDetail({ id, onClose }) {
  const [data, setData] = useState(null);
  const [settings, setSettings] = useState(null);
  
  useEffect(() => {
    api.get(`/sales/${id}`).then(setData).catch(() => toast.error('Failed to load invoice'));
    api.get('/settings').then(setSettings).catch(() => console.warn('Failed to load settings'));
  }, [id]);

  const handlePrint = (action) => {
    if (!data || !settings) return;
    printHtmlInvoice(data, settings, action);
  };

  if (!data) return <div className="modal-overlay"><div className="modal-content p-8 text-center"><div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto" /></div></div>;

  return (
    <div className="modal-overlay z-50" onClick={onClose}>
      <div className="modal-content p-6 max-w-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-white">Invoice: {data.invoice_no}</h2>
          <div className="flex gap-2">
            <button onClick={() => handlePrint('download')} className="btn-secondary btn-sm"><Download className="w-4 h-4" /> Download</button>
            <button onClick={() => handlePrint('print')} className="btn-primary btn-sm"><Printer className="w-4 h-4" /> Print</button>
            <button onClick={onClose} className="btn-ghost btn-icon btn-sm ml-2"><X className="w-4 h-4" /></button>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4 mb-6 text-sm bg-surface-800/30 p-4 rounded-xl border border-surface-700/50">
          <div>
            <div className="text-surface-400 font-semibold text-xs mb-1 uppercase tracking-wider">Customer</div>
            <div className="font-medium text-white text-base">{data.customer_name || 'Walk-in'}</div>
            {data.customer_phone && <div className="text-surface-300 mt-0.5">{data.customer_phone}</div>}
          </div>
          <div>
            <div className="text-surface-400 font-semibold text-xs mb-1 uppercase tracking-wider">Date</div>
            <div className="text-white text-base">{fmtDateTime(data.created_at)}</div>
            <div className="text-surface-400 font-semibold text-xs mt-3 mb-1 uppercase tracking-wider">Payment / Status</div>
            <div className="text-white flex items-center gap-2 text-base">
              {data.payment_method} <span className={statusBadge(data.status)}>{statusLabel(data.status)}</span>
            </div>
          </div>
        </div>

        <div className="mb-4">
          <div className="text-sm font-semibold text-white uppercase tracking-wider mb-2">Items</div>
          <div className="border border-surface-700 rounded-lg overflow-hidden shadow-sm">
            <table className="data-table w-full">
              <thead><tr className="bg-surface-800"><th className="py-3 px-4 text-surface-200 font-semibold">Item</th><th className="py-3 px-4 text-surface-200 font-semibold text-center">Qty</th><th className="py-3 px-4 text-surface-200 font-semibold text-right">Price</th><th className="py-3 px-4 text-surface-200 font-semibold text-right">Total</th></tr></thead>
              <tbody>
                {data.items?.map((item, idx) => (
                  <tr key={idx} className="border-t border-surface-700 hover:bg-surface-800/50 transition-colors">
                    <td className="py-3 px-4">
                      <div className="text-white font-medium">{item.product_name}</div>
                      {item.discount_pct > 0 && <div className="text-xs text-amber-400 font-medium mt-0.5">Discount: {item.discount_pct}%</div>}
                    </td>
                    <td className="py-3 px-4 text-center font-mono text-white text-sm">{item.quantity}</td>
                    <td className="py-3 px-4 text-right font-mono text-white text-sm">{fmtCurrency(item.unit_price)}</td>
                    <td className="py-3 px-4 text-right font-mono text-emerald-400 font-bold text-sm">{fmtCurrency(item.line_total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex justify-end text-sm mt-6">
          <div className="w-72 space-y-2.5 bg-surface-800/40 p-4 rounded-xl border border-surface-700/50">
            <div className="flex justify-between text-surface-200 font-medium"><span className="uppercase tracking-wide text-xs mt-0.5 text-surface-400">Subtotal:</span> <span className="font-mono text-white">{fmtCurrency(data.subtotal)}</span></div>
            <div className="flex justify-between text-surface-200 font-medium"><span className="uppercase tracking-wide text-xs mt-0.5 text-surface-400">Discount:</span> <span className="font-mono text-white">{fmtCurrency(data.discount)}</span></div>
            {parseFloat(data.delivery_charge) > 0 && (
              <div className="flex justify-between text-surface-200 font-medium"><span className="uppercase tracking-wide text-xs mt-0.5 text-surface-400">Delivery Charge:</span> <span className="font-mono text-white">{fmtCurrency(data.delivery_charge)}</span></div>
            )}
            <div className="section-divider my-3 border-surface-600" />
            <div className="flex justify-between text-white font-bold text-lg items-center"><span className="uppercase tracking-wide text-xs text-surface-300">Grand Total:</span> <span className="font-mono text-emerald-400">{fmtCurrency(data.grand_total)}</span></div>
            {data.is_preorder && (
               <>
                 <div className="flex justify-between text-brand-400 text-sm mt-3 font-medium"><span>Advance Paid:</span> <span className="font-mono text-brand-300">{fmtCurrency(data.amount_received)}</span></div>
                 <div className="flex justify-between text-red-400 font-bold text-sm mt-1"><span>Due Balance:</span> <span className="font-mono text-red-400">{fmtCurrency(data.change_due || (data.grand_total - data.amount_received))}</span></div>
               </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
