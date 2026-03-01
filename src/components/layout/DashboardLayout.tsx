'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import { useAuth } from '@/lib/auth-context';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.push('/auth/login');
  }, [user, loading, router]);

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
      <Sidebar />
      <main className="flex-1 ml-64 min-h-screen">
        <div className="p-8 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
