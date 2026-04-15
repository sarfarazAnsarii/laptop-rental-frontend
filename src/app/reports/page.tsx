'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import {
  BarChart2, FileSpreadsheet, FileText,
  Layers, TrendingUp, TrendingDown, RefreshCw,
  Monitor, Users, IndianRupee,
  Calendar, ChevronLeft, ChevronRight, Activity,
} from 'lucide-react';

/* ──────────────── constants & helpers ─────────────────────── */
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const fmtAmt   = (n: any) => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtAmtSh = (n: any) => '₹' + fmtAmt(n);
const fmtDate  = (d?: string) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

function firstOfMonth(y: number, m: number) { return new Date(y, m, 1); }
function lastOfMonth (y: number, m: number) { return new Date(y, m + 1, 0); }

function classify(r: any, y: number, m: number) {
  const first = firstOfMonth(y, m);
  const last  = lastOfMonth(y, m);
  const start   = r.start_date    ? new Date(r.start_date)    : null;
  const endDate = r.end_date      ? new Date(r.end_date)      : null;
  const deliv   = r.delivery_date ? new Date(r.delivery_date) : start;
  const wasActive           = start && start <= last && (endDate === null || endDate >= first);
  const isNewThisMonth      = deliv && deliv >= first && deliv <= last;
  const isReturnedThisMonth = endDate && endDate >= first && endDate <= last;
  const isContinuing        = wasActive && !isNewThisMonth;
  return { wasActive, isNewThisMonth, isReturnedThisMonth, isContinuing };
}

