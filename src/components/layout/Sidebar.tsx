'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Monitor, FileText, Users, LogOut,
  Laptop, AlertCircle, ChevronRight, Package, Wrench,
  AlertTriangle, Shield, X, UserCog,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

const NAV_ADMIN = [
  { href: '/dashboard',       label: 'Dashboard',   icon: LayoutDashboard },
  { href: '/inventory',       label: 'Inventory',   icon: Monitor },
  { href: '/rentals',         label: 'Rentals',     icon: FileText },
  // { href: '/clients',         label: 'Clients',     icon: Users },
  { href: '/rentals/overdue', label: 'Overdue',     icon: AlertCircle },
  { href: '/issues',          label: 'Issues',      icon: Wrench },
  { href: '/users',           label: 'Users',       icon: UserCog },
];

const NAV_STAFF = [
  { href: '/inventory',       label: 'Inventory',   icon: Monitor },
  { href: '/issues',          label: 'Issues',      icon: Wrench },
];

const NAV_VENDOR = [
  { href: '/vendor/stock',  label: 'My Stock',  icon: Package },
  { href: '/vendor/issues', label: 'My Issues', icon: AlertTriangle },
];

function getNav(role?: string) {
  if (role === 'vendor') return NAV_VENDOR;
  if (role === 'staff')  return NAV_STAFF;
  return NAV_ADMIN;
}

const ROLE_GRADIENT: Record<string, string> = {
  admin:  'linear-gradient(135deg, #8B5CF6, #6D28D9)',
  staff:  'linear-gradient(135deg, #3B82F6, #1D4ED8)',
  vendor: 'linear-gradient(135deg, #F59E0B, #D97706)',
  client: 'linear-gradient(135deg, #14B8A6, #0D9488)',
};

interface SidebarProps {
  open?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ open = false, onClose }: SidebarProps) {
  const pathname  = usePathname();
  const { user, logout } = useAuth();
  const navItems  = getNav(user?.role);

  return (
    <aside
      className="fixed left-0 top-0 h-screen w-64 flex flex-col z-40 transition-transform duration-300 ease-in-out lg:translate-x-0"
      style={{
        background: 'linear-gradient(180deg, #0B1628 0%, #0D1B2E 100%)',
        borderRight: '1px solid #1E3058',
        transform: open ? 'translateX(0)' : undefined,
      }}
      data-open={open}>
      {/* Inline style to handle translate — Tailwind classes for lg */}
      <style>{`
        @media (max-width: 1023px) {
          aside[data-open="false"] { transform: translateX(-100%); }
          aside[data-open="true"]  { transform: translateX(0); }
        }
      `}</style>

      {/* Logo + mobile close */}
      <div className="p-6 mb-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #3B82F6, #14B8A6)' }}>
            <Laptop size={18} color="white" />
          </div>
          <div>
            <div className="font-bold text-sm" style={{ fontFamily: 'Syne, sans-serif', color: '#F1F5F9' }}>LaptopRent</div>
            <div className="text-xs" style={{ color: '#475569' }}>Management System</div>
          </div>
        </div>
        {/* Close button — only shown on mobile */}
        <button onClick={onClose}
          className="lg:hidden p-1.5 rounded-xl transition-colors hover:bg-white/10"
          style={{ color: '#475569' }}>
          <X size={16} />
        </button>
      </div>

      {/* Role strip */}
      {user?.role === 'vendor' && (
        <div className="mx-3 mb-3 px-3 py-2 rounded-xl flex items-center gap-2"
          style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
          <Package size={13} style={{ color: '#F59E0B' }} />
          <span className="text-xs font-semibold" style={{ color: '#F59E0B' }}>Vendor Portal</span>
        </div>
      )}
      {user?.role === 'admin' && (
        <div className="mx-3 mb-3 px-3 py-2 rounded-xl flex items-center gap-2"
          style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)' }}>
          <Shield size={13} style={{ color: '#A78BFA' }} />
          <span className="text-xs font-semibold" style={{ color: '#A78BFA' }}>Super Admin</span>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active =
            pathname === href ||
            (pathname.startsWith(href + '/') && href !== '/dashboard');
          return (
            <Link key={href} href={href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
              style={{
                background: active ? 'rgba(59,130,246,0.12)' : 'transparent',
                color:      active ? '#3B82F6' : '#64748B',
                border:     active ? '1px solid rgba(59,130,246,0.2)' : '1px solid transparent',
              }}>
              <Icon size={17} />
              <span style={{ fontFamily: 'DM Sans, sans-serif' }}>{label}</span>
              {active && <ChevronRight size={14} className="ml-auto" />}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="p-4 border-t" style={{ borderColor: '#1E3058' }}>
        <Link href="/profile"
          className="flex items-center gap-3 mb-3 px-2 py-1.5 rounded-xl transition-all hover:bg-white/5"
          style={{ textDecoration: 'none' }}>
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
            style={{ background: ROLE_GRADIENT[user?.role ?? 'admin'] ?? ROLE_GRADIENT.admin, color: 'white' }}>
            {user?.name?.charAt(0)?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate" style={{ color: '#F1F5F9' }}>{user?.name}</div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className={'badge badge-' + user?.role}>{user?.role}</span>
              {user?.company && (
                <span className="text-xs truncate" style={{ color: '#334155' }}>{user.company}</span>
              )}
            </div>
          </div>
        </Link>
        <button onClick={logout}
          className="flex items-center gap-2 w-full px-3 py-2 rounded-xl text-sm transition-all hover:bg-red-500/10 hover:text-red-400"
          style={{ color: '#475569' }}>
          <LogOut size={15} />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
