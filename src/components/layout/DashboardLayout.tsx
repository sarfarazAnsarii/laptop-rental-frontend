'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import Sidebar from '@/components/layout/Sidebar';
import { useAuth } from '@/lib/auth-context';
import {
  Menu, Laptop, Search, Bell,
  LayoutDashboard, Monitor, FileText, Wrench,
  CalendarClock, RotateCcw, BookOpen, AlertTriangle,
} from 'lucide-react';

/* ── Mobile bottom-nav per role ──────────────────────────────── */
const MOBILE_ADMIN = [
  { href: '/dashboard',  label: 'Home',      icon: LayoutDashboard },
  { href: '/inventory',  label: 'Inventory', icon: Monitor },
  { href: '/rentals',    label: 'Rentals',   icon: FileText },
  { href: '/issues',     label: 'Issues',    icon: Wrench },
  { href: '/schedules',  label: 'Schedule',  icon: CalendarClock },
];
const MOBILE_STAFF = [
  { href: '/inventory', label: 'Inventory', icon: Monitor },
  { href: '/issues',    label: 'Issues',    icon: Wrench },
];
const MOBILE_CLIENT = [
  { href: '/client/rentals',  label: 'Rentals',  icon: FileText },
  { href: '/client/returns',  label: 'Returns',  icon: RotateCcw },
  { href: '/client/issues',   label: 'Issues',   icon: AlertTriangle },
  { href: '/client/ledger',   label: 'Ledger',   icon: BookOpen },
];

function getMobileNav(role?: string) {
  if (role === 'client') return MOBILE_CLIENT;
  if (role === 'staff')  return MOBILE_STAFF;
  return MOBILE_ADMIN;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router   = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => { setSidebarOpen(false); }, [pathname]);

  useEffect(() => {
    if (loading) return;
    if (!user) { router.push('/auth/login'); return; }
    if (user.role === 'vendor') { router.push('/auth/login'); return; }
    const clientAllowed =
      pathname.startsWith('/client') ||
      pathname === '/profile' ||
      pathname.startsWith('/rentals/');
    if (user.role === 'client' && !clientAllowed) { router.push('/client/rentals'); return; }
    if (user.role !== 'client' && pathname.startsWith('/client')) { router.push('/dashboard'); }
  }, [user, loading, router, pathname]);

  const mobileNav = getMobileNav(user?.role);

  /* ── Loading screen ── */
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#F8FAFC' }}>
      <div className="text-center">
        <div className="w-12 h-12 rounded-2xl mx-auto mb-3 animate-pulse"
          style={{ background: 'linear-gradient(135deg, #2563EB, #7C3AED)' }} />
        <p style={{ color: '#94A3B8', fontSize: 13, fontFamily: 'Inter, sans-serif' }}>Loading…</p>
      </div>
    </div>
  );

  if (!user) return null;

  return (
    <div className="flex min-h-screen" style={{ background: '#F8FAFC' }}>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 lg:hidden"
          style={{ background: 'rgba(15,23,42,0.35)', backdropFilter: 'blur(3px)' }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main area */}
      <div className="flex-1 lg:ml-[260px] flex flex-col min-h-screen">

        {/* ── Top Navbar ── */}
        <header className="topbar">
          {/* Hamburger (mobile) */}
          <button className="lg:hidden topbar-icon-btn" onClick={() => setSidebarOpen(true)}>
            <Menu size={18} />
          </button>

          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #2563EB, #7C3AED)' }}>
              <Laptop size={13} color="white" />
            </div>
            <span className="font-bold text-sm" style={{ color: '#0F172A', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
              LaptopRent
            </span>
          </div>

          {/* Desktop search */}
          <div className="topbar-search hidden lg:block">
            <Search size={13} className="topbar-search-icon" />
            <input placeholder="Search inventory, rentals, clients…" />
          </div>

          {/* Right actions */}
          <div className="ml-auto flex items-center gap-1.5">
            <button className="topbar-icon-btn hidden sm:flex">
              <Bell size={17} />
              <span className="topbar-notif-dot" />
            </button>
            <Link href="/profile" style={{ textDecoration: 'none' }}>
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white cursor-pointer ring-2 ring-white ring-offset-1 hover:ring-blue-200 transition-all"
                style={{ background: 'linear-gradient(135deg, #2563EB, #7C3AED)' }}
              >
                {user?.name?.charAt(0)?.toUpperCase()}
              </div>
            </Link>
          </div>
        </header>

        {/* ── Page content ── */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 pb-24 lg:pb-8">
          {children}
        </main>
      </div>

      {/* ── Mobile bottom navigation ── */}
      {mobileNav.length > 1 && (
        <nav
          className="fixed bottom-0 inset-x-0 lg:hidden z-20"
          style={{ background: 'white', borderTop: '1px solid #E2E8F0', paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          <div className="flex items-center">
            {mobileNav.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(href + '/');
              return (
                <Link
                  key={href}
                  href={href}
                  className="flex-1 flex flex-col items-center gap-0.5 py-2.5 transition-colors"
                  style={{ textDecoration: 'none', color: active ? '#2563EB' : '#94A3B8' }}
                >
                  <Icon size={19} />
                  <span style={{ fontSize: 9.5, fontWeight: active ? 600 : 400, letterSpacing: '0.01em' }}>{label}</span>
                  {active && (
                    <div className="absolute bottom-0 w-6 h-0.5 rounded-t-full" style={{ background: '#2563EB' }} />
                  )}
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}
