import React, { useState, useEffect, useRef } from 'react';
import { api, FILE_BASE } from '../utils/api';
import { Upload, Move, Maximize2, Check, X, Layout } from 'lucide-react';
import toast from 'react-hot-toast';

const BLOCKS = [
  { id: 'customer', label: 'Customer Details' },
  { id: 'doc_info', label: 'Doc No & Date' },
  { id: 'items', label: 'Items Table' },
  { id: 'totals', label: 'Totals Block' },
  { id: 'notes', label: 'Notes / Footer' },
];

const DEFAULT_CONFIG = {
  customer: { x: 50, y: 150, w: 300, h: 80 },
  doc_info: { x: 500, y: 50, w: 250, h: 80 },
  items: { x: 50, y: 300, w: 700, h: 400 },
  totals: { x: 450, y: 720, w: 300, h: 150 },
  notes: { x: 50, y: 880, w: 700, h: 100 },
};

export default function TemplateDesigner({ settings, onChange }) {
  const [config, setConfig] = useState(() => {
    try { return JSON.parse(settings.template_config || '{}'); } catch { return DEFAULT_CONFIG; }
  });
  const [activeBlock, setActiveBlock] = useState(null);
  const containerRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!Object.keys(config).length) setConfig(DEFAULT_CONFIG);
  }, []);

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('template', file);
    try {
      const { url } = await api.post('/uploads/template', formData);
      onChange('template_background', url);
      toast.success('Template background uploaded');
    } catch (err) { toast.error('Upload failed: ' + err.message); }
  };

  const updateBlock = (id, updates) => {
    const newConfig = { ...config, [id]: { ...config[id], ...updates } };
    setConfig(newConfig);
    onChange('template_config', JSON.stringify(newConfig));
  };

  const handleMouseDown = (e, id) => {
    setActiveBlock(id);
    setIsDragging(true);
    const rect = e.currentTarget.getBoundingClientRect();
    setDragOffset({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const handleMouseMove = (e) => {
    if (!isDragging || !activeBlock) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - containerRect.left - dragOffset.x, containerRect.width - config[activeBlock].w));
    const y = Math.max(0, Math.min(e.clientY - containerRect.top - dragOffset.y, containerRect.height - config[activeBlock].h));
    updateBlock(activeBlock, { x, y });
  };

  const handleMouseUp = () => setIsDragging(false);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-white">Custom Pad Template</h3>
          <p className="text-sm text-surface-400">Upload your company letterhead and position data blocks.</p>
        </div>
        <div className="flex gap-2">
          <label className="flex items-center gap-3 cursor-pointer p-2 bg-surface-800 rounded-lg border border-surface-700 hover:border-brand-500 transition-colors">
            <div className="relative">
              <input type="checkbox" className="sr-only" checked={settings.use_custom_template === 'true'} onChange={e => onChange('use_custom_template', String(e.target.checked))} />
              <div className={`w-10 h-5 rounded-full transition-colors duration-300 ${settings.use_custom_template === 'true' ? 'bg-brand-600' : 'bg-surface-700'}`} />
              <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform duration-300 ${settings.use_custom_template === 'true' ? 'translate-x-5' : ''}`} />
            </div>
            <span className="text-sm font-medium">Use Custom Template</span>
          </label>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-6">
        <div className="col-span-1 space-y-4">
          <div className="neo-card p-4 space-y-4">
            <div>
              <label className="label">Background Image (A4)</label>
              <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-surface-700 border-dashed rounded-xl hover:border-brand-500 transition-colors cursor-pointer relative group">
                <input type="file" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={handleUpload} accept="image/*,application/pdf" />
                <div className="space-y-1 text-center">
                  <Upload className="mx-auto h-10 w-10 text-surface-400 group-hover:text-brand-400" />
                  <div className="text-xs text-surface-500">Click to upload JPG, PNG or PDF</div>
                </div>
              </div>
            </div>

            <div className="section-divider" />

            <div>
              <label className="label mb-2">Available Blocks</label>
              <div className="space-y-2">
                {BLOCKS.map(b => (
                  <button 
                    key={b.id} 
                    onClick={() => setActiveBlock(b.id)}
                    className={`w-full flex items-center justify-between p-2 rounded-lg text-sm transition-colors ${activeBlock === b.id ? 'bg-brand-500/20 border border-brand-500 text-brand-300' : 'bg-surface-800 border border-surface-700 text-surface-400 hover:border-surface-600'}`}
                  >
                    {b.label}
                    {activeBlock === b.id && <Check className="w-3.5 h-3.5" />}
                  </button>
                ))}
              </div>
            </div>

            {activeBlock && config[activeBlock] && (
              <div className="space-y-3 pt-2">
                <div className="text-xs font-bold text-surface-500 uppercase">Block Properties: {activeBlock}</div>
                <div className="grid grid-cols-2 gap-2">
                  <div><label className="text-[10px] text-surface-500 uppercase">X Position</label><input type="number" className="input-field !py-1 !text-xs" value={Math.round(config[activeBlock].x)} onChange={e => updateBlock(activeBlock, { x: parseInt(e.target.value) || 0 })} /></div>
                  <div>
                    <label className="text-[10px] text-surface-500 uppercase">Y Position</label>
                    <input type="number" className="input-field !py-1 !text-xs" value={Math.round(config[activeBlock].y)} onChange={e => updateBlock(activeBlock, { y: parseInt(e.target.value) || 0 })} disabled={['totals', 'notes'].includes(activeBlock)} title={['totals', 'notes'].includes(activeBlock) ? "Y position is determined dynamically based on table height" : ""} />
                  </div>
                  <div><label className="text-[10px] text-surface-500 uppercase">Width</label><input type="number" className="input-field !py-1 !text-xs" value={Math.round(config[activeBlock].w)} onChange={e => updateBlock(activeBlock, { w: parseInt(e.target.value) || 10 })} /></div>
                  <div>
                    <label className="text-[10px] text-surface-500 uppercase">Height</label>
                    <input type="number" className="input-field !py-1 !text-xs" value={Math.round(config[activeBlock].h)} onChange={e => updateBlock(activeBlock, { h: parseInt(e.target.value) || 10 })} disabled={['items', 'totals'].includes(activeBlock)} title={['items', 'totals'].includes(activeBlock) ? "Height is dynamic based on content" : ""} />
                  </div>
                </div>
                {['totals', 'notes'].includes(activeBlock) && (
                  <div className="text-[10px] text-brand-400 bg-brand-500/10 p-2 rounded border border-brand-500/20">
                    <b>Note:</b> Vertical position (Y) is dynamic. This block will automatically follow the end of the Items Table. Use X to adjust horizontal alignment.
                  </div>
                )}
                {activeBlock === 'items' && (
                  <div className="text-[10px] text-brand-400 bg-brand-500/10 p-2 rounded border border-brand-500/20">
                    <b>Note:</b> Height is dynamic. The table will grow downwards automatically and support multi-page printing.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="col-span-3">
          <div 
            ref={containerRef}
            className="relative bg-white shadow-2xl mx-auto overflow-hidden" 
            style={{ width: '595px', height: '842px', border: '1px solid #e5e7eb' }} // A4 @ 72DPI for preview
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            {settings.template_background ? (
              <img src={`${FILE_BASE}${settings.template_background}`} className="absolute inset-0 w-full h-full object-contain opacity-50" alt="Background" />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-surface-200 uppercase font-bold tracking-widest text-4xl opacity-10 rotate-45 select-none">Letterhead Template</div>
            )}

            {BLOCKS.map(b => {
              const box = config[b.id] || DEFAULT_CONFIG[b.id];
              const isActive = activeBlock === b.id;
              return (
                <div
                  key={b.id}
                  onMouseDown={(e) => handleMouseDown(e, b.id)}
                  className={`absolute border-2 flex items-center justify-center text-[10px] font-bold cursor-move select-none transition-shadow ${isActive ? 'border-brand-500 bg-brand-500/10 shadow-lg z-20' : 'border-surface-400 bg-surface-100/30 text-surface-600 z-10'}`}
                  style={{ left: box.x, top: box.y, width: box.w, height: box.h }}
                >
                  <div className="text-center px-1">
                    <Move className="w-3 h-3 mx-auto mb-1 opacity-50" />
                    {b.label}
                  </div>
                  {isActive && (
                    <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-brand-500 cursor-se-resize rounded-full" />
                  )}
                </div>
              );
            })}
            
            {/* Grid Helper */}
            <div className="absolute inset-0 pointer-events-none opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
          </div>
          <div className="mt-4 text-center text-xs text-surface-500">
            Preview is at 72 DPI (595x842 pixels). Coordinates are stored relative to this size.
          </div>
        </div>
      </div>
    </div>
  );
}
