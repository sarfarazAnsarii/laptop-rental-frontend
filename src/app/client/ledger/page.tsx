'use client';

import { useEffect, useState, useCallback } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button, PageHeader, EmptyState, Toast } from '@/components/ui';
import { api } from '@/lib/api';
import { Download, BookOpen, TrendingDown, Receipt, FileSpreadsheet } from 'lucide-react';
import Link from 'next/link';

const fmtAmt = (n: any) =>
  Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (d?: string) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const STATUS_COLOR: Record<string, string> = {
  active:    '#3B82F6',
  completed: '#10B981',
  cancelled: '#64748B',
  overdue:   '#F43F5E',
};

export default function ClientLedgerPage() {
  const [rentals,  setRentals]  = useState<any[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [page,     setPage]     = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total,    setTotal]    = useState(0);
  const [tdsRate,  setTdsRate]  = useState<number>(10);
  const [downloading, setDownloading] = useState(false);

  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.client.myRentals({ per_page: '200', page: String(page) });
      setRentals(res.data?.data || res.data || []);
      setLastPage(res.data?.last_page || 1);
      setTotal(res.data?.total || 0);
    } catch (e: any) {
      showToast(e.message || 'Failed to load ledger', 'error');
    } finally { setLoading(false); }
  }, [page]);

  useEffect(() => { load(); }, [load]);

  /* per-row calculations */
  function calcRow(r: any) {
    const base  = Number(r.total  || (Number(r.grand_total || 0) - Number(r.gst_amount || 0)));
    const gst   = Number(r.gst_amount  || 0);
    const grand = Number(r.grand_total || base + gst);
    const tds   = parseFloat((base * tdsRate / 100).toFixed(2));
    const net   = parseFloat((grand - tds).toFixed(2));
    return { base, gst, grand, tds, net };
  }

  /* aggregate totals across all rows */
  const totals = rentals.reduce(
    (acc, r) => {
      const { base, gst, grand, tds, net } = calcRow(r);
      return { base: acc.base + base, gst: acc.gst + gst, grand: acc.grand + grand, tds: acc.tds + tds, net: acc.net + net };
    },
    { base: 0, gst: 0, grand: 0, tds: 0, net: 0 },
  );

  async function downloadExcel() {
    setDownloading(true);
    try {
      const { utils, writeFile } = await import('xlsx');
      const headers = [
        'Sl.No', 'Rental No', 'Asset Code', 'Laptop', 'Start Date', 'End Date',
        'Monthly Rental', 'Base Amount (₹)', 'GST Amount (₹)', `Invoice Amount (₹)`,
        `TDS @ ${tdsRate}% (₹)`, 'Net Payable (₹)', 'Status',
      ];
      const rows = rentals.map((r, i) => {
        const { base, gst, grand, tds, net } = calcRow(r);
        return [
          i + 1,
          r.rental_no,
          r.inventory?.asset_code || '—',
          `${r.inventory?.brand || ''} ${r.inventory?.model_no || ''}`.trim(),
          fmtDate(r.start_date),
          fmtDate(r.end_date),
          Number(r.monthly_rental || 0),
          base, gst, grand, tds, net,
          r.status,
        ];
      });
      const totalRow = [
        '', '', '', '', '', '', 'TOTAL',
        totals.base, totals.gst, totals.grand, totals.tds, totals.net, '',
      ];

      const ws = utils.aoa_to_sheet([headers, ...rows, [''], totalRow]);
      /* column widths */
      ws['!cols'] = [
        { wch: 6 }, { wch: 16 }, { wch: 12 }, { wch: 24 }, { wch: 14 }, { wch: 14 },
        { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 10 },
      ];
      const wb = utils.book_new();
      utils.book_append_sheet(wb, ws, 'Ledger');
      writeFile(wb, `ledger-tds${tdsRate}pct-${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (e: any) {
      showToast('Failed to generate Excel: ' + (e.message || ''), 'error');
    } finally { setDownloading(false); }
  }

  const summaryCards = [
    { label: 'Base Amount',    value: totals.base,  color: '#3B82F6', note: 'Before GST' },
    { label: 'GST Amount',     value: totals.gst,   color: '#F59E0B', note: 'Tax component' },
    { label: 'Invoice Total',  value: totals.grand, color: '#10B981', note: 'Base + GST' },
    { label: `TDS @ ${tdsRate}%`, value: totals.tds,color: '#F43F5E', note: 'Deductible by you' },
    { label: 'Net Payable',    value: totals.net,   color: '#8B5CF6', note: 'Invoice − TDS' },
  ];

  return (
    <DashboardLayout>
      <PageHeader
        title="Ledger"
        subtitle={`${total} rental${total !== 1 ? 's' : ''} · Invoice &amp; TDS summary`}
        action={
          <div className="flex items-center gap-3 flex-wrap">
            {/* TDS Rate input */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl"
              style={{ background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.25)' }}>
              <TrendingDown size={13} style={{ color: '#F43F5E' }} />
              <span className="text-xs font-semibold" style={{ color: '#F43F5E' }}>TDS</span>
              <input
                type="number" min={0} max={30} step={0.5}
                className="w-12 text-center text-sm font-bold bg-transparent outline-none"
                style={{ color: '#F43F5E' }}
                value={tdsRate}
                onChange={e => setTdsRate(Math.max(0, Math.min(30, Number(e.target.value))))}
              />
              <span className="text-xs font-semibold" style={{ color: '#F43F5E' }}>%</span>
            </div>
            <Button icon={<Download size={14} />} loading={downloading} onClick={downloadExcel}>
              <span className="hidden sm:inline">Download Excel</span>
              <span className="sm:hidden">Excel</span>
            </Button>
          </div>
        }
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
        {summaryCards.map(s => (
          <div key={s.label} className="glass-card p-4">
            <div className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: '#475569' }}>{s.label}</div>
            <div className="text-base font-bold mb-0.5" style={{ color: s.color, fontFamily: 'Syne, sans-serif' }}>
              ₹{fmtAmt(s.value)}
            </div>
            <div className="text-[10px]" style={{ color: '#334155' }}>{s.note}</div>
          </div>
        ))}
      </div>

      {/* TDS note */}
      <div className="mb-4 px-4 py-3 rounded-xl flex items-start gap-2.5 text-xs"
        style={{ background: 'rgba(244,63,94,0.06)', border: '1px solid rgba(244,63,94,0.2)' }}>
        <TrendingDown size={14} style={{ color: '#F43F5E', flexShrink: 0, marginTop: 1 }} />
        <span style={{ color: '#94A3B8' }}>
          TDS (Tax Deducted at Source) at <strong style={{ color: '#F43F5E' }}>{tdsRate}%</strong> is
          calculated on the <strong>base rental amount</strong> (excluding GST) as per Section 194I / 194C of
          the Income Tax Act. Adjust the rate above to match your applicable TDS section.
        </span>
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            {[...Array(6)].map((_, i) => <div key={i} className="skeleton h-12 rounded-xl" />)}
          </div>
        ) : rentals.length === 0 ? (
          <EmptyState icon={<BookOpen size={22} />} title="No rental records" desc="Your invoice ledger will appear here once you have rentals" />
        ) : (
          <>
            {/* Mobile cards */}
            <div className="sm:hidden divide-y" style={{ borderColor: 'rgba(30,48,88,0.4)' }}>
              {rentals.map((r, idx) => {
                const { base, gst, grand, tds, net } = calcRow(r);
                const sc = STATUS_COLOR[r.status] || '#94A3B8';
                return (
                  <div key={r.id} className="p-4 space-y-2 animate-fade-in">
                    <div className="flex items-center justify-between gap-2">
                      <Link href={`/rentals/${r.id}`}>
                        <span className="font-mono text-xs font-semibold" style={{ color: '#3B82F6' }}>{r.rental_no}</span>
                      </Link>
                      <span className={`badge badge-${r.status}`}>{r.status}</span>
                    </div>
                    <div className="text-sm font-medium" style={{ color: '#F1F5F9' }}>
                      {r.inventory?.brand} {r.inventory?.model_no}
                      <span className="ml-2 font-mono text-xs font-normal" style={{ color: '#475569' }}>{r.inventory?.asset_code}</span>
                    </div>
                    <div className="text-xs" style={{ color: '#64748B' }}>
                      {fmtDate(r.start_date)} → {fmtDate(r.end_date)}
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs pt-1"
                      style={{ borderTop: '1px solid rgba(30,48,88,0.4)' }}>
                      <div style={{ color: '#64748B' }}>Base: <span style={{ color: '#F1F5F9', fontWeight: 600 }}>₹{fmtAmt(base)}</span></div>
                      <div style={{ color: '#64748B' }}>GST: <span style={{ color: '#F59E0B', fontWeight: 600 }}>₹{fmtAmt(gst)}</span></div>
                      <div style={{ color: '#64748B' }}>Invoice: <span style={{ color: '#10B981', fontWeight: 600 }}>₹{fmtAmt(grand)}</span></div>
                      <div style={{ color: '#64748B' }}>TDS: <span style={{ color: '#F43F5E', fontWeight: 600 }}>₹{fmtAmt(tds)}</span></div>
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-xs" style={{ color: '#64748B' }}>Net Payable</span>
                      <span className="text-sm font-bold" style={{ color: '#8B5CF6' }}>₹{fmtAmt(net)}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto">
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#060D1C', borderBottom: '2px solid #1E3A5F' }}>
                    {[
                      { label: '#',             align: 'center', w: 36 },
                      { label: 'Rental No',     align: 'left'   },
                      { label: 'Laptop',        align: 'left'   },
                      { label: 'Period',        align: 'left'   },
                      { label: 'Base Amount',   align: 'right'  },
                      { label: 'GST',           align: 'right'  },
                      { label: 'Invoice',       align: 'right'  },
                      { label: `TDS @${tdsRate}%`, align: 'right' },
                      { label: 'Net Payable',   align: 'right'  },
                      { label: 'Status',        align: 'center' },
                    ].map(h => (
                      <th key={h.label} style={{
                        padding: '8px 10px', color: '#3A5578', fontWeight: 700, fontSize: 10,
                        textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: h.align as any,
                        width: h.w, whiteSpace: 'nowrap',
                      }}>{h.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rentals.map((r, idx) => {
                    const { base, gst, grand, tds, net } = calcRow(r);
                    return (
                      <tr key={r.id} className="animate-fade-in"
                        style={{ borderBottom: '1px solid #0E1C34' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(59,130,246,0.03)')}
                        onMouseLeave={e => (e.currentTarget.style.background = '')}>
                        <td style={{ padding: '7px 8px', textAlign: 'center', color: '#2A4060', fontSize: 10, userSelect: 'none' }}>
                          {(page - 1) * 200 + idx + 1}
                        </td>
                        <td style={{ padding: '7px 10px' }}>
                          <Link href={`/rentals/${r.id}`}
                            className="font-mono text-xs font-semibold hover:underline"
                            style={{ color: '#4499F0' }}>
                            {r.rental_no}
                          </Link>
                        </td>
                        <td style={{ padding: '7px 10px' }}>
                          <div style={{ color: '#BDD0E8', fontWeight: 600 }}>{r.inventory?.brand} {r.inventory?.model_no}</div>
                          <div style={{ color: '#2E4568', fontSize: 10, fontFamily: 'monospace' }}>{r.inventory?.asset_code}</div>
                        </td>
                        <td style={{ padding: '7px 10px' }}>
                          <div style={{ color: '#7B9EC4' }}>{fmtDate(r.start_date)}</div>
                          <div style={{ color: '#2E4568', fontSize: 10 }}>→ {fmtDate(r.end_date)}</div>
                        </td>
                        <td style={{ padding: '7px 10px', textAlign: 'right', color: '#BDD0E8', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                          ₹{fmtAmt(base)}
                        </td>
                        <td style={{ padding: '7px 10px', textAlign: 'right', color: '#F59E0B', fontVariantNumeric: 'tabular-nums' }}>
                          ₹{fmtAmt(gst)}
                        </td>
                        <td style={{ padding: '7px 10px', textAlign: 'right', color: '#10B981', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                          ₹{fmtAmt(grand)}
                        </td>
                        <td style={{ padding: '7px 10px', textAlign: 'right', color: '#F43F5E', fontVariantNumeric: 'tabular-nums' }}>
                          ₹{fmtAmt(tds)}
                        </td>
                        <td style={{ padding: '7px 10px', textAlign: 'right', color: '#8B5CF6', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                          ₹{fmtAmt(net)}
                        </td>
                        <td style={{ padding: '7px 10px', textAlign: 'center' }}>
                          <span className={`badge badge-${r.status}`}>{r.status}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ background: 'rgba(30,48,88,0.5)', borderTop: '2px solid #1E3A5F' }}>
                    <td colSpan={4} style={{ padding: '8px 10px', fontWeight: 700, fontSize: 11, color: '#7B9EC4', textAlign: 'right' }}>
                      GRAND TOTAL ({rentals.length} records)
                    </td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: '#BDD0E8', fontVariantNumeric: 'tabular-nums' }}>
                      ₹{fmtAmt(totals.base)}
                    </td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: '#F59E0B', fontVariantNumeric: 'tabular-nums' }}>
                      ₹{fmtAmt(totals.gst)}
                    </td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: '#10B981', fontVariantNumeric: 'tabular-nums' }}>
                      ₹{fmtAmt(totals.grand)}
                    </td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: '#F43F5E', fontVariantNumeric: 'tabular-nums' }}>
                      ₹{fmtAmt(totals.tds)}
                    </td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: '#8B5CF6', fontVariantNumeric: 'tabular-nums' }}>
                      ₹{fmtAmt(totals.net)}
                    </td>
                    <td style={{ padding: '8px 10px' }} />
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )}

        {lastPage > 1 && (
          <div className="flex items-center justify-between px-6 py-4" style={{ borderTop: '1px solid #1E3058' }}>
            <span className="text-xs" style={{ color: '#475569' }}>Page {page} of {lastPage} — {total} total</span>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Prev</Button>
              <Button variant="ghost" size="sm" disabled={page >= lastPage} onClick={() => setPage(p => p + 1)}>Next</Button>
            </div>
          </div>
        )}
      </div>

      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </DashboardLayout>
  );
}
