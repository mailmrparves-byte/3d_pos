import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Layers, Eye, EyeOff, Zap, Shield } from 'lucide-react';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const [email, setEmail] = useState('admin@industrial.com.bd');
  const [password, setPassword] = useState('admin123');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      navigate('/dashboard');
      toast.success('Welcome back!');
    } catch (err) {
      toast.error(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{ backgroundColor: 'var(--bg-base)' }}>

      {/* Animated background blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/3 w-96 h-96 rounded-full opacity-20 animate-float"
          style={{ background: 'radial-gradient(circle,#3b82f6,transparent)', filter: 'blur(80px)' }} />
        <div className="absolute bottom-1/4 right-1/4 w-72 h-72 rounded-full opacity-15"
          style={{ background: 'radial-gradient(circle,#7c3aed,transparent)', filter: 'blur(80px)', animation: 'float 4s ease-in-out infinite reverse' }} />
        <div className="absolute top-3/4 left-1/4 w-48 h-48 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle,#10b981,transparent)', filter: 'blur(60px)', animation: 'float 5s ease-in-out infinite 1s' }} />
      </div>

      {/* Grid pattern overlay */}
      <div className="absolute inset-0 opacity-5 pointer-events-none"
        style={{ backgroundImage: 'linear-gradient(var(--text-400) 1px,transparent 1px),linear-gradient(90deg,var(--text-400) 1px,transparent 1px)', backgroundSize: '40px 40px' }} />

      <div className="w-full max-w-sm relative z-10 animate-slide-up">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-5 animate-float"
            style={{ background: 'linear-gradient(135deg,#3b82f6,#1d4ed8)', boxShadow: '0 8px 32px rgba(59,130,246,0.5)' }}>
            <Layers className="w-8 h-8 text-white" />
          </div>
          <h1 className="font-display text-2xl font-bold mb-1" style={{ color: 'var(--text-100)', letterSpacing: '-0.03em' }}>
            Industrial 3D Solution
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-500)' }}>Inventory & POS Management System</p>
        </div>

        {/* Card */}
        <div className="neo-card p-7">
          {/* Card header */}
          <div className="flex items-center gap-2 mb-6 pb-4" style={{ borderBottom: '1px solid var(--border)' }}>
            <Shield className="w-4 h-4 text-brand-400" style={{ color: '#60a5fa' }} />
            <span className="text-sm font-semibold" style={{ color: 'var(--text-300)' }}>Secure Sign In</span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="label">Email Address</label>
              <input
                id="login-email"
                type="email"
                className="input-field"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="admin@industrial.com.bd"
                required
                autoComplete="email"
              />
            </div>

            <div>
              <label className="label">Password</label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPw ? 'text' : 'password'}
                  className="input-field"
                  style={{ paddingRight: '2.75rem' }}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 icon-btn"
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              id="login-submit"
              type="submit"
              disabled={loading}
              className="btn-primary w-full justify-center btn-lg"
              style={{ marginTop: '0.75rem' }}
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <><Zap className="w-4 h-4" /> Sign In</>
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-xs mt-6" style={{ color: 'var(--text-500)' }}>
          Industrial 3D Solution © {new Date().getFullYear()} &nbsp;·&nbsp;
          <a href="mailto:support@industrial.com.bd" className="hover:underline" style={{ color: 'var(--text-400)' }}>
            support@industrial.com.bd
          </a>
        </p>
      </div>
    </div>
  );
}
