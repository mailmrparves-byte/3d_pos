import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import {
  LayoutDashboard, ShoppingCart, Package, Users, Truck,
  BarChart3, Settings, LogOut, Menu, X, ShoppingBag,
  Users2, Layers, Bell, Zap, Sun, Moon, ChevronRight, Trash2, FileText
} from 'lucide-react';

const navItems = [
  { to: '/dashboard',  icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/pos',        icon: ShoppingCart,    label: 'Point of Sale' },
  { to: '/preorders',  icon: ShoppingBag,     label: 'Preorders' },
  { to: '/inventory',  icon: Package,         label: 'Inventory' },
  { to: '/customers',  icon: Users,           label: 'Customers' },
  { to: '/group-buys', icon: Users2,          label: 'Group Buys' },
  { to: '/quotations', icon: FileText,       label: 'Quotations' },
  { to: '/reports',    icon: BarChart3,       label: 'Reports' },
  { to: '/settings',   icon: Settings,        label: 'Settings' },
  { to: '/trash',      icon: Trash2,          label: 'Trash Bin' },
];

const roleColors = {
  admin: '#60a5fa', manager: '#c084fc', salesperson: '#34d399',
  inventory: '#fbbf24', accountant: '#22d3ee'
};
const roleBg = {
  admin: 'rgba(96,165,250,0.12)', manager: 'rgba(192,132,252,0.12)',
  salesperson: 'rgba(52,211,153,0.12)', inventory: 'rgba(251,191,36,0.12)', accountant: 'rgba(34,211,238,0.12)'
};

export default function Layout() {
  const { user, logout } = useAuth();
  const { dark, toggle } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const navigate = useNavigate();

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: 'var(--bg-base)' }}>

      {/* ── Sidebar ─────────────────────── */}
      <aside
        className={`flex flex-col flex-shrink-0 transition-all duration-300 ease-in-out ${sidebarOpen ? 'w-64' : 'w-0 overflow-hidden'}`}
        style={{ backgroundColor: 'var(--sidebar-bg)', borderRight: '1px solid var(--border)' }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-5" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 animate-float"
            style={{ background: 'linear-gradient(135deg,#3b82f6,#1d4ed8)', boxShadow: '0 4px 14px rgba(59,130,246,0.45)' }}>
            <Layers className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="font-display font-bold text-sm leading-tight" style={{ color: 'var(--text-100)' }}>Industrial 3D</div>
            <div className="text-xs font-medium" style={{ color: 'var(--text-500)' }}>Solution POS</div>
          </div>
        </div>

        {/* Nav label */}
        <div className="px-4 pt-4 pb-1">
          <span className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-500)', letterSpacing: '0.1em' }}>Navigation</span>
        </div>

        {/* Nav items */}
        <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
          {navItems.map(({ to, icon: Icon, label }, i) => (
            <NavLink
              key={to}
              to={to}
              style={{ animationDelay: `${i * 40}ms` }}
              className={({ isActive }) => `sidebar-item animate-slide-in ${isActive ? 'active' : ''}`}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span className="font-medium">{label}</span>
              {/* Active indicator */}
            </NavLink>
          ))}
        </nav>

        {/* User card */}
        <div className="p-3" style={{ borderTop: '1px solid var(--border)' }}>
          <div
            className="flex items-center gap-3 p-3 rounded-xl transition-all duration-200 group cursor-default"
            style={{ backgroundColor: 'var(--bg-800)', border: '1px solid var(--border)' }}
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
              style={{ background: 'linear-gradient(135deg,#3b82f6,#7c3aed)', boxShadow: '0 2px 8px rgba(124,58,237,0.4)' }}
            >
              {user?.name?.charAt(0)?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold truncate" style={{ color: 'var(--text-100)', fontFamily: "'Inter',sans-serif" }}>{user?.name}</div>
              <div
                className="text-xs font-medium capitalize px-1.5 py-0.5 rounded-full inline-block mt-0.5"
                style={{ color: roleColors[user?.role] || '#94a3b8', backgroundColor: roleBg[user?.role] || 'transparent' }}
              >
                {user?.role}
              </div>
            </div>
            <button
              onClick={logout}
              className="icon-btn opacity-0 group-hover:opacity-100 hover:!text-red-400 transition-opacity"
              title="Logout"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main ────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Top bar */}
        <header
          className="h-14 flex items-center gap-3 px-5 flex-shrink-0"
          style={{
            borderBottom: '1px solid var(--border)',
            backgroundColor: 'var(--header-bg)',
            backdropFilter: 'blur(16px)',
          }}
        >
          {/* Sidebar toggle */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="icon-btn"
            title="Toggle sidebar"
          >
            <Menu className="w-4 h-4" />
          </button>

          {/* Live indicator */}
          <div className="flex items-center gap-1.5 text-xs font-medium" style={{ color: 'var(--text-500)' }}>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse-slow inline-block" />
            Live
          </div>

          <div className="flex-1" />

          {/* Right controls */}
          <div className="flex items-center gap-2">
            {/* Theme toggle */}
            <button onClick={toggle} className="theme-toggle" title={dark ? 'Light mode' : 'Dark mode'}>
              {dark
                ? <Sun className="w-4 h-4 text-amber-400" />
                : <Moon className="w-4 h-4 text-blue-500" />
              }
            </button>

            {/* Bell */}
            <button className="icon-btn relative">
              <Bell className="w-4 h-4" />
            </button>

            {/* New Sale CTA */}
            <button
              onClick={() => navigate('/pos')}
              className="btn-primary btn-sm hidden sm:flex items-center gap-2"
            >
              <Zap className="w-3.5 h-3.5" />
              New Sale
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-6 animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
