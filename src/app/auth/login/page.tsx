'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Laptop, Eye, EyeOff, ArrowRight, X, Mail, KeyRound, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';

type FpStep = 'email' | 'reset' | 'done';

export default function LoginPage() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const { login } = useAuth();
  const router = useRouter();

  // forgot password flow
  const [showFp, setShowFp]   = useState(false);
  const [fpStep, setFpStep]   = useState<FpStep>('email');
  const [fpEmail, setFpEmail] = useState('');
  const [fpOtp, setFpOtp]     = useState('');
  const [fpPwd, setFpPwd]     = useState('');
  const [fpConfirm, setFpConfirm] = useState('');
  const [fpLoading, setFpLoading] = useState(false);
  const [fpMsg, setFpMsg]     = useState<{ text: string; ok: boolean } | null>(null);
  const [showFpPwd, setShowFpPwd] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      await login(email, password);
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Invalid credentials');
    } finally { setLoading(false); }
  }

  async function handleFpEmail() {
    if (!fpEmail) return;
    setFpLoading(true); setFpMsg(null);
    try {
      await api.auth.forgotPassword(fpEmail);
      setFpMsg({ text: 'OTP sent to your email. Valid for 15 minutes.', ok: true });
      setFpStep('reset');
    } catch (e: any) {
      setFpMsg({ text: e.message || 'Failed to send OTP', ok: false });
    } finally { setFpLoading(false); }
  }

  async function handleFpReset() {
    if (!fpOtp || !fpPwd || !fpConfirm) return;
    setFpLoading(true); setFpMsg(null);
    try {
      await api.auth.resetPassword({ email: fpEmail, otp: fpOtp, password: fpPwd, password_confirmation: fpConfirm });
      setFpStep('done');
    } catch (e: any) {
      setFpMsg({ text: e.message || 'Failed to reset password', ok: false });
    } finally { setFpLoading(false); }
  }

  function closeFp() {
    setShowFp(false); setFpStep('email');
    setFpEmail(''); setFpOtp(''); setFpPwd(''); setFpConfirm('');
    setFpMsg(null);
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden" style={{ background: '#0B1628' }}>
      {/* BG decoration */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-20%] right-[-10%] w-96 h-96 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #3B82F6, transparent)' }} />
        <div className="absolute bottom-[-20%] left-[-10%] w-80 h-80 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #14B8A6, transparent)' }} />
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
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wide" style={{ color: '#64748B' }}>Password</label>
                <button type="button" onClick={() => { setShowFp(true); setFpEmail(email); }}
                  className="text-xs font-medium transition-colors hover:underline" style={{ color: '#3B82F6' }}>
                  Forgot Password?
                </button>
              </div>
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

      {/* Forgot Password Modal */}
      {showFp && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={closeFp} />
          <div className="relative w-full max-w-sm sm:rounded-2xl rounded-t-2xl shadow-2xl animate-fade-in"
            style={{ background: '#111827', border: '1px solid #1E3058' }}>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #1E3058' }}>
              <h2 className="font-bold text-base flex items-center gap-2" style={{ fontFamily: 'Syne, sans-serif', color: '#F1F5F9' }}>
                {fpStep === 'done' ? <ShieldCheck size={15} style={{ color: '#10B981' }} /> : <KeyRound size={15} style={{ color: '#3B82F6' }} />}
                {fpStep === 'email' ? 'Forgot Password' : fpStep === 'reset' ? 'Reset Password' : 'Password Reset'}
              </h2>
              <button onClick={closeFp} className="p-1.5 rounded-lg hover:bg-white/10" style={{ color: '#64748B' }}><X size={16} /></button>
            </div>

            <div className="p-5 space-y-4">
              {/* Step 1 — Email */}
              {fpStep === 'email' && (
                <>
                  <p className="text-sm" style={{ color: '#64748B' }}>Enter your email and we'll send a 6-digit OTP to reset your password.</p>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: '#64748B' }}>Email Address</label>
                    <div className="relative">
                      <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#475569' }} />
                      <input className="inp pl-9" type="email" value={fpEmail} onChange={e => setFpEmail(e.target.value)} placeholder="your@email.com" />
                    </div>
                  </div>
                  {fpMsg && <div className="px-3 py-2 rounded-xl text-sm" style={{ background: fpMsg.ok ? 'rgba(16,185,129,0.08)' : 'rgba(244,63,94,0.08)', border: `1px solid ${fpMsg.ok ? 'rgba(16,185,129,0.25)' : 'rgba(244,63,94,0.25)'}`, color: fpMsg.ok ? '#10B981' : '#F43F5E' }}>{fpMsg.text}</div>}
                  <div className="flex justify-end gap-3 pt-1">
                    <button onClick={closeFp} className="px-4 py-2 rounded-xl text-sm font-semibold bg-white/5 hover:bg-white/10 border border-white/10" style={{ color: '#94A3B8' }}>Cancel</button>
                    <button onClick={handleFpEmail} disabled={fpLoading || !fpEmail}
                      className="px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50 transition-all"
                      style={{ background: '#3B82F6', color: 'white' }}>
                      {fpLoading ? 'Sending...' : 'Send OTP'}
                    </button>
                  </div>
                </>
              )}

              {/* Step 2 — OTP + new password */}
              {fpStep === 'reset' && (
                <>
                  <div className="px-3 py-2 rounded-xl text-xs" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', color: '#10B981' }}>
                    OTP sent to <strong>{fpEmail}</strong>. Check your inbox.
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: '#64748B' }}>6-Digit OTP</label>
                    <input className="inp font-mono tracking-widest text-center text-lg" maxLength={6} value={fpOtp} onChange={e => setFpOtp(e.target.value.replace(/\D/g, ''))} placeholder="000000" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: '#64748B' }}>New Password</label>
                    <div className="relative">
                      <input className="inp pr-10" type={showFpPwd ? 'text' : 'password'} value={fpPwd} onChange={e => setFpPwd(e.target.value)} placeholder="••••••••" />
                      <button type="button" onClick={() => setShowFpPwd(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: '#475569' }}>
                        {showFpPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: '#64748B' }}>Confirm New Password</label>
                    <input className="inp" type="password" value={fpConfirm} onChange={e => setFpConfirm(e.target.value)} placeholder="••••••••" />
                  </div>
                  {fpMsg && <div className="px-3 py-2 rounded-xl text-sm" style={{ background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.25)', color: '#F43F5E' }}>{fpMsg.text}</div>}
                  <div className="flex justify-between gap-3 pt-1">
                    <button onClick={() => { setFpStep('email'); setFpMsg(null); }} className="px-4 py-2 rounded-xl text-sm font-semibold bg-white/5 hover:bg-white/10 border border-white/10" style={{ color: '#94A3B8' }}>Back</button>
                    <button onClick={handleFpReset} disabled={fpLoading || !fpOtp || !fpPwd || !fpConfirm}
                      className="px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50 transition-all"
                      style={{ background: '#3B82F6', color: 'white' }}>
                      {fpLoading ? 'Resetting...' : 'Reset Password'}
                    </button>
                  </div>
                </>
              )}

              {/* Step 3 — Done */}
              {fpStep === 'done' && (
                <>
                  <div className="text-center py-4 space-y-3">
                    <div className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center" style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)' }}>
                      <ShieldCheck size={26} style={{ color: '#10B981' }} />
                    </div>
                    <div className="font-bold text-base" style={{ fontFamily: 'Syne, sans-serif', color: '#F1F5F9' }}>Password Reset!</div>
                    <p className="text-sm" style={{ color: '#64748B' }}>Your password has been updated. You can now sign in with your new password.</p>
                  </div>
                  <button onClick={closeFp} className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all" style={{ background: '#3B82F6', color: 'white' }}>
                    Back to Sign In
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
