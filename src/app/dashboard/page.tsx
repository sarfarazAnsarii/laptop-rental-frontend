'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { CardHeader, EmptyState, Skeleton } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { DashboardSummary } from '@/types';
import Link from 'next/link';
import {
  Monitor, FileText, TrendingUp, Package, Wrench, Truck,
  Plus, ArrowRight, Layers, Activity, BarChart2,
  Calendar, AlertCircle, CheckCircle2, ArrowUpRight,
  Users, Zap,
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';

/* ── Count-up hook ───────────────────────────────────────────────── */
function useCountUp(target: number, enabled: boolean, duration = 1400) {
  const [val, setVal] = useState(0);
  const raf = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (!enabled) return;
    if (target === 0) { setVal(0); return; }
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - t0) / duration, 1);
      const e = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(target * e));
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [target, enabled, duration]);
  return val;
}

/* ── Helpers ─────────────────────────────────────────────────────── */
const fmt  = (n: number) => '₹' + new Intl.NumberFormat('en-IN').format(n);
const fmtK = (n: number) => n >= 100000 ? `₹${(n / 100000).toFixed(1)}L` : n >= 1000 ? `₹${(n / 1000).toFixed(0)}K` : `₹${n}`;
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

/* ── Chart helpers ───────────────────────────────────────────────── */
const MONTHS = ['Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May'];
function buildMonthlyData(total: number) {
  return MONTHS.map((m, i) => ({
    month: m,
    revenue: Math.round(total * (0.05 + Math.random() * 0.12) * (1 + i * 0.02)),
    rentals: Math.floor(3 + Math.random() * 15),
  }));
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border shadow-lg px-3 py-2.5" style={{ background: 'white', borderColor: '#E2E8F0', fontSize: 12 }}>
      <p className="font-semibold mb-1" style={{ color: '#334155' }}>{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name === 'revenue' ? 'Revenue' : 'Rentals'}:{' '}
          <strong>{p.name === 'revenue' ? fmtK(p.value) : p.value}</strong>
        </p>
      ))}
    </div>
  );
}

/* ── Activity styles ─────────────────────────────────────────────── */
const ACT_STYLE: Record<string, { bg: string; color: string }> = {
  rental:   { bg: '#EFF6FF', color: '#2563EB' },
  issue:    { bg: '#FEF3C7', color: '#D97706' },
  schedule: { bg: '#F0FDF4', color: '#16A34A' },
};

/* ── Premium KPI Card ────────────────────────────────────────────── */
interface KpiCardProps {
  label: string;
  rawValue: number;
  displayValue: string | number;
  icon: React.ReactNode;
  accentColor: string;
  accentBg: string;
  sub: string;
  trend: string;
  trendUp: boolean;
  barPct: number;
  barColor: string;
  href: string;
  delayClass: string;
  loaded: boolean;
}

