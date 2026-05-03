import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { fmtCurrency, fmtDateTime } from './api';

const COMPANY_NAME = 'My Inventory System'; // Replace with dynamic setting if available

export const exportUtils = {
  /**
   * Export data to PDF
   * @param {string} title - Report title
   * @param {Array} columns - Table headers
   * @param {Array} data - Table body data
   * @param {Object} filters - Applied filters for header
   */
  exportPDF: (title, columns, data, filters = {}) => {
    const doc = new jsPDF();
    const date = fmtDateTime(new Date());

    // Header
    doc.setFontSize(18);
    doc.text(COMPANY_NAME, 14, 22);
    doc.setFontSize(14);
    doc.setTextColor(100);
    doc.text(title, 14, 30);
    
    doc.setFontSize(10);
    doc.setTextColor(150);
    doc.text(`Generated on: ${date}`, 14, 38);

    // Filters info
    let filterY = 44;
    const filterStrings = Object.entries(filters)
      .filter(([_, v]) => v && v !== '')
      .map(([k, v]) => `${k}: ${v}`);
    
    if (filterStrings.length > 0) {
      doc.setFontSize(9);
      doc.text(`Filters: ${filterStrings.join(' | ')}`, 14, filterY);
      filterY += 6;
    }

    // Table
    doc.autoTable({
      startY: filterY + 2,
      head: [columns],
      body: data,
      theme: 'grid',
      headStyles: { fillGray: true, textColor: 20 },
      styles: { fontSize: 8 },
      margin: { top: 10 }
    });

    doc.save(`${title.toLowerCase().replace(/\s+/g, '_')}_${new Date().getTime()}.pdf`);
  },

  /**
   * Export data to Excel
   */
  exportExcel: (title, columns, data) => {
    const worksheet = XLSX.utils.json_to_sheet(data.map(row => {
        const obj = {};
        columns.forEach((col, i) => {
            obj[col] = row[i];
        });
        return obj;
    }));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Data");
    XLSX.writeFile(workbook, `${title.toLowerCase().replace(/\s+/g, '_')}_${new Date().getTime()}.xlsx`);
  },

  /**
   * Print table
   */
  printTable: (title, columns, data, filters = {}) => {
    const date = fmtDateTime(new Date());
    const filterStrings = Object.entries(filters)
      .filter(([_, v]) => v && v !== '')
      .map(([k, v]) => `<strong>${k}:</strong> ${v}`);

    const html = `
      <html>
        <head>
          <title>${title}</title>
          <style>
            body { font-family: sans-serif; padding: 40px; color: #333; }
            .header { margin-bottom: 30px; border-bottom: 2px solid #eee; padding-bottom: 20px; }
            .company { font-size: 24px; font-weight: bold; }
            .title { font-size: 18px; color: #666; margin-top: 5px; }
            .meta { font-size: 12px; color: #999; margin-top: 10px; }
            .filters { font-size: 12px; margin-top: 10px; color: #555; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #eee; padding: 10px; text-align: left; font-size: 12px; }
            th { background: #f9f9f9; font-weight: bold; }
            @media print {
              .no-print { display: none; }
              body { padding: 0; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="company">${COMPANY_NAME}</div>
            <div class="title">${title}</div>
            <div class="meta">Generated: ${date}</div>
            ${filterStrings.length ? `<div class="filters">Filters: ${filterStrings.join(' | ')}</div>` : ''}
          </div>
          <table>
            <thead>
              <tr>${columns.map(c => `<th>${c}</th>`).join('')}</tr>
            </thead>
            <tbody>
              ${data.map(row => `<tr>${row.map(cell => `<td>${cell || ''}</td>`).join('')}</tr>`).join('')}
            </tbody>
          </table>
          <script>window.print(); setTimeout(() => window.close(), 500);</script>
        </body>
      </html>
    `;

    const win = window.open('', '_blank');
    win.document.write(html);
    win.document.close();
  }
};