/* ──────────────── main component ─────────────────────────── */
export default function ReportsPage() {
  const { user } = useAuth();
  const router   = useRouter();

  const now  = new Date();
  const [month, setMonth] = useState(now.getMonth());
  const [year,  setYear]  = useState(now.getFullYear());
  const [allRentals, setAllRentals] = useState<any[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [tab, setTab] = useState<'overview' | 'new' | 'renewals' | 'returns' | 'all'>('overview');

  const tableRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (user && user.role !== 'admin') router.push('/dashboard'); }, [user, router]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.rentals.list({ per_page: '1000', status: '' });
      setAllRentals(res.data?.data || []);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (user?.role !== 'admin') return null;

  /* ── derive sets ── */
  const newRentals: any[]       = [];
  const returningRentals: any[] = [];
  const renewingRentals: any[]  = [];
  const activeThisMonth: any[]  = [];

  allRentals.forEach(r => {
    const { wasActive, isNewThisMonth, isReturnedThisMonth, isContinuing } = classify(r, year, month);
    if (!wasActive && !isReturnedThisMonth) return;
    if (wasActive)           activeThisMonth.push(r);
    if (isNewThisMonth)      newRentals.push(r);
    if (isContinuing)        renewingRentals.push(r);
    if (isReturnedThisMonth) returningRentals.push(r);
  });

  /* ── revenue ── */
  const newRevenue     = newRentals.reduce((s, r)       => s + Number(r.grand_total || 0), 0);
  const renewalRevenue = renewingRentals.reduce((s, r)  => s + Number(r.grand_total || 0), 0);
  const returnRevenue  = returningRentals.reduce((s, r) => s + Number(r.adjusted_total ?? r.grand_total ?? 0), 0);
  const totalGst       = activeThisMonth.reduce((s, r)  => s + Number(r.gst_amount || 0), 0);

  const clientIds = new Set(activeThisMonth.map(r => r.client_id).filter(Boolean));

  /* ── bulk grouping ── */
  function groupByBulk(list: any[]) {
    const groups: Array<{ bulkId: string | null; items: any[] }> = [];
    const seen = new Map<string, number>();
    for (const r of list) {
      const bid: string | null = r.bulk_id ?? null;
      if (bid && seen.has(bid)) { groups[seen.get(bid)!].items.push(r); }
      else { seen.set(bid ?? `_${r.id}`, groups.length); groups.push({ bulkId: bid, items: [r] }); }
    }
    return groups;
  }

  const monthLabel = `${MONTHS[month]} ${year}`;
  const years = Array.from({ length: 6 }, (_, i) => now.getFullYear() - 3 + i);

  /* ──────────────── Download helpers ──────────────── */
  function buildExcelData(list: any[]) {
    return list.map(r => ({
      'Rental No':      r.rental_no,
      'Bulk ID':        r.bulk_id || '',
      'Client':         r.client?.name || '',
      'Company':        r.client?.company || '',
      'Laptop':         `${r.inventory?.brand || ''} ${r.inventory?.model_no || ''}`.trim(),
      'Asset Code':     r.inventory?.asset_code || '',
      'Serial No':      r.inventory?.serial_number || '',
      'Delivery Date':  r.delivery_date ? fmtDate(r.delivery_date) : fmtDate(r.start_date),
      'Start Date':     fmtDate(r.start_date),
      'End Date':       r.end_date ? fmtDate(r.end_date) : '',
      'Monthly Rental': Number(r.monthly_rental || 0),
      'Qty':            r.quantity || 1,
      'GST %':          r.gst_percent || 18,
      'GST Amount':     Number(r.gst_amount || 0),
      'Grand Total':    Number(r.grand_total || 0),
      'Adjusted Total': r.adjusted_total ? Number(r.adjusted_total) : '',
      'Status':         r.status,
    }));
  }

  async function downloadExcel() {
    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();
    const summaryData = [
      ['Report Month', monthLabel],
      ['Generated On', new Date().toLocaleString('en-IN')],
      [''],
      ['Metric', 'Value'],
      ['Active Laptops This Month', activeThisMonth.length],
      ['New Rentals (Deliveries)', newRentals.length],
      ['Auto-Renewed (Continuing)', renewingRentals.length],
      ['Returns / Cancellations', returningRentals.length],
      ['Unique Clients', clientIds.size],
      ['New Rental Revenue (₹)', newRevenue.toFixed(2)],
      ['Renewal Revenue (₹)', renewalRevenue.toFixed(2)],
      ['Return Revenue (₹)', returnRevenue.toFixed(2)],
      ['Total GST (₹)', totalGst.toFixed(2)],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryData), 'Summary');
    if (newRentals.length)       XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(buildExcelData(newRentals)),       'New Rentals');
    if (renewingRentals.length)  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(buildExcelData(renewingRentals)),  'Auto-Renewals');
    if (returningRentals.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(buildExcelData(returningRentals)), 'Returns');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(buildExcelData(activeThisMonth)), 'All Active');
    XLSX.writeFile(wb, `LaptopRent_Report_${MONTHS[month]}_${year}.xlsx`);
  }

  async function downloadPDF() {
    const { default: jsPDF }    = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');
    const doc  = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();

    doc.setFontSize(16); doc.setFont('helvetica', 'bold');
    doc.text('LaptopRent — Monthly Report', 14, 16);
    doc.setFontSize(10); doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);
    doc.text(`${monthLabel}  ·  Generated: ${new Date().toLocaleString('en-IN')}`, 14, 22);
    doc.setTextColor(0);

    const boxes = [
      { label: 'Active This Month', value: String(activeThisMonth.length) },
      { label: 'New Deliveries',    value: String(newRentals.length) },
      { label: 'Auto-Renewals',     value: String(renewingRentals.length) },
      { label: 'Returns',           value: String(returningRentals.length) },
      { label: 'Clients',           value: String(clientIds.size) },
      { label: 'New Revenue',       value: '₹' + fmtAmt(newRevenue) },
      { label: 'Renewal Revenue',   value: '₹' + fmtAmt(renewalRevenue) },
      { label: 'Total GST',         value: '₹' + fmtAmt(totalGst) },
    ];
    const bw = (pageW - 28) / 4;
    const bh = 12;
    boxes.forEach((b, i) => {
      const col = i % 4; const row = Math.floor(i / 4);
      const x = 14 + col * (bw + 2); const y = 28 + row * (bh + 2);
      doc.setFillColor(240, 247, 255); doc.roundedRect(x, y, bw, bh, 1.5, 1.5, 'F');
      doc.setFontSize(7); doc.setTextColor(100); doc.text(b.label, x + 2, y + 4);
      doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(20);
      doc.text(b.value, x + 2, y + 9.5); doc.setFont('helvetica', 'normal');
    });

    const cols = ['Rental No', 'Laptop', 'Client', 'Delivery', 'Monthly', 'Grand Total', 'Status'];
    function makeRows(list: any[]) {
      return list.map(r => [
        r.rental_no,
        `${r.inventory?.brand || ''} ${r.inventory?.model_no || ''}`.trim() + (r.inventory?.asset_code ? `\n${r.inventory.asset_code}` : ''),
        (r.client?.name || '') + (r.client?.company ? `\n${r.client.company}` : ''),
        fmtDate(r.delivery_date || r.start_date),
        '₹' + fmtAmt(r.monthly_rental),
        '₹' + fmtAmt(r.grand_total),
        r.status,
      ]);
    }

    let startY = 58;
    const sections = [
      { title: 'New Rentals (Delivered This Month)',           data: newRentals,       color: [16,  185, 129] as [number,number,number] },
      { title: 'Auto-Renewals (Continuing from Previous Months)', data: renewingRentals, color: [59,  130, 246] as [number,number,number] },
      { title: 'Returns & Cancellations',                      data: returningRentals, color: [244,  63,  94] as [number,number,number] },
    ];
    sections.forEach(({ title, data, color }) => {
      if (data.length === 0) return;
      doc.setFontSize(10); doc.setFont('helvetica', 'bold');
      doc.setTextColor(...color); doc.text(`${title} (${data.length})`, 14, startY);
      doc.setTextColor(0); doc.setFont('helvetica', 'normal');
      autoTable(doc, {
        startY: startY + 3,
        head: [cols],
        body: makeRows(data),
        styles: { fontSize: 7, cellPadding: 2 },
        headStyles: { fillColor: color, textColor: 255, fontStyle: 'bold', fontSize: 7 },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: { 0: { cellWidth: 24 }, 1: { cellWidth: 40 }, 2: { cellWidth: 36 } },
        margin: { left: 14, right: 14 },
        didDrawPage: () => { startY = 20; },
      });
      startY = (doc as any).lastAutoTable.finalY + 8;
    });
    doc.save(`LaptopRent_Report_${MONTHS[month]}_${year}.pdf`);
  }

  /* ──────────────── RentalTable — table on md+, cards on mobile ──────────────── */
  function RentalTable({ list, emptyMsg }: { list: any[]; emptyMsg: string }) {
    const groups = groupByBulk(list);
    if (list.length === 0) return (
      <div className="px-6 py-10 text-center text-sm" style={{ color: '#475569' }}>{emptyMsg}</div>
    );

    const totalGrandTotal = list.reduce((s, r) => s + Number(r.grand_total || 0), 0);
    const totalGstSum     = list.reduce((s, r) => s + Number(r.gst_amount   || 0), 0);

    return (
      <>
        {/* ── Desktop table (md+) ── */}
        <div className="hidden md:block overflow-x-auto">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'rgba(30,48,88,0.6)' }}>
                {['Rental No','Laptop','Client','Delivery Date','Start → End','Monthly','Grand Total','Status'].map(h => (
                  <th key={h} style={{ padding: '9px 12px', textAlign: 'left', color: '#64748B', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid #1E3058', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {groups.map(({ bulkId, items }) => (
                <React.Fragment key={bulkId ?? items[0].id}>
                  {bulkId && (
                    <tr style={{ background: 'rgba(139,92,246,0.08)', borderTop: '1px solid rgba(139,92,246,0.2)' }}>
                      <td colSpan={8} style={{ padding: '6px 12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Layers size={12} color="#A78BFA" />
                          <Link href={`/rentals/bulk/${encodeURIComponent(bulkId)}`}
                            style={{ color: '#A78BFA', fontFamily: 'monospace', fontSize: 12, fontWeight: 700, textDecoration: 'none' }}>
                            {bulkId}
                          </Link>
                          <span style={{ color: '#64748B', fontSize: 11 }}>{items.length} laptops</span>
                          <span style={{ marginLeft: 'auto', color: '#10B981', fontWeight: 700, fontSize: 12 }}>
                            {fmtAmtSh(items.reduce((s, r) => s + Number(r.grand_total || 0), 0))}
                          </span>
                        </div>
                      </td>
                    </tr>
                  )}
                  {items.map(r => (
                    <tr key={r.id} style={{ borderBottom: '1px solid rgba(30,48,88,0.35)' }}
                      className="hover:bg-white/[0.02] transition-colors">
                      <td style={{ padding: '8px 12px' }}>
                        <Link href={`/rentals/${r.id}`} style={{ color: '#3B82F6', fontFamily: 'monospace', fontSize: 12, fontWeight: 700, textDecoration: 'none' }}>
                          {r.rental_no}
                        </Link>
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        <div style={{ color: '#F1F5F9', fontSize: 13, fontWeight: 500 }}>{r.inventory?.brand} {r.inventory?.model_no}</div>
                        <div style={{ color: '#475569', fontSize: 11, fontFamily: 'monospace' }}>{r.inventory?.asset_code}</div>
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        <div style={{ color: '#F1F5F9', fontSize: 13 }}>{r.client?.name || '—'}</div>
                        {r.client?.company && <div style={{ color: '#475569', fontSize: 11 }}>{r.client.company}</div>}
                      </td>
                      <td style={{ padding: '8px 12px', color: '#94A3B8', fontSize: 12, whiteSpace: 'nowrap' }}>{fmtDate(r.delivery_date || r.start_date)}</td>
                      <td style={{ padding: '8px 12px', fontSize: 12, whiteSpace: 'nowrap' }}>
                        <div style={{ color: '#94A3B8' }}>{fmtDate(r.start_date)}</div>
                        {r.end_date
                          ? <div style={{ color: '#F43F5E', fontSize: 11 }}>→ {fmtDate(r.end_date)}</div>
                          : <div style={{ color: '#10B981', fontSize: 11 }}>→ ongoing</div>}
                      </td>
                      <td style={{ padding: '8px 12px', color: '#F1F5F9', fontSize: 13, whiteSpace: 'nowrap' }}>{fmtAmtSh(r.monthly_rental)}</td>
                      <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                        <div style={{ color: '#10B981', fontWeight: 700, fontSize: 13 }}>{fmtAmtSh(r.grand_total)}</div>
                        <div style={{ color: '#475569', fontSize: 11 }}>GST: {fmtAmtSh(r.gst_amount)}</div>
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        <span className={`badge badge-${r.status}`}>{r.status}</span>
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: 'rgba(16,185,129,0.06)', borderTop: '2px solid rgba(16,185,129,0.2)' }}>
                <td colSpan={5} style={{ padding: '9px 12px', fontWeight: 700, color: '#475569', fontSize: 12 }}>
                  Total — {list.length} rental{list.length !== 1 ? 's' : ''}
                </td>
                <td style={{ padding: '9px 12px' }} />
                <td style={{ padding: '9px 12px', whiteSpace: 'nowrap' }}>
                  <div style={{ color: '#10B981', fontWeight: 700 }}>{fmtAmtSh(totalGrandTotal)}</div>
                  <div style={{ color: '#475569', fontSize: 11 }}>GST: {fmtAmtSh(totalGstSum)}</div>
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>

        {/* ── Mobile cards (< md) ── */}
        <div className="md:hidden divide-y" style={{ borderColor: 'rgba(30,48,88,0.35)' }}>
          {groups.map(({ bulkId, items }) => (
            <React.Fragment key={bulkId ?? items[0].id}>
              {bulkId && (
                <div className="px-4 py-2.5 flex items-center gap-2"
                  style={{ background: 'rgba(139,92,246,0.08)', borderTop: '1px solid rgba(139,92,246,0.2)' }}>
                  <Layers size={11} color="#A78BFA" />
                  <Link href={`/rentals/bulk/${encodeURIComponent(bulkId)}`}
                    className="font-mono text-xs font-bold" style={{ color: '#A78BFA', textDecoration: 'none' }}>
                    {bulkId}
                  </Link>
                  <span className="text-[10px]" style={{ color: '#64748B' }}>{items.length} laptops</span>
                  <span className="ml-auto text-xs font-bold" style={{ color: '#10B981' }}>
                    {fmtAmtSh(items.reduce((s, r) => s + Number(r.grand_total || 0), 0))}
                  </span>
                </div>
              )}
              {items.map(r => (
                <div key={r.id} className="p-4 space-y-2">
                  {/* Row 1 — rental no + status */}
                  <div className="flex items-center justify-between gap-2">
                    <Link href={`/rentals/${r.id}`}
                      className="font-mono text-xs font-bold" style={{ color: '#3B82F6', textDecoration: 'none' }}>
                      {r.rental_no}
                    </Link>
                    <span className={`badge badge-${r.status} text-[10px]`}>{r.status}</span>
                  </div>
                  {/* Row 2 — laptop */}
                  <div>
                    <div className="text-sm font-medium" style={{ color: '#F1F5F9' }}>
                      {r.inventory?.brand} {r.inventory?.model_no}
                    </div>
                    <div className="text-[11px] font-mono" style={{ color: '#475569' }}>{r.inventory?.asset_code}</div>
                  </div>
                  {/* Row 3 — client */}
                  <div className="text-xs" style={{ color: '#94A3B8' }}>
                    {r.client?.name || '—'}
                    {r.client?.company && <span style={{ color: '#475569' }}> · {r.client.company}</span>}
                  </div>
                  {/* Row 4 — dates + amounts */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div className="rounded-lg px-2.5 py-1.5" style={{ background: 'rgba(30,48,88,0.4)' }}>
                      <div className="text-[10px] uppercase tracking-wide mb-0.5" style={{ color: '#475569' }}>Delivery</div>
                      <div className="text-xs" style={{ color: '#94A3B8' }}>{fmtDate(r.delivery_date || r.start_date)}</div>
                      <div className="text-[10px] mt-0.5" style={{ color: r.end_date ? '#F43F5E' : '#10B981' }}>
                        {r.end_date ? `↩ ${fmtDate(r.end_date)}` : '→ ongoing'}
                      </div>
                    </div>
                    <div className="rounded-lg px-2.5 py-1.5" style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.15)' }}>
                      <div className="text-[10px] uppercase tracking-wide mb-0.5" style={{ color: '#475569' }}>Monthly / Total</div>
                      <div className="text-xs font-semibold" style={{ color: '#F1F5F9' }}>{fmtAmtSh(r.monthly_rental)}</div>
                      <div className="text-xs font-bold" style={{ color: '#10B981' }}>{fmtAmtSh(r.grand_total)}</div>
                    </div>
                  </div>
                </div>
              ))}
            </React.Fragment>
          ))}
          {/* Mobile total footer */}
          <div className="px-4 py-3 flex items-center justify-between"
            style={{ background: 'rgba(16,185,129,0.06)', borderTop: '2px solid rgba(16,185,129,0.2)' }}>
            <span className="text-xs font-bold" style={{ color: '#475569' }}>
              Total — {list.length} rental{list.length !== 1 ? 's' : ''}
            </span>
            <div className="text-right">
              <div className="text-sm font-bold" style={{ color: '#10B981' }}>{fmtAmtSh(totalGrandTotal)}</div>
              <div className="text-[10px]" style={{ color: '#475569' }}>GST: {fmtAmtSh(totalGstSum)}</div>
            </div>
          </div>
        </div>
      </>
    );
  }

  /* ──────────────── JSX ──────────────── */
  const TABS = [
    { key: 'overview',  label: 'Overview',                        shortLabel: 'Overview',  icon: <BarChart2    size={13} /> },
    { key: 'new',       label: `New (${newRentals.length})`,       shortLabel: `New`,       icon: <TrendingUp   size={13} /> },
    { key: 'renewals',  label: `Renew (${renewingRentals.length})`,shortLabel: 'Renew',     icon: <RefreshCw    size={13} /> },
    { key: 'returns',   label: `Return (${returningRentals.length})`,shortLabel: 'Return',  icon: <TrendingDown size={13} /> },
    { key: 'all',       label: `All (${activeThisMonth.length})`,  shortLabel: 'All',       icon: <Activity     size={13} /> },
  ] as const;

  return (
    <DashboardLayout>
      <PageHeader
        title="Reports"
        subtitle={`Monthly rental activity · ${monthLabel}`}
        action={
          <div className="flex gap-2">
            <button onClick={downloadExcel} disabled={loading || activeThisMonth.length === 0}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-xl text-xs font-semibold transition-all disabled:opacity-40 hover:opacity-80"
              style={{ background: 'rgba(16,185,129,0.12)', color: '#10B981', border: '1px solid rgba(16,185,129,0.25)' }}>
              <FileSpreadsheet size={14} />
              <span className="hidden sm:inline">Excel</span>
            </button>
            <button onClick={downloadPDF} disabled={loading || activeThisMonth.length === 0}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-xl text-xs font-semibold transition-all disabled:opacity-40 hover:opacity-80"
              style={{ background: 'rgba(239,68,68,0.12)', color: '#F87171', border: '1px solid rgba(239,68,68,0.25)' }}>
              <FileText size={14} />
              <span className="hidden sm:inline">PDF</span>
            </button>
          </div>
        }
      />

      {/* ── Month / Year Filter ── */}
      <div className="glass-card p-3 sm:p-4 mb-5">
        <div className="flex flex-wrap gap-2 items-center">
          <button onClick={() => { const d = new Date(year, month - 1, 1); setMonth(d.getMonth()); setYear(d.getFullYear()); }}
            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors flex-shrink-0" style={{ color: '#94A3B8' }}>
            <ChevronLeft size={15} />
          </button>
          <select className="inp flex-1 min-w-0 sm:flex-none sm:w-40" value={month} onChange={e => setMonth(Number(e.target.value))}>
            {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
          </select>
          <select className="inp w-20 sm:w-28 flex-shrink-0" value={year} onChange={e => setYear(Number(e.target.value))}>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button onClick={() => { const d = new Date(year, month + 1, 1); setMonth(d.getMonth()); setYear(d.getFullYear()); }}
            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors flex-shrink-0" style={{ color: '#94A3B8' }}>
            <ChevronRight size={15} />
          </button>
          <span className="text-xs font-semibold w-full sm:w-auto sm:ml-auto text-right sm:text-left" style={{ color: '#475569' }}>
            {loading ? 'Loading…' : `${activeThisMonth.length} active rental${activeThisMonth.length !== 1 ? 's' : ''} this month`}
          </span>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(6)].map((_, i) => <div key={i} className="skeleton h-14 rounded-xl" />)}
        </div>
      ) : (
        <>
          {/* ── Activity Summary Cards ── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            {[
              { label: 'Active This Month', value: activeThisMonth.length,  sub: 'laptops rented',     color: '#3B82F6', icon: <Monitor      size={15} />, bg: 'rgba(59,130,246,0.1)' },
              { label: 'New Deliveries',    value: newRentals.length,        sub: 'started this month', color: '#10B981', icon: <TrendingUp   size={15} />, bg: 'rgba(16,185,129,0.1)' },
              { label: 'Auto-Renewals',     value: renewingRentals.length,   sub: 'continuing',         color: '#8B5CF6', icon: <RefreshCw    size={15} />, bg: 'rgba(139,92,246,0.1)' },
              { label: 'Returns',           value: returningRentals.length,  sub: 'ended this month',   color: '#F43F5E', icon: <TrendingDown size={15} />, bg: 'rgba(244,63,94,0.1)'  },
            ].map(s => (
              <div key={s.label} className="glass-card p-3 sm:p-4 flex items-center gap-2 sm:gap-3 relative overflow-hidden">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: s.bg }}>
                  <span style={{ color: s.color }}>{s.icon}</span>
                </div>
                <div className="min-w-0">
                  <div className="text-lg sm:text-xl font-bold leading-none" style={{ color: s.color }}>{s.value}</div>
                  <div className="text-[10px] sm:text-xs mt-0.5 font-medium truncate" style={{ color: '#94A3B8' }}>{s.label}</div>
                  <div className="text-[9px] sm:text-[10px] hidden sm:block" style={{ color: '#475569' }}>{s.sub}</div>
                </div>
                <div className="absolute inset-y-0 right-0 w-0.5 rounded-r-2xl"
                  style={{ background: s.color, opacity: 0.4 }} />
              </div>
            ))}
          </div>

          {/* ── Revenue Cards ── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            {[
              { label: 'New Rental Revenue',  value: newRevenue,     color: '#10B981', sub: 'first-month billing',        icon: <TrendingUp   size={13} /> },
              { label: 'Renewal Revenue',     value: renewalRevenue, color: '#3B82F6', sub: 'continuing monthly charges', icon: <RefreshCw    size={13} /> },
              { label: 'Return Revenue',      value: returnRevenue,  color: '#F59E0B', sub: 'adjusted for returns',       icon: <TrendingDown size={13} /> },
              { label: 'Total GST Collected', value: totalGst,       color: '#A78BFA', sub: 'across all active rentals',  icon: <IndianRupee  size={13} /> },
            ].map(s => (
              <div key={s.label} className="glass-card p-3 sm:p-4 relative overflow-hidden">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span style={{ color: s.color }}>{s.icon}</span>
                  <span className="text-[10px] sm:text-xs font-semibold truncate" style={{ color: '#64748B' }}>{s.label}</span>
                </div>
                <div className="text-sm sm:text-lg font-bold leading-tight" style={{ color: s.color }}>₹{fmtAmt(s.value)}</div>
                <div className="text-[9px] sm:text-[10px] mt-0.5 hidden sm:block" style={{ color: '#334155' }}>{s.sub}</div>
                <div className="absolute inset-x-0 bottom-0 h-0.5 rounded-b-2xl"
                  style={{ background: `linear-gradient(90deg,transparent,${s.color},transparent)`, opacity: 0.5 }} />
              </div>
            ))}
          </div>

          {/* ── Business summary row ── */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">

            {/* Active Clients */}
            <div className="glass-card p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
              <div
                className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(20,184,166,0.12)' }}
              >
                <Users size={14} style={{ color: '#14B8A6' }} />
              </div>
              <div className="min-w-0 flex-1">
                <div
                  className="font-bold leading-tight"
                  style={{ color: '#14B8A6', fontSize: 'clamp(14px, 3.5vw, 20px)' }}
                >
                  {clientIds.size}
                </div>
                <div className="text-[10px] sm:text-xs font-medium truncate" style={{ color: '#94A3B8' }}>
                  Active Clients
                </div>
                <div className="text-[9px] sm:text-[10px] hidden sm:block truncate" style={{ color: '#475569' }}>
                  with rentals this month
                </div>
              </div>
            </div>

            {/* Bulk Groups */}
            <div className="glass-card p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
              <div
                className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(139,92,246,0.12)' }}
              >
                <Layers size={14} style={{ color: '#A78BFA' }} />
              </div>
              <div className="min-w-0 flex-1">
                <div
                  className="font-bold leading-tight"
                  style={{ color: '#A78BFA', fontSize: 'clamp(14px, 3.5vw, 20px)' }}
                >
                  {new Set(activeThisMonth.filter(r => r.bulk_id).map(r => r.bulk_id)).size}
                </div>
                <div className="text-[10px] sm:text-xs font-medium truncate" style={{ color: '#94A3B8' }}>
                  Bulk Groups
                </div>
                <div className="text-[9px] sm:text-[10px] hidden sm:block truncate" style={{ color: '#475569' }}>
                  active this month
                </div>
              </div>
            </div>

            {/* Total Revenue */}
            <div className="glass-card p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
              <div
                className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(59,130,246,0.12)' }}
              >
                <IndianRupee size={14} style={{ color: '#3B82F6' }} />
              </div>
              <div className="min-w-0 flex-1">
                <div
                  className="font-bold leading-tight break-all"
                  style={{
                    color: '#3B82F6',
                    fontSize: 'clamp(11px, 2.8vw, 18px)',
                    wordBreak: 'break-all',
                  }}
                >
                  ₹{fmtAmt(newRevenue + renewalRevenue)}
                </div>
                <div className="text-[10px] sm:text-xs font-medium truncate" style={{ color: '#94A3B8' }}>
                  Total Revenue
                </div>
                <div className="text-[9px] sm:text-[10px] hidden sm:block truncate" style={{ color: '#475569' }}>
                  new + renewals
                </div>
              </div>
            </div>

          </div>

          {/* ── Tabs + Tables ── */}
          <div className="glass-card overflow-hidden" ref={tableRef}>
            {/* Tab bar */}
            <div
              className="flex"
              style={{
                borderBottom: '1px solid #1E3058',
                overflowX: 'auto',
                overflowY: 'hidden',
                scrollbarWidth: 'none',
                msOverflowStyle: 'none',
                WebkitOverflowScrolling: 'touch',
              }}
            >
              {TABS.map(t => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key as any)}
                  className="flex items-center gap-1 font-semibold whitespace-nowrap transition-all flex-shrink-0"
                  style={{
                    fontSize:     12,
                    padding:      '10px 10px',
                    color:        tab === t.key ? '#3B82F6' : '#475569',
                    borderBottom: tab === t.key ? '2px solid #3B82F6' : '2px solid transparent',
                    background:   tab === t.key ? 'rgba(59,130,246,0.05)' : 'transparent',
                    minWidth:     0,
                  }}
                >
                  <span className="flex-shrink-0">{t.icon}</span>

                  {/* Active tab: always show full label. Inactive: icon-only on xs, short on sm, full on md+ */}
                  {tab === t.key ? (
                    <span>{t.label}</span>
                  ) : (
                    <>
                      <span className="hidden sm:inline md:hidden">{t.shortLabel}</span>
                      <span className="hidden md:inline">{t.label}</span>
                    </>
                  )}
                </button>
              ))}
            </div>

            {/* ── Overview tab ── */}
            {tab === 'overview' && (
              <div className="p-4 sm:p-5 space-y-4 sm:space-y-5">
                {/* Billing rule notice */}
                <div className="p-3 sm:p-4 rounded-xl flex items-start gap-2 sm:gap-3"
                  style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.18)' }}>
                  <Calendar size={15} style={{ color: '#3B82F6', flexShrink: 0, marginTop: 1 }} />
                  <div className="text-xs sm:text-sm" style={{ color: '#94A3B8' }}>
                    <strong style={{ color: '#F1F5F9' }}>Billing rule:</strong> All rentals run{' '}
                    <strong style={{ color: '#3B82F6' }}>1st–last of each month</strong> and auto-renew.
                    First month is pro-rated from delivery date. This report covers all laptops active at any point in {monthLabel}.
                  </div>
                </div>

                {/* Three-column breakdown — stacked on mobile, 3-col on sm+ */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                  {/* New deliveries */}
                  <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(16,185,129,0.25)' }}>
                    <div className="px-3 sm:px-4 py-2.5 flex items-center gap-2"
                      style={{ background: 'rgba(16,185,129,0.08)', borderBottom: '1px solid rgba(16,185,129,0.2)' }}>
                      <TrendingUp size={13} style={{ color: '#10B981' }} />
                      <span className="text-xs font-bold uppercase tracking-wider" style={{ color: '#10B981' }}>New Deliveries</span>
                      <span className="ml-auto text-xs font-bold px-1.5 py-0.5 rounded"
                        style={{ background: 'rgba(16,185,129,0.15)', color: '#10B981' }}>
                        {newRentals.length}
                      </span>
                    </div>
                    <div className="divide-y" style={{ borderColor: 'rgba(30,48,88,0.4)', maxHeight: 260, overflowY: 'auto' }}>
                      {newRentals.length === 0 ? (
                        <div className="px-4 py-6 text-xs text-center" style={{ color: '#334155' }}>No new rentals</div>
                      ) : newRentals.map(r => (
                        <div key={r.id} className="px-3 sm:px-4 py-2.5">
                          <div className="flex items-center justify-between gap-2">
                            <Link href={`/rentals/${r.id}`} className="font-mono text-xs font-bold truncate" style={{ color: '#3B82F6', textDecoration: 'none' }}>{r.rental_no}</Link>
                            <span className="text-xs font-semibold flex-shrink-0" style={{ color: '#10B981' }}>{fmtAmtSh(r.grand_total)}</span>
                          </div>
                          <div className="text-xs mt-0.5 truncate" style={{ color: '#F1F5F9' }}>{r.inventory?.brand} {r.inventory?.model_no}</div>
                          <div className="text-xs truncate" style={{ color: '#64748B' }}>{r.client?.name}{r.client?.company ? ` · ${r.client.company}` : ''}</div>
                          <div className="text-[10px] mt-0.5" style={{ color: '#475569' }}>Delivery: {fmtDate(r.delivery_date || r.start_date)}</div>
                        </div>
                      ))}
                    </div>
                    {newRentals.length > 0 && (
                      <div className="px-3 sm:px-4 py-2.5 flex justify-between items-center"
                        style={{ background: 'rgba(16,185,129,0.06)', borderTop: '1px solid rgba(16,185,129,0.2)' }}>
                        <span className="text-xs font-bold" style={{ color: '#475569' }}>Revenue</span>
                        <span className="text-sm font-bold" style={{ color: '#10B981' }}>{fmtAmtSh(newRevenue)}</span>
                      </div>
                    )}
                  </div>

                  {/* Auto-renewals */}
                  <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(59,130,246,0.25)' }}>
                    <div className="px-3 sm:px-4 py-2.5 flex items-center gap-2"
                      style={{ background: 'rgba(59,130,246,0.08)', borderBottom: '1px solid rgba(59,130,246,0.2)' }}>
                      <RefreshCw size={13} style={{ color: '#3B82F6' }} />
                      <span className="text-xs font-bold uppercase tracking-wider" style={{ color: '#3B82F6' }}>Auto-Renewals</span>
                      <span className="ml-auto text-xs font-bold px-1.5 py-0.5 rounded"
                        style={{ background: 'rgba(59,130,246,0.15)', color: '#3B82F6' }}>
                        {renewingRentals.length}
                      </span>
                    </div>
                    <div className="divide-y" style={{ borderColor: 'rgba(30,48,88,0.4)', maxHeight: 260, overflowY: 'auto' }}>
                      {renewingRentals.length === 0 ? (
                        <div className="px-4 py-6 text-xs text-center" style={{ color: '#334155' }}>No renewals</div>
                      ) : renewingRentals.map(r => (
                        <div key={r.id} className="px-3 sm:px-4 py-2.5">
                          <div className="flex items-center justify-between gap-2">
                            <Link href={`/rentals/${r.id}`} className="font-mono text-xs font-bold truncate" style={{ color: '#3B82F6', textDecoration: 'none' }}>{r.rental_no}</Link>
                            <span className="text-xs font-semibold flex-shrink-0" style={{ color: '#3B82F6' }}>{fmtAmtSh(r.grand_total)}</span>
                          </div>
                          <div className="text-xs mt-0.5 truncate" style={{ color: '#F1F5F9' }}>{r.inventory?.brand} {r.inventory?.model_no}</div>
                          <div className="text-xs truncate" style={{ color: '#64748B' }}>{r.client?.name}{r.client?.company ? ` · ${r.client.company}` : ''}</div>
                          <div className="text-[10px] mt-0.5" style={{ color: '#475569' }}>Since: {fmtDate(r.start_date)}</div>
                        </div>
                      ))}
                    </div>
                    {renewingRentals.length > 0 && (
                      <div className="px-3 sm:px-4 py-2.5 flex justify-between items-center"
                        style={{ background: 'rgba(59,130,246,0.06)', borderTop: '1px solid rgba(59,130,246,0.2)' }}>
                        <span className="text-xs font-bold" style={{ color: '#475569' }}>Revenue</span>
                        <span className="text-sm font-bold" style={{ color: '#3B82F6' }}>{fmtAmtSh(renewalRevenue)}</span>
                      </div>
                    )}
                  </div>

                  {/* Returns */}
                  <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(244,63,94,0.25)' }}>
                    <div className="px-3 sm:px-4 py-2.5 flex items-center gap-2"
                      style={{ background: 'rgba(244,63,94,0.08)', borderBottom: '1px solid rgba(244,63,94,0.2)' }}>
                      <TrendingDown size={13} style={{ color: '#F43F5E' }} />
                      <span className="text-xs font-bold uppercase tracking-wider" style={{ color: '#F43F5E' }}>Returns &amp; Cancellations</span>
                      <span className="ml-auto text-xs font-bold px-1.5 py-0.5 rounded"
                        style={{ background: 'rgba(244,63,94,0.15)', color: '#F43F5E' }}>
                        {returningRentals.length}
                      </span>
                    </div>
                    <div className="divide-y" style={{ borderColor: 'rgba(30,48,88,0.4)', maxHeight: 260, overflowY: 'auto' }}>
                      {returningRentals.length === 0 ? (
                        <div className="px-4 py-6 text-xs text-center" style={{ color: '#334155' }}>No returns</div>
                      ) : returningRentals.map(r => (
                        <div key={r.id} className="px-3 sm:px-4 py-2.5">
                          <div className="flex items-center justify-between gap-2">
                            <Link href={`/rentals/${r.id}`} className="font-mono text-xs font-bold truncate" style={{ color: '#3B82F6', textDecoration: 'none' }}>{r.rental_no}</Link>
                            <span className={`badge badge-${r.status} text-[10px] flex-shrink-0`}>{r.status}</span>
                          </div>
                          <div className="text-xs mt-0.5 truncate" style={{ color: '#F1F5F9' }}>{r.inventory?.brand} {r.inventory?.model_no}</div>
                          <div className="text-xs truncate" style={{ color: '#64748B' }}>{r.client?.name}{r.client?.company ? ` · ${r.client.company}` : ''}</div>
                          <div className="text-[10px] mt-0.5" style={{ color: '#F43F5E' }}>Returned: {fmtDate(r.end_date)}</div>
                          {r.deduction_amount && Number(r.deduction_amount) > 0 && (
                            <div className="text-[10px]" style={{ color: '#F59E0B' }}>
                              Deduction: {fmtAmtSh(r.deduction_amount)} · Adj: {fmtAmtSh(r.adjusted_total ?? r.grand_total)}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    {returningRentals.length > 0 && (
                      <div className="px-3 sm:px-4 py-2.5 flex justify-between items-center"
                        style={{ background: 'rgba(244,63,94,0.06)', borderTop: '1px solid rgba(244,63,94,0.2)' }}>
                        <span className="text-xs font-bold" style={{ color: '#475569' }}>Revenue</span>
                        <span className="text-sm font-bold" style={{ color: '#F59E0B' }}>{fmtAmtSh(returnRevenue)}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {tab === 'new'      && <RentalTable list={newRentals}       emptyMsg={`No new rentals delivered in ${monthLabel}`} />}
            {tab === 'renewals' && <RentalTable list={renewingRentals}  emptyMsg={`No auto-renewals in ${monthLabel}`} />}
            {tab === 'returns'  && <RentalTable list={returningRentals} emptyMsg={`No returns or cancellations in ${monthLabel}`} />}
            {tab === 'all'      && <RentalTable list={activeThisMonth}  emptyMsg={`No active rentals in ${monthLabel}`} />}
          </div>

          {/* ── Empty state ── */}
          {activeThisMonth.length === 0 && (
            <div className="glass-card p-8 flex flex-col items-center gap-3 text-center mt-5">
              <BarChart2 size={28} style={{ color: '#334155' }} />
              <div className="text-sm font-semibold" style={{ color: '#475569' }}>No rental activity in {monthLabel}</div>
              <div className="text-xs max-w-sm" style={{ color: '#334155' }}>
                Try selecting a different month, or check that rentals have been created in the system.
              </div>
            </div>
          )}
        </>
      )}
    </DashboardLayout>
  );
}
