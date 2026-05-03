import React, { useState, useEffect, useRef } from 'react';
import { api, fmtCurrency } from '../utils/api';
import { Plus, Trash2, Search, Bot, Printer, Save, X, AlertTriangle, ToggleLeft, ToggleRight } from 'lucide-react';
import toast from 'react-hot-toast';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { printHtmlInvoice } from '../utils/printInvoice';

const PAYMENT_METHODS = ['Cash', 'bKash', 'Nagad', 'Bank Transfer', 'Credit Account'];
const CUSTOMER_TYPES = ['walk-in', 'corporate', 'returning'];
const EMPTY_ITEM = { product_id: null, product_name: '', sku: '', quantity: 1, unit_price: 0, discount_pct: 0, line_total: 0, is_group_buy: false };

function calcLine(item) {
  const base = item.quantity * item.unit_price;
  const disc = base * (item.discount_pct / 100);
  return parseFloat((base - disc).toFixed(2));
}

export default function POS() {
  const [products, setProducts] = useState([]);
  const [groupBuys, setGroupBuys] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [settings, setSettings] = useState({});

  // Order state
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerType, setCustomerType] = useState('walk-in');
  const [corporatePO, setCorporatePO] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [items, setItems] = useState([{ ...EMPTY_ITEM }]);
  const [payments, setPayments] = useState([{ method: 'Cash', amount: 0 }]);
  const [isPreorder, setIsPreorder] = useState(false);
  const [advancePaid, setAdvancePaid] = useState(0);
  const [deliveryDate, setDeliveryDate] = useState('');
  const [variantInstructions, setVariantInstructions] = useState('');
  const [preorderNotes, setPreorderNotes] = useState('');
  const [notes, setNotes] = useState('');
  const [isGroupBuyMode, setIsGroupBuyMode] = useState(false);
  const [selectedGroupBuy, setSelectedGroupBuy] = useState(null);
  const [deliveryCharge, setDeliveryCharge] = useState(0);
  const [saving, setSaving] = useState(false);

  // Product search
  const [searchQ, setSearchQ] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [activeSearchIdx, setActiveSearchIdx] = useState(null);
  const searchRef = useRef(null);

  // Customer search
  const [customerSearchQ, setCustomerSearchQ] = useState('');
  const [customerResults, setCustomerResults] = useState([]);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);

  const MIN_ADVANCE_PCT = parseFloat(settings?.payment?.min_advance_pct || 20);
  const MIN_ADVANCE_PCT_HIGH = parseFloat(settings?.payment?.min_advance_pct_high || 25);
  const HIGH_VALUE = parseFloat(settings?.payment?.high_value_threshold || 100000);

  useEffect(() => {
    Promise.all([
      api.get('/products?limit=500'),
      api.get('/customers?limit=300'),
      api.get('/settings'),
      api.get('/group-buys'),
    ]).then(([p, c, s, gb]) => {
      setProducts(p);
      setCustomers(c);
      setSettings(s);
      setGroupBuys(gb.filter(x => x.status === 'open'));
    }).catch(() => toast.error('Failed to load POS data'));
  }, []);



  // Calculated totals
  const subtotal = items.reduce((s, i) => s + calcLine(i), 0);
  const grandTotal = parseFloat((subtotal + (parseFloat(deliveryCharge) || 0)).toFixed(2));
  const totalPaid = parseFloat(payments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0).toFixed(2));
  const changeDue = Math.max(0, totalPaid - grandTotal);
  const dueBalance = Math.max(0, grandTotal - totalPaid);

  // Sync advancePaid with totalPaid for preorders
  useEffect(() => {
    if (isPreorder) setAdvancePaid(totalPaid);
  }, [totalPaid, isPreorder]);

  const minAdvance = grandTotal > HIGH_VALUE ? grandTotal * (MIN_ADVANCE_PCT_HIGH / 100) : grandTotal * (MIN_ADVANCE_PCT / 100);
  const advanceWarning = isPreorder && advancePaid > 0 && advancePaid < minAdvance;

  // Product search
  const handleSearchChange = (idx, q) => {
    setActiveSearchIdx(idx);
    setSearchQ(q);
    if (q.length > 1) {
      if (isGroupBuyMode && selectedGroupBuy) {
        // Filter from selected group buy products
        const gb = groupBuys.find(g => g.id === selectedGroupBuy);
        const filtered = (gb?.products || []).filter(p => 
          p.product_name.toLowerCase().includes(q.toLowerCase())
        );
        setSearchResults(filtered.map(p => ({ ...p, name: p.product_name, selling_price: p.target_price, id: p.product_id })));
      } else {
        const results = products.filter(p =>
          p.name.toLowerCase().includes(q.toLowerCase()) || 
          p.sku.toLowerCase().includes(q.toLowerCase()) ||
          (p.category && p.category.toLowerCase().includes(q.toLowerCase()))
        ).slice(0, 8);
        setSearchResults(results);
      }
    } else {
      setSearchResults([]);
    }
  };

  const handlePhoneChange = (q) => {
    setCustomerPhone(q);
    if (q.length > 2) {
      const results = customers.filter(c =>
        c.phone && c.phone.includes(q)
      ).slice(0, 5);
      setCustomerResults(results);
      setShowCustomerDropdown(true);
    } else {
      setCustomerResults([]);
      setShowCustomerDropdown(false);
    }
  };

  const selectCustomer = (c) => {
    setSelectedCustomer(c);
    setCustomerName(c.name);
    setCustomerPhone(c.phone);
    setCustomerAddress(c.billing_address || c.address || '');
    setCustomerType(c.type || 'walk-in');
    setShowCustomerDropdown(false);
  };

  const selectProduct = (idx, product) => {
    const updated = [...items];
    updated[idx] = { 
      ...updated[idx], 
      product_id: product.id, 
      product_name: product.name, 
      sku: product.sku || '', 
      unit_price: parseFloat(product.selling_price), 
      is_group_buy: isGroupBuyMode,
      line_total: calcLine({ ...updated[idx], unit_price: parseFloat(product.selling_price) }) 
    };
    setItems(updated);
    setSearchResults([]);
    setActiveSearchIdx(null);
    setSearchQ('');
  };

  const updateItem = (idx, field, value) => {
    const updated = [...items];
    let finalValue = value;
    if (field === 'discount_pct') {
      finalValue = Math.min(100, Math.max(0, parseFloat(value) || 0));
    } else if (field === 'quantity') {
      finalValue = Math.max(1, parseInt(value) || 1);
    } else if (field === 'unit_price') {
      finalValue = Math.max(0, parseFloat(value) || 0);
    }
    updated[idx] = { ...updated[idx], [field]: finalValue };
    updated[idx].line_total = calcLine(updated[idx]);
    setItems(updated);
  };

  const addItem = () => setItems([...items, { ...EMPTY_ITEM }]);
  const removeItem = (idx) => setItems(items.filter((_, i) => i !== idx));

  const clearForm = () => {
    setCustomerName(''); setCustomerPhone(''); setCustomerAddress(''); setCustomerType('walk-in'); setCorporatePO(''); setSelectedCustomer(null);
    setItems([{ ...EMPTY_ITEM }]);
    setPayments([{ method: 'Cash', amount: 0 }]);
    setIsPreorder(false); setAdvancePaid(0);
    setDeliveryDate(''); setVariantInstructions(''); setPreorderNotes(''); setNotes('');
    setIsGroupBuyMode(false); setSelectedGroupBuy(null); setDeliveryCharge(0);
  };

  const saveAsQuotation = async () => {
    if (!items[0].product_id) return toast.error('Add at least one product');
    setSaving(true);
    try {
      const payload = {
        customer_id: selectedCustomer?.id || null,
        customer_name: customerName || 'Walk-in',
        customer_phone: customerPhone,
        customer_address: customerAddress,
        customer_type: customerType,
        corporate_po: corporatePO,
        items: items.filter(i => i.product_id).map(i => ({ ...i, line_total: calcLine(i) })),
        subtotal, discount: 0, delivery_charge: parseFloat(deliveryCharge) || 0, grand_total: grandTotal,
        notes,
        status: 'draft'
      };
      await api.post('/quotations', payload);
      toast.success('Saved as Quotation');
      clearForm();
    } catch (err) {
      toast.error(err.message || 'Failed to save quotation');
    } finally {
      setSaving(false);
    }
  };

  const confirmSale = async () => {
    if (!items[0].product_id) return toast.error('Add at least one product');
    if (advanceWarning) return toast.error(`Advance must be at least ${fmtCurrency(minAdvance)}`);
    setSaving(true);
    try {
      const payload = {
        customer_id: selectedCustomer?.id || null,
        customer_name: customerName || 'Walk-in',
        customer_phone: customerPhone,
        customer_address: customerAddress,
        customer_type: customerType,
        corporate_po: corporatePO,
        items: items.filter(i => i.product_id).map(i => ({ ...i, line_total: calcLine(i) })),
        subtotal, discount: 0, delivery_charge: parseFloat(deliveryCharge) || 0, grand_total: grandTotal,
        payment_method: payments.map(p => p.method).join(', '), 
        amount_received: totalPaid,
        payments,
        change_due: changeDue,
        status: isPreorder ? 'preorder' : (totalPaid >= grandTotal ? 'paid' : 'partial'),
        is_preorder: isPreorder,
        is_draft: false,
        notes,
        group_buy_id: isGroupBuyMode ? selectedGroupBuy : null,
        preorder: isPreorder ? { advance_paid: totalPaid, due_balance: dueBalance, delivery_date: deliveryDate, variant_instructions: variantInstructions, notes: preorderNotes } : null
      };
      const result = await api.post('/sales', payload);
      toast.success(`Sale ${result.invoice_no} confirmed!`);
      // Ensure result has items for the print engine
      printInvoice({ ...result, items: payload.items }, payload);
      clearForm();
    } catch (err) {
      toast.error(err.message || 'Failed to save sale');
    } finally {
      setSaving(false);
    }
  };

  const printInvoice = (sale, payload) => {
    // Print using new highly customizable HTML layout engine
    printHtmlInvoice(sale, settings);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-4 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Point of Sale</h1>
          <p className="page-subtitle">Create sales, preorders, and generate invoices</p>
        </div>
        <div className="flex gap-2">
          <button onClick={clearForm} className="btn-ghost btn-sm"><X className="w-3.5 h-3.5" /> Clear</button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Left: Customer + Products */}
        <div className="xl:col-span-2 space-y-4">
          {/* Group Buy Toggle */}
          <div className="form-section">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-surface-200">Group Buy Invoice</div>
                <div className="text-xs text-surface-500">Sell products at group buy rates</div>
              </div>
              <div className="flex items-center gap-3">
                {isGroupBuyMode && (
                  <select 
                    className="input-field !py-1.5 !text-xs min-w-[200px]" 
                    value={selectedGroupBuy || ''} 
                    onChange={e => {
                      const gbId = parseInt(e.target.value);
                      setSelectedGroupBuy(gbId);
                      const gb = groupBuys.find(g => g.id === gbId);
                      if (gb && gb.products) {
                        const autoItems = gb.products.map(p => ({
                          product_id: p.product_id,
                          product_name: p.product_name,
                          sku: p.sku || '',
                          quantity: p.quantity || 1,
                          unit_price: parseFloat(p.target_price),
                          discount_pct: 0,
                          is_group_buy: true,
                          line_total: parseFloat(p.target_price) * (p.quantity || 1)
                        }));
                        setItems(autoItems);
                        toast.success(`Loaded ${autoItems.length} products from ${gb.product_name}`);
                      } else {
                        setItems([{ ...EMPTY_ITEM, is_group_buy: true }]);
                      }
                    }}
                  >
                    <option value="" disabled className="bg-surface-800">Select Group Buy Event</option>
                    {groupBuys.map(gb => <option key={gb.id} value={gb.id} className="bg-surface-800">{gb.product_name}</option>)}
                  </select>
                )}
                <button onClick={() => { setIsGroupBuyMode(!isGroupBuyMode); setSelectedGroupBuy(null); setItems([{ ...EMPTY_ITEM, is_group_buy: !isGroupBuyMode }]); }} className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm transition-colors ${isGroupBuyMode ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-600/30' : 'bg-surface-800 text-surface-400'}`}>
                  {isGroupBuyMode ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                  {isGroupBuyMode ? 'Group Buy ON' : 'Group Buy OFF'}
                </button>
              </div>
            </div>
          </div>

          {/* Customer */}
          <div className="form-section">
            <div className="form-section-title">Customer Details</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Customer Name</label>
                <input id="pos-customer-name" className="input-field" value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Walk-in Customer" />
              </div>
              <div>
                <label className="label">Phone</label>
                <div className="relative">
                  <input 
                    id="pos-phone" 
                    className="input-field" 
                    value={customerPhone} 
                    onChange={e => handlePhoneChange(e.target.value)} 
                    placeholder="+880..." 
                    onBlur={() => setTimeout(() => setShowCustomerDropdown(false), 200)}
                    onFocus={() => {if (customerPhone.length > 2) handlePhoneChange(customerPhone)}}
                  />
                  {showCustomerDropdown && customerResults.length > 0 && (
                    <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-surface-800 border border-surface-700 rounded-xl shadow-2xl max-h-52 overflow-y-auto">
                      {customerResults.map(c => (
                        <div key={c.id} className="px-3 py-2.5 hover:bg-surface-700 cursor-pointer transition-colors" onMouseDown={() => selectCustomer(c)}>
                          <div className="text-sm font-medium text-surface-100">{c.name}</div>
                          <div className="text-xs text-surface-500">{c.phone} · {c.type}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="col-span-2">
                <label className="label">Billing Address</label>
                <input id="pos-customer-address" className="input-field" value={customerAddress} onChange={e => setCustomerAddress(e.target.value)} placeholder="House, Street, City..." />
              </div>
              <div>
                <label className="label">Customer Type</label>
                <select id="pos-customer-type" className="input-field" value={customerType} onChange={e => setCustomerType(e.target.value)}>
                  {CUSTOMER_TYPES.map(t => <option key={t} value={t} className="bg-surface-800 capitalize">{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                </select>
              </div>
              {customerType === 'corporate' && (
                <div>
                  <label className="label">Corporate PO Number</label>
                  <input className="input-field" value={corporatePO} onChange={e => setCorporatePO(e.target.value)} placeholder="PO-XXXX" />
                </div>
              )}
            </div>
          </div>

          {/* Products */}
          <div className="form-section">
            <div className="form-section-title">Products</div>
            <div className="space-y-3">
              {items.map((item, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-end p-3 bg-surface-800/50 rounded-xl border border-surface-700">
                  <div className="col-span-4 relative">
                    <label className="label">Product</label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
                      <input
                        className="input-field !pl-9"
                        placeholder="Search product..."
                        value={activeSearchIdx === idx ? searchQ : item.product_name}
                        onChange={e => { handleSearchChange(idx, e.target.value); if (!e.target.value) updateItem(idx, 'product_id', null); }}
                      />
                    </div>
                    {activeSearchIdx === idx && searchResults.length > 0 && (
                      <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-surface-800 border border-surface-700 rounded-xl shadow-2xl max-h-52 overflow-y-auto">
                        {searchResults.map(p => (
                          <div key={p.id} className="px-3 py-2.5 hover:bg-surface-700 cursor-pointer transition-colors" onClick={() => selectProduct(idx, p)}>
                            <div className="text-sm font-medium text-surface-100">{p.name}</div>
                            <div className="text-xs text-surface-500">{p.sku} · {fmtCurrency(p.selling_price)} · Stock: {p.stock_qty}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="col-span-1">
                    <label className="label">Qty</label>
                    <input type="number" className="input-field" min="1" value={item.quantity} onChange={e => updateItem(idx, 'quantity', parseInt(e.target.value) || 1)} />
                  </div>
                  <div className="col-span-2">
                    <label className="label">Unit Price</label>
                    <input type="number" className="input-field" value={item.unit_price} onChange={e => updateItem(idx, 'unit_price', parseFloat(e.target.value) || 0)} />
                  </div>
                  <div className="col-span-2">
                    <label className="label">Disc %</label>
                    <input type="number" className="input-field" min="0" max="100" value={item.discount_pct} onChange={e => updateItem(idx, 'discount_pct', parseFloat(e.target.value) || 0)} />
                  </div>
                  <div className="col-span-2">
                    <label className="label">Total</label>
                    <div className="input-field bg-surface-900 amount text-sm truncate px-2" title={fmtCurrency(calcLine(item))}>{fmtCurrency(calcLine(item))}</div>
                  </div>
                  <div className="col-span-1 flex justify-end">
                    <button onClick={() => removeItem(idx)} className="btn-danger btn-icon btn-sm" disabled={items.length === 1}><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              ))}
              <button onClick={addItem} className="btn-secondary btn-sm w-full justify-center"><Plus className="w-3.5 h-3.5" /> Add Item</button>
            </div>
          </div>

          {/* Preorder Toggle */}
          <div className="form-section">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-sm font-semibold text-surface-200">Preorder / Advance Payment</div>
                <div className="text-xs text-surface-500">Toggle if customer is placing a preorder</div>
              </div>
              <button onClick={() => setIsPreorder(!isPreorder)} className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm transition-colors ${isPreorder ? 'bg-brand-600/20 text-brand-400 border border-brand-600/30' : 'bg-surface-800 text-surface-400'}`}>
                {isPreorder ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                {isPreorder ? 'Preorder ON' : 'Preorder OFF'}
              </button>
            </div>
            {isPreorder && (
              <div className="grid grid-cols-2 gap-3 pt-3 border-t border-surface-800">
                <div>
                  <label className="label">Advance Amount (৳)</label>
                  <input type="number" className="input-field" value={advancePaid} onChange={e => setAdvancePaid(parseFloat(e.target.value) || 0)} placeholder="0" />
                  {advanceWarning && (
                    <div className="flex items-center gap-1 mt-1 text-xs text-amber-400">
                      <AlertTriangle className="w-3 h-3" /> Min: {fmtCurrency(minAdvance)} ({grandTotal > HIGH_VALUE ? MIN_ADVANCE_PCT_HIGH : MIN_ADVANCE_PCT}%)
                    </div>
                  )}
                </div>
                <div>
                  <label className="label">Due Balance (Auto)</label>
                  <div className="input-field bg-surface-950 amount-red text-sm">{fmtCurrency(dueBalance)}</div>
                </div>
                <div>
                  <label className="label">Expected Delivery Date</label>
                  <input type="date" className="input-field" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)} />
                </div>
                <div>
                  <label className="label">Variant / Special Instructions</label>
                  <input className="input-field" value={variantInstructions} onChange={e => setVariantInstructions(e.target.value)} placeholder="Color, size, spec..." />
                </div>
                <div className="col-span-2">
                  <label className="label">Preorder Notes</label>
                  <textarea className="input-field" rows={2} value={preorderNotes} onChange={e => setPreorderNotes(e.target.value)} placeholder="Any additional notes..." />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: Order Summary + Payment */}
        <div className="space-y-4">
          {/* Summary */}
          <div className="form-section">
            <div className="form-section-title">Order Summary</div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm items-center"><span className="text-surface-400 whitespace-nowrap">Subtotal</span><span className="font-mono truncate ml-2" title={fmtCurrency(subtotal)}>{fmtCurrency(subtotal)}</span></div>
              <div className="flex justify-between text-sm items-center"><span className="text-surface-400 whitespace-nowrap">Delivery Charge</span><input type="number" className="input-field !py-0.5 !px-1.5 !w-24 text-right !bg-surface-900" value={deliveryCharge} onChange={e => setDeliveryCharge(parseFloat(e.target.value) || 0)} /></div>
              <div className="section-divider" />
              <div className="flex justify-between text-lg font-bold items-center"><span className="whitespace-nowrap">Grand Total</span><span className="amount truncate ml-2" title={fmtCurrency(grandTotal)}>{fmtCurrency(grandTotal)}</span></div>
              {isPreorder && (
                <>
                  <div className="flex justify-between text-sm text-brand-400 items-center"><span className="whitespace-nowrap">Advance Paid</span><span className="font-mono truncate ml-2" title={fmtCurrency(advancePaid)}>{fmtCurrency(advancePaid)}</span></div>
                  <div className="flex justify-between text-sm text-red-400 font-semibold items-center"><span className="whitespace-nowrap">Due on Delivery</span><span className="font-mono truncate ml-2" title={fmtCurrency(dueBalance)}>{fmtCurrency(dueBalance)}</span></div>
                </>
              )}
            </div>
          </div>

          {/* Payment */}
          <div className="form-section">
            <div className="flex justify-between items-center mb-3">
              <div className="form-section-title !mb-0">Payment</div>
              <button onClick={() => setPayments([...payments, { method: 'bKash', amount: 0 }])} className="text-[10px] text-brand-400 font-bold uppercase tracking-wider hover:text-brand-300 transition-colors">+ Add Method</button>
            </div>
            <div className="space-y-4">
              {payments.map((p, pIdx) => (
                <div key={pIdx} className="p-3 bg-surface-800/30 rounded-xl border border-surface-700/50 space-y-3 relative">
                  {payments.length > 1 && (
                    <button onClick={() => setPayments(payments.filter((_, i) => i !== pIdx))} className="absolute top-2 right-2 text-surface-500 hover:text-red-400 transition-colors">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                  <div>
                    <label className="label">Method</label>
                    <select 
                      className="input-field !py-1.5" 
                      value={p.method} 
                      onChange={e => {
                        const newPayments = [...payments];
                        newPayments[pIdx].method = e.target.value;
                        setPayments(newPayments);
                      }}
                    >
                      {PAYMENT_METHODS.map(m => <option key={m} className="bg-surface-800">{m}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">Amount (৳)</label>
                    <div className="relative">
                      <input 
                        type="number" 
                        className="input-field !py-1.5" 
                        value={p.amount} 
                        onChange={e => {
                          const newPayments = [...payments];
                          newPayments[pIdx].amount = parseFloat(e.target.value) || 0;
                          setPayments(newPayments);
                        }} 
                      />
                      {pIdx === 0 && p.amount === 0 && (
                        <button 
                          onClick={() => {
                            const newPayments = [...payments];
                            newPayments[0].amount = grandTotal;
                            setPayments(newPayments);
                          }}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] bg-brand-500/20 text-brand-400 px-1.5 py-0.5 rounded font-bold"
                        >
                          FULL
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {totalPaid > 0 && (
                <div className="space-y-2 pt-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-surface-400">Total Paid</span>
                    <span className="font-mono text-white font-bold">{fmtCurrency(totalPaid)}</span>
                  </div>
                  {changeDue > 0 && (
                    <div className="flex justify-between text-sm p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                      <span className="text-emerald-400">Change Due</span>
                      <span className="font-mono text-emerald-400 font-bold">{fmtCurrency(changeDue)}</span>
                    </div>
                  )}
                  {!isPreorder && totalPaid < grandTotal && totalPaid > 0 && (
                    <div className="flex justify-between text-sm p-2 bg-red-500/10 border border-red-500/20 rounded-lg">
                      <span className="text-red-400">Remaining</span>
                      <span className="font-mono text-red-400 font-bold">{fmtCurrency(grandTotal - totalPaid)}</span>
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="label">Notes</label>
                <textarea className="input-field" rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional order notes..." />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-2">
            <button id="pos-confirm-sale" onClick={confirmSale} disabled={saving} className="btn-primary w-full justify-center btn-lg">
              <Printer className="w-4 h-4" /> Confirm Sale & Print Invoice
            </button>
            <button onClick={saveAsQuotation} disabled={saving} className="btn-secondary w-full justify-center">
              <Save className="w-4 h-4" /> Save as Quotation
            </button>
            <button onClick={clearForm} className="btn-ghost w-full justify-center"><X className="w-4 h-4" /> Clear Form</button>
          </div>
        </div>
      </div>
    </div>
  );
}