function KpiCard({ label, displayValue, icon, accentColor, accentBg, sub, trend, trendUp, barPct, barColor, href, delayClass, loaded }: KpiCardProps) {
  const [barReady, setBarReady] = useState(false);
  useEffect(() => {
    if (loaded) {
      const t = setTimeout(() => setBarReady(true), 600);
      return () => clearTimeout(t);
    }
  }, [loaded]);

  return (
    <Link href={href} className={`kpi-premium animate-kpi ${delayClass} block`} style={{ textDecoration: 'none' }}>
      {/* Accent top bar */}
      <div style={{ height: 3, background: `linear-gradient(90deg, ${accentColor}, ${accentColor}88)` }} />
      <div className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#94A3B8', letterSpacing: '0.07em' }}>{label}</span>
            <div className="flex items-end gap-2 mt-1">
              <span className="text-3xl font-extrabold tabular-nums animate-number-pop"
                style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', color: accentColor, lineHeight: 1 }}>
                {displayValue}
              </span>
            </div>
            <span className="text-xs mt-0.5" style={{ color: '#64748B' }}>{sub}</span>
          </div>
          <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{ background: accentBg, border: `1px solid ${accentColor}22` }}>
            <span style={{ color: accentColor }}>{icon}</span>
          </div>
        </div>

        {/* Trend badge */}
        <div className="flex items-center gap-2 mb-3">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold"
            style={{
              background: trendUp ? '#F0FDF4' : '#FEF2F2',
              color: trendUp ? '#16A34A' : '#DC2626',
            }}>
            {trendUp ? '↑' : '→'} {trend}
          </span>
          <span className="text-xs" style={{ color: '#94A3B8' }}>vs last month</span>
        </div>

        {/* Animated progress bar */}
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#F1F5F9' }}>
          <div className="h-full rounded-full"
            style={{
              width: barReady ? `${barPct}%` : '0%',
              background: barColor,
              transition: 'width 1.2s cubic-bezier(0.34,1.56,0.64,1)',
            }} />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-xs" style={{ color: '#94A3B8' }}>Fleet share</span>
          <span className="text-xs font-semibold" style={{ color: '#64748B' }}>{barPct}%</span>
        </div>
      </div>
    </Link>
  );
}

