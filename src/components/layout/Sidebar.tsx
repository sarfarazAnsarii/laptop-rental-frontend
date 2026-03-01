'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Monitor, FileText, Users, LogOut,
  Laptop, AlertCircle, ChevronRight
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

const navItems = [
  { href: '/dashboard',   label: 'Dashboard',  icon: LayoutDashboard },
  { href: '/inventory',   label: 'Inventory',  icon: Monitor },
  { href: '/rentals',     label: 'Rentals',    icon: FileText },
  { href: '/clients',     label: 'Clients',    icon: Users },
  { href: '/rentals/overdue', label: 'Overdue', icon: AlertCircle },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 flex flex-col z-40"
      style={{ background: 'linear-gradient(180deg, #0B1628 0%, #0D1B2E 100%)', borderRight: '1px solid #1E3058' }}>

      {/* Logo */}
      <div className="p-6 mb-2">
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
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
          return (
            <Link key={href} href={href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group"
              style={{
                background: active ? 'rgba(59,130,246,0.12)' : 'transparent',
                color: active ? '#3B82F6' : '#64748B',
                border: active ? '1px solid rgba(59,130,246,0.2)' : '1px solid transparent',
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
        <div className="flex items-center gap-3 mb-3 px-2">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
            style={{ background: 'linear-gradient(135deg, #3B82F6, #14B8A6)', color: 'white' }}>
            {user?.name?.charAt(0)?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate" style={{ color: '#F1F5F9' }}>{user?.name}</div>
            <span className={`badge badge-${user?.role} text-xs`}>{user?.role}</span>
          </div>
        </div>
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
