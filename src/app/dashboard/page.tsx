'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { StatCard, CardHeader, EmptyState, Skeleton } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { DashboardSummary } from '@/types';
import Link from 'next/link';
import {
  Monitor, FileText, TrendingUp, Package, Wrench, Truck,
  Plus, ArrowRight, Layers, Activity, Users, BarChart2,
  Calendar, Clock, AlertCircle, CheckCircle2, ArrowUpRight,
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';

/* ── Helpers ─────────────────────────────────────────────────── */
const fmt  = (n: number) => '₹' + new Intl.NumberFormat('en-IN').format(n);
const fmtK = (n: number) => n >= 100000 ? `₹${(n/100000).toFixed(1)}L` : n >= 1000 ? `₹${(n/1000).toFixed(0)}K` : `₹${n}`;
const fmtD = (d?: string) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—';
const fmtRel = (d?: string) => {
  if (!d) return '—';
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

/* Mock monthly revenue data */
const MONTHS = ['Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar','Apr','May'];
function buildMonthlyData(total: number) {
  return MONTHS.map((m, i) => ({
    month: m,
    revenue: Math.round(total * (0.05 + Math.random() * 0.12) * (1 + i * 0.02)),
    rentals: Math.floor(3 + Math.random() * 15),
  }));
}

/* ── Custom Tooltip ──────────────────────────────────────────── */
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border shadow-lg px-3 py-2.5" style={{ background: 'white', borderColor: '#E2E8F0', fontSize: 12 }}>
      <p className="font-semibold mb-1" style={{ color: '#334155' }}>{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: <strong>{p.name === 'revenue' ? fmtK(p.value) : p.value}</strong>
        </p>
      ))}
    </div>
  );
}

/* ── Activity type styles ────────────────────────────────────── */
const ACT_STYLE: Record<string, { bg: string; color: string }> = {
  rental:   { bg: '#EFF6FF', color: '#2563EB' },
  issue:    { bg: '#FEF3C7', color: '#D97706' },
  schedule: { bg: '#F0FDF4', color: '#16A34A' },
};

