import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function AdminLogin() {
  const { login, user, loading: authLoading } = useAuth();

  if (!authLoading && user?.role === 'system_admin') return <Navigate to="/admin" replace />;
  const [form, setForm]     = useState({ email: '', password: '' });
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);

  function handle(e) { setForm(f => ({ ...f, [e.target.name]: e.target.value })); }

  async function submit(e) {
    e.preventDefault();
    setError(''); setLoading(true);
    const API = import.meta.env.VITE_API_BASE || '/api';
    try {
      const res = await fetch(`${API}/auth/admin-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: form.email, password: form.password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');
      login(data.admin ? { ...data.admin, role: 'system_admin' } : data);
      window.location.href = '/admin';
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#0f172a',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div style={{
        background: '#1e293b', borderRadius: 12, padding: '40px 36px',
        width: '100%', maxWidth: 400, boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
      }}>
        {/* Logo / header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 56, height: 56, background: '#6366f1', borderRadius: 12,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 24, fontWeight: 700, color: '#fff', margin: '0 auto 16px',
          }}>S</div>
          <h1 style={{ color: '#f1f5f9', fontSize: 22, fontWeight: 700, margin: 0 }}>
            System Admin Console
          </h1>
          <p style={{ color: '#64748b', fontSize: 13, marginTop: 6 }}>
            Platform administrators only
          </p>
        </div>

        {error && (
          <div style={{
            background: '#450a0a', border: '1px solid #7f1d1d', borderRadius: 8,
            padding: '10px 14px', marginBottom: 20, color: '#fca5a5', fontSize: 13,
          }}>
            {error}
          </div>
        )}

        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ color: '#94a3b8', fontSize: 12, fontWeight: 600,
                            textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 6 }}>
              Email
            </label>
            <input
              name="email"
              type="email"
              value={form.email}
              onChange={handle}
              required
              autoFocus
              style={{
                width: '100%', padding: '10px 14px', background: '#0f172a',
                border: '1px solid #334155', borderRadius: 8, color: '#f1f5f9',
                fontSize: 14, outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>

          <div>
            <label style={{ color: '#94a3b8', fontSize: 12, fontWeight: 600,
                            textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 6 }}>
              Password
            </label>
            <input
              name="password"
              type="password"
              value={form.password}
              onChange={handle}
              required
              style={{
                width: '100%', padding: '10px 14px', background: '#0f172a',
                border: '1px solid #334155', borderRadius: 8, color: '#f1f5f9',
                fontSize: 14, outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: 8, padding: '11px', background: loading ? '#4338ca' : '#6366f1',
              color: '#fff', border: 'none', borderRadius: 8, fontSize: 14,
              fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background 0.15s',
            }}
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 24, fontSize: 12, color: '#475569' }}>
          Looking for the school portal?{' '}
          <a href="/login" style={{ color: '#818cf8', textDecoration: 'none' }}>Login here</a>
        </p>
      </div>
    </div>
  );
}
