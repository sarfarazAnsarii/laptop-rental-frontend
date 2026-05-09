'use client';

import { useState, FormEvent, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Eye, EyeOff, ArrowRight, Mail, KeyRound, ShieldCheck,
  Check, Monitor, TrendingUp, Users, FileText, Laptop2,
  Lock, Loader2, X, ChevronRight,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';

type FpStep = 'email' | 'reset' | 'done';

/* ─── tiny helpers ─────────────────────────────────────── */
const C = {
  bg:        '#F8FAFC',
  primary:   '#2563EB',
  accent:    '#7C3AED',
  text:      '#0F172A',
  sub:       '#64748B',
  border:    '#E2E8F0',
  card:      '#FFFFFF',
  danger:    '#EF4444',
  success:   '#10B981',
};

/* Dashboard preview data */
const PREVIEW_STATS = [
  { label: 'Laptops',   value: '248', color: '#2563EB', sub: '+12 this month' },
  { label: 'Rentals',   value: '94',  color: '#7C3AED', sub: '11 expiring soon' },
  { label: 'Revenue',   value: '₹4.2L', color: '#10B981', sub: 'This month' },
];
const PREVIEW_ROWS = [
  { code: 'LR-042', name: 'Dell Latitude 5520', status: 'Rented',   color: '#2563EB' },
  { code: 'LR-071', name: 'HP ProBook 450 G9',  status: 'Available', color: '#10B981' },
  { code: 'LR-103', name: 'Lenovo ThinkPad X1', status: 'Rented',   color: '#2563EB' },
];
const PREVIEW_BARS = [28, 45, 38, 62, 55, 74, 68, 82, 75, 90, 85, 100];

const FEATURES = [
  { icon: Monitor,    text: 'Real-time inventory tracking' },
  { icon: FileText,   text: 'Automated billing & invoices'  },
  { icon: TrendingUp, text: 'Revenue & TDS reporting'       },
  { icon: Users,      text: 'Multi-role team access'        },
];

/* ─── Main component ──────────────────────────────────── */
export default function LoginPage() {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [remember, setRemember] = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const { login } = useAuth();
  const router = useRouter();

  // Pre-fill remembered email
  useEffect(() => {
    const saved = localStorage.getItem('lr_remember_email');
    if (saved) { setEmail(saved); setRemember(true); }
  }, []);

  // Forgot-password flow
  const [showFp,     setShowFp]     = useState(false);
  const [fpStep,     setFpStep]     = useState<FpStep>('email');
  const [fpEmail,    setFpEmail]    = useState('');
  const [fpOtp,      setFpOtp]      = useState('');
  const [fpPwd,      setFpPwd]      = useState('');
  const [fpConfirm,  setFpConfirm]  = useState('');
  const [fpLoading,  setFpLoading]  = useState(false);
  const [fpMsg,      setFpMsg]      = useState<{ text: string; ok: boolean } | null>(null);
  const [showFpPwd,  setShowFpPwd]  = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      await login(email, password);
      if (remember) localStorage.setItem('lr_remember_email', email);
      else          localStorage.removeItem('lr_remember_email');
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Invalid credentials. Please try again.');
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
    if (fpPwd !== fpConfirm) {
      setFpMsg({ text: 'Passwords do not match', ok: false }); return;
    }
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

  function openFp() {
    setFpEmail(email); setShowFp(true);
  }

  /* ── Render ─────────────────────────────────────────── */
  return (
    <div className="min-h-screen flex" style={{ background: C.bg, fontFamily: "'DM Sans', system-ui, sans-serif" }}>

      {/* ═══════════════ LEFT PANEL ═══════════════ */}
      <div className="hidden lg:flex flex-col justify-between relative overflow-hidden auth-left-animate"
        style={{
          width: '56%',
          background: 'linear-gradient(135deg, #1E3A8A 0%, #2563EB 45%, #7C3AED 100%)',
          padding: '48px 56px',
        }}>

        {/* Animated blobs */}
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
          <div style={{
            position: 'absolute', top: '-8%', right: '-5%',
            width: 480, height: 480,
            background: 'radial-gradient(circle, rgba(124,58,237,0.5) 0%, transparent 70%)',
            animation: 'auth-blob 9s ease-in-out infinite',
          }} />
          <div style={{
            position: 'absolute', bottom: '-12%', left: '-8%',
            width: 440, height: 440,
            background: 'radial-gradient(circle, rgba(14,165,233,0.4) 0%, transparent 70%)',
            animation: 'auth-blob 11s ease-in-out infinite reverse',
            animationDelay: '2s',
          }} />
          <div style={{
            position: 'absolute', top: '40%', left: '30%',
            width: 280, height: 280,
            background: 'radial-gradient(circle, rgba(16,185,129,0.18) 0%, transparent 70%)',
            animation: 'auth-blob 13s ease-in-out infinite',
            animationDelay: '1s',
          }} />
          {/* Subtle grid */}
          <div style={{
            position: 'absolute', inset: 0, opacity: 0.06,
            backgroundImage: 'linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }} />
        </div>

        {/* Top — Logo */}
        <div style={{ position: 'relative', zIndex: 2 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: 'rgba(255,255,255,0.15)',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255,255,255,0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Laptop2 size={22} color="white" />
            </div>
            <span style={{ fontSize: 20, fontWeight: 800, color: 'white', fontFamily: 'Syne, sans-serif', letterSpacing: '-0.02em' }}>
              LaptopRent
            </span>
          </div>
        </div>

        {/* Middle — Headline + Features */}
        <div style={{ position: 'relative', zIndex: 2, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingTop: 40, paddingBottom: 32 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: 'rgba(255,255,255,0.12)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: 100,
            padding: '4px 12px 4px 4px',
            marginBottom: 24,
            width: 'fit-content',
          }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#10B981', animation: 'auth-dot-pulse 2s ease-in-out infinite' }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>Trusted by 200+ businesses</span>
          </div>

          <h1 style={{
            fontSize: 46, fontWeight: 900, lineHeight: 1.08,
            color: 'white', fontFamily: 'Syne, sans-serif',
            letterSpacing: '-0.03em', marginBottom: 18,
          }}>
            Manage Your Fleet,<br />
            <span style={{ color: 'rgba(255,255,255,0.6)' }}>Effortlessly.</span>
          </h1>
          <p style={{ fontSize: 17, color: 'rgba(255,255,255,0.65)', lineHeight: 1.6, marginBottom: 36, maxWidth: 420 }}>
            Complete laptop rental management — from inventory to invoicing — built for modern businesses.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {FEATURES.map(({ icon: Icon, text }) => (
              <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                  background: 'rgba(255,255,255,0.12)',
                  border: '1px solid rgba(255,255,255,0.18)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon size={15} color="rgba(255,255,255,0.85)" />
                </div>
                <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.8)', fontWeight: 500 }}>{text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom — Dashboard preview card */}
        <div style={{ position: 'relative', zIndex: 2 }} className="auth-float-animate">
          <div style={{
            background: 'rgba(255,255,255,0.08)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255,255,255,0.16)',
            borderRadius: 16,
            overflow: 'hidden',
            boxShadow: '0 24px 64px rgba(0,0,0,0.25)',
          }}>
            {/* Window chrome */}
            <div style={{
              background: 'rgba(0,0,0,0.15)',
              borderBottom: '1px solid rgba(255,255,255,0.08)',
              padding: '10px 14px',
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <div style={{ display: 'flex', gap: 5 }}>
                {['#F43F5E','#F59E0B','#10B981'].map(c => (
                  <div key={c} style={{ width: 9, height: 9, borderRadius: '50%', background: c, opacity: 0.8 }} />
                ))}
              </div>
              <div style={{ flex: 1, height: 5, background: 'rgba(255,255,255,0.08)', borderRadius: 3, maxWidth: 140 }} />
              <div style={{ display: 'flex', gap: 4 }}>
                {[60, 90].map(w => (
                  <div key={w} style={{ width: w, height: 5, background: 'rgba(255,255,255,0.06)', borderRadius: 3 }} />
                ))}
              </div>
            </div>

            <div style={{ padding: '14px 16px' }}>
              {/* Stats */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
                {PREVIEW_STATS.map(s => (
                  <div key={s.label} style={{
                    background: 'rgba(255,255,255,0.06)',
                    borderRadius: 8, padding: '8px 10px',
                    border: '1px solid rgba(255,255,255,0.08)',
                  }}>
                    <div style={{ fontSize: 17, fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</div>
                    <div style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.55)', marginTop: 3, fontWeight: 500 }}>{s.label}</div>
                    <div style={{ fontSize: 8.5, color: 'rgba(255,255,255,0.3)', marginTop: 1 }}>{s.sub}</div>
                  </div>
                ))}
              </div>

              {/* Mini bar chart */}
              <div style={{
                background: 'rgba(0,0,0,0.12)', borderRadius: 8,
                padding: '8px 10px', marginBottom: 10,
                border: '1px solid rgba(255,255,255,0.06)',
              }}>
                <div style={{ fontSize: 8.5, color: 'rgba(255,255,255,0.4)', marginBottom: 7, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Monthly Rentals</div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 28 }}>
                  {PREVIEW_BARS.map((h, i) => (
                    <div key={i} style={{
                      flex: 1, height: `${h}%`, borderRadius: '2px 2px 0 0',
                      background: i >= 10
                        ? 'rgba(99,179,237,0.95)'
                        : `rgba(37,99,235,${0.25 + h / 200})`,
                    }} />
                  ))}
                </div>
              </div>

              {/* Table rows */}
              {PREVIEW_ROWS.map((row, i) => (
                <div key={row.code} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '5px 0',
                  borderBottom: i < PREVIEW_ROWS.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                }}>
                  <div style={{
                    width: 22, height: 22, background: 'rgba(255,255,255,0.07)',
                    borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <Monitor size={10} color="rgba(255,255,255,0.4)" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.75)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.name}</div>
                    <div style={{ fontSize: 8.5, color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace' }}>{row.code}</div>
                  </div>
                  <div style={{
                    fontSize: 8, padding: '2px 6px', borderRadius: 4, fontWeight: 700, flexShrink: 0,
                    background: `${row.color}22`, color: row.color,
                    border: `1px solid ${row.color}44`,
                  }}>{row.status}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════ RIGHT PANEL ═══════════════ */}
      <div className="flex-1 flex flex-col items-center justify-center relative"
        style={{
          padding: '32px 24px',
          background: C.bg,
          /* Dot mesh */
          backgroundImage: 'radial-gradient(circle, #CBD5E1 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }}>

        {/* Soft gradient overlays to fade mesh edges */}
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none',
          background: 'radial-gradient(ellipse 80% 60% at 50% 50%, rgba(248,250,252,0.96) 30%, rgba(248,250,252,0.5) 100%)' }} />

        {/* Mobile logo (hidden on lg) */}
        <div className="lg:hidden flex items-center gap-3 mb-8 relative z-10">
          <div style={{
            width: 38, height: 38, borderRadius: 10,
            background: 'linear-gradient(135deg,#2563EB,#7C3AED)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 16px rgba(37,99,235,0.3)',
          }}>
            <Laptop2 size={18} color="white" />
          </div>
          <span style={{ fontSize: 18, fontWeight: 800, color: C.text, fontFamily: 'Syne, sans-serif', letterSpacing: '-0.02em' }}>
            LaptopRent
          </span>
        </div>

        {/* ── Login Card ── */}
        <div className="auth-card-animate relative z-10 w-full" style={{ maxWidth: 440 }}>
          <div style={{
            background: C.card,
            borderRadius: 24,
            border: `1px solid ${C.border}`,
            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.04), 0 24px 48px -8px rgba(0,0,0,0.10), 0 0 0 1px rgba(0,0,0,0.03)',
            padding: '36px 36px 32px',
          }}>

            {/* Card header */}
            <div style={{ marginBottom: 28 }}>
              {/* Logo mark */}
              <div style={{
                width: 48, height: 48, borderRadius: 14,
                background: 'linear-gradient(135deg,#2563EB,#7C3AED)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 8px 24px rgba(37,99,235,0.3)',
                marginBottom: 20,
              }}>
                <Laptop2 size={22} color="white" />
              </div>
              <h2 style={{ fontSize: 26, fontWeight: 800, color: C.text, fontFamily: 'Syne, sans-serif', letterSpacing: '-0.03em', marginBottom: 6 }}>
                Welcome back
              </h2>
              <p style={{ fontSize: 14.5, color: C.sub }}>Sign in to your workspace to continue</p>
            </div>

            {/* Error banner */}
            {error && (
              <div style={{
                display: 'flex', alignItems: 'flex-start', gap: 10,
                marginBottom: 20, padding: '12px 14px', borderRadius: 12,
                background: 'rgba(239,68,68,0.06)',
                border: '1px solid rgba(239,68,68,0.2)',
              }}>
                <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#EF4444', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                  <X size={10} color="white" strokeWidth={3} />
                </div>
                <span style={{ fontSize: 13.5, color: '#DC2626', lineHeight: 1.5 }}>{error}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit}>
              {/* Email */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 7 }}>
                  Email address
                </label>
                <div style={{ position: 'relative' }}>
                  <Mail size={15} style={{
                    position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)',
                    color: error ? C.danger : '#94A3B8', pointerEvents: 'none',
                    transition: 'color .15s',
                  }} />
                  <input
                    className={`auth-inp ${error ? 'error' : ''}`}
                    style={{ paddingLeft: 40 }}
                    type="email"
                    value={email}
                    onChange={e => { setEmail(e.target.value); setError(''); }}
                    placeholder="you@company.com"
                    autoComplete="email"
                    required
                  />
                </div>
              </div>

              {/* Password */}
              <div style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: C.text }}>Password</label>
                  <button type="button" onClick={openFp}
                    style={{ fontSize: 12.5, fontWeight: 500, color: C.primary, background: 'none', border: 'none', cursor: 'pointer', padding: 0, transition: 'opacity .15s' }}
                    onMouseEnter={e => (e.currentTarget.style.opacity = '0.7')}
                    onMouseLeave={e => (e.currentTarget.style.opacity = '1')}>
                    Forgot password?
                  </button>
                </div>
                <div style={{ position: 'relative' }}>
                  <Lock size={15} style={{
                    position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)',
                    color: '#94A3B8', pointerEvents: 'none',
                  }} />
                  <input
                    className={`auth-inp ${error ? 'error' : ''}`}
                    style={{ paddingLeft: 40, paddingRight: 44 }}
                    type={showPass ? 'text' : 'password'}
                    value={password}
                    onChange={e => { setPassword(e.target.value); setError(''); }}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    required
                  />
                  <button type="button" onClick={() => setShowPass(p => !p)}
                    style={{
                      position: 'absolute', right: 13, top: '50%', transform: 'translateY(-50%)',
                      color: '#94A3B8', background: 'none', border: 'none', cursor: 'pointer', padding: 2,
                      transition: 'color .15s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.color = C.text)}
                    onMouseLeave={e => (e.currentTarget.style.color = '#94A3B8')}>
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Remember me */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 22 }}>
                <input
                  id="remember"
                  type="checkbox"
                  className="auth-checkbox"
                  checked={remember}
                  onChange={e => setRemember(e.target.checked)}
                />
                <label htmlFor="remember" style={{ fontSize: 13, color: C.sub, cursor: 'pointer', userSelect: 'none' }}>
                  Remember me for 30 days
                </label>
              </div>

              {/* Sign in button */}
              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%', padding: '13px',
                  borderRadius: 13, border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
                  background: loading ? '#93C5FD' : 'linear-gradient(135deg,#2563EB,#1D4ED8)',
                  color: 'white', fontSize: 15, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  boxShadow: loading ? 'none' : '0 4px 14px rgba(37,99,235,0.4)',
                  transition: 'all .2s',
                  fontFamily: "'DM Sans', system-ui, sans-serif",
                }}
                onMouseEnter={e => { if (!loading) (e.currentTarget.style.transform = 'translateY(-1px)'); if (!loading) (e.currentTarget.style.boxShadow = '0 6px 20px rgba(37,99,235,0.5)'); }}
                onMouseLeave={e => { (e.currentTarget.style.transform = 'none'); if (!loading) (e.currentTarget.style.boxShadow = '0 4px 14px rgba(37,99,235,0.4)'); }}>
                {loading
                  ? <><Loader2 size={16} className="animate-spin" /> Signing in...</>
                  : <><span>Sign in to workspace</span><ArrowRight size={16} /></>}
              </button>
            </form>

            {/* Divider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, margin: '22px 0' }}>
              <div style={{ flex: 1, height: 1, background: C.border }} />
              <span style={{ fontSize: 12, color: '#94A3B8', fontWeight: 500 }}>OR</span>
              <div style={{ flex: 1, height: 1, background: C.border }} />
            </div>

            {/* Google button (visual only) */}
            <button
              type="button"
              disabled
              style={{
                width: '100%', padding: '11px',
                borderRadius: 13, cursor: 'not-allowed',
                background: 'white', border: `1.5px solid ${C.border}`,
                color: C.text, fontSize: 14, fontWeight: 600,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                opacity: 0.55,
                fontFamily: "'DM Sans', system-ui, sans-serif",
              }}>
              {/* Google 'G' logo */}
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 400 }}>(coming soon)</span>
            </button>

            {/* Footer */}
            <p style={{ textAlign: 'center', fontSize: 12.5, color: '#94A3B8', marginTop: 22 }}>
              Need access?{' '}
              <a href="mailto:accounts@contact.laptoprentalservice.com"
                style={{ color: C.primary, fontWeight: 600, textDecoration: 'none' }}
                onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}>
                Contact admin
              </a>
            </p>
          </div>

          {/* Below-card text */}
          <p style={{ textAlign: 'center', fontSize: 12, color: '#94A3B8', marginTop: 20 }}>
            © 2025 Shine IT Service · Laptop Rental Management
          </p>
        </div>
      </div>

      {/* ═══════════════ FORGOT PASSWORD MODAL ═══════════════ */}
      {showFp && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100,
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        }}>
          {/* Backdrop */}
          <div onClick={closeFp} style={{
            position: 'absolute', inset: 0,
            background: 'rgba(15,23,42,0.45)',
            backdropFilter: 'blur(6px)',
          }} />

          {/* Sheet */}
          <div className="auth-card-animate" style={{
            position: 'relative', zIndex: 1,
            width: '100%', maxWidth: 460,
            background: 'white',
            borderRadius: '24px 24px 0 0',
            boxShadow: '0 -8px 48px rgba(0,0,0,0.18)',
            border: '1px solid #E2E8F0',
            overflow: 'hidden',
          }}>
            {/* Handle */}
            <div style={{ padding: '14px 0 0', display: 'flex', justifyContent: 'center' }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: '#E2E8F0' }} />
            </div>

            {/* Header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 24px 14px',
              borderBottom: `1px solid ${C.border}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 34, height: 34, borderRadius: 9,
                  background: fpStep === 'done' ? 'rgba(16,185,129,0.1)' : 'rgba(37,99,235,0.1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {fpStep === 'done'
                    ? <ShieldCheck size={16} color="#10B981" />
                    : <KeyRound size={16} color="#2563EB" />}
                </div>
                <div>
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: C.text, fontFamily: 'Syne, sans-serif', marginBottom: 1 }}>
                    {fpStep === 'email' ? 'Reset password' : fpStep === 'reset' ? 'Enter new password' : 'Password updated!'}
                  </h3>
                  {/* Step dots */}
                  <div style={{ display: 'flex', gap: 4 }}>
                    {(['email','reset','done'] as FpStep[]).map((s, i) => (
                      <div key={s} style={{
                        width: fpStep === s ? 16 : 6, height: 6, borderRadius: 3,
                        background: ['email','reset','done'].indexOf(fpStep) >= i ? C.primary : '#E2E8F0',
                        transition: 'all .25s',
                      }} />
                    ))}
                  </div>
                </div>
              </div>
              <button onClick={closeFp} style={{
                width: 30, height: 30, borderRadius: 8, border: 'none', cursor: 'pointer',
                background: '#F1F5F9', color: C.sub, display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <X size={15} />
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: '20px 24px 24px' }}>

              {/* Step 1 — Email */}
              {fpStep === 'email' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <p style={{ fontSize: 13.5, color: C.sub, lineHeight: 1.6 }}>
                    Enter your registered email and we'll send a 6-digit OTP.
                  </p>
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 7 }}>Email address</label>
                    <div style={{ position: 'relative' }}>
                      <Mail size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', pointerEvents: 'none' }} />
                      <input className="auth-inp" style={{ paddingLeft: 38 }} type="email"
                        value={fpEmail} onChange={e => setFpEmail(e.target.value)}
                        placeholder="your@email.com" onKeyDown={e => e.key === 'Enter' && handleFpEmail()} />
                    </div>
                  </div>
                  {fpMsg && <FpAlert msg={fpMsg} />}
                  <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                    <FpCancelBtn onClick={closeFp} />
                    <FpPrimaryBtn onClick={handleFpEmail} loading={fpLoading} disabled={!fpEmail}>
                      Send OTP <ChevronRight size={14} />
                    </FpPrimaryBtn>
                  </div>
                </div>
              )}

              {/* Step 2 — OTP + new password */}
              {fpStep === 'reset' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 10,
                    background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)',
                  }}>
                    <Check size={14} color="#10B981" />
                    <span style={{ fontSize: 13, color: '#059669', fontWeight: 500 }}>OTP sent to <strong>{fpEmail}</strong></span>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 7 }}>6-Digit OTP</label>
                    <input className="auth-inp" style={{ textAlign: 'center', fontFamily: 'monospace', fontSize: 22, fontWeight: 800, letterSpacing: '0.35em' }}
                      maxLength={6} value={fpOtp} onChange={e => setFpOtp(e.target.value.replace(/\D/g, ''))}
                      placeholder="000000" />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 7 }}>New password</label>
                    <div style={{ position: 'relative' }}>
                      <input className="auth-inp" style={{ paddingRight: 44 }}
                        type={showFpPwd ? 'text' : 'password'}
                        value={fpPwd} onChange={e => setFpPwd(e.target.value)} placeholder="At least 8 characters" />
                      <button type="button" onClick={() => setShowFpPwd(p => !p)}
                        style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', background: 'none', border: 'none', cursor: 'pointer' }}>
                        {showFpPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 7 }}>Confirm new password</label>
                    <input className="auth-inp" type="password"
                      value={fpConfirm} onChange={e => setFpConfirm(e.target.value)} placeholder="Repeat password" />
                  </div>
                  {fpMsg && <FpAlert msg={fpMsg} />}
                  <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between' }}>
                    <FpCancelBtn onClick={() => { setFpStep('email'); setFpMsg(null); }}>Back</FpCancelBtn>
                    <FpPrimaryBtn onClick={handleFpReset} loading={fpLoading} disabled={!fpOtp || !fpPwd || !fpConfirm}>
                      Reset password <ChevronRight size={14} />
                    </FpPrimaryBtn>
                  </div>
                </div>
              )}

              {/* Step 3 — Done */}
              {fpStep === 'done' && (
                <div style={{ textAlign: 'center', padding: '12px 0 8px' }}>
                  <div style={{
                    width: 64, height: 64, borderRadius: 20, margin: '0 auto 16px',
                    background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <ShieldCheck size={30} color="#10B981" />
                  </div>
                  <h3 style={{ fontSize: 18, fontWeight: 800, color: C.text, fontFamily: 'Syne, sans-serif', marginBottom: 8 }}>
                    Password updated!
                  </h3>
                  <p style={{ fontSize: 13.5, color: C.sub, marginBottom: 22, lineHeight: 1.6 }}>
                    Your password has been reset successfully. Sign in with your new password.
                  </p>
                  <button onClick={closeFp} style={{
                    width: '100%', padding: '12px', borderRadius: 12, border: 'none', cursor: 'pointer',
                    background: 'linear-gradient(135deg,#2563EB,#1D4ED8)',
                    color: 'white', fontSize: 14.5, fontWeight: 700,
                    fontFamily: "'DM Sans', system-ui, sans-serif",
                    boxShadow: '0 4px 14px rgba(37,99,235,0.35)',
                  }}>
                    Back to Sign In
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Sub-components ────────────────────────────────────── */
function FpAlert({ msg }: { msg: { text: string; ok: boolean } }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 8,
      padding: '10px 12px', borderRadius: 10, fontSize: 13,
      background: msg.ok ? 'rgba(16,185,129,0.06)' : 'rgba(239,68,68,0.06)',
      border: `1px solid ${msg.ok ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.2)'}`,
      color: msg.ok ? '#059669' : '#DC2626',
    }}>
      {msg.ok ? <Check size={14} style={{ flexShrink: 0, marginTop: 1 }} /> : <X size={14} style={{ flexShrink: 0, marginTop: 1 }} />}
      {msg.text}
    </div>
  );
}

function FpCancelBtn({ onClick, children = 'Cancel' }: { onClick: () => void; children?: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{
      padding: '9px 18px', borderRadius: 10, border: '1.5px solid #E2E8F0', cursor: 'pointer',
      background: 'white', color: '#64748B', fontSize: 13.5, fontWeight: 600,
      fontFamily: "'DM Sans', system-ui, sans-serif",
    }}>
      {children}
    </button>
  );
}

function FpPrimaryBtn({ onClick, loading, disabled, children }: {
  onClick: () => void; loading: boolean; disabled?: boolean; children: React.ReactNode;
}) {
  return (
    <button onClick={onClick} disabled={loading || disabled} style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '9px 18px', borderRadius: 10, border: 'none', cursor: (loading || disabled) ? 'not-allowed' : 'pointer',
      background: (loading || disabled) ? '#93C5FD' : 'linear-gradient(135deg,#2563EB,#1D4ED8)',
      color: 'white', fontSize: 13.5, fontWeight: 700,
      fontFamily: "'DM Sans', system-ui, sans-serif",
      boxShadow: (loading || disabled) ? 'none' : '0 3px 10px rgba(37,99,235,0.35)',
    }}>
      {loading ? <Loader2 size={14} className="animate-spin" /> : null}
      {children}
    </button>
  );
}
