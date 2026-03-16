'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { StatCard } from '@/components/ui';
import { api } from '@/lib/api';
import { DashboardSummary, Rental, Inventory } from '@/types';
import { Monitor, FileText, AlertCircle, TrendingUp, CheckCircle, Package, Clock } from 'lucide-react';
import Link from 'next/link';

function fmt(n: number) {
  return '₹' + new Intl.NumberFormat('en-IN').format(n);
}
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [recentRentals, setRecentRentals] = useState<Rental[]>([]);
  const [lowStock, setLowStock] = useState<Inventory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.dashboard.summary(),
      api.rentals.list({ per_page: '5', status: 'active' }),
      api.inventory.list({ status: 'available', per_page: '4' }),
    ]).then(([sum, ren, inv]) => {
      setSummary(sum.data);
      setRecentRentals(ren.data?.data || []);
      setLowStock(inv.data?.data || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const stats = summary ? [
    { label: 'Total Laptops',     value: summary.total_laptops,    icon: <Monitor size={18} />,    color: '#3B82F6', sub: 'In inventory' },
    { label: 'Available',         value: summary.available,         icon: <Package size={18} />,    color: '#10B981', sub: 'Ready to rent' },
    { label: 'Currently Rented',  value: summary.rented,            icon: <FileText size={18} />,   color: '#14B8A6', sub: 'Active rentals' },
    { label: 'Overdue Rentals',   value: summary.overdue_rentals,   icon: <AlertCircle size={18} />,color: '#F43F5E', sub: 'Need attention' },
    { label: 'Revenue This Month',value: fmt(summary.revenue_this_month), icon: <TrendingUp size={18} />, color: '#F59E0B', sub: 'GST included' },
    { label: 'Active Rentals',    value: summary.active_rentals,    icon: <CheckCircle size={18} />,color: '#8B5CF6', sub: 'Ongoing' },
  ] : [];

  return (
    <DashboardLayout>
      <div className="animate-fade-in">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold mb-1" style={{ fontFamily: 'Syne, sans-serif', color: '#F1F5F9' }}>Dashboard</h1>
          <p className="text-sm" style={{ color: '#64748B' }}>
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>

        {/* Stats Grid */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 mb-6 sm:mb-8">
            {[...Array(6)].map((_, i) => <div key={i} className="skeleton h-28 rounded-2xl" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 mb-6 sm:mb-8">
            {stats.map((s, i) => (
              <div key={i} style={{ animationDelay: `${i * 0.07}s` }}>
                <StatCard {...s} />
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 sm:gap-6">
          {/* Recent Active Rentals */}
          <div className="lg:col-span-3 glass-card overflow-hidden">
            <div className="px-4 sm:px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid #1E3058' }}>
              <h2 className="font-bold text-sm" style={{ fontFamily: 'Syne, sans-serif', color: '#F1F5F9' }}>Active Rentals</h2>
              <Link href="/rentals" className="text-xs font-medium" style={{ color: '#3B82F6' }}>View all →</Link>
            </div>
            {loading ? (
              <div className="p-6 space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="skeleton h-10 rounded-xl" />)}</div>
            ) : recentRentals.length === 0 ? (
              <div className="py-12 text-center text-sm" style={{ color: '#475569' }}>No active rentals</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Rental No</th>
                      <th>Client</th>
                      <th className="hidden sm:table-cell">Laptop</th>
                      <th className="hidden sm:table-cell">End Date</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentRentals.map(r => (
                      <tr key={r.id}>
                        <td><Link href={`/rentals/${r.id}`} className="font-mono text-xs font-medium" style={{ color: '#3B82F6' }}>{r.rental_no}</Link></td>
                        <td style={{ color: '#F1F5F9' }}>{r.client?.name || '—'}</td>
                        <td className="hidden sm:table-cell">{r.inventory?.brand} {r.inventory?.model_no}</td>
                        <td className="hidden sm:table-cell">{fmtDate(r.end_date)}</td>
                        <td style={{ color: '#10B981', fontWeight: 600 }}>{fmt(r.grand_total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Available Laptops */}
          <div className="lg:col-span-2 glass-card overflow-hidden">
            <div className="px-4 sm:px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid #1E3058' }}>
              <h2 className="font-bold text-sm" style={{ fontFamily: 'Syne, sans-serif', color: '#F1F5F9' }}>Available Laptops</h2>
              <Link href="/inventory" className="text-xs font-medium" style={{ color: '#3B82F6' }}>View all →</Link>
            </div>
            {loading ? (
              <div className="p-6 space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="skeleton h-14 rounded-xl" />)}</div>
            ) : lowStock.length === 0 ? (
              <div className="py-12 text-center text-sm" style={{ color: '#475569' }}>No available laptops</div>
            ) : (
              <div className="p-4 space-y-2">
                {lowStock.map(inv => (
                  <Link key={inv.id} href={`/inventory/${inv.id}`}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all hover:bg-blue-500/5"
                    style={{ border: '1px solid #1E3058' }}>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: 'rgba(59,130,246,0.1)' }}>
                      <Monitor size={15} style={{ color: '#3B82F6' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate" style={{ color: '#F1F5F9' }}>{inv.brand} {inv.model_no}</div>
                      <div className="text-xs" style={{ color: '#475569' }}>{inv.asset_code} · {inv.ram} / {inv.ssd}</div>
                    </div>
                    <span className="badge badge-available text-xs">Ready</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Quick links */}
        <div className="mt-4 sm:mt-6 grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { href: '/inventory/new',  label: 'Add Laptop',    icon: <Monitor size={16} />,   color: '#3B82F6' },
            { href: '/rentals/new',    label: 'New Rental',    icon: <FileText size={16} />,  color: '#14B8A6' },
            { href: '/clients',        label: 'Manage Clients',icon: <Package size={16} />,   color: '#8B5CF6' },
            { href: '/rentals/overdue',label: 'Check Overdue', icon: <Clock size={16} />,     color: '#F43F5E' },
          ].map(q => (
            <Link key={q.href} href={q.href}
              className="glass-card p-4 flex items-center gap-3 hover:border-blue-500/30 transition-all"
              style={{ textDecoration: 'none' }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${q.color}15` }}>
                <span style={{ color: q.color }}>{q.icon}</span>
              </div>
              <span className="text-sm font-medium" style={{ color: '#94A3B8' }}>{q.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
