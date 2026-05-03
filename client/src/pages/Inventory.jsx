import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../utils/api';
import { Package, AlertTriangle, Clock, FolderTree, Tag, Warehouse, Store, ArrowRightLeft, ClipboardList } from 'lucide-react';
import toast from 'react-hot-toast';

import InvAllProducts from './inventory/InvAllProducts';
import InvLowStock from './inventory/InvLowStock';
import InvSlowMoving from './inventory/InvSlowMoving';
import InvCategories from './inventory/InvCategories';
import InvBrands from './inventory/InvBrands';
import InvWarehouseStock from './inventory/InvWarehouseStock';
import InvShowroomStock from './inventory/InvShowroomStock';
import InvTransfers from './inventory/InvTransfers';
import InvAdjustments from './inventory/InvAdjustments';

const TABS = [
  { id: 'all', label: 'All Products', icon: Package },
  { id: 'low', label: 'Low Stock', icon: AlertTriangle },
  { id: 'slow', label: 'Slow Moving', icon: Clock },
  { id: 'categories', label: 'Categories', icon: FolderTree },
  { id: 'brands', label: 'Brands', icon: Tag },
  { id: 'warehouse', label: 'Warehouse', icon: Warehouse },
  { id: 'showroom', label: 'Showroom', icon: Store },
  { id: 'transfers', label: 'Transfers', icon: ArrowRightLeft },
  { id: 'adjustments', label: 'Adjustments', icon: ClipboardList },
];

export default function Inventory() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'all';

  const setActiveTab = (id) => {
    setSearchParams({ tab: id });
  };

  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);

  const loadMeta = async () => {
    try {
      const [c, b] = await Promise.all([
        api.get('/inventory/categories'),
        api.get('/inventory/brands'),
      ]);
      setCategories(c); setBrands(b);
    } catch { /* silent */ }
  };

  useEffect(() => { loadMeta(); }, []);

  const renderTab = () => {
    switch (activeTab) {
      case 'all': return <InvAllProducts categories={categories} brands={brands} onRefresh={loadMeta} />;
      case 'low': return <InvLowStock />;
      case 'slow': return <InvSlowMoving />;
      case 'categories': return <InvCategories categories={categories} onRefresh={loadMeta} />;
      case 'brands': return <InvBrands brands={brands} onRefresh={loadMeta} />;
      case 'warehouse': return <InvWarehouseStock />;
      case 'showroom': return <InvShowroomStock />;
      case 'transfers': return <InvTransfers />;
      case 'adjustments': return <InvAdjustments />;
      default: return null;
    }
  };

  return (
    <div className="animate-fade-in flex gap-0" style={{ minHeight: 'calc(100vh - 8rem)' }}>
      {/* Sub-sidebar */}
      <div className="w-52 flex-shrink-0 pr-4" style={{ borderRight: '1px solid var(--border)' }}>
        <div className="sticky top-0">
          <h1 className="text-lg font-bold text-white mb-1">Inventory</h1>
          <p className="text-xs text-surface-500 mb-4">Management Hub</p>
          <nav className="space-y-0.5">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200
                  ${activeTab === id
                    ? 'text-white'
                    : 'text-surface-400 hover:text-surface-200 hover:bg-white/[0.03]'
                  }`}
                style={activeTab === id ? {
                  background: 'linear-gradient(135deg, rgba(59,130,246,0.15), rgba(59,130,246,0.05))',
                  borderLeft: '2px solid #3b82f6',
                } : { borderLeft: '2px solid transparent' }}
              >
                <Icon className="w-4 h-4 flex-shrink-0" style={activeTab === id ? { color: '#60a5fa' } : {}} />
                <span>{label}</span>
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 pl-6 min-w-0">
        {renderTab()}
      </div>
    </div>
  );
}
