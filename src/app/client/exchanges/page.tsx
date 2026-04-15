'use client';

import { useEffect, useState, useCallback } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { PageHeader, Toast } from '@/components/ui';
import { api } from '@/lib/api';
import { RentalExchange } from '@/types';
import { ArrowLeftRight, Calendar, ChevronLeft, ChevronRight, Laptop } from 'lucide-react';

const fmtDate = (d?: string) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export default function ClientExchangesPage() {
  const [exchanges, setExchanges]   = useState<RentalExchange[]>([]);
  const [loading, setLoading]       = useState(true);
  const [page, setPage]             = useState(1);
  const [lastPage, setLastPage]     = useState(1);
  const [total, setTotal]           = useState(0);
  const [toast, setToast]           = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const load = useCallback(async (p = page) => {
    setLoading(true);
    try {
      const res = await api.exchanges.myExchanges({ page: String(p), per_page: '15' });
      setExchanges(res.data?.data ?? []);
      setLastPage(res.data?.last_page ?? 1);
      setTotal(res.data?.total ?? 0);
    } catch {
      setToast({ msg: 'Failed to load exchanges.', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { load(page); }, [page]);

  return (
    <DashboardLayout>
      <PageHeader
        title="My Exchanges"
        subtitle={`${total} laptop exchange${total !== 1 ? 's' : ''} on your rentals`}
      />

      {toast && (
        <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />
      )}

      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="skeleton h-24 rounded-2xl" />
          ))}
        </div>
      ) : exchanges.length === 0 ? (
        <div className="glass-card p-10 flex flex-col items-center gap-3 text-center">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
            style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)' }}>
            <ArrowLeftRight size={22} style={{ color: '#3B82F6' }} />
          </div>
          <div className="text-sm font-semibold" style={{ color: '#F1F5F9' }}>No exchanges yet</div>
          <div className="text-xs max-w-xs" style={{ color: '#475569' }}>
            If your rented laptop has ever been exchanged for another device, the history will appear here.
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {exchanges.map(ex => (
            <div key={ex.id} className="glass-card p-4 sm:p-5">
              {/* Header row */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                    style={{ background: 'rgba(59,130,246,0.12)' }}>
                    <ArrowLeftRight size={13} style={{ color: '#3B82F6' }} />
                  </div>
                  <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-lg"
                    style={{ background: 'rgba(59,130,246,0.1)', color: '#60A5FA' }}>
                    {ex.exchange_no}
                  </span>
                  <span className="font-mono text-xs" style={{ color: '#475569' }}>
                    {ex.rental?.rental_no}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-xs" style={{ color: '#64748B' }}>
                  <Calendar size={12} />
                  {fmtDate(ex.exchange_date)}
                </div>
              </div>

              {/* Laptops swap */}
              <div className="flex items-center gap-3">
                {/* Old */}
                <div className="flex-1 rounded-xl p-3"
                  style={{ background: 'rgba(244,63,94,0.06)', border: '1px solid rgba(244,63,94,0.15)' }}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <Laptop size={12} style={{ color: '#F87171' }} />
                    <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#F87171' }}>
                      Returned
                    </span>
                  </div>
                  <div className="text-sm font-semibold" style={{ color: '#F1F5F9' }}>
                    {ex.old_inventory?.brand} {ex.old_inventory?.model_no}
                  </div>
                  <div className="text-xs font-mono mt-0.5" style={{ color: '#64748B' }}>
                    {ex.old_inventory?.asset_code}
                    {ex.old_inventory?.serial_number ? ` · ${ex.old_inventory.serial_number}` : ''}
                  </div>
                </div>

                {/* Arrow */}
                <div className="flex-shrink-0">
                  <ArrowLeftRight size={16} style={{ color: '#334155' }} />
                </div>

                {/* New */}
                <div className="flex-1 rounded-xl p-3"
                  style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)' }}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <Laptop size={12} style={{ color: '#34D399' }} />
                    <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#34D399' }}>
                      Received
                    </span>
                  </div>
                  <div className="text-sm font-semibold" style={{ color: '#F1F5F9' }}>
                    {ex.new_inventory?.brand} {ex.new_inventory?.model_no}
                  </div>
                  <div className="text-xs font-mono mt-0.5" style={{ color: '#64748B' }}>
                    {ex.new_inventory?.asset_code}
                    {ex.new_inventory?.serial_number ? ` · ${ex.new_inventory.serial_number}` : ''}
                  </div>
                </div>
              </div>

              {/* Reason / Notes */}
              {(ex.reason || ex.notes) && (
                <div className="mt-3 text-xs px-3 py-2 rounded-lg" style={{ background: 'rgba(30,48,88,0.4)', color: '#64748B' }}>
                  {ex.reason && <span>{ex.reason}</span>}
                  {ex.reason && ex.notes && <span className="mx-1">·</span>}
                  {ex.notes && <span>{ex.notes}</span>}
                </div>
              )}

              {/* Terms unchanged notice */}
              <div className="mt-3 text-[10px] px-2" style={{ color: '#334155' }}>
                Rental terms (amount, billing cycle) were not affected by this exchange.
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {lastPage > 1 && (
        <div className="flex items-center justify-between mt-4 px-1">
          <span className="text-xs" style={{ color: '#475569' }}>Page {page} of {lastPage}</span>
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
    </DashboardLayout>
  );
}
