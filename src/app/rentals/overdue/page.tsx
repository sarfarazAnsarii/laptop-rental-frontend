'use client';

import DashboardLayout from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/ui';
import { CheckCircle, RefreshCw, Calendar } from 'lucide-react';
import Link from 'next/link';

export default function OverduePage() {
  return (
    <DashboardLayout>
      <PageHeader title="Overdue Rentals" subtitle="Not applicable" />

      <div className="glass-card p-8 flex flex-col items-center text-center gap-5 max-w-lg mx-auto">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
          style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)' }}>
          <CheckCircle size={30} style={{ color: '#10B981' }} />
        </div>

        <div>
          <h2 className="text-lg font-bold mb-2" style={{ color: '#F1F5F9', fontFamily: 'Syne, sans-serif' }}>
            No Overdue Rentals
          </h2>
          <p className="text-sm leading-relaxed" style={{ color: '#64748B' }}>
            Overdue status is not applicable for this system. Rentals automatically renew
            every month from the <strong style={{ color: '#94A3B8' }}>1st to the last day</strong> of each month.
            Payment is collected monthly (advance or postpaid) and the rental continues as long as it is active.
          </p>
        </div>

        <div className="w-full space-y-2.5 pt-2">
          {[
            { icon: Calendar,    color: '#3B82F6', label: 'Billing Period',   desc: '1st to last day of every month' },
            { icon: RefreshCw,   color: '#14B8A6', label: 'Auto Renewal',     desc: 'Rental renews automatically each month' },
            { icon: CheckCircle, color: '#10B981', label: 'No Overdue',       desc: 'Cannot go overdue — rental is always active until cancelled' },
          ].map(({ icon: Icon, color, label, desc }) => (
            <div key={label} className="flex items-center gap-3 px-4 py-3 rounded-xl text-left"
              style={{ background: 'rgba(30,48,88,0.3)', border: '1px solid rgba(30,48,88,0.6)' }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: `${color}14` }}>
                <Icon size={15} style={{ color }} />
              </div>
              <div>
                <div className="text-xs font-semibold" style={{ color: '#F1F5F9' }}>{label}</div>
                <div className="text-xs" style={{ color: '#475569' }}>{desc}</div>
              </div>
            </div>
          ))}
        </div>

        <Link href="/rentals"
          className="text-sm font-semibold px-5 py-2.5 rounded-xl transition-all hover:opacity-80"
          style={{ background: 'rgba(59,130,246,0.15)', color: '#3B82F6', border: '1px solid rgba(59,130,246,0.3)' }}>
          View Active Rentals
        </Link>
      </div>
    </DashboardLayout>
  );
}
