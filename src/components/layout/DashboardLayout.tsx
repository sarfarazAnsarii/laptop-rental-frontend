'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import { useAuth } from '@/lib/auth-context';
import { Menu, Laptop } from 'lucide-react';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router   = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Close sidebar on route change (mobile)
  useEffect(() => { setSidebarOpen(false); }, [pathname]);

  useEffect(() => {
    if (loading) return;
    if (!user) { router.push('/auth/login'); return; }
    // Vendor accounts have no dashboard access
    if (user.role === 'vendor') { router.push('/auth/login'); return; }
    // Client portal redirect — also allow rental detail/bulk/invoice pages
    const clientAllowed = pathname.startsWith('/client') || pathname === '/profile'
      || pathname.startsWith('/rentals/');
    if (user.role === 'client' && !clientAllowed) {
      router.push('/client/rentals'); return;
    }
    // Non-clients can't access client pages
    if (user.role !== 'client' && pathname.startsWith('/client')) {
      router.push('/dashboard');
    }
  }, [user, loading, router, pathname]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#0B1628' }}>
      <div className="text-center">
        <div className="w-10 h-10 rounded-xl mx-auto mb-3 animate-pulse"
          style={{ background: 'linear-gradient(135deg, #3B82F6, #14B8A6)' }} />
        <p style={{ color: '#475569', fontSize: 13 }}>Loading...</p>
      </div>
    </div>
  );

  if (!user) return null;

  return (
    <div className="flex min-h-screen" style={{ background: '#0B1628' }}>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 lg:hidden"
          style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(2px)' }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="flex-1 lg:ml-64 min-h-screen flex flex-col">
        {/* Mobile top bar */}
        <div className="lg:hidden flex items-center gap-3 px-4 py-3 sticky top-0 z-20"
          style={{ background: '#0B1628', borderBottom: '1px solid #1E3058' }}>
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-xl transition-colors"
            style={{ background: 'rgba(30,48,88,0.5)', color: '#64748B' }}>
            <Menu size={18} />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #3B82F6, #14B8A6)' }}>
              <Laptop size={14} color="white" />
            </div>
            <span className="font-bold text-sm" style={{ fontFamily: 'Syne, sans-serif', color: '#F1F5F9' }}>
              LaptopRent
            </span>
          </div>
        </div>

        {/* Page content */}
        <div className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
          {children}
        </div>
      </main>
    </div>
  );
}
