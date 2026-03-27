'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { PageHeader, EmptyState } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import {
  BarChart2, Printer, Layers, Monitor, X,
  Building2, Phone, Mail,
  ArrowDown, ArrowUp,
} from 'lucide-react';

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

const fmtAmt = (n: any) =>
  Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtDate = (d?: string) =>
  d ? new Date(d).toLocaleDateString('en-IN') : '—';

const fmtDateShort = (d: string) =>
  new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

export default function ReportsPage() {
  const { user } = useAuth();
  const router   = useRouter();

  const now   = new Date();
  const [month,   setMonth]   = useState(now.getMonth());
  const [year,    setYear]    = useState(now.getFullYear());
  const [rentals, setRentals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [laptopModal, setLaptopModal] = useState<{ date: string; rows: any[] } | null>(null);

  useEffect(() => {
    if (user && user.role !== 'admin') router.push('/dashboard');
  }, [user, router]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.rentals.list({ per_page: '500', status: '' });
      const all: any[] = res.data?.data || [];
      const filtered = all.filter(r => {
        const d = new Date(r.delivery_date || r.created_at);
        return d.getMonth() === month && d.getFullYear() === year;
      });
      setRentals(filtered);
    } finally { setLoading(false); }
  }, [month, year]);

  useEffect(() => { load(); }, [load]);

  if (user?.role !== 'admin') return null;

  /* ── date-wise grouping for tracking table ── */
  const byDate: Record<string, any[]> = {};
  rentals.forEach(r => {
    const key = r.delivery_date || r.created_at?.split('T')[0] || 'unknown';
    if (!byDate[key]) byDate[key] = [];
    byDate[key].push(r);
  });
  const dates = Object.keys(byDate).sort();

  let runningCount = 0;
  const trackingRows = dates.map(date => {
    const deliveries = byDate[date].filter(r => r.status !== 'cancelled');
    const pickups    = byDate[date].filter(r => r.status === 'completed');
    runningCount += deliveries.reduce((s, r) => s + (r.quantity || 1), 0);
    runningCount -= pickups.reduce((s, r) => s + (r.quantity || 1), 0);
    return { date, deliveries, pickups, count: runningCount };
  });

  /* ── bulk grouping for detail table ── */
  const detailGroups: Array<{ bulkId: string | null; items: any[] }> = [];
  const seen = new Map<string, number>();
  for (const r of rentals) {
    const bid: string | null = r.bulk_id ?? null;
    if (bid && seen.has(bid)) {
      detailGroups[seen.get(bid)!].items.push(r);
    } else {
      seen.set(bid!, detailGroups.length);
      detailGroups.push({ bulkId: bid, items: [r] });
    }
  }

  /* ── summary totals (non-cancelled) ── */
  const active       = rentals.filter(r => r.status !== 'cancelled');
  const totalQty     = active.reduce((s, r) => s + (r.quantity || 1), 0);
  const grossTotal   = active.reduce((s, r) => s + Number(r.total || 0), 0);
  const totalGst     = active.reduce((s, r) => s + Number(r.gst_amount || 0), 0);
  const totalRevenue = active.reduce((s, r) => s + Number(r.grand_total || 0), 0);
  const bulkGroups   = [...new Set(active.filter(r => r.bulk_id).map(r => r.bulk_id))].length;

  const monthLabel = `${MONTHS[month].slice(0, 3)}-${String(year).slice(2)}`;
  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i);

  return (
    <DashboardLayout>
      <style>{`
        @media print {
          aside, .lg\\:hidden { display: none !important; }
          main { margin-left: 0 !important; }
          .glass-card { background: white !important; border: 1px solid #ccc !important; box-shadow: none !important; }
          .no-print { display: none !important; }
          body { background: white !important; color: black !important; }
          table { font-size: 11px !important; }
          th, td { padding: 5px 8px !important; }
        }
      `}</style>

      <PageHeader
        title="Monthly Report"
        subtitle={`Rental activity for ${MONTHS[month]} ${year}`}
        action={
          <button
            onClick={() => window.print()}
            className="no-print flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold"
            style={{ background: '#3B82F6', color: 'white' }}>
            <Printer size={13} />
            <span className="hidden sm:inline">Print Report</span>
            <span className="sm:hidden">Print</span>
          </button>
        }
      />

      {/* ── Filters ── */}
      <div className="no-print glass-card p-3 sm:p-4 mb-5 sm:mb-6 flex flex-wrap gap-2 sm:gap-3 items-center">
        <select className="inp flex-1 sm:flex-none sm:w-40" value={month}
          onChange={e => setMonth(Number(e.target.value))}>
          {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
        </select>
        <select className="inp w-24 sm:w-28" value={year}
          onChange={e => setYear(Number(e.target.value))}>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <span className="text-xs sm:text-sm font-semibold ml-auto" style={{ color: '#475569' }}>
          {rentals.length} rental{rentals.length !== 1 ? 's' : ''}
        </span>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <div key={i} className="skeleton h-12 rounded-xl" />)}
        </div>
      ) : rentals.length === 0 ? (
        <div className="glass-card">
          <EmptyState icon={<BarChart2 size={22} />} title="No rentals found"
            desc={`No rental activity for ${MONTHS[month]} ${year}`} />
        </div>
      ) : (
        <>
          {/* ── Summary stats ── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3 lg:gap-4 mb-5 sm:mb-6">
            {[
              { label: 'Total Laptops', value: String(totalQty),           color: '#3B82F6', sub: 'units' },
              { label: 'Bulk Groups',   value: String(bulkGroups),          color: '#A78BFA', sub: 'groups' },
              { label: 'Gross Amount',  value: `₹${fmtAmt(grossTotal)}`,   color: '#8B5CF6', sub: 'before GST' },
              { label: 'GST Amount',    value: `₹${fmtAmt(totalGst)}`,     color: '#F59E0B', sub: 'tax collected' },
              { label: 'Grand Total',   value: `₹${fmtAmt(totalRevenue)}`, color: '#10B981', sub: 'incl. GST' },
            ].map(s => (
              <div key={s.label} className="glass-card p-3 sm:p-4 text-center relative overflow-hidden">
                <div className="absolute inset-x-0 bottom-0 h-0.5 rounded-b-2xl opacity-50"
                  style={{ background: `linear-gradient(90deg,transparent,${s.color},transparent)` }} />
                <div className="text-[10px] sm:text-xs mb-1 font-medium" style={{ color: '#475569' }}>{s.label}</div>
                <div className="text-sm sm:text-base lg:text-lg font-bold leading-tight break-all"
                  style={{ color: s.color }}>{s.value}</div>
                <div className="text-[9px] sm:text-[10px] mt-0.5" style={{ color: '#334155' }}>{s.sub}</div>
              </div>
            ))}
          </div>

          {/* ── Date-wise Tracking ── */}
          <div className="glass-card overflow-hidden mb-5 sm:mb-6">
            <div className="px-4 sm:px-5 py-3 sm:py-3.5 flex items-center gap-2"
              style={{ borderBottom: '1px solid #1E3058' }}>
              <span className="text-sm font-bold" style={{ color: '#F1F5F9' }}>
                {monthLabel} — Delivery / Pickup Tracking
              </span>
            </div>

            {/* Mobile tracking cards */}
            <div className="sm:hidden divide-y" style={{ borderColor: 'rgba(30,48,88,0.4)' }}>
              {trackingRows.map(({ date, deliveries, pickups, count }) => {
                const deliveryQty = deliveries.reduce((s, r) => s + (r.quantity || 1), 0);
                const pickupQty   = pickups.reduce((s, r) => s + (r.quantity || 1), 0);
                return (
                  <div key={date} className="px-4 py-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold" style={{ color: '#F1F5F9' }}>
                        {fmtDateShort(date)}
                      </span>
                      <button
                        onClick={() => setLaptopModal({ date, rows: byDate[date] })}
                        className="no-print flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold"
                        style={{ background: 'rgba(59,130,246,0.1)', color: '#3B82F6', border: '1px solid rgba(59,130,246,0.2)' }}>
                        <Monitor size={10} /> View
                      </button>
                    </div>
                    <div className="flex items-center gap-3">
                      {deliveryQty > 0 && (
                        <div className="flex items-center gap-1">
                          <ArrowDown size={12} style={{ color: '#10B981' }} />
                          <span className="text-sm font-bold" style={{ color: '#10B981' }}>{deliveryQty}</span>
                          <span className="text-xs" style={{ color: '#475569' }}>delivered</span>
                        </div>
                      )}
                      {pickupQty > 0 && (
                        <div className="flex items-center gap-1">
                          <ArrowUp size={12} style={{ color: '#F43F5E' }} />
                          <span className="text-sm font-bold" style={{ color: '#F43F5E' }}>{pickupQty}</span>
                          <span className="text-xs" style={{ color: '#475569' }}>picked up</span>
                        </div>
                      )}
                      <div className="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-lg"
                        style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)' }}>
                        <span className="text-xs" style={{ color: '#64748B' }}>Running</span>
                        <span className="text-sm font-bold" style={{ color: '#3B82F6' }}>{count}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div className="px-4 py-3 flex items-center justify-between"
                style={{ background: 'rgba(30,48,88,0.5)' }}>
                <span className="text-xs font-bold uppercase tracking-wider" style={{ color: '#64748B' }}>Final Count</span>
                <span className="text-base font-bold" style={{ color: '#3B82F6' }}>{trackingRows.at(-1)?.count || 0}</span>
              </div>
            </div>

            {/* Desktop tracking table */}
            <div className="hidden sm:block overflow-x-auto">
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'rgba(30,48,88,0.6)' }}>
                    {['Date', 'Pick Up', 'Delivery', 'Running Count', 'Price (₹)', ''].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: '#64748B', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #1E3058' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {trackingRows.map(({ date, deliveries, pickups, count }) => {
                    const deliveryQty = deliveries.reduce((s, r) => s + (r.quantity || 1), 0);
                    const pickupQty   = pickups.reduce((s, r) => s + (r.quantity || 1), 0);
                    const price       = deliveries[0]?.monthly_rental;
                    return (
                      <tr key={date} style={{ borderBottom: '1px solid rgba(30,48,88,0.4)' }}
                        className="hover:bg-white/[0.02] transition-colors">
                        <td style={{ padding: '9px 14px', color: '#94A3B8' }}>{fmtDateShort(date)}</td>
                        <td style={{ padding: '9px 14px', color: '#F43F5E', fontWeight: pickupQty ? 700 : 400 }}>
                          {pickupQty || <span style={{ color: '#334155' }}>—</span>}
                        </td>
                        <td style={{ padding: '9px 14px', color: '#10B981', fontWeight: deliveryQty ? 700 : 400 }}>
                          {deliveryQty || <span style={{ color: '#334155' }}>—</span>}
                        </td>
                        <td style={{ padding: '9px 14px', color: '#3B82F6', fontWeight: 700 }}>{count}</td>
                        <td style={{ padding: '9px 14px', color: '#94A3B8' }}>
                          {price ? Number(price).toLocaleString('en-IN') : <span style={{ color: '#334155' }}>—</span>}
                        </td>
                        <td style={{ padding: '9px 14px' }}>
                          <button
                            onClick={() => setLaptopModal({ date, rows: byDate[date] })}
                            className="no-print flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all hover:opacity-80"
                            style={{ background: 'rgba(59,130,246,0.1)', color: '#3B82F6', border: '1px solid rgba(59,130,246,0.2)', whiteSpace: 'nowrap' }}>
                            <Monitor size={11} /> View Laptops
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  <tr style={{ background: 'rgba(30,48,88,0.5)', borderTop: '2px solid #1E3058' }}>
                    <td colSpan={3} style={{ padding: '10px 14px', fontWeight: 700, color: '#F1F5F9' }}>Final Count</td>
                    <td style={{ padding: '10px 14px', fontWeight: 700, color: '#3B82F6' }}>{trackingRows.at(-1)?.count || 0}</td>
                    <td colSpan={2} />
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Rental Detail Table ── */}
          <div className="glass-card overflow-hidden">
            <div className="px-4 sm:px-5 py-3 sm:py-3.5" style={{ borderBottom: '1px solid #1E3058' }}>
              <span className="text-sm font-bold" style={{ color: '#F1F5F9' }}>
                All Rentals — {MONTHS[month]} {year}
              </span>
            </div>

            {/* Mobile rental cards */}
            <div className="sm:hidden divide-y" style={{ borderColor: 'rgba(30,48,88,0.4)' }}>
              {detailGroups.map(({ bulkId, items }) => (
                <div key={bulkId ?? items[0].id}>
                  {bulkId && (
                    <div className="px-4 py-2 flex items-center gap-2"
                      style={{ background: 'rgba(139,92,246,0.07)', borderBottom: '1px solid rgba(139,92,246,0.15)' }}>
                      <Layers size={12} style={{ color: '#A78BFA' }} />
                      <Link href={`/rentals/bulk/${encodeURIComponent(bulkId)}`}
                        className="font-mono text-xs font-bold" style={{ color: '#A78BFA', textDecoration: 'none' }}>
                        {bulkId}
                      </Link>
                      <span className="text-xs" style={{ color: '#64748B' }}>{items.length} laptop{items.length > 1 ? 's' : ''}</span>
                      <span className="ml-auto text-xs font-bold" style={{ color: '#10B981' }}>
                        ₹{fmtAmt(items.reduce((s, r) => s + Number(r.grand_total || 0), 0))}
                      </span>
                    </div>
                  )}
                  {items.map(r => (
                    <div key={r.id} className="px-4 py-3 space-y-1.5"
                      style={bulkId ? { paddingLeft: 24, background: 'rgba(139,92,246,0.02)' } : {}}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Link href={`/rentals/${r.id}`} className="font-mono text-xs font-semibold"
                            style={{ color: '#3B82F6', textDecoration: 'none' }}>{r.rental_no}</Link>
                          {bulkId && <span className="text-[10px] px-1.5 rounded font-semibold"
                            style={{ background: 'rgba(139,92,246,0.12)', color: '#A78BFA' }}>bulk</span>}
                        </div>
                        <span className={`badge badge-${r.status} text-[10px]`}>{r.status}</span>
                      </div>
                      <div className="text-sm font-medium" style={{ color: '#F1F5F9' }}>
                        {r.inventory?.brand} {r.inventory?.model_no}
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="text-xs" style={{ color: '#64748B' }}>
                          {r.client?.name}{r.client?.company ? ` · ${r.client.company}` : ''}
                        </div>
                        <div className="text-sm font-bold" style={{ color: '#10B981' }}>₹{fmtAmt(r.grand_total)}</div>
                      </div>
                      <div className="text-xs" style={{ color: '#475569' }}>
                        Delivery: {fmtDate(r.delivery_date)} · Monthly: ₹{fmtAmt(r.monthly_rental)}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
              {/* Mobile totals */}
              <div className="px-4 py-3 space-y-1.5" style={{ background: 'rgba(16,185,129,0.07)', borderTop: '2px solid rgba(16,185,129,0.3)' }}>
                <div className="text-xs font-bold uppercase tracking-wider" style={{ color: '#64748B' }}>
                  Total — {rentals.length} rentals
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <div className="text-[10px]" style={{ color: '#475569' }}>Gross</div>
                    <div className="text-xs font-bold" style={{ color: '#F1F5F9' }}>₹{fmtAmt(grossTotal)}</div>
                  </div>
                  <div>
                    <div className="text-[10px]" style={{ color: '#475569' }}>GST</div>
                    <div className="text-xs font-bold" style={{ color: '#F59E0B' }}>₹{fmtAmt(totalGst)}</div>
                  </div>
                  <div>
                    <div className="text-[10px]" style={{ color: '#475569' }}>Grand</div>
                    <div className="text-xs font-bold" style={{ color: '#10B981' }}>₹{fmtAmt(totalRevenue)}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Desktop rental table */}
            <div className="hidden sm:block overflow-x-auto">
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'rgba(30,48,88,0.6)' }}>
                    {['Rental No', 'Laptop', 'Client', 'Qty', 'Delivery', 'Monthly', 'Total', 'GST', 'Grand Total', 'Status'].map(h => (
                      <th key={h} style={{ padding: '10px 12px', textAlign: 'left', color: '#64748B', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #1E3058', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {detailGroups.map(({ bulkId, items }) => (
                    <React.Fragment key={bulkId ?? items[0].id}>
                      {bulkId && (
                        <tr style={{ background: 'rgba(139,92,246,0.08)', borderTop: '1px solid rgba(139,92,246,0.2)' }}>
                          <td colSpan={2} style={{ padding: '8px 12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <Layers size={13} color="#A78BFA" />
                              <Link href={`/rentals/bulk/${encodeURIComponent(bulkId)}`}
                                style={{ color: '#A78BFA', fontFamily: 'monospace', fontSize: 12, fontWeight: 700, textDecoration: 'none' }}>
                                {bulkId}
                              </Link>
                              <span style={{ color: '#64748B', fontSize: 11 }}>{items.length} laptop{items.length > 1 ? 's' : ''}</span>
                            </div>
                          </td>
                          <td style={{ padding: '8px 12px' }}>
                            <div style={{ color: '#F1F5F9', fontSize: 12, fontWeight: 600 }}>{items[0]?.client?.name || '—'}</div>
                            {items[0]?.client?.company && <div style={{ color: '#475569', fontSize: 11 }}>{items[0].client.company}</div>}
                          </td>
                          <td style={{ padding: '8px 12px' }} />
                          <td style={{ padding: '8px 12px', color: '#94A3B8', fontSize: 12 }}>{fmtDate(items[0]?.delivery_date)}</td>
                          <td style={{ padding: '8px 12px' }} />
                          <td style={{ padding: '8px 12px', color: '#F1F5F9', fontWeight: 700, textAlign: 'right' }}>
                            ₹{fmtAmt(items.reduce((s, r) => s + Number(r.total || 0), 0))}
                          </td>
                          <td style={{ padding: '8px 12px', color: '#F59E0B', fontWeight: 700, textAlign: 'right' }}>
                            ₹{fmtAmt(items.reduce((s, r) => s + Number(r.gst_amount || 0), 0))}
                          </td>
                          <td style={{ padding: '8px 12px', color: '#10B981', fontWeight: 700, textAlign: 'right' }}>
                            ₹{fmtAmt(items.reduce((s, r) => s + Number(r.grand_total || 0), 0))}
                          </td>
                          <td style={{ padding: '8px 12px' }}>
                            {[...new Set(items.map(r => r.status))].map(s => (
                              <span key={s} className={`badge badge-${s}`} style={{ marginRight: 4 }}>{s}</span>
                            ))}
                          </td>
                        </tr>
                      )}
                      {items.map(r => (
                        <tr key={r.id} style={{ borderBottom: '1px solid rgba(30,48,88,0.4)', background: bulkId ? 'rgba(139,92,246,0.02)' : 'transparent' }}>
                          <td style={{ padding: '9px 12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              {bulkId && <span style={{ width: 10, borderLeft: '2px solid rgba(139,92,246,0.3)', display: 'inline-block', height: 14 }} />}
                              <Link href={`/rentals/${r.id}`} style={{ color: '#3B82F6', fontFamily: 'monospace', fontSize: 12, textDecoration: 'none' }}>
                                {r.rental_no}
                              </Link>
                              {bulkId && <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 4, background: 'rgba(139,92,246,0.12)', color: '#A78BFA', fontWeight: 700 }}>bulk</span>}
                            </div>
                          </td>
                          <td style={{ padding: '9px 12px' }}>
                            <div style={{ color: '#F1F5F9', fontWeight: 600, fontSize: 12 }}>{r.inventory?.brand} {r.inventory?.model_no}</div>
                            <div style={{ color: '#475569', fontSize: 11 }}>{r.inventory?.asset_code}</div>
                          </td>
                          <td style={{ padding: '9px 12px' }}>
                            <div style={{ color: '#F1F5F9', fontSize: 12 }}>{r.client?.name || '—'}</div>
                            {r.client?.company && <div style={{ color: '#475569', fontSize: 11 }}>{r.client.company}</div>}
                          </td>
                          <td style={{ padding: '9px 12px', color: '#94A3B8', textAlign: 'center' }}>{r.quantity || 1}</td>
                          <td style={{ padding: '9px 12px', color: '#94A3B8', whiteSpace: 'nowrap' }}>{fmtDate(r.delivery_date)}</td>
                          <td style={{ padding: '9px 12px', color: '#94A3B8', textAlign: 'right' }}>₹{fmtAmt(r.monthly_rental)}</td>
                          <td style={{ padding: '9px 12px', color: '#94A3B8', textAlign: 'right' }}>₹{fmtAmt(r.total)}</td>
                          <td style={{ padding: '9px 12px', color: '#94A3B8', textAlign: 'right' }}>₹{fmtAmt(r.gst_amount)}</td>
                          <td style={{ padding: '9px 12px', color: '#10B981', fontWeight: 700, textAlign: 'right' }}>₹{fmtAmt(r.grand_total)}</td>
                          <td style={{ padding: '9px 12px' }}>
                            <span className={`badge badge-${r.status}`}>{r.status}</span>
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                  <tr style={{ background: 'rgba(16,185,129,0.07)', borderTop: '2px solid rgba(16,185,129,0.3)' }}>
                    <td colSpan={6} style={{ padding: '10px 12px', fontWeight: 700, color: '#F1F5F9' }}>
                      Total — {rentals.length} rental{rentals.length !== 1 ? 's' : ''}{bulkGroups > 0 ? ` (${bulkGroups} bulk group${bulkGroups > 1 ? 's' : ''})` : ''}
                    </td>
                    <td style={{ padding: '10px 12px', color: '#F1F5F9', fontWeight: 700, textAlign: 'right' }}>₹{fmtAmt(grossTotal)}</td>
                    <td style={{ padding: '10px 12px', color: '#F59E0B', fontWeight: 700, textAlign: 'right' }}>₹{fmtAmt(totalGst)}</td>
                    <td style={{ padding: '10px 12px', color: '#10B981', fontWeight: 700, textAlign: 'right' }}>₹{fmtAmt(totalRevenue)}</td>
                    <td />
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ── View Laptops Modal ── */}
      {laptopModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
          onClick={() => setLaptopModal(null)}>
          <div
            className="relative w-full sm:max-w-2xl rounded-t-2xl sm:rounded-2xl flex flex-col overflow-hidden"
            style={{
              background: '#111827',
              border: '1px solid #1E3058',
              maxHeight: '90vh',
              boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
            }}
            onClick={e => e.stopPropagation()}>

            {/* Modal header */}
            <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 sm:py-4 flex-shrink-0"
              style={{ borderBottom: '1px solid #1E3058' }}>
              <div>
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                    style={{ background: 'rgba(59,130,246,0.12)' }}>
                    <Monitor size={14} style={{ color: '#3B82F6' }} />
                  </div>
                  <span className="text-sm font-bold" style={{ fontFamily: 'Syne, sans-serif', color: '#F1F5F9' }}>
                    {fmtDateShort(laptopModal.date)}
                  </span>
                </div>
                <div className="text-xs mt-0.5 ml-9" style={{ color: '#475569' }}>
                  {laptopModal.rows.length} rental{laptopModal.rows.length !== 1 ? 's' : ''} on this date
                </div>
              </div>
              <button onClick={() => setLaptopModal(null)}
                className="p-1.5 rounded-xl transition-colors hover:bg-white/10"
                style={{ color: '#475569' }}>
                <X size={16} />
              </button>
            </div>

            {/* Modal body — card list on mobile, table on desktop */}
            <div className="overflow-y-auto flex-1">

              {/* Mobile: card list */}
              <div className="sm:hidden divide-y" style={{ borderColor: 'rgba(30,48,88,0.4)' }}>
                {laptopModal.rows.map(r => (
                  <div key={r.id} className="p-4 space-y-3">
                    {/* Row 1: Rental no + status */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Link href={`/rentals/${r.id}`} onClick={() => setLaptopModal(null)}
                          className="font-mono text-xs font-bold" style={{ color: '#3B82F6', textDecoration: 'none' }}>
                          {r.rental_no}
                        </Link>
                        {r.bulk_id && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded font-bold"
                            style={{ background: 'rgba(139,92,246,0.12)', color: '#A78BFA' }}>bulk</span>
                        )}
                      </div>
                      <span className={`badge badge-${r.status}`}>{r.status}</span>
                    </div>

                    {/* Row 2: Laptop */}
                    <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                      style={{ background: 'rgba(30,48,88,0.4)', border: '1px solid rgba(30,48,88,0.7)' }}>
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: 'rgba(59,130,246,0.1)' }}>
                        <Monitor size={14} style={{ color: '#3B82F6' }} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold truncate" style={{ color: '#F1F5F9' }}>
                          {r.inventory?.brand} {r.inventory?.model_no}
                        </div>
                        <div className="text-xs font-mono" style={{ color: '#475569' }}>
                          {r.inventory?.asset_code || '—'}
                        </div>
                      </div>
                      {r.monthly_rental && (
                        <div className="ml-auto text-right flex-shrink-0">
                          <div className="text-xs" style={{ color: '#64748B' }}>Monthly</div>
                          <div className="text-sm font-bold" style={{ color: '#10B981' }}>
                            ₹{Number(r.monthly_rental).toLocaleString('en-IN')}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Row 3: Client info */}
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ background: 'rgba(20,184,166,0.1)' }}>
                          <span className="text-xs font-bold" style={{ color: '#14B8A6' }}>
                            {r.client?.name?.charAt(0)?.toUpperCase() || '?'}
                          </span>
                        </div>
                        <span className="text-sm font-medium" style={{ color: '#F1F5F9' }}>{r.client?.name || '—'}</span>
                        {r.client?.company && (
                          <span className="text-xs truncate" style={{ color: '#475569' }}>· {r.client.company}</span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 pl-8">
                        {r.client?.phone && (
                          <div className="flex items-center gap-1">
                            <Phone size={10} style={{ color: '#475569' }} />
                            <span className="text-xs" style={{ color: '#64748B' }}>{r.client.phone}</span>
                          </div>
                        )}
                        {r.client?.email && (
                          <div className="flex items-center gap-1 min-w-0">
                            <Mail size={10} style={{ color: '#475569', flexShrink: 0 }} />
                            <span className="text-xs truncate" style={{ color: '#64748B' }}>{r.client.email}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop: condensed table (5 cols, not 9) */}
              <div className="hidden sm:block">
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                    <tr style={{ background: '#0D1B2E' }}>
                      {['Rental', 'Laptop', 'Client', 'Monthly (₹)', 'Status'].map(h => (
                        <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: '#64748B', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #1E3058', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {laptopModal.rows.map(r => (
                      <tr key={r.id} style={{ borderBottom: '1px solid rgba(30,48,88,0.4)' }}
                        className="hover:bg-white/[0.02] transition-colors">
                        <td style={{ padding: '10px 14px' }}>
                          <Link href={`/rentals/${r.id}`} onClick={() => setLaptopModal(null)}
                            style={{ color: '#3B82F6', fontFamily: 'monospace', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>
                            {r.rental_no}
                          </Link>
                          {r.bulk_id && (
                            <div style={{ fontSize: 10, marginTop: 2, color: '#A78BFA', fontFamily: 'monospace' }}>{r.bulk_id}</div>
                          )}
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <div style={{ color: '#F1F5F9', fontWeight: 600 }}>{r.inventory?.brand} {r.inventory?.model_no}</div>
                          <div style={{ color: '#475569', fontSize: 11, fontFamily: 'monospace' }}>{r.inventory?.asset_code || '—'}</div>
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <div style={{ color: '#F1F5F9', fontWeight: 500 }}>{r.client?.name || '—'}</div>
                          {r.client?.company && (
                            <div style={{ color: '#475569', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
                              <Building2 size={10} /> {r.client.company}
                            </div>
                          )}
                          {r.client?.phone && (
                            <div style={{ color: '#475569', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
                              <Phone size={10} /> {r.client.phone}
                            </div>
                          )}
                          {r.client?.email && (
                            <div style={{ color: '#475569', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
                              <Mail size={10} /> {r.client.email}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '10px 14px', color: '#10B981', fontWeight: 700, textAlign: 'right' }}>
                          {r.monthly_rental ? Number(r.monthly_rental).toLocaleString('en-IN') : '—'}
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <span className={`badge badge-${r.status}`}>{r.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
