import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';

const Dashboard   = lazy(() => import('./pages/Dashboard'));
const POS         = lazy(() => import('./pages/POS'));
const Preorders   = lazy(() => import('./pages/Preorders'));
const Inventory   = lazy(() => import('./pages/Inventory'));
const Customers   = lazy(() => import('./pages/Customers'));
const GroupBuys   = lazy(() => import('./pages/GroupBuys'));
const Quotations  = lazy(() => import('./pages/Quotations'));
const Reports     = lazy(() => import('./pages/Reports'));
const Settings    = lazy(() => import('./pages/Settings'));
const Trash       = lazy(() => import('./pages/Trash'));

function Loader() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <Loader />;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Suspense fallback={<Loader />}><Dashboard /></Suspense>} />
        <Route path="pos" element={<Suspense fallback={<Loader />}><POS /></Suspense>} />
        <Route path="preorders" element={<Suspense fallback={<Loader />}><Preorders /></Suspense>} />
        <Route path="inventory" element={<Suspense fallback={<Loader />}><Inventory /></Suspense>} />
        <Route path="customers" element={<Suspense fallback={<Loader />}><Customers /></Suspense>} />
        <Route path="group-buys" element={<Suspense fallback={<Loader />}><GroupBuys /></Suspense>} />
        <Route path="quotations" element={<Suspense fallback={<Loader />}><Quotations /></Suspense>} />
        <Route path="reports" element={<Suspense fallback={<Loader />}><Reports /></Suspense>} />
        <Route path="settings" element={<Suspense fallback={<Loader />}><Settings /></Suspense>} />
        <Route path="trash" element={<Suspense fallback={<Loader />}><Trash /></Suspense>} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
          <Toaster
          position="top-right"
          toastOptions={{
            style: { background: 'var(--bg-800)', color: 'var(--text-100)', border: '1px solid var(--border)', fontFamily: 'Syne, sans-serif', fontSize: '14px' },
            success: { iconTheme: { primary: '#10b981', secondary: 'var(--bg-800)' } },
            error: { iconTheme: { primary: '#ef4444', secondary: 'var(--bg-800)' } },
          }}
        />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
