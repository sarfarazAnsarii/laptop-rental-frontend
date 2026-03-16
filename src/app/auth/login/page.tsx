'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Laptop, Eye, EyeOff, ArrowRight } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();
  const router = useRouter();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await login(email, password);
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden" style={{ background: '#0B1628' }}>
      {/* BG decoration */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-20%] right-[-10%] w-96 h-96 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #3B82F6, transparent)' }} />
        <div className="absolute bottom-[-20%] left-[-10%] w-80 h-80 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #14B8A6, transparent)' }} />
        {/* Grid lines */}
        <div className="absolute inset-0 opacity-5"
          style={{ backgroundImage: 'linear-gradient(#3B82F6 1px, transparent 1px), linear-gradient(90deg, #3B82F6 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
      </div>

      <div className="w-full max-w-md animate-fade-in">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: 'linear-gradient(135deg, #3B82F6, #14B8A6)', boxShadow: '0 0 40px rgba(59,130,246,0.3)' }}>
            <Laptop size={26} color="white" />
          </div>
          <h1 className="text-2xl font-bold mb-1" style={{ fontFamily: 'Syne, sans-serif', color: '#F1F5F9' }}>LaptopRent</h1>
          <p className="text-sm" style={{ color: '#64748B' }}>Sign in to your workspace</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl p-8" style={{ background: 'rgba(19,32,64,0.6)', border: '1px solid #1E3058', backdropFilter: 'blur(20px)' }}>
          {error && (
            <div className="mb-4 px-4 py-3 rounded-xl text-sm" style={{ background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.3)', color: '#F43F5E' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: '#64748B' }}>Email Address</label>
              <input className="inp" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@example.com" required />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: '#64748B' }}>Password</label>
              <div className="relative">
                <input className="inp pr-10" type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required />
                <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: '#475569' }}>
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading}
              className="w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all mt-2"
              style={{ background: 'linear-gradient(135deg, #3B82F6, #2563EB)', color: 'white', boxShadow: '0 4px 24px rgba(59,130,246,0.3)' }}>
              {loading ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Signing in...</> : <><span>Sign In</span><ArrowRight size={16} /></>}
            </button>
          </form>
        </div>

        <p className="text-center text-xs mt-6" style={{ color: '#334155' }}>
          Laptop Rental Inventory Management System
        </p>
      </div>
    </div>
  );
}
