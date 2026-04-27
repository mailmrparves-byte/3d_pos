import { fmtCurrency, fmtDateTime } from './api';
import html2pdf from 'html2pdf.js';

export function printHtmlInvoice(sale, settings, action = 'print') {
  const biz = settings.business || settings;
  const inv = settings.invoice || settings;
  const isPreorder = sale.is_preorder === true || sale.status === 'preorder' || !!sale.preorder;
  const title = isPreorder ? 'PREORDER INVOICE' : (inv.title_text || 'TAX INVOICE');

  const layout = (() => {
    try {
      return JSON.parse(inv.invoice_layout || '["header", "customer", "items", "totals", "footer"]');
    } catch {
      return ["header", "customer", "items", "totals", "footer"];
    }
  })();

  const color = inv.color_theme || '#1e40af';
  const logo = inv.logo_url || '';
  const watermark = inv.watermark_url || '';
  const opacity = inv.watermark_opacity || '0.1';

  let htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Invoice ${sale.invoice_no}</title>
      <style>
        body { font-family: 'Inter', sans-serif; margin: 0; padding: 40px; color: #1f2937; position: relative; }
        .watermark { position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: -1; background-image: url('${watermark}'); background-size: 60%; background-position: center; background-repeat: no-repeat; opacity: ${opacity}; }
        .container { max-width: 800px; margin: 0 auto; position: relative; z-index: 1; }
        .block { margin-bottom: 30px; }
        .header { display: flex; justify-content: space-between; border-bottom: 2px solid ${color}; padding-bottom: 20px; }
        .header img { max-height: 60px; }
        .header .company-name { font-size: 24px; font-weight: bold; color: ${color}; }
        .customer { background: #f9fafb; padding: 15px; border-radius: 8px; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th { background-color: ${color}; color: white; padding: 10px; text-align: left; }
        td { padding: 10px; border-bottom: 1px solid #e5e7eb; }
        .totals { display: flex; justify-content: flex-end; margin-bottom: 250px; }
        .totals-table { width: 300px; }
        .totals-table td { padding: 5px; border: none; }
        .totals-table tr.grand-total { border-top: 2px solid ${color}; font-weight: bold; font-size: 18px; color: ${color}; }
        .footer { position: absolute; bottom: 40px; left: 40px; right: 40px; text-align: center; color: #6b7280; font-size: 12px; border-top: 1px solid #e5e7eb; padding-top: 20px; background: white; }
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; min-height: 297mm; }
          .watermark { display: block !important; }
          .footer { position: fixed; bottom: 0; left: 40px; right: 40px; }
        }
      </style>
    </head>
    <body>
      ${watermark ? `<div class="watermark"></div>` : ''}
      <div class="container">
  `;

  layout.forEach(block => {
    if (block === 'header') {
      htmlContent += `
        <div class="block header">
          <div>
            ${logo ? `<img src="${logo}" alt="Logo" />` : `<div class="company-name">${biz.company_name || 'Your Company'}</div>`}
            <div style="margin-top: 10px; font-size: 14px; color: #4b5563;">
              ${biz.address || ''}<br/>
              Phone: ${biz.primary_phone || ''}<br/>
              Email: ${biz.email || ''}
            </div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 28px; font-weight: bold; color: ${color}; text-transform: uppercase;">${title}</div>
            <div style="font-size: 16px; margin-top: 10px;"><b>Invoice:</b> ${sale.invoice_no}</div>
            <div style="font-size: 16px;"><b>Date:</b> ${new Date(sale.created_at).toLocaleDateString()}</div>
          </div>
        </div>
      `;
    }
    if (block === 'customer') {
      htmlContent += `
        <div class="block customer" style="display: flex; justify-content: space-between;">
          <div>
            <div style="font-weight: bold; margin-bottom: 5px; color: ${color};">Bill To:</div>
            <div style="font-size: 16px;"><b>${sale.customer_name || 'Walk-in'}</b></div>
            ${sale.customer_phone ? `<div>Phone: ${sale.customer_phone}</div>` : ''}
          </div>
          ${sale.customer_address ? `
          <div style="text-align: right; max-width: 250px;">
            <div style="font-weight: bold; margin-bottom: 5px; color: ${color};">Billing Address:</div>
            <div>${sale.customer_address}</div>
          </div>
          ` : ''}
        </div>
      `;
    }
    if (block === 'items') {
      const itemsHtml = sale.items.map(i => `
        <tr>
          <td>${i.product_name} ${i.discount_pct > 0 ? `<span style="color: #f59e0b; font-size: 12px;">(Disc: ${i.discount_pct}%)</span>` : ''}</td>
          <td style="text-align: center;">${i.quantity}</td>
          <td style="text-align: right;">${fmtCurrency(i.unit_price)}</td>
          <td style="text-align: right; font-weight: bold;">${fmtCurrency(i.line_total)}</td>
        </tr>
      `).join('');
      
      htmlContent += `
        <div class="block">
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th style="text-align: center;">Qty</th>
                <th style="text-align: right;">Price</th>
                <th style="text-align: right;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>
        </div>
      `;
    }
    if (block === 'totals') {
      htmlContent += `
        <div class="block totals">
          <table class="totals-table">
            <tr><td>Subtotal:</td><td style="text-align: right;">${fmtCurrency(sale.subtotal)}</td></tr>
            <tr><td>VAT:</td><td style="text-align: right;">${fmtCurrency(sale.vat_amount)}</td></tr>
            <tr><td>Discount:</td><td style="text-align: right;">${fmtCurrency(sale.discount)}</td></tr>
            <tr class="grand-total"><td style="padding-top: 10px;">Grand Total:</td><td style="text-align: right; padding-top: 10px;">${fmtCurrency(sale.grand_total)}</td></tr>
            ${isPreorder ? `
            <tr><td style="padding-top: 10px; font-weight: bold;">Advance Paid:</td><td style="text-align: right; padding-top: 10px; color: ${color}; font-weight: bold;">${fmtCurrency(sale.amount_received)}</td></tr>
            <tr><td style="font-weight: bold;">Due Balance:</td><td style="text-align: right; color: #dc2626; font-weight: bold;">${fmtCurrency(sale.grand_total - sale.amount_received)}</td></tr>
            ` : ''}
            ${(sale.payments && sale.payments.length > 0) ? `
              <tr><td colspan="2" style="text-align: right; font-size: 11px; font-weight: bold; color: ${color}; padding-top: 10px; text-transform: uppercase; letter-spacing: 0.05em;">Payment Breakdown</td></tr>
              ${sale.payments.filter(p => p.amount > 0).map(p => `
                <tr><td style="text-align: right; font-size: 10px; color: #4b5563;">${p.method}:</td><td style="text-align: right; font-size: 10px; color: #4b5563;">${fmtCurrency(p.amount)}</td></tr>
              `).join('')}
            ` : `
              <tr><td colspan="2" style="text-align: right; font-size: 12px; color: #6b7280; padding-top: 10px;">Payment Method: ${sale.payment_method}</td></tr>
            `}
          </table>
        </div>
      `;
    }
    if (block === 'footer') {
      htmlContent += `
        <div class="block footer">
          <div style="display: flex; gap: 20px; text-align: left; margin-bottom: 15px;">
            ${inv.show_terms !== 'false' && inv.terms_text ? `
            <div style="flex: 1;">
              <div style="font-weight: bold; color: ${color}; margin-bottom: 5px;">Terms & Conditions:</div>
              <div style="white-space: pre-line; color: #4b5563;">${inv.terms_text}</div>
            </div>
            ` : ''}
            ${inv.show_policy !== 'false' && inv.return_policy ? `
            <div style="flex: 1;">
              <div style="font-weight: bold; color: ${color}; margin-bottom: 5px;">Warranty & Return Policy:</div>
              <div style="white-space: pre-line; color: #4b5563;">${inv.return_policy}</div>
            </div>
            ` : ''}
          </div>
          
          ${inv.show_support !== 'false' && inv.support_contact ? `
          <div style="padding: 15px; border-radius: 8px; background-color: #f9fafb; border: 1px solid #e5e7eb; text-align: center; color: #374151; font-weight: 500; margin-bottom: 20px;">
            <div style="font-weight: bold; font-size: 14px; margin-bottom: 5px; color: ${color};">Need Immediate Support?</div>
            ${inv.support_contact}
          </div>
          ` : ''}
 
          ${inv.show_footer_note !== 'false' ? `
          <div style="text-align: center; border-top: 1px solid #e5e7eb; padding-top: 15px;">
            ${inv.footer_note || 'Thank you for your business!'}
          </div>
          ` : ''}
        </div>
      `;
    }
  });

  htmlContent += `
      </div>
    </body>
    </html>
  `;

  if (action === 'download') {
    const element = document.createElement('div');
    element.innerHTML = htmlContent;
    document.body.appendChild(element);
    
    const opt = {
      margin: 0,
      filename: `${sale.invoice_no}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(element).save().then(() => {
      document.body.removeChild(element);
    });
  } else {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(htmlContent.replace('</body>', `
      <script>
        window.onload = function() { 
          setTimeout(() => {
            window.print(); 
            window.onafterprint = function() { window.close(); };
          }, 500);
        }
      </script>
    </body>`));
    printWindow.document.close();
  }
}
