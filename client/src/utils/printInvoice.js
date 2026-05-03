import { FILE_BASE, fmtCurrency, statusLabel } from './api';
import html2pdf from 'html2pdf.js';
import { numberToWords } from './numberToWords';

export function printHtmlInvoice(sale, settings, action = 'print') {
  const biz = settings.business || settings;
  const inv = settings.invoice || settings;
  const isPreorder = sale.is_preorder === true || sale.status === 'preorder' || !!sale.preorder;
  const isGroupBuy = !!sale.group_buy_id;
  const isQuotation = sale.is_quotation === true;
  const title = isQuotation
    ? (inv.quotation_title || 'QUOTATION')
    : isGroupBuy ? 'GROUP BUY INVOICE'
    : isPreorder ? 'PREORDER INVOICE'
    : (inv.title_text || 'TAX INVOICE');
  const docNoLabel = isQuotation ? 'Quotation' : 'Invoice';
  const docNo = isQuotation ? (sale.quotation_no || '') : (sale.invoice_no || '');

  const layout = (() => {
    try { return JSON.parse(inv.invoice_layout || '["header","customer","items","totals","footer"]'); }
    catch { return ["header", "customer", "items", "totals", "footer"]; }
  })();

  const color = inv.color_theme || '#1e40af';
  const logo = inv.logo_url || '';
  const watermark = inv.watermark_url || '';
  const opacity = inv.watermark_opacity || '0.1';
  const useCustom = (settings.print_template?.use_custom_template === 'true') || (inv.use_custom_template === 'true');
  const templateConfig = (() => {
    try { return JSON.parse(settings.print_template?.template_config || inv.template_config || '{}'); }
    catch { return null; }
  })();
  const templateBg = settings.print_template?.template_background || inv.template_background || '';
  const baseUrl = FILE_BASE;
  const paymentMethod = (sale.payment_method || 'N/A').toUpperCase();

  // ─── Build body content ───────────────────────────────────────────────────
  let bodyContent = '';

  if (useCustom && templateConfig) {
    const scale = 0.3527;
    const itemsBox = templateConfig.items || { x: 50, y: 300, w: 700 };
    const customerBox = templateConfig.customer || { x: 50, y: 150, w: 300 };
    const docInfoBox = templateConfig.doc_info || { x: 500, y: 50, w: 250 };
    const totalsBox = templateConfig.totals || { x: 450, w: 300 };
    const notesBox = templateConfig.notes || { x: 50, w: 700 };

    const headerH = Math.max(0, (itemsBox.y * scale) - 8);

    bodyContent = `
      <div class="custom-wrapper">
        <div class="abs" style="left:${customerBox.x*scale}mm;top:${customerBox.y*scale}mm;width:${customerBox.w*scale}mm">
          <div style="font-size:13px">
            <div style="font-weight:bold;color:${color};margin-bottom:2px">Bill To:</div>
            <div style="font-weight:bold">${sale.customer_name || 'Walk-in'}</div>
            ${sale.customer_phone ? `<div>Phone: ${sale.customer_phone}</div>` : ''}
            ${sale.customer_address ? `<div style="font-size:11px;margin-top:3px">${sale.customer_address}</div>` : ''}
          </div>
        </div>
        <div class="abs" style="left:${docInfoBox.x*scale}mm;top:${docInfoBox.y*scale}mm;width:${docInfoBox.w*scale}mm">
          <div style="text-align:right">
            <div style="font-size:18px;font-weight:bold;color:${color};text-transform:uppercase;margin-bottom:4px">${title}</div>
            <div style="font-size:12px"><b>${docNoLabel}:</b> ${docNo}</div>
            <div style="font-size:12px"><b>Date:</b> ${new Date(sale.created_at).toLocaleDateString()}</div>
          </div>
        </div>
        <div class="flow" style="padding-left:${itemsBox.x*scale}mm;width:${(itemsBox.w||700)*scale}mm">
          <table>
            <thead style="display:table-header-group">
              <tr><td colspan="4" style="height:${headerH}mm;border:none;padding:0"></td></tr>
              <tr>
                <th>Item Description</th>
                <th style="text-align:center;width:10%">Qty</th>
                <th style="text-align:right;width:20%">Price</th>
                <th style="text-align:right;width:20%">Total</th>
              </tr>
            </thead>
            <tfoot style="display:table-footer-group">
              <tr><td colspan="4" style="height:10mm;border:none;padding:0"></td></tr>
            </tfoot>
            <tbody>
              ${sale.items.map(i => `
                <tr>
                  <td>${i.product_name}${i.discount_pct > 0 ? ` <span style="color:#f59e0b;font-size:10px">(Disc:${i.discount_pct}%)</span>` : ''}</td>
                  <td style="text-align:center">${i.quantity}</td>
                  <td style="text-align:right">${fmtCurrency(i.unit_price)}</td>
                  <td style="text-align:right;font-weight:bold">${fmtCurrency(i.line_total)}</td>
                </tr>`).join('')}
            </tbody>
          </table>
          <div style="page-break-inside:avoid">
            <div style="margin-left:${Math.max(0,(totalsBox.x-itemsBox.x)*scale)}mm;width:${(totalsBox.w||300)*scale}mm;margin-top:5mm">
              <table class="tt">
                <tr><td>Subtotal:</td><td style="text-align:right">${fmtCurrency(sale.subtotal)}</td></tr>
                ${parseFloat(sale.discount)>0?`<tr><td>Discount:</td><td style="text-align:right">${fmtCurrency(sale.discount)}</td></tr>`:''}
                ${parseFloat(sale.delivery_charge)>0?`<tr><td>Delivery:</td><td style="text-align:right">${fmtCurrency(sale.delivery_charge)}</td></tr>`:''}
                <tr class="gt"><td style="padding-top:5px">Grand Total:</td><td style="text-align:right;padding-top:5px">${fmtCurrency(sale.grand_total)}</td></tr>
                ${isPreorder?`<tr><td>Advance:</td><td style="text-align:right">${fmtCurrency(sale.amount_received)}</td></tr><tr><td>Due:</td><td style="text-align:right;color:#dc2626">${fmtCurrency(sale.grand_total-sale.amount_received)}</td></tr>`:''}
                <tr><td style="font-size:10px;color:#6b7280;padding-top:4px">Status:</td><td style="text-align:right;font-size:10px">${statusLabel(sale.status)}</td></tr>
                <tr><td style="font-size:10px;color:#6b7280">Payment:</td><td style="text-align:right;font-size:10px">${paymentMethod}</td></tr>
              </table>
            </div>
            <div style="width:100%;margin-top:6px;font-size:11px;font-weight:bold;color:${color};border-top:1px dashed #cbd5e1;padding-top:5px">
              Amount in words: <span style="color:#334155;font-style:italic">${numberToWords(sale.grand_total)}</span>
            </div>
            <div style="margin-left:${Math.max(0,(notesBox.x-itemsBox.x)*scale)}mm;width:${(notesBox.w||700)*scale}mm;margin-top:8mm;font-size:10px;color:#4b5563">
              ${sale.notes?`<div style="margin-bottom:4px"><b>Notes:</b> ${sale.notes}</div>`:''}
              <div style="border-top:1px solid #eee;padding-top:4px">${inv.footer_note||'Thank you for your business!'}</div>
            </div>
          </div>
        </div>
      </div>`;
  } else {
    // ── Standard layout ──
    const itemsHtml = sale.items.map(i => `
      <tr>
        <td>${i.product_name}
          ${i.is_group_buy?`<span style="background:${color};color:white;font-size:9px;padding:2px 5px;border-radius:4px;margin-left:8px;font-weight:bold">GROUP BUY</span>`:''}
          ${i.discount_pct>0?`<span style="color:#f59e0b;font-size:11px;margin-left:4px">(Disc:${i.discount_pct}%)</span>`:''}
        </td>
        <td style="text-align:center">${i.quantity}</td>
        <td style="text-align:right">${fmtCurrency(i.unit_price)}</td>
        <td style="text-align:right;font-weight:bold">${fmtCurrency(i.line_total)}</td>
      </tr>`).join('');

    bodyContent = `<div class="container">`;

    layout.forEach(block => {
      if (block === 'header') {
        bodyContent += `
          <div class="block header">
            <div>
              ${logo ? `<img src="${logo}" alt="Logo" style="max-height:60px"/>` : `<div class="co-name">${biz.company_name||'Your Company'}</div>`}
              <div style="margin-top:8px;font-size:13px;color:#4b5563">
                ${biz.address||''}<br/>Phone: ${biz.primary_phone||''}<br/>Email: ${biz.email||''}
              </div>
            </div>
            <div style="text-align:right">
              <div style="font-size:26px;font-weight:bold;color:${color};text-transform:uppercase">${title}</div>
              <div style="font-size:14px;margin-top:8px"><b>${docNoLabel}:</b> ${docNo}</div>
              <div style="font-size:14px"><b>Date:</b> ${new Date(sale.created_at).toLocaleDateString()}</div>
            </div>
          </div>`;
      }
      if (block === 'customer') {
        bodyContent += `
          <div class="block customer">
            <div>
              <div style="font-weight:bold;margin-bottom:4px;color:${color}">Bill To:</div>
              <div style="font-size:15px"><b>${sale.customer_name||'Walk-in'}</b></div>
              ${sale.customer_phone?`<div>Phone: ${sale.customer_phone}</div>`:''}
            </div>
            ${sale.customer_address?`
            <div style="text-align:right;max-width:250px">
              <div style="font-weight:bold;margin-bottom:4px;color:${color}">Address:</div>
              <div>${sale.customer_address}</div>
            </div>`:''}
          </div>`;
      }
      if (block === 'items') {
        bodyContent += `
          <div class="block">
            <table>
              <thead><tr><th>Item</th><th style="text-align:center">Qty</th><th style="text-align:right">Price</th><th style="text-align:right">Total</th></tr></thead>
              <tbody>${itemsHtml}</tbody>
            </table>
          </div>`;
      }
      if (block === 'totals') {
        bodyContent += `
          <div class="block" style="display:flex;justify-content:flex-end">
            <div style="width:300px">
              <table class="tt">
                <tr><td>Subtotal:</td><td style="text-align:right">${fmtCurrency(sale.subtotal)}</td></tr>
                <tr><td>Discount:</td><td style="text-align:right">${fmtCurrency(sale.discount)}</td></tr>
                ${parseFloat(sale.delivery_charge)>0?`<tr><td>Delivery:</td><td style="text-align:right">${fmtCurrency(sale.delivery_charge)}</td></tr>`:''}
                <tr class="gt"><td style="padding-top:8px">Grand Total:</td><td style="text-align:right;padding-top:8px">${fmtCurrency(sale.grand_total)}</td></tr>
                ${isPreorder?`<tr><td style="padding-top:8px;font-weight:bold">Advance Paid:</td><td style="text-align:right;padding-top:8px;color:${color};font-weight:bold">${fmtCurrency(sale.amount_received)}</td></tr><tr><td style="font-weight:bold">Due Balance:</td><td style="text-align:right;color:#dc2626;font-weight:bold">${fmtCurrency(sale.grand_total-sale.amount_received)}</td></tr>`:''}
                ${(sale.payments&&sale.payments.length>0)
                  ? `<tr><td colspan="2" style="text-align:right;font-size:11px;font-weight:bold;color:${color};padding-top:8px;text-transform:uppercase">Payment Breakdown</td></tr>${sale.payments.filter(p=>p.amount>0).map(p=>`<tr><td style="text-align:right;font-size:10px;color:#4b5563">${p.method}:</td><td style="text-align:right;font-size:10px;color:#4b5563">${fmtCurrency(p.amount)}</td></tr>`).join('')}`
                  : `<tr><td colspan="2" style="text-align:right;font-size:11px;color:#6b7280;padding-top:8px">Status: ${statusLabel(sale.status)} | Payment: ${paymentMethod}</td></tr>`}
              </table>
              <div style="margin-top:10px;font-size:11px;font-weight:bold;color:${color};border-top:1px dashed #cbd5e1;padding-top:7px;text-align:right">
                Amount in words: <span style="color:#334155;font-style:italic">${numberToWords(sale.grand_total)}</span>
              </div>
            </div>
          </div>`;
      }
      if (block === 'footer') {
        bodyContent += `
          <div class="block">
            <div style="display:flex;gap:20px;margin-bottom:12px">
              ${inv.show_terms!=='false'&&inv.terms_text?`<div style="flex:1"><div style="font-weight:bold;color:${color};margin-bottom:4px">Terms &amp; Conditions:</div><div style="white-space:pre-line;color:#4b5563">${inv.terms_text}</div></div>`:''}
              ${inv.show_policy!=='false'&&inv.return_policy?`<div style="flex:1"><div style="font-weight:bold;color:${color};margin-bottom:4px">Return Policy:</div><div style="white-space:pre-line;color:#4b5563">${inv.return_policy}</div></div>`:''}
            </div>
            ${inv.show_support!=='false'&&inv.support_contact?`<div style="padding:12px;border-radius:8px;background:#f9fafb;border:1px solid #e5e7eb;text-align:center;color:#374151;font-weight:500;margin-bottom:16px"><div style="font-weight:bold;font-size:13px;margin-bottom:4px;color:${color}">Need Support?</div>${inv.support_contact}</div>`:''}
            ${inv.show_footer_note!=='false'?`<div style="text-align:center;border-top:1px solid #e5e7eb;padding-top:12px">${inv.footer_note||'Thank you for your business!'}</div>`:''}
          </div>`;
      }
    });
    bodyContent += `</div>`;
  }

  // ─── CSS ─────────────────────────────────────────────────────────────────
  const commonCss = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    *,*::before,*::after{box-sizing:border-box}
    body{font-family:'Inter',sans-serif;margin:0;padding:0;color:#1f2937;-webkit-print-color-adjust:exact;print-color-adjust:exact;background:white}
    .container{padding:36px}
    .block{margin-bottom:24px}
    .block:last-child{margin-bottom:0}
    .header{display:flex;justify-content:space-between;border-bottom:2px solid ${color};padding-bottom:16px}
    .co-name{font-size:22px;font-weight:bold;color:${color}}
    .customer{background:#f9fafb;padding:14px;border-radius:8px;display:flex;justify-content:space-between}
    table{width:100%;border-collapse:collapse}
    th{background-color:${color};color:white;padding:7px 10px;text-align:left;font-size:12px}
    td{padding:7px 10px;border-bottom:1px solid #e5e7eb;font-size:12px}
    .tt{width:100%}
    .tt td{padding:3px 0;border:none;font-size:12px}
    .gt{border-top:2px solid ${color};font-weight:bold;font-size:15px;color:${color}}
    .abs{position:absolute;overflow:hidden}
    .flow{width:100%}
    .flow table{width:100%;border-collapse:collapse}
    .flow th{background-color:${color};color:white;padding:6px 8px;font-size:11px;text-align:left}
    .flow td{padding:6px 8px;border-bottom:1px solid #e5e7eb;font-size:11px}
    .custom-wrapper{
      ${useCustom && templateBg ? `background-image:url('${baseUrl}${templateBg}');background-size:210mm 297mm;background-repeat:repeat-y;` : ''}
      width:210mm;
      min-height:297mm;
      position:relative;
    }
    ${watermark && !useCustom ? `.wm{position:absolute;top:0;left:0;width:100%;height:100%;background-image:url('${watermark}');background-size:60%;background-position:center;background-repeat:no-repeat;opacity:${opacity}}` : ''}
  `;

  // ─── For DOWNLOAD: no min-height so html2pdf captures exact content size
  const downloadHtml = `<!DOCTYPE html><html><head><title>${docNoLabel} ${docNo}</title><style>
    ${commonCss}
    .page{width:210mm;position:relative;margin:0 auto;background:white}
  </style></head><body>
    <div class="page">
      ${watermark && !useCustom ? '<div class="wm"></div>' : ''}
      ${bodyContent}
    </div>
  </body></html>`;

  // ─── For PRINT: min-height ensures it looks like a proper A4 page in browser print dialog
  const printHtml = `<!DOCTYPE html><html><head><title>${docNoLabel} ${docNo}</title><style>
    ${commonCss}
    .page{width:210mm;min-height:297mm;position:relative;margin:0 auto;background:white}
    @media print{
      body{background:none;margin:0}
      @page{size:A4 portrait;margin:10mm 10mm 10mm 10mm}
      .page{width:100%;min-height:unset;margin:0}
    }
  </style></head><body>
    <div class="page">
      ${watermark && !useCustom ? '<div class="wm"></div>' : ''}
      ${bodyContent}
    </div>
    <script>
      window.onload = function() {
        // Wait for images and fonts to fully load before printing
        setTimeout(function() {
          window.print();
          window.onafterprint = function() { window.close(); };
        }, 800);
      };
    </script>
  </body></html>`;

  // ─── Action ───────────────────────────────────────────────────────────────
  if (action === 'download') {
    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'position:fixed;left:-9999px;top:0;width:210mm';
    wrapper.innerHTML = downloadHtml;
    document.body.appendChild(wrapper);
    const page = wrapper.querySelector('.page');

    const opt = {
      margin: 0,
      filename: `${docNo || 'invoice'}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, scrollY: 0, windowWidth: 794 },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: ['avoid-all', 'css'] }
    };

    html2pdf().set(opt).from(page).save().then(() => {
      document.body.removeChild(wrapper);
    });
  } else {
    const printWindow = window.open('', '_blank');
    if (!printWindow) { alert('Please allow popups to print.'); return; }
    printWindow.document.write(printHtml);
    printWindow.document.close();
  }
}
