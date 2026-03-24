'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { DashboardSummary } from '@/types';
import Link from 'next/link';
import {
  Monitor, FileText, AlertCircle, TrendingUp, CheckCircle, Package,
  Clock, Wrench, Truck, Plus, ArrowRight, Layers, Calendar,
  Activity, BarChart2, Users,
} from 'lucide-react';

const fmt  = (n: number) => '₹' + new Intl.NumberFormat('en-IN').format(n);
const fmtD = (d?: string) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const fmtT = (d?: string) =>
  d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';

/* ── Activity item type ── */
interface ActivityItem {
  id:    string;
  type:  'rental' | 'schedule' | 'issue';
  time:  string;
  title: string;
  sub:   string;
  link:  string;
  color: string;
  icon:  React.ReactNode;
  badge?: string;
  badgeClass?: string;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [now,           setNow]           = useState(new Date());
  const [summary,       setSummary]       = useState<DashboardSummary | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const [activeRentals, setActiveRentals] = useState<any[]>([]);
  const [available,     setAvailable]     = useState<any[]>([]);
  const [activity,      setActivity]      = useState<ActivityItem[]>([]);
  const [overdue,       setOverdue]       = useState<any[]>([]);
  const [loading,       setLoading]       = useState(true);

  useEffect(() => {
    Promise.all([
      api.dashboard.summary(),
      api.rentals.list({ per_page: '5', status: 'active' }),
      api.inventory.list({ status: 'available', per_page: '4' }),
      api.rentals.list({ per_page: '10' }),
      api.issues.list({ per_page: '6' }),
      api.schedules.list({ per_page: '6' }),
      api.rentals.overdue(),
    ]).then(([sum, actR, avail, recR, iss, sch, ovr]) => {
      setSummary(sum.data);
      setActiveRentals(actR.data?.data || []);
      setAvailable(avail.data?.data || []);
      setOverdue(ovr.data?.data || ovr.data || []);

      /* ── build unified activity feed ── */
      const items: ActivityItem[] = [];

      (recR.data?.data || []).forEach((r: any) => {
        items.push({
          id:         `rental-${r.id}`,
          type:       'rental',
          time:       r.created_at,
          title:      `Rental ${r.rental_no}`,
          sub:        `${r.client?.name || '—'} · ${r.inventory?.brand || ''} ${r.inventory?.model_no || ''}`,
          link:       `/rentals/${r.id}`,
          color:      r.status === 'active' ? '#14B8A6' : r.status === 'completed' ? '#10B981' : r.status === 'cancelled' ? '#64748B' : '#3B82F6',
          icon:       <FileText size={13} />,
          badge:      r.status,
          badgeClass: `badge badge-${r.status}`,
        });
      });

      (iss.data?.data || iss.data || []).forEach((i: any) => {
        items.push({
          id:         `issue-${i.id}`,
          type:       'issue',
          time:       i.created_at,
          title:      i.title,
          sub:        `${i.inventory?.brand || ''} ${i.inventory?.model_no || ''} · ${i.reporter?.name || ''}`,
          link:       '/issues',
          color:      i.severity === 'critical' ? '#F43F5E' : i.severity === 'high' ? '#F97316' : '#F59E0B',
          icon:       <Wrench size={13} />,
          badge:      i.severity,
          badgeClass: `badge badge-${i.severity}`,
        });
      });

      (sch.data?.data || sch.data || []).forEach((s: any) => {
        items.push({
          id:         `sched-${s.id}`,
          type:       'schedule',
          time:       s.created_at || s.scheduled_at,
          title:      `${s.type === 'pickup' ? 'Pickup' : 'Delivery'} Scheduled`,
          sub:        `${s.rental?.client?.name || '—'} · ${s.address || ''}`,
          link:       '/schedules',
          color:      s.type === 'pickup' ? '#F97316' : '#3B82F6',
          icon:       <Truck size={13} />,
          badge:      s.status,
          badgeClass: `badge badge-${s.status}`,
        });
      });

      items.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
      setActivity(items.slice(0, 15));
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const statCards = summary ? [
    { label: 'Total Laptops',    value: summary.total_laptops,    icon: Monitor,     color: '#3B82F6', href: '/inventory' },
    { label: 'Available',        value: summary.available,         icon: Package,     color: '#10B981', href: '/inventory' },
    { label: 'Currently Rented', value: summary.rented,            icon: FileText,    color: '#14B8A6', href: '/rentals' },
    { label: 'Overdue',          value: summary.overdue_rentals,   icon: AlertCircle, color: '#F43F5E', href: '/rentals/overdue' },
    { label: 'Active Rentals',   value: summary.active_rentals,    icon: CheckCircle, color: '#8B5CF6', href: '/rentals' },
    { label: 'Revenue / Month',  value: fmt(summary.total_revenue),icon: TrendingUp,  color: '#F59E0B', href: '/reports' },
  ] : [];

  return (
    <DashboardLayout>
      <div className="animate-fade-in space-y-6">

        {/* ── Header ── */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-baseline gap-3 flex-wrap mb-1">
              <h1 className="text-2xl sm:text-3xl font-bold"
                style={{ fontFamily: 'Syne, sans-serif', color: '#F1F5F9' }}>
                {greeting()}, {user?.name?.split(' ')[0]} 👋
              </h1>
              <span className="text-2xl sm:text-3xl font-bold tabular-nums"
                style={{ fontFamily: 'Syne, sans-serif', color: '#3B82F6' }}>
                {now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
              </span>
            </div>
            <p className="text-sm" style={{ color: '#64748B' }}>
              {now.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Link href="/inventory/new"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all hover:opacity-80"
              style={{ background: 'rgba(59,130,246,0.12)', color: '#3B82F6', border: '1px solid rgba(59,130,246,0.2)' }}>
              <Plus size={13} /> Add Laptop
            </Link>
            <Link href="/rentals/new"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all hover:opacity-80"
              style={{ background: 'rgba(20,184,166,0.12)', color: '#14B8A6', border: '1px solid rgba(20,184,166,0.2)' }}>
              <Plus size={13} /> New Rental
            </Link>
            <Link href="/reports"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all hover:opacity-80"
              style={{ background: 'rgba(139,92,246,0.12)', color: '#A78BFA', border: '1px solid rgba(139,92,246,0.2)' }}>
              <BarChart2 size={13} /> Reports
            </Link>
          </div>
        </div>

        {/* ── Stat Cards ── */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
            {[...Array(6)].map((_, i) => <div key={i} className="skeleton h-24 rounded-2xl" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
            {statCards.map((s, i) => {
              const Icon = s.icon;
              return (
                <Link key={i} href={s.href}
                  className="glass-card p-4 flex flex-col gap-2 hover:border-blue-500/20 transition-all group"
                  style={{ textDecoration: 'none', animationDelay: `${i * 0.06}s` }}>
                  <div className="flex items-center justify-between">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                      style={{ background: `${s.color}14`, border: `1px solid ${s.color}20` }}>
                      <Icon size={15} style={{ color: s.color }} />
                    </div>
                    <ArrowRight size={12} className="opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ color: s.color }} />
                  </div>
                  <div>
                    <div className="text-xl font-bold" style={{ fontFamily: 'Syne, sans-serif', color: '#F1F5F9' }}>{s.value}</div>
                    <div className="text-xs mt-0.5" style={{ color: '#64748B' }}>{s.label}</div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {/* ── Overdue alert bar ── */}
        {!loading && overdue.length > 0 && (
          <Link href="/rentals/overdue"
            className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all hover:opacity-90"
            style={{ background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.25)', textDecoration: 'none' }}>
            <AlertCircle size={16} style={{ color: '#F43F5E', flexShrink: 0 }} />
            <span className="text-sm font-semibold" style={{ color: '#F43F5E' }}>
              {overdue.length} overdue rental{overdue.length > 1 ? 's' : ''} require attention
            </span>
            <span className="ml-auto text-xs" style={{ color: '#F43F5E' }}>View →</span>
          </Link>
        )}

        {/* ── Main row ── */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

          {/* Active Rentals */}
          <div className="lg:col-span-3 glass-card overflow-hidden">
            <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid #1E3058' }}>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg flex items-center justify-center"
                  style={{ background: 'rgba(20,184,166,0.12)' }}>
                  <FileText size={13} style={{ color: '#14B8A6' }} />
                </div>
                <span className="text-sm font-bold" style={{ fontFamily: 'Syne, sans-serif', color: '#F1F5F9' }}>Active Rentals</span>
              </div>
              <Link href="/rentals" className="text-xs font-medium flex items-center gap-1" style={{ color: '#3B82F6' }}>
                View all <ArrowRight size={11} />
              </Link>
            </div>
            {loading ? (
              <div className="p-5 space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="skeleton h-10 rounded-xl" />)}</div>
            ) : activeRentals.length === 0 ? (
              <div className="py-12 text-center text-sm" style={{ color: '#475569' }}>No active rentals</div>
            ) : (
              <div className="overflow-x-auto">
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: 'rgba(30,48,88,0.5)' }}>
                      {['Rental No', 'Client', 'Laptop', 'End Date', 'Total'].map(h => (
                        <th key={h} style={{ padding: '9px 14px', textAlign: 'left', color: '#64748B', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #1E3058', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {activeRentals.map(r => (
                      <tr key={r.id} style={{ borderBottom: '1px solid rgba(30,48,88,0.4)' }}
                        className="hover:bg-white/[0.02] transition-colors">
                        <td style={{ padding: '10px 14px' }}>
                          <div className="flex items-center gap-1.5">
                            {r.bulk_id && <Layers size={11} style={{ color: '#A78BFA' }} />}
                            <Link href={`/rentals/${r.id}`} style={{ color: '#3B82F6', fontFamily: 'monospace', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>
                              {r.rental_no}
                            </Link>
                          </div>
                        </td>
                        <td style={{ padding: '10px 14px', color: '#F1F5F9' }}>
                          <div style={{ fontWeight: 500 }}>{r.client?.name || '—'}</div>
                          {r.client?.company && <div style={{ fontSize: 11, color: '#475569' }}>{r.client.company}</div>}
                        </td>
                        <td style={{ padding: '10px 14px', color: '#94A3B8', fontSize: 12 }}>
                          {r.inventory?.brand} {r.inventory?.model_no}
                        </td>
                        <td style={{ padding: '10px 14px', color: '#64748B', fontSize: 12, whiteSpace: 'nowrap' }}>
                          {fmtD(r.end_date)}
                        </td>
                        <td style={{ padding: '10px 14px', color: '#10B981', fontWeight: 700 }}>
                          {fmt(r.grand_total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Available Laptops */}
          <div className="lg:col-span-2 glass-card overflow-hidden">
            <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid #1E3058' }}>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg flex items-center justify-center"
                  style={{ background: 'rgba(16,185,129,0.12)' }}>
                  <Monitor size={13} style={{ color: '#10B981' }} />
                </div>
                <span className="text-sm font-bold" style={{ fontFamily: 'Syne, sans-serif', color: '#F1F5F9' }}>Available Laptops</span>
              </div>
              <Link href="/inventory" className="text-xs font-medium flex items-center gap-1" style={{ color: '#3B82F6' }}>
                View all <ArrowRight size={11} />
              </Link>
            </div>
            {loading ? (
              <div className="p-5 space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="skeleton h-14 rounded-xl" />)}</div>
            ) : available.length === 0 ? (
              <div className="py-12 text-center text-sm" style={{ color: '#475569' }}>No available laptops</div>
            ) : (
              <div className="p-4 space-y-2">
                {available.map(inv => (
                  <Link key={inv.id} href={`/inventory/${inv.id}`}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all hover:bg-blue-500/5"
                    style={{ border: '1px solid #1E3058', textDecoration: 'none' }}>
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: 'rgba(59,130,246,0.1)' }}>
                      <Monitor size={14} style={{ color: '#3B82F6' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold truncate" style={{ color: '#F1F5F9' }}>
                        {inv.brand} {inv.model_no}
                      </div>
                      <div className="text-xs" style={{ color: '#475569' }}>
                        {inv.asset_code} · {inv.ram} / {inv.ssd}
                      </div>
                    </div>
                    <span className="badge badge-available text-xs flex-shrink-0">Ready</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Activity History + Quick Actions ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Application History */}
          <div className="lg:col-span-2 glass-card overflow-hidden">
            <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid #1E3058' }}>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg flex items-center justify-center"
                  style={{ background: 'rgba(139,92,246,0.12)' }}>
                  <Activity size={13} style={{ color: '#A78BFA' }} />
                </div>
                <span className="text-sm font-bold" style={{ fontFamily: 'Syne, sans-serif', color: '#F1F5F9' }}>Application History</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs" style={{ color: '#475569' }}>
                <Clock size={11} /> Recent activity
              </div>
            </div>

            {loading ? (
              <div className="p-5 space-y-3">{[...Array(6)].map((_, i) => <div key={i} className="skeleton h-12 rounded-xl" />)}</div>
            ) : activity.length === 0 ? (
              <div className="py-12 text-center text-sm" style={{ color: '#475569' }}>No recent activity</div>
            ) : (
              <div className="divide-y overflow-y-auto" style={{ borderColor: 'rgba(30,48,88,0.4)', maxHeight: 590 }}>
                {activity.map((item, i) => (
                  <Link key={item.id} href={item.link}
                    className="flex items-start gap-3 px-5 py-3 transition-all hover:bg-white/[0.02] animate-fade-in"
                    style={{ textDecoration: 'none', animationDelay: `${i * 0.03}s` }}>
                    {/* Timeline dot + icon */}
                    <div className="flex flex-col items-center gap-1 flex-shrink-0 pt-0.5">
                      <div className="w-7 h-7 rounded-xl flex items-center justify-center"
                        style={{ background: `${item.color}14`, border: `1px solid ${item.color}25` }}>
                        <span style={{ color: item.color }}>{item.icon}</span>
                      </div>
                      {i < activity.length - 1 && (
                        <div className="w-px flex-1" style={{ background: 'rgba(30,48,88,0.6)', minHeight: 8 }} />
                      )}
                    </div>

                    <div className="flex-1 min-w-0 pb-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold" style={{ color: '#F1F5F9' }}>{item.title}</span>
                        {item.badge && <span className={item.badgeClass}>{item.badge}</span>}
                      </div>
                      <div className="text-xs mt-0.5 truncate" style={{ color: '#64748B' }}>{item.sub}</div>
                    </div>

                    <div className="text-xs flex-shrink-0 text-right" style={{ color: '#334155' }}>
                      {fmtT(item.time)}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Quick Actions + Mini Stats */}
          <div className="flex flex-col gap-4">

            {/* Quick Actions */}
            <div className="glass-card overflow-hidden">
              <div className="px-5 py-4 flex items-center gap-2" style={{ borderBottom: '1px solid #1E3058' }}>
                <div className="w-6 h-6 rounded-lg flex items-center justify-center"
                  style={{ background: 'rgba(59,130,246,0.12)' }}>
                  <Plus size={13} style={{ color: '#3B82F6' }} />
                </div>
                <span className="text-sm font-bold" style={{ fontFamily: 'Syne, sans-serif', color: '#F1F5F9' }}>Quick Actions</span>
              </div>
              <div className="p-3 space-y-2">
                {[
                  { href: '/rentals/new',      label: 'New Rental',       icon: FileText,   color: '#14B8A6' },
                  { href: '/rentals/bulk/new', label: 'Bulk Rental',      icon: Layers,     color: '#A78BFA' },
                  { href: '/inventory/new',    label: 'Add Laptop',       icon: Monitor,    color: '#3B82F6' },
                  { href: '/clients',          label: 'Manage Clients',   icon: Users,      color: '#F59E0B' },
                  { href: '/schedules',        label: 'Schedules',        icon: Calendar,   color: '#F97316' },
                  { href: '/rentals/overdue',  label: 'Check Overdue',    icon: AlertCircle,color: '#F43F5E' },
                  { href: '/reports',          label: 'Monthly Report',   icon: BarChart2,  color: '#8B5CF6' },
                ].map(q => {
                  const Icon = q.icon;
                  return (
                    <Link key={q.href} href={q.href}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all hover:bg-white/5"
                      style={{ border: '1px solid rgba(30,48,88,0.6)', textDecoration: 'none' }}>
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: `${q.color}12`, border: `1px solid ${q.color}20` }}>
                        <Icon size={13} style={{ color: q.color }} />
                      </div>
                      <span className="text-sm font-medium" style={{ color: '#94A3B8' }}>{q.label}</span>
                      <ArrowRight size={12} className="ml-auto" style={{ color: '#334155' }} />
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* Mini summary strip */}
            {summary && (
              <div className="glass-card p-4 space-y-3">
                <div className="text-xs font-bold mb-2" style={{ color: '#475569', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Inventory Breakdown</div>
                {[
                  { label: 'Available',    value: summary.available,        color: '#10B981' },
                  { label: 'Rented',       value: summary.rented,           color: '#14B8A6' },
                  { label: 'Maintenance',  value: (summary as any).maintenance || 0, color: '#F59E0B' },
                  { label: 'Total',        value: summary.total_laptops,    color: '#3B82F6' },
                ].map(s => (
                  <div key={s.label} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: s.color }} />
                      <span className="text-xs" style={{ color: '#64748B' }}>{s.label}</span>
                    </div>
                    <div className="flex-1 mx-2 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(30,48,88,0.8)' }}>
                      <div className="h-full rounded-full" style={{
                        background: s.color,
                        width: summary.total_laptops ? `${Math.round((Number(s.value) / summary.total_laptops) * 100)}%` : '0%',
                        opacity: 0.7,
                      }} />
                    </div>
                    <span className="text-xs font-bold w-6 text-right" style={{ color: '#F1F5F9' }}>{s.value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </DashboardLayout>
  );
}
