'use client';

import { ReactNode, ButtonHTMLAttributes } from 'react';
import { X, Loader2, TrendingUp, TrendingDown, Minus, ChevronRight } from 'lucide-react';
import Link from 'next/link';

/* ── Tokens ────────────────────────────────────────────────── */
export const C = {
  bg: '#F8FAFC', card: '#FFFFFF', border: '#E2E8F0',
  text: '#0F172A', text2: '#334155', sub: '#64748B', muted: '#94A3B8',
  primary: '#2563EB', primaryLight: '#EFF6FF',
  accent: '#7C3AED', accentLight: '#F5F3FF',
  success: '#16A34A', successLight: '#F0FDF4',
  warning: '#D97706', warningLight: '#FFFBEB',
  danger: '#DC2626', dangerLight: '#FEF2F2',
};

/* ── Button ────────────────────────────────────────────────── */
interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: ReactNode;
  fullWidth?: boolean;
}

export function Button({
  variant = 'primary', size = 'md', loading, icon, children,
  className = '', fullWidth, ...props
}: BtnProps) {
  const base = 'inline-flex items-center justify-center gap-2 font-semibold rounded-xl transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500';

  const sizes = {
    xs: 'px-2.5 py-1 text-xs h-7',
    sm: 'px-3 py-1.5 text-xs h-8',
    md: 'px-4 py-2 text-sm h-9',
    lg: 'px-5 py-2.5 text-sm h-10',
  };

  const variants = {
    primary:   'bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white shadow-sm hover:shadow-md',
    secondary: 'bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 border border-slate-200',
    outline:   'border-2 border-blue-200 text-blue-600 hover:bg-blue-50 hover:border-blue-300 bg-white',
    ghost:     'text-slate-600 hover:bg-slate-100 hover:text-slate-900 bg-transparent',
    danger:    'bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 hover:border-red-300',
    success:   'bg-green-50 hover:bg-green-100 text-green-700 border border-green-200',
  };

  return (
    <button
      className={`${base} ${sizes[size]} ${variants[variant]} ${fullWidth ? 'w-full' : ''} ${className}`}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading ? <Loader2 size={14} className="animate-spin" /> : icon}
      {children}
    </button>
  );
}

/* ── Modal ─────────────────────────────────────────────────── */
export function Modal({ open, onClose, title, children, width = 'max-w-xl', subtitle }: {
  open: boolean; onClose: () => void; title: string; children: ReactNode;
  width?: string; subtitle?: string;
}) {
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`modal-box ${width} animate-scale-in`} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2 className="font-semibold text-base" style={{ color: C.text, fontFamily: 'Plus Jakarta Sans, sans-serif' }}>{title}</h2>
            {subtitle && <p className="text-xs mt-0.5" style={{ color: C.sub }}>{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-slate-100"
            style={{ color: C.sub }}
          >
            <X size={16} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

/* ── StatCard / KPI ────────────────────────────────────────── */
export function StatCard({
  label, value, icon, color, sub, trend, trendValue, href,
}: {
  label: string; value: string | number; icon: ReactNode;
  color: string; sub?: string; trend?: 'up' | 'down' | 'flat';
  trendValue?: string; href?: string;
}) {
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const trendColor = trend === 'up' ? '#16A34A' : trend === 'down' ? '#DC2626' : '#94A3B8';

  const inner = (
    <div className="kpi-card group" style={{ cursor: href ? 'pointer' : 'default' }}>
      {/* Color accent bar */}
      <div className="absolute bottom-0 left-0 right-0 h-0.5 rounded-b-2xl transition-opacity opacity-0 group-hover:opacity-100"
        style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }} />
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: `${color}14`, border: `1px solid ${color}22` }}>
          <span style={{ color }}>{icon}</span>
        </div>
        {trend && trendValue && (
          <div className="flex items-center gap-1 text-xs font-semibold" style={{ color: trendColor }}>
            <TrendIcon size={12} />
            {trendValue}
          </div>
        )}
      </div>
      <div className="text-2xl font-bold mb-0.5" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', color: C.text, letterSpacing: '-0.02em' }}>
        {value}
      </div>
      <div className="text-sm font-medium" style={{ color: C.sub }}>{label}</div>
      {sub && <div className="text-xs mt-1" style={{ color: C.muted }}>{sub}</div>}
    </div>
  );

  return href ? <Link href={href} style={{ textDecoration: 'none' }}>{inner}</Link> : inner;
}

/* ── PageHeader ────────────────────────────────────────────── */
export function PageHeader({
  title, subtitle, action, breadcrumbs,
}: {
  title: string; subtitle?: string; action?: ReactNode;
  breadcrumbs?: Array<{ label: string; href?: string }>;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6">
      <div>
        {breadcrumbs && breadcrumbs.length > 0 && (
          <div className="breadcrumb mb-1">
            {breadcrumbs.map((b, i) => (
              <span key={i} className="flex items-center gap-1">
                {i > 0 && <ChevronRight size={11} style={{ color: C.muted }} />}
                {b.href ? <Link href={b.href}>{b.label}</Link> : <span style={{ color: C.muted }}>{b.label}</span>}
              </span>
            ))}
          </div>
        )}
        <h1 className="text-xl sm:text-2xl font-bold" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', color: C.text, letterSpacing: '-0.02em' }}>
          {title}
        </h1>
        {subtitle && <p className="text-sm mt-0.5" style={{ color: C.sub }}>{subtitle}</p>}
      </div>
      {action && <div className="flex-shrink-0 flex items-center gap-2">{action}</div>}
    </div>
  );
}

