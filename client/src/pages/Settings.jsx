import React, { useState, useEffect } from 'react';
import { api, BASE } from '../utils/api';
import { Save, Building2, FileText, Percent, CreditCard, Package, ShoppingCart, Users, Bot, MapPin, Database, Download, UploadCloud, Trash2, Layout } from 'lucide-react';
import InvoiceBuilder from '../components/InvoiceBuilder';
import TemplateDesigner from '../components/TemplateDesigner';
import { fmtDateTime } from '../utils/api';
import toast from 'react-hot-toast';

const TABS = [
  { id: 'business', label: 'Business Profile', icon: Building2 },
  { id: 'invoice', label: 'Invoice', icon: FileText },
  { id: 'payment', label: 'Payment', icon: CreditCard },
  { id: 'inventory', label: 'Inventory', icon: Package },
  { id: 'pos', label: 'POS', icon: ShoppingCart },
  { id: 'users', label: 'Users', icon: Users },
  { id: 'backup', label: 'Data Backup', icon: Database },
  { id: 'print_template', label: 'Print Template', icon: Layout },
  { id: 'ai', label: 'AI Assistant', icon: Bot },
];

function Toggle({ checked, onChange, label }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer">
      <div className="relative">
        <input type="checkbox" className="sr-only" checked={checked} onChange={e => onChange(e.target.checked)} />
        <div className={`w-10 h-5 rounded-full transition-colors duration-300 ${checked ? 'bg-brand-600' : 'bg-surface-700'}`} />
        <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform duration-300 ${checked ? 'translate-x-5' : ''}`} />
      </div>
      {label && <span className="text-sm text-surface-300">{label}</span>}
    </label>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}

function BusinessTab({ settings, onChange }) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <Field label="Company Name"><input className="input-field" value={settings.company_name || ''} onChange={e => onChange('company_name', e.target.value)} /></Field>
      <Field label="Tagline"><input className="input-field" value={settings.company_tagline || ''} onChange={e => onChange('company_tagline', e.target.value)} /></Field>
      <Field label="Website"><input className="input-field" value={settings.website || ''} onChange={e => onChange('website', e.target.value)} /></Field>
      <Field label="Primary Phone"><input className="input-field" value={settings.primary_phone || ''} onChange={e => onChange('primary_phone', e.target.value)} /></Field>
      <Field label="Secondary Phone"><input className="input-field" value={settings.secondary_phone || ''} onChange={e => onChange('secondary_phone', e.target.value)} /></Field>
      <Field label="WhatsApp Number"><input className="input-field" value={settings.whatsapp || ''} onChange={e => onChange('whatsapp', e.target.value)} /></Field>
      <Field label="Email"><input className="input-field" value={settings.email || ''} onChange={e => onChange('email', e.target.value)} /></Field>
      <Field label="VAT Registration (BIN)"><input className="input-field" value={settings.vat_reg_no || ''} onChange={e => onChange('vat_reg_no', e.target.value)} /></Field>
      <Field label="Trade License"><input className="input-field" value={settings.trade_license || ''} onChange={e => onChange('trade_license', e.target.value)} /></Field>
      <Field label="TIN Number"><input className="input-field" value={settings.tin_number || ''} onChange={e => onChange('tin_number', e.target.value)} /></Field>
      <div className="col-span-2"><Field label="Full Address"><textarea className="input-field" rows={2} value={settings.address || ''} onChange={e => onChange('address', e.target.value)} /></Field></div>
      <Field label="City"><input className="input-field" value={settings.city || ''} onChange={e => onChange('city', e.target.value)} /></Field>
      <Field label="Country"><input className="input-field" value={settings.country || ''} onChange={e => onChange('country', e.target.value)} /></Field>
      <div className="col-span-2"><Field label="About / Business Description"><textarea className="input-field" rows={3} value={settings.about || ''} onChange={e => onChange('about', e.target.value)} /></Field></div>
    </div>
  );
}

function InvoiceTab({ settings, onChange }) {
  return (
    <div className="space-y-6">
      <div className="form-section mb-6">
        <h3 className="form-section-title">Invoice Numbering & Defaults</h3>
        <div className="grid grid-cols-3 gap-4">
          <Field label="Invoice Prefix"><input className="input-field" value={settings.invoice_prefix || 'INV'} onChange={e => onChange('invoice_prefix', e.target.value)} /></Field>
          <Field label="Starting Number"><input type="number" className="input-field" value={settings.starting_number || '1001'} onChange={e => onChange('starting_number', e.target.value)} /></Field>
          <Field label="Preorder Prefix"><input className="input-field" value={settings.preorder_prefix || 'PRE'} onChange={e => onChange('preorder_prefix', e.target.value)} /></Field>
        </div>
      </div>
      
      <InvoiceBuilder settings={settings} onChange={onChange} />
    </div>
  );
}



function PaymentTab({ settings, onChange }) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="col-span-2 form-section-title">Enabled Payment Methods</div>
      <Toggle checked={settings.enable_cash === 'true'} onChange={v => onChange('enable_cash', String(v))} label="Cash" />
      <Toggle checked={settings.enable_bkash === 'true'} onChange={v => onChange('enable_bkash', String(v))} label="bKash" />
      <Toggle checked={settings.enable_nagad === 'true'} onChange={v => onChange('enable_nagad', String(v))} label="Nagad" />
      <Toggle checked={settings.enable_bank === 'true'} onChange={v => onChange('enable_bank', String(v))} label="Bank Transfer" />
      <Toggle checked={settings.enable_credit === 'true'} onChange={v => onChange('enable_credit', String(v))} label="Corporate Credit" />
      <Field label="bKash Merchant No"><input className="input-field" value={settings.bkash_merchant || ''} onChange={e => onChange('bkash_merchant', e.target.value)} /></Field>
      <Field label="Nagad Merchant No"><input className="input-field" value={settings.nagad_merchant || ''} onChange={e => onChange('nagad_merchant', e.target.value)} /></Field>
      <div className="col-span-2 form-section-title mt-2">Advance Payment Rules</div>
      <Field label="Min Advance % (standard)"><input type="number" className="input-field" value={settings.min_advance_pct || '20'} onChange={e => onChange('min_advance_pct', e.target.value)} /></Field>
      <Field label="Min Advance % (high-value)"><input type="number" className="input-field" value={settings.min_advance_pct_high || '25'} onChange={e => onChange('min_advance_pct_high', e.target.value)} /></Field>
      <Field label="High-Value Threshold (৳)"><input type="number" className="input-field" value={settings.high_value_threshold || '100000'} onChange={e => onChange('high_value_threshold', e.target.value)} /></Field>
      <Field label="Overdue After (days)"><input type="number" className="input-field" value={settings.overdue_after_days || '30'} onChange={e => onChange('overdue_after_days', e.target.value)} /></Field>
      <Toggle checked={settings.show_advance_warning === 'true'} onChange={v => onChange('show_advance_warning', String(v))} label="Show Advance Warning in POS" />
    </div>
  );
}

function InventoryTab({ settings, onChange }) {
  const thresholds = [
    ['threshold_3d_printers','3D Printers & CNC'],
    ['threshold_meters','Meters & Testers'],
    ['threshold_tools','Tools & Equipment'],
    ['threshold_filaments','Filaments'],
    ['threshold_consumables','Consumables / Soldering'],
    ['threshold_electrical','Electrical Components'],
    ['threshold_pneumatic','Pneumatic Parts'],
    ['threshold_other','Other'],
  ];
  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="col-span-2 form-section-title">Low Stock Thresholds (by Category)</div>
      {thresholds.map(([k, l]) => (
        <Field key={k} label={l}><input type="number" className="input-field" value={settings[k] || '5'} onChange={e => onChange(k, e.target.value)} /></Field>
      ))}
      <div className="col-span-2 form-section-title mt-2">Serial & Expiry Tracking</div>
      <Field label="Serial Tracking Min Price (৳)"><input type="number" className="input-field" value={settings.serial_min_price || '10000'} onChange={e => onChange('serial_min_price', e.target.value)} /></Field>
      <Field label="Expiry Warning (days before)"><input type="number" className="input-field" value={settings.expiry_warn_days || '30'} onChange={e => onChange('expiry_warn_days', e.target.value)} /></Field>
      <Toggle checked={settings.enable_expiry === 'true'} onChange={v => onChange('enable_expiry', String(v))} label="Enable Expiry Tracking" />
      <div className="col-span-2 form-section-title mt-2">Costing Method</div>
      <Field label="Inventory Costing Method">
        <select className="input-field" value={settings.costing_method || 'weighted_average'} onChange={e => onChange('costing_method', e.target.value)}>
          {['fifo','weighted_average','manual'].map(m => <option key={m} className="bg-surface-800 capitalize">{m.replace('_', ' ')}</option>)}
        </select>
      </Field>
    </div>
  );
}

function POSTab({ settings, onChange }) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <Toggle checked={settings.allow_below_cost === 'true'} onChange={v => onChange('allow_below_cost', String(v))} label="Allow Selling Below Cost" />
      <Toggle checked={settings.allow_negative_stock === 'true'} onChange={v => onChange('allow_negative_stock', String(v))} label="Allow Negative Stock" />
      <Toggle checked={settings.show_stock_qty === 'true'} onChange={v => onChange('show_stock_qty', String(v))} label="Show Stock in Search" />
      <Toggle checked={settings.show_product_image === 'true'} onChange={v => onChange('show_product_image', String(v))} label="Show Product Image" />
      <Toggle checked={settings.allow_drafts === 'true'} onChange={v => onChange('allow_drafts', String(v))} label="Allow Quotations in POS" />
      <Toggle checked={settings.auto_print === 'true'} onChange={v => onChange('auto_print', String(v))} label="Auto Print After Sale" />
      <Toggle checked={settings.require_customer_info === 'true'} onChange={v => onChange('require_customer_info', String(v))} label="Require Customer Info" />
      <Field label="Default Discount %"><input type="number" className="input-field" value={settings.default_discount || '0'} onChange={e => onChange('default_discount', e.target.value)} /></Field>
      <Field label="Max Allowed Discount %"><input type="number" className="input-field" value={settings.max_discount || '30'} onChange={e => onChange('max_discount', e.target.value)} /></Field>
      <Field label="Manager Override PIN"><input type="password" className="input-field" value={settings.manager_pin || '1234'} onChange={e => onChange('manager_pin', e.target.value)} /></Field>
    </div>
  );
}

function AITab({ settings, onChange }) {
  const AI_MODELS = {
    gemini: ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'],
    anthropic: ['claude-3-5-sonnet-latest', 'claude-3-opus-latest', 'claude-3-haiku-20240307'],
    openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'o1-mini']
  };

  const provider = settings.provider || 'gemini';
  const availableModels = AI_MODELS[provider] || [];
  return (
    <div className="grid grid-cols-2 gap-4">
      <Toggle checked={settings.enabled === 'true'} onChange={v => onChange('enabled', String(v))} label="Enable AI Assistant" />
      <Field label="AI Provider">
        <select className="input-field" value={settings.provider || 'gemini'} onChange={e => onChange('provider', e.target.value)}>
          {['gemini','anthropic','openai'].map(p => <option key={p} className="bg-surface-800 capitalize">{p}</option>)}
        </select>
      </Field>
      <Field label="AI Model">
        {settings.api_key && settings.api_key.length > 0 ? (
          <select className="input-field" value={settings.model || availableModels[0]} onChange={e => onChange('model', e.target.value)}>
            {availableModels.map(m => <option key={m} className="bg-surface-800">{m}</option>)}
          </select>
        ) : (
          <input className="input-field text-surface-500" value={settings.model || ''} disabled placeholder="Please enter API Key first" />
        )}
      </Field>
      <Field label="API Key">
        <input type="password" className="input-field" value={settings.api_key || ''} onChange={e => onChange('api_key', e.target.value)} placeholder="sk-... or AIza..." />
      </Field>
      <Field label="Response Language">
        <select className="input-field" value={settings.language || 'english'} onChange={e => onChange('language', e.target.value)}>
          {['english','bengali','auto'].map(l => <option key={l} className="bg-surface-800 capitalize">{l}</option>)}
        </select>
      </Field>
      <Field label="Max Response Length">
        <select className="input-field" value={settings.max_length || 'medium'} onChange={e => onChange('max_length', e.target.value)}>
          {['short','medium','long','full'].map(l => <option key={l} className="bg-surface-800 capitalize">{l}</option>)}
        </select>
      </Field>
      <div className="col-span-2">
        <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-sm text-amber-300">
          💡 Get a free Gemini API key at <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener" className="underline">aistudio.google.com/apikey</a>. The key is stored securely on your server and never sent to the browser.
        </div>
      </div>
    </div>
  );
}

function UsersTab() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', phone: '', role: 'salesperson', status: 'active', password: '' });

  const load = async () => {
    try { setLoading(true); const data = await api.get('/users'); setUsers(data); }
    catch { toast.error('Failed to load users'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    try {
      if (editUser) await api.put(`/users/${editUser.id}`, form);
      else await api.post('/users', form);
      toast.success('Saved'); setShowForm(false); load();
    } catch (err) { toast.error(err.message); }
  };

  const ROLES = ['admin','manager','salesperson','inventory','accountant'];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-surface-400">{users.length} users</div>
        <button onClick={() => { setEditUser(null); setForm({ name:'',email:'',phone:'',role:'salesperson',status:'active',password:'' }); setShowForm(true); }} className="btn-primary btn-sm">+ Add User</button>
      </div>
      {showForm && (
        <div className="neo-card p-4 mb-4 grid grid-cols-2 gap-3">
          <div><label className="label">Name</label><input className="input-field" value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} /></div>
          <div><label className="label">Email</label><input type="email" className="input-field" value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))} /></div>
          <div><label className="label">Password {editUser ? '(leave blank to keep)' : ''}</label><input type="password" className="input-field" value={form.password} onChange={e => setForm(f => ({...f, password: e.target.value}))} /></div>
          <div><label className="label">Role</label>
            <select className="input-field" value={form.role} onChange={e => setForm(f => ({...f, role: e.target.value}))}>
              {ROLES.map(r => <option key={r} className="bg-surface-800 capitalize">{r}</option>)}
            </select>
          </div>
          <div><label className="label">Status</label>
            <select className="input-field" value={form.status} onChange={e => setForm(f => ({...f, status: e.target.value}))}>
              {['active','inactive'].map(s => <option key={s} className="bg-surface-800 capitalize">{s}</option>)}
            </select>
          </div>
          <div className="col-span-2 flex gap-2 justify-end">
            <button onClick={() => setShowForm(false)} className="btn-secondary btn-sm">Cancel</button>
            <button onClick={save} className="btn-primary btn-sm"><Save className="w-3.5 h-3.5" /> Save</button>
          </div>
        </div>
      )}
      <div className="table-container">
        <table className="data-table">
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Last Login</th><th>Actions</th></tr></thead>
          <tbody>
            {loading ? Array(4).fill(0).map((_, i) => <tr key={i}>{Array(6).fill(0).map((_,j) => <td key={j}><div className="h-4 shimmer rounded" /></td>)}</tr>)
            : users.map(u => (
              <tr key={u.id}>
                <td className="font-medium">{u.name}</td>
                <td className="text-xs text-surface-400">{u.email}</td>
                <td><span className="badge badge-blue capitalize">{u.role}</span></td>
                <td><span className={`badge ${u.status === 'active' ? 'badge-green' : 'badge-red'}`}>{u.status}</span></td>
                <td className="text-xs text-surface-500">{u.last_login ? new Date(u.last_login).toLocaleDateString() : 'Never'}</td>
                <td>
                  <button onClick={() => { setEditUser(u); setForm({name:u.name,email:u.email,phone:u.phone||'',role:u.role,status:u.status,password:''}); setShowForm(true); }} className="btn-ghost btn-icon btn-sm">✏️</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BackupTab() {
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [selectedBackup, setSelectedBackup] = useState(null);

  const load = async () => {
    try { setLoading(true); const b = await api.get('/backup/list'); setBackups(b); }
    catch { toast.error('Failed to load backups'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    setCreating(true);
    try { await api.post('/backup/create'); toast.success('Backup created successfully'); load(); }
    catch (err) { toast.error(err.message); }
    finally { setCreating(false); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this backup?')) return;
    try { await api.delete(`/backup/${id}`); toast.success('Deleted'); load(); }
    catch (err) { toast.error(err.message); }
  };

  const handleRestore = async (e) => {
    e.preventDefault();
    if (confirmText !== 'RESTORE' || !selectedBackup) return;
    setRestoring(true);
    try { await api.post('/backup/restore', { filename: selectedBackup, confirm: confirmText }); toast.success('Database restored successfully'); setConfirmText(''); setSelectedBackup(null); load(); }
    catch (err) { toast.error(err.message); }
    finally { setRestoring(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between bg-surface-800 p-4 rounded-xl border border-surface-700">
        <div>
          <h3 className="font-bold text-white">Manual Backup</h3>
          <p className="text-xs text-surface-400 mt-1">Create an instant snapshot of your entire database.</p>
        </div>
        <button onClick={handleCreate} disabled={creating} className="btn-primary">
          {creating ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Database className="w-4 h-4" />}
          {creating ? 'Creating...' : 'Backup Now'}
        </button>
      </div>

      <div>
        <h3 className="form-section-title">Backup History</h3>
        <div className="table-container mt-2">
          <table className="data-table">
            <thead><tr><th>Date</th><th>Filename</th><th>Size</th><th>Created By</th><th>Actions</th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={5} className="text-center">Loading...</td></tr> :
              backups.map(b => (
                <tr key={b.id}>
                  <td><span className="text-xs">{fmtDateTime(b.created_at)}</span></td>
                  <td><span className="font-mono text-xs text-brand-400">{b.filename}</span></td>
                  <td><span className="font-mono text-xs">{(b.size_bytes / 1024 / 1024).toFixed(2)} MB</span></td>
                  <td><span className="text-xs text-surface-400">{b.created_by_name || 'System'}</span></td>
                  <td>
                    <div className="flex gap-1">
                      <a href={`${BASE}/backup/download/${b.filename}`} download target="_blank" className="btn-ghost btn-icon btn-sm"><Download className="w-3.5 h-3.5" /></a>
                      <button onClick={() => handleDelete(b.id)} className="btn-danger btn-icon btn-sm"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && !backups.length && <tr><td colSpan={5} className="text-center text-surface-500 py-8">No backups available</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-red-500/10 border border-red-500/20 p-5 rounded-xl">
        <h3 className="font-bold text-red-400 flex items-center gap-2"><UploadCloud className="w-4 h-4" /> Restore Database</h3>
        <p className="text-xs text-surface-400 mt-1 mb-4">Warning: Restoring a backup will overwrite the current database. This action cannot be undone.</p>
        <form onSubmit={handleRestore} className="grid grid-cols-3 gap-3 items-end">
          <div className="col-span-1">
            <label className="label">Select Backup File</label>
            <select className="input-field text-xs" value={selectedBackup || ''} onChange={e => setSelectedBackup(e.target.value)} required>
              <option value="">— Select a backup to restore —</option>
              {backups.map(b => <option key={b.id} value={b.filename}>{b.filename}</option>)}
            </select>
          </div>
          <div className="col-span-1">
            <label className="label text-red-400">Type RESTORE to confirm</label>
            <input className="input-field font-mono text-center" value={confirmText} onChange={e => setConfirmText(e.target.value)} required placeholder="RESTORE" />
          </div>
          <div className="col-span-1">
            <button type="submit" disabled={restoring || confirmText !== 'RESTORE' || !selectedBackup} className="btn-danger w-full">
              {restoring ? 'Restoring...' : 'Restore Database'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Settings() {
  const [activeTab, setActiveTab] = useState('business');
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/settings').then(s => { setSettings(s); setLoading(false); }).catch(() => toast.error('Failed to load settings'));
  }, []);

  const onChange = (tab, key, value) => {
    setSettings(prev => ({ ...prev, [tab]: { ...(prev[tab] || {}), [key]: value } }));
  };

  const save = async () => {
    setSaving(true);
    try {
      await api.put(`/settings/${activeTab}`, settings[activeTab] || {});
      toast.success('Settings saved!');
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const tabSettings = settings[activeTab] || {};
  const onTabChange = (k, v) => onChange(activeTab, k, v);

  const renderTab = () => {
    if (loading) return <div className="grid grid-cols-2 gap-4">{Array(8).fill(0).map((_,i) => <div key={i} className="h-14 shimmer rounded-xl" />)}</div>;
    switch (activeTab) {
      case 'business': return <BusinessTab settings={tabSettings} onChange={onTabChange} />;
      case 'invoice': return <InvoiceTab settings={tabSettings} onChange={onTabChange} />;
      case 'payment': return <PaymentTab settings={tabSettings} onChange={onTabChange} />;
      case 'inventory': return <InventoryTab settings={tabSettings} onChange={onTabChange} />;
      case 'pos': return <POSTab settings={tabSettings} onChange={onTabChange} />;
      case 'users': return <UsersTab />;
      case 'backup': return <BackupTab />;
      case 'print_template': return <TemplateDesigner settings={tabSettings} onChange={onTabChange} />;
      case 'ai': return <AITab settings={tabSettings} onChange={onTabChange} />;
      default: return null;
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div><h1 className="page-title">Settings</h1><p className="page-subtitle">Configure your business and application settings</p></div>
        {activeTab !== 'users' && activeTab !== 'backup' && (
          <button onClick={save} disabled={saving} className="btn-primary">
            {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><Save className="w-4 h-4" /> Save Changes</>}
          </button>
        )}
      </div>

      <div className="flex gap-5">
        {/* Tab nav */}
        <div className="w-52 flex-shrink-0">
          <div className="neo-card p-2 space-y-0.5">
            {TABS.map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id)} className={`sidebar-item w-full text-left ${activeTab === t.id ? 'active' : ''}`}>
                <t.icon className="w-4 h-4" />{t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab content */}
        <div className="flex-1 neo-card p-6">
          <h2 className="text-lg font-bold text-white mb-5">{TABS.find(t => t.id === activeTab)?.label}</h2>
          {renderTab()}
        </div>
      </div>
    </div>
  );
}
