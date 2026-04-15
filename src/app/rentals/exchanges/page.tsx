'use client';

import { useEffect, useState, useCallback } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { PageHeader, Toast } from '@/components/ui';
import { api } from '@/lib/api';
import { RentalExchange } from '@/types';
import { ArrowLeftRight, Search, ChevronLeft, ChevronRight, Calendar, User, Laptop } from 'lucide-react';
import Link from 'next/link';

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

export default function ExchangesPage() {
  const [exchanges, setExchanges]   = useState<RentalExchange[]>([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [page, setPage]             = useState(1);
  const [lastPage, setLastPage]     = useState(1);
  const [total, setTotal]           = useState(0);
  const [toast, setToast]           = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const load = useCallback(async (p = page, s = search) => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(p), per_page: '15' };
      if (s) params.search = s;
      const res = await api.exchanges.list(params);
      setExchanges(res.data?.data ?? []);
      setLastPage(res.data?.last_page ?? 1);
      setTotal(res.data?.total ?? 0);
    } catch {
      setToast({ msg: 'Failed to load exchanges.', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { load(1, search); setPage(1); }, [search]);
  useEffect(() => { load(page, search); }, [page]);

  return (
    <DashboardLayout>
      <PageHeader
        title="Laptop Exchanges"
        subtitle={`${total} exchange${total !== 1 ? 's' : ''} recorded`}
      />

      {toast && (
        <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />
      )}

      {/* Search */}
      <div className="mb-4 flex gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#475569' }} />
          <input
            className="w-full pl-9 pr-3 py-2 rounded-xl text-sm"
            style={{ background: 'rgba(15,23,42,0.6)', border: '1px solid #1E3058', color: '#F1F5F9' }}
            placeholder="Search by EXC number…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">

      {/* ── Mobile card list (hidden on md+) ── */}
      <div className="md:hidden divide-y" style={{ borderColor: 'rgba(30,48,88,0.4)' }}>
        {loading ? (
          <div className="px-4 py-10 text-center text-sm" style={{ color: '#475569' }}>Loading…</div>
        ) : exchanges.length === 0 ? (
          <div className="px-4 py-10 flex flex-col items-center gap-2">
            <ArrowLeftRight size={28} style={{ color: '#334155' }} />
            <span className="text-sm" style={{ color: '#475569' }}>No exchanges found</span>
          </div>
        ) : exchanges.map(ex => (
          <div key={ex.id} className="p-4 space-y-3">

            {/* Row 1: Exchange No + Date */}
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-semibold px-2 py-1 rounded-lg"
                style={{ background: 'rgba(59,130,246,0.1)', color: '#60A5FA' }}>
                {ex.exchange_no}
              </span>
              <div className="flex items-center gap-1.5 text-xs" style={{ color: '#94A3B8' }}>
                <Calendar size={12} style={{ color: '#475569' }} />
                {fmtDate(ex.exchange_date)}
              </div>
            </div>

            {/* Row 2: Rental + Client */}
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: '#475569' }}>Rental</div>
                {ex.rental ? (
                  <Link href={`/rentals/${ex.rental_id}`}
                    className="font-mono text-xs font-semibold hover:underline"
                    style={{ color: '#38BDF8' }}>
                    {ex.rental.rental_no}
                  </Link>
                ) : (
                  <span className="text-xs" style={{ color: '#475569' }}>#{ex.rental_id}</span>
                )}
              </div>
              <div className="text-right min-w-0">
                <div className="text-[10px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: '#475569' }}>Client</div>
                <div className="text-xs font-medium truncate" style={{ color: '#F1F5F9' }}>
                  {ex.rental?.client?.name ?? '—'}
                </div>
                {ex.rental?.client?.company && (
                  <div className="text-xs truncate" style={{ color: '#475569' }}>{ex.rental.client.company}</div>
                )}
              </div>
            </div>

            {/* Row 3: Old → New Laptop */}
            <div className="rounded-lg p-2.5 space-y-2" style={{ background: 'rgba(30,48,88,0.3)' }}>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider w-8 flex-shrink-0" style={{ color: '#475569' }}>Old</span>
                <LaptopCell inv={ex.old_inventory} />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider w-8 flex-shrink-0" style={{ color: '#10B981' }}>New</span>
                <LaptopCell inv={ex.new_inventory} highlight />
              </div>
            </div>

            {/* Row 4: Reason + By */}
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: '#475569' }}>Reason</div>
                <div className="text-xs" style={{ color: '#64748B' }}>
                  {ex.reason ?? <span style={{ color: '#334155' }}>—</span>}
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-[10px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: '#475569' }}>By</div>
                <div className="text-xs" style={{ color: '#64748B' }}>
                  {(ex as any).exchanged_by_user?.name ?? (ex as any).exchanged_by_name ?? '—'}
                </div>
              </div>
            </div>

          </div>
        ))}
      </div>

      {/* ── Desktop table (hidden below md) ── */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid #1E3058' }}>
              {['Exchange No', 'Date', 'Rental', 'Client', 'Old Laptop', 'New Laptop', 'Reason', 'By'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider"
                  style={{ color: '#475569' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-sm" style={{ color: '#475569' }}>Loading…</td>
              </tr>
            ) : exchanges.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <ArrowLeftRight size={28} style={{ color: '#334155' }} />
                    <span className="text-sm" style={{ color: '#475569' }}>No exchanges found</span>
                  </div>
                </td>
              </tr>
            ) : exchanges.map(ex => (
              <tr key={ex.id} style={{ borderBottom: '1px solid rgba(30,48,88,0.4)' }}
                className="hover:bg-white/[0.02] transition-colors">
                <td className="px-4 py-3">
                  <span className="font-mono text-xs font-semibold px-2 py-1 rounded-lg"
                    style={{ background: 'rgba(59,130,246,0.1)', color: '#60A5FA' }}>
                    {ex.exchange_no}
                  </span>
                </td>
                <td className="px-4 py-3 whitespace-nowrap" style={{ color: '#94A3B8' }}>
                  <div className="flex items-center gap-1.5">
                    <Calendar size={13} style={{ color: '#475569' }} />
                    {fmtDate(ex.exchange_date)}
                  </div>
                </td>
                <td className="px-4 py-3">
                  {ex.rental ? (
                    <Link href={`/rentals/${ex.rental_id}`}
                      className="font-mono text-xs font-semibold hover:underline"
                      style={{ color: '#38BDF8' }}>
                      {ex.rental.rental_no}
                    </Link>
                  ) : (
                    <span className="text-xs" style={{ color: '#475569' }}>#{ex.rental_id}</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <User size={13} style={{ color: '#475569' }} />
                    <div>
                      <div className="text-xs font-medium" style={{ color: '#F1F5F9' }}>
                        {ex.rental?.client?.name ?? '—'}
                      </div>
                      {ex.rental?.client?.company && (
                        <div className="text-xs" style={{ color: '#475569' }}>{ex.rental.client.company}</div>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3"><LaptopCell inv={ex.old_inventory} /></td>
                <td className="px-4 py-3"><LaptopCell inv={ex.new_inventory} highlight /></td>
                <td className="px-4 py-3 max-w-[160px]">
                  <span className="text-xs" style={{ color: '#64748B' }}>
                    {ex.reason ?? <span style={{ color: '#334155' }}>—</span>}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-xs" style={{ color: '#64748B' }}>
                    {(ex as any).exchanged_by_user?.name ?? (ex as any).exchanged_by_name ?? '—'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Pagination (shared) ── */}
      {lastPage > 1 && (
        <div className="px-4 py-3 flex items-center justify-between"
          style={{ borderTop: '1px solid #1E3058' }}>
          <span className="text-xs" style={{ color: '#475569' }}>
            Page {page} of {lastPage}
          </span>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="p-1.5 rounded-lg disabled:opacity-40 hover:bg-white/5 transition-colors"
              style={{ color: '#94A3B8' }}>
              <ChevronLeft size={15} />
            </button>
            <button onClick={() => setPage(p => Math.min(lastPage, p + 1))} disabled={page === lastPage}
              className="p-1.5 rounded-lg disabled:opacity-40 hover:bg-white/5 transition-colors"
              style={{ color: '#94A3B8' }}>
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      )}

    </div>
    </DashboardLayout>
  );
}

function LaptopCell({ inv, highlight }: { inv?: any; highlight?: boolean }) {
  if (!inv) return <span className="text-xs" style={{ color: '#334155' }}>—</span>;
  return (
    <div className="flex items-start gap-1.5">
      <Laptop size={13} style={{ color: highlight ? '#10B981' : '#475569' }} className="mt-0.5 flex-shrink-0" />
      <div>
        <div className="text-xs font-medium" style={{ color: highlight ? '#6EE7B7' : '#F1F5F9' }}>
          {inv.brand} {inv.model_no}
        </div>
        <div className="text-xs font-mono" style={{ color: '#475569' }}>
          {inv.asset_code}
          {inv.serial_number && ` · ${inv.serial_number}`}
        </div>
      </div>
    </div>
  );
}