/* ── FormField ─────────────────────────────────────────────── */
export function FormField({
  label, children, required, error, helper,
}: {
  label: string; children: ReactNode; required?: boolean; error?: string; helper?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold mb-1.5" style={{ color: C.sub, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}{required && <span style={{ color: C.danger, marginLeft: 3 }}>*</span>}
      </label>
      {children}
      {error && <p className="text-xs mt-1" style={{ color: C.danger }}>{error}</p>}
      {helper && !error && <p className="text-xs mt-1" style={{ color: C.muted }}>{helper}</p>}
    </div>
  );
}

/* ── EmptyState ────────────────────────────────────────────── */
export function EmptyState({
  icon, title, desc, action,
}: {
  icon: ReactNode; title: string; desc?: string; action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center"
        style={{ background: C.primaryLight, border: `1px solid rgba(37,99,235,0.15)` }}>
        <span style={{ color: C.primary }}>{icon}</span>
      </div>
      <div className="font-semibold text-base mb-1" style={{ color: C.text, fontFamily: 'Plus Jakarta Sans, sans-serif' }}>{title}</div>
      {desc && <p className="text-sm max-w-xs" style={{ color: C.sub }}>{desc}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* ── Toast ─────────────────────────────────────────────────── */
export function Toast({
  message, type = 'success', onClose,
}: {
  message: string; type: 'success' | 'error' | 'info' | 'warning'; onClose: () => void;
}) {
  const styles = {
    success: { bg: '#F0FDF4', border: '#86EFAC', text: '#15803D', dot: '#16A34A' },
    error:   { bg: '#FEF2F2', border: '#FECACA', text: '#991B1B', dot: '#DC2626' },
    info:    { bg: '#F0F9FF', border: '#BAE6FD', text: '#0369A1', dot: '#0284C7' },
    warning: { bg: '#FFFBEB', border: '#FDE68A', text: '#92400E', dot: '#D97706' },
  }[type];

  return (
    <div
      className="fixed bottom-4 right-4 left-4 sm:left-auto sm:w-auto z-50 animate-slide-up"
      style={{ maxWidth: 360 }}
    >
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border"
        style={{ background: styles.bg, borderColor: styles.border }}>
        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: styles.dot }} />
        <span className="text-sm font-medium flex-1" style={{ color: styles.text }}>{message}</span>
        <button onClick={onClose} className="flex-shrink-0 ml-1" style={{ color: styles.text, opacity: 0.7 }}>
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

/* ── SectionTitle ──────────────────────────────────────────── */
export function SectionTitle({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`section-title ${className}`}>{children}</div>
  );
}

/* ── Card ──────────────────────────────────────────────────── */
export function Card({ children, className = '', padding = true }: { children: ReactNode; className?: string; padding?: boolean }) {
  return (
    <div className={`glass-card ${padding ? 'p-5' : 'overflow-hidden'} ${className}`}>
      {children}
    </div>
  );
}

/* ── CardHeader ────────────────────────────────────────────── */
export function CardHeader({
  title, icon, action, iconBg,
}: {
  title: string; icon?: ReactNode; action?: ReactNode; iconBg?: string;
}) {
  return (
    <div className="flex items-center justify-between px-5 py-3.5 border-b" style={{ borderColor: C.border }}>
      <div className="flex items-center gap-2.5">
        {icon && (
          <div className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: iconBg || C.primaryLight }}>
            {icon}
          </div>
        )}
        <span className="font-semibold text-sm" style={{ color: C.text, fontFamily: 'Plus Jakarta Sans, sans-serif' }}>{title}</span>
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

/* ── Skeleton wrapper ──────────────────────────────────────── */
export function Skeleton({ className = '', height }: { className?: string; height?: number }) {
  return (
    <div className={`skeleton ${className}`} style={height ? { height } : undefined} />
  );
}

/* ── Avatar ────────────────────────────────────────────────── */
export function Avatar({ name, size = 32, gradient }: { name?: string; size?: number; gradient?: string }) {
  return (
    <div
      className="rounded-full flex items-center justify-center font-bold text-white flex-shrink-0"
      style={{
        width: size, height: size, fontSize: size * 0.375,
        background: gradient || 'linear-gradient(135deg, #2563EB, #7C3AED)',
      }}
    >
      {name?.charAt(0)?.toUpperCase() || '?'}
    </div>
  );
}

/* ── Divider ───────────────────────────────────────────────── */
export function Divider({ label }: { label?: string }) {
  if (!label) return <div className="divider" />;
  return (
    <div className="flex items-center gap-3 my-4">
      <div className="flex-1 h-px" style={{ background: C.border }} />
      <span className="text-xs font-medium px-2" style={{ color: C.muted }}>{label}</span>
      <div className="flex-1 h-px" style={{ background: C.border }} />
    </div>
  );
}
