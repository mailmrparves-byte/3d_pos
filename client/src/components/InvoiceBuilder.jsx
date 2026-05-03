import React, { useState, useEffect } from 'react';

function Toggle({ checked, onChange, label }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer">
      <div className="relative">
        <input type="checkbox" className="sr-only" checked={checked} onChange={e => onChange(e.target.checked)} />
        <div className={`w-9 h-5 rounded-full transition-colors duration-300 ${checked ? 'bg-brand-600' : 'bg-surface-700'}`} />
        <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform duration-300 ${checked ? 'translate-x-4' : ''}`} />
      </div>
      {label && <span className="text-sm text-surface-300">{label}</span>}
    </label>
  );
}

export default function InvoiceBuilder({ settings, onChange }) {
  const [layout, setLayout] = useState(() => {
    try {
      return JSON.parse(settings.invoice_layout || '["header", "customer", "items", "totals", "footer"]');
    } catch {
      return ["header", "customer", "items", "totals", "footer"];
    }
  });

  const blocks = {
    header: 'Company Header & Logo',
    customer: 'Customer Details',
    items: 'Items Table',
    totals: 'Totals & Summary',
    footer: 'Terms & Footer'
  };

  const handleDragStart = (e, index) => {
    e.dataTransfer.setData('blockIndex', index);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e, targetIndex) => {
    const sourceIndex = e.dataTransfer.getData('blockIndex');
    if (sourceIndex === '') return;
    const newLayout = [...layout];
    const [movedBlock] = newLayout.splice(sourceIndex, 1);
    newLayout.splice(targetIndex, 0, movedBlock);
    setLayout(newLayout);
    onChange('invoice_layout', JSON.stringify(newLayout));
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div className="space-y-6">
        <div className="form-section">
          <h3 className="form-section-title">Branding Assets</h3>
          <div className="space-y-4">
            <div>
              <label className="label">Logo Image URL</label>
              <input className="input-field" placeholder="https://example.com/logo.png" value={settings.logo_url || ''} onChange={e => onChange('logo_url', e.target.value)} />
            </div>
            <div>
              <label className="label">Watermark Image URL</label>
              <input className="input-field" placeholder="https://example.com/watermark.png" value={settings.watermark_url || ''} onChange={e => onChange('watermark_url', e.target.value)} />
            </div>
            <div>
              <label className="label">Watermark Opacity (0.1 - 1.0)</label>
              <input type="number" step="0.1" min="0.1" max="1.0" className="input-field" value={settings.watermark_opacity || '0.1'} onChange={e => onChange('watermark_opacity', e.target.value)} />
            </div>
            <div>
              <label className="label">Primary Theme Color</label>
              <input type="color" className="input-field h-10 p-1 cursor-pointer" value={settings.color_theme || '#1e40af'} onChange={e => onChange('color_theme', e.target.value)} />
            </div>
          </div>
        </div>

        <div className="form-section">
          <h3 className="form-section-title">Terms & Footer Content</h3>
          <div className="space-y-4">
            <div className="p-3 bg-surface-800/50 rounded-lg border border-surface-700/50 space-y-3">
              <Toggle checked={settings.show_terms !== 'false'} onChange={v => onChange('show_terms', String(v))} label="Show Terms & Conditions" />
              {settings.show_terms !== 'false' && (
                <textarea className="input-field text-sm" rows={2} placeholder="Enter Terms & Conditions..." value={settings.terms_text || ''} onChange={e => onChange('terms_text', e.target.value)} />
              )}
            </div>

            <div className="p-3 bg-surface-800/50 rounded-lg border border-surface-700/50 space-y-3">
              <Toggle checked={settings.show_policy !== 'false'} onChange={v => onChange('show_policy', String(v))} label="Show Warranty & Return Policy" />
              {settings.show_policy !== 'false' && (
                <textarea className="input-field text-sm" rows={2} placeholder="Enter Warranty & Return Policy..." value={settings.return_policy || ''} onChange={e => onChange('return_policy', e.target.value)} />
              )}
            </div>

            <div className="p-3 bg-surface-800/50 rounded-lg border border-surface-700/50 space-y-3">
              <Toggle checked={settings.show_support !== 'false'} onChange={v => onChange('show_support', String(v))} label="Show Support Contact Information" />
              {settings.show_support !== 'false' && (
                <textarea className="input-field text-sm" rows={2} placeholder="e.g. For immediate support, call +880 1234-567890 or email support@example.com" value={settings.support_contact || ''} onChange={e => onChange('support_contact', e.target.value)} />
              )}
            </div>

            <div className="p-3 bg-surface-800/50 rounded-lg border border-surface-700/50 space-y-3">
              <Toggle checked={settings.show_footer_note !== 'false'} onChange={v => onChange('show_footer_note', String(v))} label="Show Footer Note (Thank You message)" />
              {settings.show_footer_note !== 'false' && (
                <textarea className="input-field text-sm" rows={1} placeholder="Thank you for your business!" value={settings.footer_note || ''} onChange={e => onChange('footer_note', e.target.value)} />
              )}
            </div>
          </div>
        </div>

        <div className="form-section">
          <h3 className="form-section-title">Drag & Drop Layout Builder</h3>
          <p className="text-xs text-surface-400 mb-4">Drag the blocks below to reorder your invoice layout.</p>
          <div className="space-y-2">
            {layout.map((blockId, index) => (
              <div
                key={blockId}
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, index)}
                className="p-3 bg-surface-800 border border-surface-600 rounded-lg cursor-move hover:border-brand-500 transition-colors flex items-center justify-between"
              >
                <span className="font-semibold text-white text-sm">{blocks[blockId]}</span>
                <span className="text-surface-500 text-xs">↕ Drag</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="form-section flex items-center justify-center bg-surface-900 overflow-hidden relative">
        <h3 className="form-section-title absolute top-4 left-4">Live Preview</h3>
        <div 
          className="bg-white rounded shadow-lg overflow-hidden relative"
          style={{ width: '100%', maxWidth: '400px', aspectRatio: '1 / 1.414', transform: 'scale(0.9)', transformOrigin: 'top center' }}
        >
          {settings.watermark_url && (
            <div 
              className="absolute inset-0 pointer-events-none"
              style={{
                backgroundImage: `url(${settings.watermark_url})`,
                backgroundSize: '50%',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
                opacity: parseFloat(settings.watermark_opacity || '0.1'),
                zIndex: 0
              }}
            />
          )}

          <div className="relative z-10 p-6 flex flex-col gap-4 text-gray-800" style={{ fontSize: '10px' }}>
            {layout.map(blockId => {
              if (blockId === 'header') return (
                <div key={blockId} className="flex justify-between items-start border-b pb-4" style={{ borderColor: settings.color_theme || '#1e40af' }}>
                  {settings.logo_url ? <img src={settings.logo_url} alt="Logo" className="h-8 object-contain" /> : <div className="font-bold text-sm" style={{ color: settings.color_theme || '#1e40af' }}>{settings.company_name || 'Your Company'}</div>}
                  <div className="text-right">
                    <div className="font-bold uppercase tracking-wider" style={{ color: settings.color_theme || '#1e40af' }}>TAX INVOICE</div>
                    <div className="text-gray-500 mt-1">INV-2026-0001</div>
                  </div>
                </div>
              );
              if (blockId === 'customer') return (
                <div key={blockId} className="bg-gray-50 p-3 rounded flex justify-between text-left">
                  <div>
                    <div className="font-bold mb-1" style={{ color: settings.color_theme || '#1e40af' }}>Bill To:</div>
                    <div className="font-semibold text-gray-800">John Doe</div>
                    <div className="text-gray-500">+880 1234-567890</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold mb-1" style={{ color: settings.color_theme || '#1e40af' }}>Billing Address:</div>
                    <div className="text-gray-500 max-w-[120px]">
                      Level-6, B-63, Malibag, DIT Road, Dhaka-1217
                    </div>
                  </div>
                </div>
              );
              if (blockId === 'items') return (
                <div key={blockId}>
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="text-white" style={{ backgroundColor: settings.color_theme || '#1e40af' }}>
                        <th className="p-1.5 font-normal">Item</th>
                        <th className="p-1.5 font-normal">Qty</th>
                        <th className="p-1.5 font-normal">Price</th>
                        <th className="p-1.5 font-normal text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-gray-200">
                        <td className="p-1.5">Sample Product</td>
                        <td className="p-1.5">1</td>
                        <td className="p-1.5">৳1,000</td>
                        <td className="p-1.5 text-right font-bold">৳1,000</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              );
              if (blockId === 'totals') return (
                <div key={blockId} className="flex justify-end">
                  <div className="w-48 space-y-1">
                    <div className="flex justify-between"><span>Subtotal:</span> <span>৳1,000</span></div>
                    <div className="border-t border-gray-300 my-1 pt-1 flex justify-between font-bold" style={{ color: settings.color_theme || '#1e40af' }}><span>Grand Total:</span> <span>৳1,000</span></div>
                  </div>
                </div>
              );
              if (blockId === 'footer') return (
                <div key={blockId} className="mt-8 pt-4 border-t border-gray-200 text-left text-gray-500 flex flex-col gap-3" style={{ fontSize: '8px' }}>
                  <div className="flex gap-4 justify-between">
                    {settings.show_terms !== 'false' && settings.terms_text && (
                      <div className="flex-1">
                        <div className="font-bold mb-1" style={{ color: settings.color_theme || '#1e40af' }}>Terms & Conditions:</div>
                        <div className="whitespace-pre-line leading-tight">{settings.terms_text}</div>
                      </div>
                    )}
                    {settings.show_policy !== 'false' && settings.return_policy && (
                      <div className="flex-1">
                        <div className="font-bold mb-1" style={{ color: settings.color_theme || '#1e40af' }}>Warranty & Return Policy:</div>
                        <div className="whitespace-pre-line leading-tight">{settings.return_policy}</div>
                      </div>
                    )}
                  </div>
                  
                  {settings.show_support !== 'false' && settings.support_contact && (
                    <div className="p-2 rounded bg-gray-50 border border-gray-200 text-center text-gray-700 font-medium">
                      <div className="font-bold" style={{ color: settings.color_theme || '#1e40af', marginBottom: '2px' }}>Need Immediate Support?</div>
                      {settings.support_contact}
                    </div>
                  )}

                  {settings.show_footer_note !== 'false' && (
                    <div className="text-center mt-2 pt-2 border-t border-gray-100">
                      {settings.footer_note || 'Thank you for your business!'}
                    </div>
                  )}
                </div>
              );
              return null;
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