export default function DashboardPage() {
  const { user } = useAuth();
  const [now,           setNow]      = useState(new Date());
  const [summary,       setSummary]  = useState<DashboardSummary | null>(null);
  const [activeRentals, setActive]   = useState<any[]>([]);
  const [available,     setAvailable]= useState<any[]>([]);
  const [activity,      setActivity] = useState<any[]>([]);
  const [chartData,     setChart]    = useState<any[]>([]);
  const [loading,       setLoading]  = useState(true);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    Promise.all([
      api.dashboard.summary(),
      api.rentals.list({ per_page: '6', status: 'active' }),
      api.inventory.list({ status: 'available', per_page: '5' }),
      api.rentals.list({ per_page: '8' }),
      api.issues.list({ per_page: '5' }),
      api.schedules.list({ per_page: '5' }),
    ]).then(([sum, actR, avail, recR, iss, sch]) => {
      const s = sum.data as DashboardSummary;
      setSummary(s);
      setActive(actR.data?.data || []);
      setAvailable(avail.data?.data || []);
      setChart(buildMonthlyData(s?.total_revenue || 150000));

      const items: any[] = [];
      (recR.data?.data || []).forEach((r: any) => items.push({
        id: `r${r.id}`, type: 'rental', time: r.created_at,
        title: `Rental ${r.rental_no}`, sub: `${r.client?.name || '—'} · ${r.inventory?.brand} ${r.inventory?.model_no}`,
        link: `/rentals/${r.id}`, badge: r.status, icon: <FileText size={13} />,
      }));
      (iss.data?.data || iss.data || []).forEach((i: any) => items.push({
        id: `i${i.id}`, type: 'issue', time: i.created_at,
        title: i.title, sub: `${i.inventory?.brand || ''} ${i.inventory?.model_no || ''} · ${i.reporter?.name || ''}`,
        link: '/issues', badge: i.severity, icon: <Wrench size={13} />,
      }));
      (sch.data?.data || sch.data || []).forEach((s: any) => items.push({
        id: `s${s.id}`, type: 'schedule', time: s.created_at || s.scheduled_at,
        title: `${s.type === 'pickup' ? '↑ Pickup' : '↓ Delivery'} scheduled`,
        sub: `${s.rental?.client?.name || s.address || '—'}`,
        link: '/schedules', badge: s.status, icon: <Truck size={13} />,
      }));
      items.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
      setActivity(items.slice(0, 14));
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const greeting = () => {
    const h = new Date().getHours();
    return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  };

  const utilPct = summary
    ? Math.round(((summary.active_rentals || 0) / Math.max(summary.total_laptops, 1)) * 100)
    : 0;

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">

        {/* ── Header ── */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', color: '#0F172A', letterSpacing: '-0.02em' }}>
                {greeting()}, {user?.name?.split(' ')[0]} 👋
              </h1>
              <div className="px-3 py-1 rounded-full text-sm font-semibold tabular-nums"
                style={{ background: '#EFF6FF', color: '#2563EB' }}>
                {now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
              </div>
            </div>
            <p className="text-sm mt-0.5" style={{ color: '#64748B' }}>
              {now.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/inventory/new"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold transition-all hover:shadow-md"
              style={{ background: '#EFF6FF', color: '#2563EB', border: '1px solid rgba(37,99,235,0.2)', textDecoration: 'none' }}>
              <Plus size={14} /> Add Laptop
            </Link>
            <Link href="/rentals/new"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:shadow-md"
              style={{ background: 'linear-gradient(135deg, #2563EB, #7C3AED)', textDecoration: 'none' }}>
              <FileText size={14} /> New Rental
            </Link>
          </div>
        </div>

        {/* ── KPI Cards ── */}
        {loading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <Skeleton key={i} height={120} className="rounded-2xl" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Total Laptops"   value={summary?.total_laptops ?? 0}     icon={<Monitor size={18} />}    color="#2563EB" sub="Fleet size"               href="/inventory" trendValue="+3%" trend="up" />
            <StatCard label="Active Rentals"  value={summary?.active_rentals ?? 0}    icon={<CheckCircle2 size={18}/>} color="#7C3AED" sub="Currently rented"        href="/rentals"   trendValue="+12%" trend="up" />
            <StatCard label="Monthly Revenue" value={fmtK(summary?.total_revenue ?? 0)} icon={<TrendingUp size={18}/>} color="#16A34A" sub="This month"              href="/reports"   trendValue="+8%" trend="up" />
            <StatCard label="Open Issues"     value={0}                               icon={<AlertCircle size={18}/>} color="#DC2626" sub="Pending resolution"       href="/issues"    trend="flat" trendValue="0%" />
          </div>
        )}

        {/* ── Charts row ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Revenue Area Chart */}
          <div className="lg:col-span-2 glass-card overflow-hidden">
            <CardHeader
              title="Revenue Trend"
              icon={<TrendingUp size={14} style={{ color: '#2563EB' }} />}
              iconBg="#EFF6FF"
              action={
                <Link href="/reports" className="inline-flex items-center gap-1 text-xs font-medium"
                  style={{ color: '#2563EB', textDecoration: 'none' }}>
                  Full report <ArrowRight size={11} />
                </Link>
              }
            />
            <div className="px-5 pb-5 pt-4">
              {loading ? (
                <Skeleton height={180} />
              ) : (
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#2563EB" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} tickFormatter={v => fmtK(v)} />
                    <Tooltip content={<ChartTooltip />} />
                    <Area type="monotone" dataKey="revenue" name="revenue" stroke="#2563EB" strokeWidth={2} fill="url(#revGrad)" dot={false} activeDot={{ r: 4, fill: '#2563EB' }} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Fleet Status donut-style */}
          <div className="glass-card overflow-hidden">
            <CardHeader
              title="Fleet Status"
              icon={<Monitor size={14} style={{ color: '#7C3AED' }} />}
              iconBg="#F5F3FF"
            />
            <div className="p-5">
              {loading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => <Skeleton key={i} height={44} />)}
                </div>
              ) : (
                <div className="space-y-3.5">
                  {[
                    { label: 'Available',    value: summary?.available_laptops ?? 0, total: summary?.total_laptops ?? 1, color: '#16A34A', bg: '#DCFCE7' },
                    { label: 'On Rent',      value: summary?.active_rentals ?? 0,    total: summary?.total_laptops ?? 1, color: '#2563EB', bg: '#DBEAFE' },
                    { label: 'Maintenance',  value: Math.max(0, (summary?.total_laptops ?? 0) - (summary?.available_laptops ?? 0) - (summary?.active_rentals ?? 0)), total: summary?.total_laptops ?? 1, color: '#D97706', bg: '#FEF3C7' },
                  ].map(s => {
                    const pct = summary?.total_laptops ? Math.round((s.value / summary.total_laptops) * 100) : 0;
                    return (
                      <div key={s.label}>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full" style={{ background: s.color }} />
                            <span className="text-sm font-medium" style={{ color: '#334155' }}>{s.label}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold" style={{ color: '#0F172A' }}>{s.value}</span>
                            <span className="text-xs px-1.5 py-0.5 rounded-md font-medium" style={{ background: s.bg, color: s.color }}>{pct}%</span>
                          </div>
                        </div>
                        <div className="progress-bar">
                          <div className="progress-fill" style={{ width: `${pct}%`, background: s.color }} />
                        </div>
                      </div>
                    );
                  })}
                  <div className="mt-4 pt-4 border-t" style={{ borderColor: '#E2E8F0' }}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium" style={{ color: '#64748B' }}>Utilization rate</span>
                      <span className="text-lg font-bold" style={{ color: '#0F172A', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>{utilPct}%</span>
                    </div>
                    <div className="progress-bar mt-2">
                      <div className="progress-fill" style={{ width: `${utilPct}%`, background: 'linear-gradient(90deg, #2563EB, #7C3AED)' }} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Rentals chart + Available laptops ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Monthly rentals bar chart */}
          <div className="glass-card overflow-hidden">
            <CardHeader title="Rentals / Month" icon={<BarChart2 size={14} style={{ color: '#7C3AED' }} />} iconBg="#F5F3FF" />
            <div className="px-5 pb-5 pt-4">
              {loading ? <Skeleton height={120} /> : (
                <ResponsiveContainer width="100%" height={120}>
                  <BarChart data={chartData} margin={{ top: 0, right: 0, left: -28, bottom: 0 }}>
                    <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} interval={1} />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="rentals" name="rentals" fill="#7C3AED" radius={[4, 4, 0, 0]} maxBarSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Active Rentals table */}
          <div className="lg:col-span-2 glass-card overflow-hidden">
            <CardHeader
              title="Active Rentals"
              icon={<FileText size={14} style={{ color: '#2563EB' }} />}
              iconBg="#EFF6FF"
              action={
                <Link href="/rentals" className="inline-flex items-center gap-1 text-xs font-medium"
                  style={{ color: '#2563EB', textDecoration: 'none' }}>
                  View all <ArrowRight size={11} />
                </Link>
              }
            />
            {loading ? (
              <div className="p-5 space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} height={40} />)}</div>
            ) : activeRentals.length === 0 ? (
              <EmptyState icon={<FileText size={20} />} title="No active rentals" desc="New rentals will appear here" />
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      {['Rental', 'Client', 'Laptop', 'End Date', 'Amount'].map(h => (
                        <th key={h}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {activeRentals.map(r => (
                      <tr key={r.id}>
                        <td>
                          <Link href={`/rentals/${r.id}`}
                            className="font-mono text-xs font-semibold inline-flex items-center gap-1"
                            style={{ color: '#2563EB', textDecoration: 'none' }}>
                            {r.bulk_id && <Layers size={10} style={{ color: '#7C3AED' }} />}
                            {r.rental_no}
                          </Link>
                        </td>
                        <td>
                          <div className="font-medium text-sm" style={{ color: '#0F172A' }}>{r.client?.name || '—'}</div>
                          {r.client?.company && <div className="text-xs" style={{ color: '#94A3B8' }}>{r.client.company}</div>}
                        </td>
                        <td className="text-xs" style={{ color: '#64748B' }}>{r.inventory?.brand} {r.inventory?.model_no}</td>
                        <td className="text-xs" style={{ color: '#64748B', whiteSpace: 'nowrap' }}>{fmtD(r.end_date)}</td>
                        <td className="font-semibold text-sm" style={{ color: '#16A34A' }}>{fmt(r.grand_total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* ── Activity + Quick Actions + Available ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Activity feed */}
          <div className="lg:col-span-2 glass-card overflow-hidden">
            <CardHeader
              title="Recent Activity"
              icon={<Activity size={14} style={{ color: '#7C3AED' }} />}
              iconBg="#F5F3FF"
              action={<span className="text-xs" style={{ color: '#94A3B8' }}>Last 48 hours</span>}
            />
            {loading ? (
              <div className="p-5 space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} height={52} />)}</div>
            ) : activity.length === 0 ? (
              <EmptyState icon={<Activity size={20} />} title="No recent activity" />
            ) : (
              <div className="overflow-y-auto" style={{ maxHeight: 400 }}>
                {activity.map((item, i) => {
                  const st = ACT_STYLE[item.type] ?? ACT_STYLE.rental;
                  return (
                    <Link key={item.id} href={item.link}
                      className="flex items-start gap-3 px-5 py-3.5 transition-colors border-b hover:bg-slate-50"
                      style={{ borderColor: '#F1F5F9', textDecoration: 'none' }}>
                      <div className="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                        style={{ background: st.bg }}>
                        <span style={{ color: st.color }}>{item.icon}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium" style={{ color: '#0F172A' }}>{item.title}</span>
                          {item.badge && <span className={`badge badge-${item.badge}`}>{item.badge}</span>}
                        </div>
                        <div className="text-xs mt-0.5 truncate" style={{ color: '#64748B' }}>{item.sub}</div>
                      </div>
                      <div className="text-xs flex-shrink-0 mt-0.5" style={{ color: '#94A3B8' }}>{fmtRel(item.time)}</div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right column */}
          <div className="flex flex-col gap-4">

            {/* Quick Actions */}
            <div className="glass-card overflow-hidden">
              <CardHeader title="Quick Actions" icon={<Plus size={14} style={{ color: '#2563EB' }} />} iconBg="#EFF6FF" />
              <div className="p-3 grid grid-cols-2 lg:grid-cols-1 gap-2">
                {[
                  { href: '/rentals/new',       label: 'New Rental',   icon: FileText,  color: '#2563EB', bg: '#EFF6FF' },
                  { href: '/rentals/bulk/new',  label: 'Bulk Rental',  icon: Layers,    color: '#7C3AED', bg: '#F5F3FF' },
                  { href: '/inventory/new',     label: 'Add Laptop',   icon: Monitor,   color: '#16A34A', bg: '#F0FDF4' },
                  { href: '/schedules',         label: 'Schedules',    icon: Calendar,  color: '#D97706', bg: '#FFFBEB' },
                  { href: '/reports',           label: 'Reports',      icon: BarChart2, color: '#0284C7', bg: '#F0F9FF' },
                  { href: '/issues',            label: 'Issues',       icon: Wrench,    color: '#DC2626', bg: '#FEF2F2' },
                ].map(q => {
                  const Icon = q.icon;
                  return (
                    <Link key={q.href} href={q.href}
                      className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all hover:scale-[1.01]"
                      style={{ border: '1px solid #E2E8F0', textDecoration: 'none' }}>
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: q.bg }}>
                        <Icon size={13} style={{ color: q.color }} />
                      </div>
                      <span className="text-sm font-medium truncate" style={{ color: '#334155' }}>{q.label}</span>
                      <ArrowUpRight size={11} className="ml-auto hidden lg:block" style={{ color: '#CBD5E1' }} />
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* Available Laptops */}
            {!loading && available.length > 0 && (
              <div className="glass-card overflow-hidden">
                <CardHeader
                  title="Available Now"
                  icon={<Package size={14} style={{ color: '#16A34A' }} />}
                  iconBg="#F0FDF4"
                  action={
                    <Link href="/inventory" className="text-xs font-medium" style={{ color: '#2563EB', textDecoration: 'none' }}>
                      View all
                    </Link>
                  }
                />
                <div className="p-3 space-y-1.5">
                  {available.map(inv => (
                    <Link key={inv.id} href={`/inventory/${inv.id}`}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all hover:bg-slate-50"
                      style={{ border: '1px solid #F1F5F9', textDecoration: 'none' }}>
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: '#EFF6FF' }}>
                        <Monitor size={13} style={{ color: '#2563EB' }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold truncate" style={{ color: '#0F172A' }}>
                          {inv.brand} {inv.model_no}
                        </div>
                        <div className="text-xs" style={{ color: '#94A3B8', fontFamily: 'JetBrains Mono, monospace' }}>
                          {inv.asset_code}
                        </div>
                      </div>
                      <span className="badge badge-available">ready</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
    </DashboardLayout>
  );
}
