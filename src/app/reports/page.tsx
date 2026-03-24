'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { PageHeader, EmptyState } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { BarChart2, Printer, Layers, Monitor, X, Building2, Phone, Mail } from 'lucide-react';

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

const fmtAmt = (n: any) =>
  Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtDate = (d?: string) =>
  d ? new Date(d).toLocaleDateString('en-IN') : '—';

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
            className="no-print flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
            style={{ background: '#3B82F6', color: 'white' }}>
            <Printer size={14} /> Print Report
          </button>
        }
      />

      {/* Filters */}
      <div className="no-print glass-card p-4 mb-6 flex flex-wrap gap-3 items-center">
        <select className="inp w-40" value={month} onChange={e => setMonth(Number(e.target.value))}>
          {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
        </select>
        <select className="inp w-28" value={year} onChange={e => setYear(Number(e.target.value))}>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <span className="text-sm font-semibold" style={{ color: '#475569' }}>
          {rentals.length} rental{rentals.length !== 1 ? 's' : ''} found
        </span>
      </div>

      {loading ? (
        <div className="space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="skeleton h-12 rounded-xl" />)}</div>
      ) : rentals.length === 0 ? (
        <div className="glass-card">
          <EmptyState icon={<BarChart2 size={22} />} title="No rentals found" desc={`No rental activity for ${MONTHS[month]} ${year}`} />
        </div>
      ) : (
        <>
          {/* Summary stats */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-6">
            {[
              { label: 'Total Laptops',  value: String(totalQty),           color: '#3B82F6' },
              { label: 'Bulk Groups',    value: String(bulkGroups),          color: '#A78BFA' },
              { label: 'Gross Amount',   value: `₹${fmtAmt(grossTotal)}`,   color: '#8B5CF6' },
              { label: 'GST Amount',     value: `₹${fmtAmt(totalGst)}`,     color: '#F59E0B' },
              { label: 'Grand Total',    value: `₹${fmtAmt(totalRevenue)}`, color: '#10B981' },
            ].map(s => (
              <div key={s.label} className="glass-card p-4 text-center">
                <div className="text-xs mb-1" style={{ color: '#475569' }}>{s.label}</div>
                <div className="text-lg font-bold" style={{ color: s.color }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Date-wise tracking table */}
          <div className="glass-card overflow-hidden mb-6">
            <div className="px-5 py-3 flex items-center gap-2" style={{ borderBottom: '1px solid #1E3058' }}>
              <span className="text-sm font-bold" style={{ color: '#F1F5F9' }}>{monthLabel} — Delivery / Pickup Tracking</span>
            </div>
            <div className="overflow-x-auto">
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'rgba(30,48,88,0.6)' }}>
                    {['Date', 'Pick Up', 'Delivery', 'Count', 'Price (₹)', ''].map(h => (
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
                      <tr key={date} style={{ borderBottom: '1px solid rgba(30,48,88,0.4)' }}>
                        <td style={{ padding: '9px 14px', color: '#94A3B8' }}>
                          {new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                        </td>
                        <td style={{ padding: '9px 14px', color: '#F43F5E', fontWeight: pickupQty ? 700 : 400 }}>
                          {pickupQty || ''}
                        </td>
                        <td style={{ padding: '9px 14px', color: '#10B981', fontWeight: deliveryQty ? 700 : 400 }}>
                          {deliveryQty || ''}
                        </td>
                        <td style={{ padding: '9px 14px', color: '#F1F5F9', fontWeight: 700 }}>{count}</td>
                        <td style={{ padding: '9px 14px', color: '#94A3B8' }}>
                          {price ? Number(price).toLocaleString('en-IN') : ''}
                        </td>
                        <td style={{ padding: '9px 14px' }}>
                          <button
                            onClick={() => setLaptopModal({ date, rows: byDate[date] })}
                            className="no-print flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all hover:opacity-80"
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
                    <td />
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Rental detail table with bulk grouping */}
          <div className="glass-card overflow-hidden">
            <div className="px-5 py-3" style={{ borderBottom: '1px solid #1E3058' }}>
              <span className="text-sm font-bold" style={{ color: '#F1F5F9' }}>All Rentals — {MONTHS[month]} {year}</span>
            </div>
            <div className="overflow-x-auto">
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'rgba(30,48,88,0.6)' }}>
                    {['Rental No', 'Laptop', 'Client', 'Qty', 'Delivery Date', 'Monthly', 'Total', 'GST', 'Grand Total', 'Status'].map(h => (
                      <th key={h} style={{ padding: '10px 12px', textAlign: 'left', color: '#64748B', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #1E3058', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {detailGroups.map(({ bulkId, items }) => (
                    <React.Fragment key={bulkId ?? items[0].id}>
                      {/* Bulk group header */}
                      {bulkId && (
                        <tr key={`bulk-header-${bulkId}`} style={{ background: 'rgba(139,92,246,0.08)', borderTop: '1px solid rgba(139,92,246,0.2)' }}>
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
                          <td colSpan={1} style={{ padding: '8px 12px' }} />
                          <td style={{ padding: '8px 12px', color: '#94A3B8', fontSize: 12 }}>
                            {fmtDate(items[0]?.delivery_date)}
                          </td>
                          <td style={{ padding: '8px 12px', color: '#64748B', fontSize: 11 }} />
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
                      {/* Individual rows */}
                      {items.map(r => (
                        <tr key={r.id} style={{
                          borderBottom: '1px solid rgba(30,48,88,0.4)',
                          background: bulkId ? 'rgba(139,92,246,0.02)' : 'transparent',
                        }}>
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
                  {/* Totals row */}
                  <tr style={{ background: 'rgba(16,185,129,0.07)', borderTop: '2px solid rgba(16,185,129,0.3)' }}>
                    <td colSpan={6} style={{ padding: '10px 12px', fontWeight: 700, color: '#F1F5F9' }}>
                      Total — {rentals.length} rentals{bulkGroups > 0 ? ` (${bulkGroups} bulk group${bulkGroups > 1 ? 's' : ''})` : ''}
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
      {/* Laptop detail modal */}
      {laptopModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.6)' }}
          onClick={() => setLaptopModal(null)}>
          <div className="glass-card w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden"
            style={{ border: '1px solid #1E3058' }}
            onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4"
              style={{ borderBottom: '1px solid #1E3058' }}>
              <div>
                <div className="text-sm font-bold" style={{ color: '#F1F5F9' }}>
                  Laptops — {new Date(laptopModal.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                </div>
                <div className="text-xs mt-0.5" style={{ color: '#475569' }}>
                  {laptopModal.rows.length} rental{laptopModal.rows.length !== 1 ? 's' : ''} on this date
                </div>
              </div>
              <button onClick={() => setLaptopModal(null)}
                className="p-1.5 rounded-xl transition-colors hover:bg-white/10"
                style={{ color: '#475569' }}>
                <X size={16} />
              </button>
            </div>

            {/* Table */}
            <div className="overflow-y-auto">
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                  <tr style={{ background: '#0D1B2E' }}>
                    {['Rental No', 'Laptop', 'Asset Code', 'Client', 'Company', 'Phone', 'Email', 'Monthly (₹)', 'Status'].map(h => (
                      <th key={h} style={{ padding: '10px 12px', textAlign: 'left', color: '#64748B', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #1E3058', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {laptopModal.rows.map(r => (
                    <tr key={r.id} style={{ borderBottom: '1px solid rgba(30,48,88,0.4)' }}>
                      <td style={{ padding: '9px 12px' }}>
                        <Link href={`/rentals/${r.id}`} onClick={() => setLaptopModal(null)}
                          style={{ color: '#3B82F6', fontFamily: 'monospace', fontSize: 12, textDecoration: 'none' }}>
                          {r.rental_no}
                        </Link>
                        {r.bulk_id && (
                          <div style={{ fontSize: 10, marginTop: 2, color: '#A78BFA', fontFamily: 'monospace' }}>{r.bulk_id}</div>
                        )}
                      </td>
                      <td style={{ padding: '9px 12px' }}>
                        <div style={{ color: '#F1F5F9', fontWeight: 600 }}>{r.inventory?.brand} {r.inventory?.model_no}</div>
                        {r.inventory?.processor && <div style={{ color: '#475569', fontSize: 11 }}>{r.inventory.processor}</div>}
                      </td>
                      <td style={{ padding: '9px 12px', color: '#64748B', fontFamily: 'monospace', fontSize: 12 }}>
                        {r.inventory?.asset_code || '—'}
                      </td>
                      <td style={{ padding: '9px 12px' }}>
                        <div style={{ color: '#F1F5F9' }}>{r.client?.name || '—'}</div>
                      </td>
                      <td style={{ padding: '9px 12px' }}>
                        {r.client?.company
                          ? <div className="flex items-center gap-1"><Building2 size={11} style={{ color: '#475569' }} /><span style={{ color: '#94A3B8' }}>{r.client.company}</span></div>
                          : <span style={{ color: '#334155' }}>—</span>}
                      </td>
                      <td style={{ padding: '9px 12px' }}>
                        {r.client?.phone
                          ? <div className="flex items-center gap-1"><Phone size={11} style={{ color: '#475569' }} /><span style={{ color: '#94A3B8' }}>{r.client.phone}</span></div>
                          : <span style={{ color: '#334155' }}>—</span>}
                      </td>
                      <td style={{ padding: '9px 12px' }}>
                        {r.client?.email
                          ? <div className="flex items-center gap-1"><Mail size={11} style={{ color: '#475569' }} /><span style={{ color: '#94A3B8' }}>{r.client.email}</span></div>
                          : <span style={{ color: '#334155' }}>—</span>}
                      </td>
                      <td style={{ padding: '9px 12px', color: '#94A3B8', textAlign: 'right' }}>
                        {r.monthly_rental ? Number(r.monthly_rental).toLocaleString('en-IN') : '—'}
                      </td>
                      <td style={{ padding: '9px 12px' }}>
                        <span className={`badge badge-${r.status}`}>{r.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
