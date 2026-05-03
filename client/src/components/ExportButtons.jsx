import React, { useState } from 'react';
import { Download, Printer, FileText, FileSpreadsheet, ChevronDown } from 'lucide-react';
import { exportUtils } from '../utils/exportUtils';

/**
 * Common Export/Print button component for all inventory modules
 * @param {string} title - Title of the report
 * @param {Array} columns - Header names (e.g. ['SKU', 'Product', 'Price'])
 * @param {Array} data - Filtered table data as arrays of values
 * @param {Object} filters - Current active filters to show in header
 */
export default function ExportButtons({ title, columns, data, filters = {} }) {
  const [showMenu, setShowMenu] = useState(false);

  const handleExportPDF = () => {
    exportUtils.exportPDF(title, columns, data, filters);
    setShowMenu(false);
  };

  const handleExportExcel = () => {
    exportUtils.exportExcel(title, columns, data);
    setShowMenu(false);
  };

  const handlePrint = () => {
    exportUtils.printTable(title, columns, data, filters);
    setShowMenu(false);
  };

  return (
    <div className="relative inline-block text-left">
      <div className="flex gap-2">
        <button 
          onClick={handlePrint}
          className="btn-secondary btn-sm flex items-center gap-2"
          title="Print current view"
        >
          <Printer className="w-4 h-4" />
          <span className="hidden sm:inline">Print</span>
        </button>
        
        <div className="relative">
          <button 
            onClick={() => setShowMenu(!showMenu)}
            className="btn-primary btn-sm flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Export</span>
            <ChevronDown className={`w-3 h-3 transition-transform ${showMenu ? 'rotate-180' : ''}`} />
          </button>

          {showMenu && (
            <>
              <div 
                className="fixed inset-0 z-40" 
                onClick={() => setShowMenu(false)}
              />
              <div className="absolute right-0 mt-2 w-48 rounded-xl bg-surface-800 border border-surface-700 shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in duration-150">
                <button 
                  onClick={handleExportPDF}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-surface-200 hover:bg-white/[0.05] transition-colors"
                >
                  <FileText className="w-4 h-4 text-red-400" />
                  Export as PDF
                </button>
                <button 
                  onClick={handleExportExcel}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-surface-200 hover:bg-white/[0.05] transition-colors"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                  Export as Excel
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