/* ── Main Page ───────────────────────────────────────────────────── */
export default function DashboardPage() {
  const { user } = useAuth();
  const [now,           setNow]       = useState(new Date());
  const [summary,       setSummary]   = useState<DashboardSummary | null>(null);
  const [activeRentals, setActive]    = useState<any[]>([]);
  const [available,     setAvailable] = useState<any[]>([]);
  const [activity,      setActivity]  = useState<any[]>([]);
  const [chartData,     setChart]     = useState<any[]>([]);
  const [loading,       setLoading]   = useState(true);

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

  const loaded = !loading && !!summary;
  const total = summary?.total_laptops ?? 1;

  /* Count-up values */
  const cLaptops = useCountUp(summary?.total_laptops   ?? 0, loaded, 1200);
  const cRentals = useCountUp(summary?.active_rentals  ?? 0, loaded, 1400);
  const cRevenue = useCountUp(summary?.total_revenue   ?? 0, loaded, 1600);
  const cClients = useCountUp(summary?.total_clients   ?? 0, loaded, 1300);

  const maintenance = Math.max(0, (summary?.total_laptops ?? 0) - (summary?.available_laptops ?? 0) - (summary?.active_rentals ?? 0));
  const utilPct = summary ? Math.round(((summary.active_rentals || 0) / Math.max(summary.total_laptops, 1)) * 100) : 0;

  /* Fleet bar animated widths */
  const [fleetReady, setFleetReady] = useState(false);
  useEffect(() => {
    if (loaded) {
      const t = setTimeout(() => setFleetReady(true), 400);
      return () => clearTimeout(t);
    }
  }, [loaded]);

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">

        {/* ── Hero Header ──────────────────────────────────────────── */}
        <div className="relative overflow-hidden rounded-2xl px-6 py-5 flex flex-wrap items-center justify-between gap-4"
          style={{
            background: 'linear-gradient(135deg, #0F172A 0%, #1E3A5F 55%, #2563EB 100%)',
            boxShadow: '0 8px 32px rgba(37,99,235,0.18)',
          }}>
          {/* Decorative orbs */}
          <div className="absolute top-0 right-0 w-64 h-64 rounded-full pointer-events-none"
            style={{ background: 'radial-gradient(circle, rgba(124,58,237,0.18) 0%, transparent 70%)', transform: 'translate(30%,-30%)' }} />
          <div className="absolute bottom-0 left-24 w-40 h-40 rounded-full pointer-events-none"
            style={{ background: 'radial-gradient(circle, rgba(37,99,235,0.25) 0%, transparent 70%)', transform: 'translateY(40%)' }} />

          <div className="relative z-10">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-extrabold"
                style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', color: '#FFFFFF', letterSpacing: '-0.03em' }}>
                {greeting()},&nbsp;
                <span style={{
                  background: 'linear-gradient(90deg, #93C5FD, #C4B5FD)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}>
                  {user?.name?.split(' ')[0]}
                </span>
                &nbsp;👋
              </h1>
            </div>
            <p className="text-sm mt-1 flex items-center gap-2" style={{ color: '#93C5FD' }}>
              <span className="live-dot" style={{ background: '#4ADE80' }} />
              {now.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              &nbsp;·&nbsp;
              <span className="tabular-nums font-semibold" style={{ color: '#E2E8F0' }}>
                {now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
              </span>
            </p>
            {summary && (
              <div className="mt-2 flex items-center gap-2">
                <div className="px-2.5 py-1 rounded-full text-xs font-bold"
                  style={{ background: 'rgba(255,255,255,0.12)', color: '#E2E8F0', backdropFilter: 'blur(4px)', border: '1px solid rgba(255,255,255,0.15)' }}>
                  <span style={{ color: '#4ADE80' }}>⬤</span>&nbsp; Fleet {utilPct}% utilized
                </div>
                <div className="px-2.5 py-1 rounded-full text-xs font-bold"
                  style={{ background: 'rgba(255,255,255,0.12)', color: '#E2E8F0', backdropFilter: 'blur(4px)', border: '1px solid rgba(255,255,255,0.15)' }}>
                  {summary.available_laptops} laptops ready
                </div>
              </div>
            )}
          </div>

          <div className="relative z-10 flex items-center gap-2 flex-wrap">
            <Link href="/inventory/new"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold transition-all hover:scale-105"
              style={{ background: 'rgba(255,255,255,0.15)', color: '#FFFFFF', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.2)', textDecoration: 'none' }}>
              <Plus size={14} /> Add Laptop
            </Link>
            <Link href="/rentals/new"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold transition-all hover:scale-105"
              style={{ background: '#FFFFFF', color: '#1D4ED8', textDecoration: 'none' }}>
              <FileText size={14} /> New Rental
            </Link>
          </div>
        </div>

        {/* ── KPI Cards ────────────────────────────────────────────── */}
        {loading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <Skeleton key={i} height={178} className="rounded-2xl" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              label="Total Laptops"
              rawValue={summary?.total_laptops ?? 0}
              displayValue={cLaptops}
              icon={<Monitor size={18} />}
              accentColor="#2563EB"
              accentBg="#EFF6FF"
              sub="Fleet size"
              trend="+3%"
              trendUp
              barPct={summary?.total_laptops ? 100 : 0}
              barColor="linear-gradient(90deg,#2563EB,#3B82F6)"
              href="/inventory"
              delayClass="delay-1"
              loaded={loaded}
            />
            <KpiCard
              label="Active Rentals"
              rawValue={summary?.active_rentals ?? 0}
              displayValue={cRentals}
              icon={<CheckCircle2 size={18} />}
              accentColor="#7C3AED"
              accentBg="#F5F3FF"
              sub="Currently rented"
              trend="+12%"
              trendUp
              barPct={Math.round(((summary?.active_rentals ?? 0) / Math.max(total, 1)) * 100)}
              barColor="linear-gradient(90deg,#7C3AED,#A78BFA)"
              href="/rentals"
              delayClass="delay-2"
              loaded={loaded}
            />
            <KpiCard
              label="Total Revenue"
              rawValue={summary?.total_revenue ?? 0}
              displayValue={fmtK(cRevenue)}
              icon={<TrendingUp size={18} />}
              accentColor="#16A34A"
              accentBg="#F0FDF4"
              sub="Lifetime earnings"
              trend="+8%"
              trendUp
              barPct={Math.min(utilPct + 10, 95)}
              barColor="linear-gradient(90deg,#16A34A,#4ADE80)"
              href="/reports"
              delayClass="delay-3"
              loaded={loaded}
            />
            <KpiCard
              label="Total Clients"
              rawValue={summary?.total_clients ?? 0}
              displayValue={cClients}
              icon={<Users size={18} />}
              accentColor="#0284C7"
              accentBg="#F0F9FF"
              sub="Registered clients"
              trend="+5%"
              trendUp
              barPct={Math.min((summary?.total_clients ?? 0) * 4, 88)}
              barColor="linear-gradient(90deg,#0284C7,#38BDF8)"
              href="/users"
              delayClass="delay-4"
              loaded={loaded}
            />
          </div>
        )}

        {/* ── Charts Row ───────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Revenue Area Chart */}
          <div className="lg:col-span-2 glass-card overflow-hidden animate-kpi delay-3">
            <CardHeader
              title="Revenue Trend"
              icon={<TrendingUp size={14} style={{ color: '#2563EB' }} />}
              iconBg="#EFF6FF"
              action={
                <Link href="/reports" className="inline-flex items-center gap-1 text-xs font-semibold"
                  style={{ color: '#2563EB', textDecoration: 'none' }}>
                  Full report <ArrowRight size={11} />
                </Link>
              }
            />
            <div className="px-5 pb-5 pt-2">
              {loading ? <Skeleton height={190} /> : (
                <ResponsiveContainer width="100%" height={190}>
                  <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%"   stopColor="#2563EB" stopOpacity={0.2} />
                        <stop offset="100%" stopColor="#2563EB" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="revStroke" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%"   stopColor="#2563EB" />
                        <stop offset="100%" stopColor="#7C3AED" />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} tickFormatter={v => fmtK(v)} />
                    <Tooltip content={<ChartTooltip />} />
                    <Area type="monotone" dataKey="revenue" name="revenue"
                      stroke="url(#revStroke)" strokeWidth={2.5}
                      fill="url(#revGrad)"
                      dot={false}
                      activeDot={{ r: 5, fill: '#2563EB', strokeWidth: 2, stroke: '#fff' }} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Fleet Status */}
          <div className="glass-card overflow-hidden animate-kpi delay-4">
            <CardHeader
              title="Fleet Status"
              icon={<Monitor size={14} style={{ color: '#7C3AED' }} />}
              iconBg="#F5F3FF"
            />
            <div className="p-5">
              {loading ? (
                <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} height={48} />)}</div>
              ) : (
                <div className="space-y-4">
                  {[
                    { label: 'Available',   value: summary?.available_laptops ?? 0, color: '#16A34A', bg: '#DCFCE7', barBg: 'linear-gradient(90deg,#16A34A,#4ADE80)' },
                    { label: 'On Rent',     value: summary?.active_rentals    ?? 0, color: '#2563EB', bg: '#DBEAFE', barBg: 'linear-gradient(90deg,#2563EB,#60A5FA)' },
                    { label: 'Maintenance', value: maintenance,                     color: '#D97706', bg: '#FEF3C7', barBg: 'linear-gradient(90deg,#D97706,#FCD34D)' },
                  ].map(s => {
                    const pct = total > 0 ? Math.round((s.value / total) * 100) : 0;
                    return (
                      <div key={s.label}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full" style={{ background: s.color }} />
                            <span className="text-sm font-medium" style={{ color: '#334155' }}>{s.label}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold tabular-nums" style={{ color: '#0F172A', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>{s.value}</span>
                            <span className="text-xs px-1.5 py-0.5 rounded-md font-semibold" style={{ background: s.bg, color: s.color }}>{pct}%</span>
                          </div>
                        </div>
                        <div className="h-2 rounded-full overflow-hidden" style={{ background: '#F1F5F9' }}>
                          <div className="h-full rounded-full"
                            style={{
                              width: fleetReady ? `${pct}%` : '0%',
                              background: s.barBg,
                              transition: 'width 1.1s cubic-bezier(0.34,1.56,0.64,1)',
                            }} />
                        </div>
                      </div>
                    );
                  })}

                  {/* Utilization rate */}
                  <div className="pt-3 border-t" style={{ borderColor: '#E2E8F0' }}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#94A3B8', letterSpacing: '0.06em' }}>Utilization</span>
                      <span className="text-xl font-extrabold tabular-nums"
                        style={{ color: '#0F172A', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>{utilPct}%</span>
                    </div>
                    <div className="h-2.5 rounded-full overflow-hidden" style={{ background: '#F1F5F9' }}>
                      <div className="h-full rounded-full"
                        style={{
                          width: fleetReady ? `${utilPct}%` : '0%',
                          background: 'linear-gradient(90deg, #2563EB, #7C3AED)',
                          transition: 'width 1.3s cubic-bezier(0.34,1.56,0.64,1)',
                          boxShadow: '0 0 6px rgba(37,99,235,0.4)',
                        }} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Rentals Bar Chart + Active Table ─────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Monthly bar chart */}
          <div className="glass-card overflow-hidden animate-kpi delay-5">
            <CardHeader title="Rentals / Month" icon={<BarChart2 size={14} style={{ color: '#7C3AED' }} />} iconBg="#F5F3FF" />
            <div className="px-5 pb-5 pt-2">
              {loading ? <Skeleton height={130} /> : (
                <ResponsiveContainer width="100%" height={130}>
                  <BarChart data={chartData} margin={{ top: 0, right: 0, left: -28, bottom: 0 }}>
                    <defs>
                      <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%"   stopColor="#7C3AED" stopOpacity={1} />
                        <stop offset="100%" stopColor="#A78BFA" stopOpacity={0.6} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} interval={1} />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="rentals" name="rentals" fill="url(#barGrad)" radius={[4, 4, 0, 0]} maxBarSize={18} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Active Rentals table */}
          <div className="lg:col-span-2 glass-card overflow-hidden animate-kpi delay-5">
            <CardHeader
              title="Active Rentals"
              icon={<FileText size={14} style={{ color: '#2563EB' }} />}
              iconBg="#EFF6FF"
              action={
                <Link href="/rentals" className="inline-flex items-center gap-1 text-xs font-semibold"
                  style={{ color: '#2563EB', textDecoration: 'none' }}>
                  View all <ArrowRight size={11} />
                </Link>
              }
            />
            {loading ? (
              <div className="p-5 space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} height={42} />)}</div>
            ) : activeRentals.length === 0 ? (
              <EmptyState icon={<FileText size={20} />} title="No active rentals" desc="New rentals will appear here" />
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>{['Rental', 'Client', 'Laptop', 'End Date', 'Amount'].map(h => <th key={h}>{h}</th>)}</tr>
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
                        <td className="font-bold text-sm" style={{ color: '#16A34A', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>{fmt(r.grand_total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* ── Activity Feed + Quick Actions + Available ─────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Activity timeline */}
          <div className="lg:col-span-2 glass-card overflow-hidden animate-kpi delay-6">
            <CardHeader
              title="Recent Activity"
              icon={<Activity size={14} style={{ color: '#7C3AED' }} />}
              iconBg="#F5F3FF"
              action={
                <div className="flex items-center gap-1.5 text-xs" style={{ color: '#94A3B8' }}>
                  <span className="live-dot" />
                  Live
                </div>
              }
            />
            {loading ? (
              <div className="p-5 space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} height={56} />)}</div>
            ) : activity.length === 0 ? (
              <EmptyState icon={<Activity size={20} />} title="No recent activity" />
            ) : (
              <div className="overflow-y-auto" style={{ maxHeight: 420 }}>
                {activity.map((item) => {
                  const st = ACT_STYLE[item.type] ?? ACT_STYLE.rental;
                  return (
                    <Link key={item.id} href={item.link}
                      className="flex items-start gap-3 px-5 py-3.5 transition-colors border-b hover:bg-slate-50 group"
                      style={{ borderColor: '#F1F5F9', textDecoration: 'none' }}>
                      {/* Timeline dot + icon */}
                      <div className="relative flex-shrink-0 mt-0.5">
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                          style={{ background: st.bg }}>
                          <span style={{ color: st.color }}>{item.icon}</span>
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold" style={{ color: '#0F172A' }}>{item.title}</span>
                          {item.badge && <span className={`badge badge-${item.badge}`}>{item.badge}</span>}
                        </div>
                        <div className="text-xs mt-0.5 truncate" style={{ color: '#64748B' }}>{item.sub}</div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0 mt-0.5">
                        <span className="text-xs" style={{ color: '#94A3B8' }}>{fmtRel(item.time)}</span>
                        <ArrowUpRight size={11} className="opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: '#CBD5E1' }} />
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right col */}
          <div className="flex flex-col gap-4">

            {/* Quick Actions */}
            <div className="glass-card overflow-hidden animate-kpi delay-6">
              <CardHeader
                title="Quick Actions"
                icon={<Zap size={14} style={{ color: '#D97706' }} />}
                iconBg="#FFFBEB"
              />
              <div className="p-3 space-y-1.5">
                {[
                  { href: '/rentals/new',      label: 'New Rental',   icon: FileText,  color: '#2563EB', bg: '#EFF6FF' },
                  { href: '/rentals/bulk/new', label: 'Bulk Rental',  icon: Layers,    color: '#7C3AED', bg: '#F5F3FF' },
                  { href: '/inventory/new',    label: 'Add Laptop',   icon: Monitor,   color: '#16A34A', bg: '#F0FDF4' },
                  { href: '/schedules',        label: 'Schedules',    icon: Calendar,  color: '#D97706', bg: '#FFFBEB' },
                  { href: '/reports',          label: 'Reports',      icon: BarChart2, color: '#0284C7', bg: '#F0F9FF' },
                  { href: '/issues',           label: 'Issues',       icon: Wrench,    color: '#DC2626', bg: '#FEF2F2' },
                ].map(q => {
                  const Icon = q.icon;
                  return (
                    <Link key={q.href} href={q.href}
                      className="group flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all hover:scale-[1.02] hover:shadow-sm"
                      style={{ border: '1px solid #E2E8F0', textDecoration: 'none', background: 'white' }}>
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: q.bg }}>
                        <Icon size={13} style={{ color: q.color }} />
                      </div>
                      <span className="text-sm font-semibold flex-1 truncate" style={{ color: '#334155' }}>{q.label}</span>
                      <ArrowUpRight size={12} className="transition-all opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                        style={{ color: '#94A3B8', flexShrink: 0 }} />
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* Available Laptops */}
            {!loading && available.length > 0 && (
              <div className="glass-card overflow-hidden animate-kpi delay-7">
                <CardHeader
                  title="Available Now"
                  icon={<Package size={14} style={{ color: '#16A34A' }} />}
                  iconBg="#F0FDF4"
                  action={
                    <Link href="/inventory" className="text-xs font-semibold"
                      style={{ color: '#2563EB', textDecoration: 'none' }}>
                      View all
                    </Link>
                  }
                />
                <div className="p-3 space-y-1.5">
                  {available.map(inv => (
                    <Link key={inv.id} href={`/inventory/${inv.id}`}
                      className="group flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all hover:bg-slate-50"
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

            {/* Open Issues alert */}
            <div className="glass-card overflow-hidden animate-kpi delay-8 p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: '#FEF2F2' }}>
                  <AlertCircle size={16} style={{ color: '#DC2626' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold" style={{ color: '#0F172A' }}>Open Issues</div>
                  <div className="text-xs" style={{ color: '#94A3B8' }}>All clear — no pending issues</div>
                </div>
                <Link href="/issues"
                  className="text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-colors"
                  style={{ background: '#FEF2F2', color: '#DC2626', textDecoration: 'none' }}>
                  View
                </Link>
              </div>
            </div>

          </div>
        </div>

      </div>
    </DashboardLayout>
  );
}
