'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Monitor, FileText, UserCog, LogOut,
  Laptop, Wrench, X, CalendarClock, ReceiptText, Wallet,
  ArrowLeftRight, RotateCcw, BookOpen, BarChart2, Shield,
  AlertTriangle, ChevronRight,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

/* ── Nav definitions ────────────────────────────────────────── */
const NAV_ADMIN = [
  { href: '/dashboard',          label: 'Dashboard',    icon: LayoutDashboard },
  { href: '/inventory',          label: 'Inventory',    icon: Monitor },
  { href: '/rentals',            label: 'Rentals',      icon: FileText },
  { href: '/schedules',          label: 'Schedules',    icon: CalendarClock },
  { href: '/payments',           label: 'Payments',     icon: Wallet },
  { href: '/credit-notes',       label: 'Credit Notes', icon: ReceiptText },
  { href: '/issues',             label: 'Issues',       icon: Wrench },
  { href: '/rentals/exchanges',  label: 'Exchanges',    icon: ArrowLeftRight },
  { href: '/users',              label: 'Users',        icon: UserCog },
  { href: '/reports',            label: 'Reports',      icon: BarChart2 },
];

const NAV_STAFF = [
  { href: '/inventory', label: 'Inventory', icon: Monitor },
  { href: '/issues',    label: 'Issues',    icon: Wrench },
];

const NAV_CLIENT = [
  { href: '/client/rentals',   label: 'My Rentals', icon: FileText },
  { href: '/client/returns',   label: 'Returns',    icon: RotateCcw },
  { href: '/client/exchanges', label: 'Exchanges',  icon: ArrowLeftRight },
  { href: '/client/schedules', label: 'Schedules',  icon: CalendarClock },
  { href: '/client/issues',    label: 'Issues',     icon: AlertTriangle },
  { href: '/client/ledger',    label: 'Ledger',     icon: BookOpen },
];

function getNav(role?: string) {
  if (role === 'client') return NAV_CLIENT;
  if (role === 'staff')  return NAV_STAFF;
  return NAV_ADMIN;
}

const ROLE_GRADIENT: Record<string, string> = {
  admin:  'linear-gradient(135deg, #7C3AED, #5B21B6)',
  staff:  'linear-gradient(135deg, #2563EB, #1D4ED8)',
  vendor: 'linear-gradient(135deg, #D97706, #B45309)',
  client: 'linear-gradient(135deg, #0F766E, #0D9488)',
};

/* ── Role badge config ──────────────────────────────────────── */
const ROLE_CONFIG: Record<string, { label: string; bg: string; border: string; color: string; icon: any }> = {
  admin:  { label: 'Super Admin',    bg: '#F5F3FF', border: '#DDD6FE', color: '#5B21B6', icon: Shield },
  staff:  { label: 'Staff Member',   bg: '#EFF6FF', border: '#BFDBFE', color: '#1D4ED8', icon: UserCog },
  client: { label: 'Client Portal',  bg: '#F0FDFA', border: '#99F6E4', color: '#0F766E', icon: FileText },
};

/* ── Component ──────────────────────────────────────────────── */
export default function Sidebar({ open = false, onClose }: { open?: boolean; onClose?: () => void }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const navItems = getNav(user?.role);
  const roleConf = ROLE_CONFIG[user?.role ?? ''];

  return (
    <aside
      className="sidebar"
      data-open={open}
    >
      {/* ── Logo ── */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">
          <Laptop size={17} color="white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="sidebar-logo-title">LaptopRental</div>
          <div className="sidebar-logo-sub">Management System</div>
        </div>
        <button
          onClick={onClose}
          className="lg:hidden w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-slate-100 flex-shrink-0"
          style={{ color: '#64748B' }}
        >
          <X size={15} />
        </button>
      </div>

      {/* ── Role badge ── */}
      {roleConf && (
        <div className="mx-3 mb-0.5 mt-2.5 px-3 py-2 rounded-xl flex items-center gap-2"
          style={{ background: roleConf.bg, border: `1px solid ${roleConf.border}` }}>
          <roleConf.icon size={12} style={{ color: roleConf.color }} />
          <span className="text-xs font-semibold" style={{ color: roleConf.color }}>{roleConf.label}</span>
        </div>
      )}

      {/* ── Navigation ── */}
      <nav className="sidebar-nav">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active =
            pathname === href ||
            (pathname.startsWith(href + '/') && href !== '/dashboard');

          return (
            <Link key={href} href={href} className={`sidebar-link ${active ? 'active' : ''}`}>
              <Icon size={16} style={{ flexShrink: 0 }} />
              <span className="flex-1">{label}</span>
              {active && <ChevronRight size={12} style={{ opacity: 0.5, flexShrink: 0 }} />}
            </Link>
          );
        })}
      </nav>

      {/* ── User section ── */}
      <div className="sidebar-user">
        <Link href="/profile" className="sidebar-user-card">
          <div
            className="user-avatar"
            style={{ background: ROLE_GRADIENT[user?.role ?? 'admin'] ?? ROLE_GRADIENT.admin }}
          >
            {user?.name?.charAt(0)?.toUpperCase() ?? '?'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="user-name truncate">{user?.name}</div>
            <div className="mt-0.5">
              <span className={`badge badge-${user?.role}`}>{user?.role}</span>
              {user?.company && (
                <span className="text-xs ml-1.5 truncate" style={{ color: '#94A3B8' }}>{user.company}</span>
              )}
            </div>
          </div>
        </Link>
        <button onClick={logout} className="sidebar-logout">
          <LogOut size={14} />
          Sign out
        </button>
      </div>
    </aside>
  );
}
