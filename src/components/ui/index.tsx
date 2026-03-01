'use client';

import { ReactNode, ButtonHTMLAttributes } from 'react';
import { X, Loader2 } from 'lucide-react';

/* ── Button ───────────────────────────────────────────── */
interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost' | 'danger' | 'success' | 'outline';
  size?: 'sm' | 'md';
  loading?: boolean;
  icon?: ReactNode;
}

export function Button({ variant = 'primary', size = 'md', loading, icon, children, className = '', ...props }: BtnProps) {
  const base = 'inline-flex items-center gap-2 font-semibold rounded-xl transition-all disabled:opacity-50 cursor-pointer';
  const sizes = { sm: 'px-3 py-1.5 text-xs', md: 'px-4 py-2.5 text-sm' };
  const variants = {
    primary: 'bg-blue-500 hover:bg-blue-600 text-white shadow-lg shadow-blue-500/20',
    ghost:   'bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10',
    danger:  'bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20',
    success: 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20',
    outline: 'border border-blue-500/40 text-blue-400 hover:bg-blue-500/10',
  };
  return (
    <button className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} disabled={loading || props.disabled} {...props}>
      {loading ? <Loader2 size={14} className="animate-spin" /> : icon}
      {children}
    </button>
  );
}

/* ── Modal ────────────────────────────────────────────── */
export function Modal({ open, onClose, title, children, width = 'max-w-2xl' }: {
  open: boolean; onClose: () => void; title: string; children: ReactNode; width?: string;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative ${width} w-full rounded-2xl shadow-2xl animate-fade-in`}
        style={{ background: '#111827', border: '1px solid #1E3058' }}>
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #1E3058' }}>
          <h2 className="font-bold text-base" style={{ fontFamily: 'Syne, sans-serif', color: '#F1F5F9' }}>{title}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors" style={{ color: '#64748B' }}>
            <X size={16} />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

/* ── StatCard ─────────────────────────────────────────── */
export function StatCard({ label, value, icon, color, sub }: {
  label: string; value: string | number; icon: ReactNode; color: string; sub?: string;
}) {
  return (
    <div className="glass-card p-5 animate-fade-in">
      <div className="flex items-start justify-between mb-4">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${color}20`, border: `1px solid ${color}30` }}>
          <span style={{ color }}>{icon}</span>
        </div>
      </div>
      <div className="text-2xl font-bold mb-1" style={{ fontFamily: 'Syne, sans-serif', color: '#F1F5F9' }}>{value}</div>
      <div className="text-sm font-medium" style={{ color: '#64748B' }}>{label}</div>
      {sub && <div className="text-xs mt-1" style={{ color: '#475569' }}>{sub}</div>}
    </div>
  );
}

/* ── PageHeader ───────────────────────────────────────── */
export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between mb-8">
      <div>
        <h1 className="text-2xl font-bold mb-1" style={{ fontFamily: 'Syne, sans-serif', color: '#F1F5F9' }}>{title}</h1>
        {subtitle && <p className="text-sm" style={{ color: '#64748B' }}>{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

/* ── FormField ────────────────────────────────────────── */
export function FormField({ label, children, required }: { label: string; children: ReactNode; required?: boolean }) {
  return (
    <div>
      <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: '#64748B' }}>
        {label}{required && <span className="text-red-400 ml-1">*</span>}
      </label>
      {children}
    </div>
  );
}

/* ── Empty State ──────────────────────────────────────── */
export function EmptyState({ icon, title, desc }: { icon: ReactNode; title: string; desc?: string }) {
  return (
    <div className="text-center py-16">
      <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.15)' }}>
        <span style={{ color: '#3B82F6' }}>{icon}</span>
      </div>
      <div className="font-semibold mb-1" style={{ fontFamily: 'Syne, sans-serif', color: '#F1F5F9' }}>{title}</div>
      {desc && <p className="text-sm" style={{ color: '#64748B' }}>{desc}</p>}
    </div>
  );
}

/* ── Toast ────────────────────────────────────────────── */
export function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error'; onClose: () => void }) {
  const colors = {
    success: { bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.3)', text: '#10B981' },
    error:   { bg: 'rgba(244,63,94,0.12)',  border: 'rgba(244,63,94,0.3)',  text: '#F43F5E' },
  }[type];

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-fade-in flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl"
      style={{ background: colors.bg, border: `1px solid ${colors.border}`, minWidth: 260 }}>
      <span className="text-sm font-medium" style={{ color: colors.text }}>{message}</span>
      <button onClick={onClose} className="ml-auto" style={{ color: colors.text }}><X size={14} /></button>
    </div>
  );
}
