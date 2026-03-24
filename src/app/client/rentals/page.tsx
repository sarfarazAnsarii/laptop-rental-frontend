'use client';

import React, { useEffect, useState, useCallback } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button, Modal, FormField, PageHeader, EmptyState, Toast } from '@/components/ui';
import { api } from '@/lib/api';
import { FileText, Eye, Cpu, Database, HardDrive, Calendar, Layers, Truck } from 'lucide-react';
import Link from 'next/link';

const fmt     = (n: any) => '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });
const fmtDate = (d?: string) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export default function ClientRentalsPage() {
  const [rentals,  setRentals]  = useState<any[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [page,     setPage]     = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total,    setTotal]    = useState(0);
  const [toast,    setToast]    = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  // Schedule pickup
  const EMPTY_SCHED = { address: '', scheduled_at: '', contact_name: '', contact_phone: '', notes: '' };
  const [pickupModal,   setPickupModal]   = useState<{ rentalId?: number; bulkId?: string } | null>(null);
  const [pickupForm,    setPickupForm]    = useState(EMPTY_SCHED);
  const [pickupSaving,  setPickupSaving]  = useState(false);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  async function handleSchedulePickup() {
    if (!pickupModal) return;
    setPickupSaving(true);
    try {
      if (pickupModal.bulkId) {
        await api.rentals.bulkSchedules.schedulePickup(pickupModal.bulkId, pickupForm);
      } else {
        await api.rentals.schedules.schedulePickup(pickupModal.rentalId!, pickupForm);
      }
      showToast('Pickup scheduled — our team will contact you');
      setPickupModal(null);
      setPickupForm(EMPTY_SCHED);
    } catch (e: any) {
      showToast(e.message || 'Failed to schedule pickup', 'error');
    } finally { setPickupSaving(false); }
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.client.myRentals({ per_page: '50', page: String(page) });
      setRentals(res.data?.data || res.data || []);
      setLastPage(res.data?.last_page || 1);
      setTotal(res.data?.total || 0);
    } catch (e: any) {
      showToast(e.message || 'Failed to load rentals', 'error');
    } finally { setLoading(false); }
  }, [page]);

  useEffect(() => { load(); }, [load]);

  // Group rentals by bulk_id (same logic as main rentals page)
  const rentalGroups = (() => {
    const result: Array<{ bulkId: string | null; items: any[] }> = [];
    const seen = new Map<string, number>();
    for (const r of rentals) {
      const bid: string | null = r.bulk_id ?? null;
      if (bid && seen.has(bid)) {
        result[seen.get(bid)!].items.push(r);
      } else {
        seen.set(bid!, result.length);
        result.push({ bulkId: bid, items: [r] });
      }
    }
    return result;
  })();

  return (
    <DashboardLayout>
      <PageHeader title="My Rentals" subtitle={`${total} laptop${total !== 1 ? 's' : ''} rented`} />

      <div className="glass-card overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            {[...Array(5)].map((_, i) => <div key={i} className="skeleton h-24 rounded-xl" />)}
          </div>
        ) : rentals.length === 0 ? (
          <EmptyState icon={<FileText size={22} />} title="No rentals found" desc="You have no active or past rentals" />
        ) : (
          <>
            {/* Mobile cards */}
            <div className="sm:hidden divide-y" style={{ borderColor: 'rgba(30,48,88,0.4)' }}>
              {rentalGroups.map(({ bulkId, items }) => (
                <React.Fragment key={bulkId ?? items[0].id}>
                  {bulkId && (
                    <div className="px-4 py-2.5 flex items-center justify-between"
                      style={{ background: 'rgba(139,92,246,0.1)', borderLeft: '3px solid #8B5CF6' }}>
                      <div className="flex items-center gap-2">
                        <Layers size={13} style={{ color: '#8B5CF6' }} />
                        <span className="text-xs font-semibold font-mono" style={{ color: '#8B5CF6' }}>{bulkId}</span>
                        <span className="text-xs" style={{ color: '#64748B' }}>{items.length} laptops</span>
                      </div>
                      <div className="flex gap-1">
                        {items.some(r => r.status === 'active') && (
                          <Button variant="outline" size="sm" icon={<Truck size={12} />}
                            onClick={() => { setPickupForm(EMPTY_SCHED); setPickupModal({ bulkId }); }}>
                            Pickup
                          </Button>
                        )}
                        <Link href={`/rentals/bulk/${encodeURIComponent(bulkId)}`}>
                          <Button variant="ghost" size="sm" icon={<Eye size={12} />}>View All</Button>
                        </Link>
                      </div>
                    </div>
                  )}
                  {items.map(r => (
                    <div key={r.id} className="p-4 space-y-2.5 animate-fade-in"
                      style={bulkId ? { paddingLeft: 20, borderLeft: '3px solid rgba(139,92,246,0.3)' } : {}}>
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-semibold" style={{ color: '#3B82F6' }}>{r.rental_no}</span>
                        <div className="flex items-center gap-1.5">
                          {bulkId && <span className="badge" style={{ background: 'rgba(139,92,246,0.15)', color: '#8B5CF6', border: '1px solid rgba(139,92,246,0.3)' }}>bulk</span>}
                          <span className={`badge badge-${r.status}`}>{r.status}</span>
                        </div>
                      </div>
                      <div>
                        <div className="font-semibold text-sm" style={{ color: '#F1F5F9' }}>
                          {r.inventory?.brand} {r.inventory?.model_no}
                        </div>
                        <div className="text-xs font-mono" style={{ color: '#475569' }}>{r.inventory?.asset_code}</div>
                      </div>
                      <div className="text-xs space-y-0.5" style={{ color: '#64748B' }}>
                        <div>{r.inventory?.cpu}{r.inventory?.generation ? ` · ${r.inventory.generation} Gen` : ''} · {r.inventory?.ram} · {r.inventory?.ssd}</div>
                        <div>From {fmtDate(r.delivery_date || r.start_date)}</div>
                      </div>
                      <div className="flex items-center justify-between pt-1">
                        <div>
                          <div className="text-sm font-bold" style={{ color: '#10B981' }}>{fmt(r.grand_total)}</div>
                          <div className="text-xs" style={{ color: '#475569' }}>GST: {fmt(r.gst_amount)}</div>
                        </div>
                        <div className="flex gap-1">
                          {r.status === 'active' && !bulkId && (
                            <Button variant="outline" size="sm" icon={<Truck size={12} />}
                              onClick={() => { setPickupForm(EMPTY_SCHED); setPickupModal({ rentalId: r.id }); }}>
                              Pickup
                            </Button>
                          )}
                          <Link href={`/rentals/${r.id}`}>
                            <Button variant="ghost" size="sm" icon={<Eye size={13} />}>View</Button>
                          </Link>
                        </div>
                      </div>
                    </div>
                  ))}
                </React.Fragment>
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Rental No</th>
                    <th>Laptop</th>
                    <th>Specs</th>
                    <th>Start Date</th>
                    <th>Billing</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {rentalGroups.map(({ bulkId, items }) => (
                    <React.Fragment key={bulkId ?? items[0].id}>
                      {bulkId && (
                        <tr style={{ background: 'rgba(139,92,246,0.1)' }}>
                          <td colSpan={5} style={{ borderLeft: '3px solid #8B5CF6', padding: '8px 12px' }}>
                            <div className="flex items-center gap-2">
                              <Layers size={13} style={{ color: '#8B5CF6' }} />
                              <span className="font-mono text-xs font-bold" style={{ color: '#8B5CF6' }}>{bulkId}</span>
                              <span className="text-xs" style={{ color: '#64748B' }}>{items.length} laptops</span>
                              <span className="text-xs font-semibold" style={{ color: '#10B981' }}>
                                {fmt(items.reduce((s, r) => s + Number(r.grand_total || 0), 0))} total
                              </span>
                            </div>
                          </td>
                          <td style={{ background: 'rgba(139,92,246,0.1)' }} />
                          <td style={{ background: 'rgba(139,92,246,0.1)', textAlign: 'right', paddingRight: 12 }}>
                            <div className="flex gap-1 justify-end">
                              {items.some(r => r.status === 'active') && (
                                <Button variant="outline" size="sm" icon={<Truck size={12} />}
                                  onClick={() => { setPickupForm(EMPTY_SCHED); setPickupModal({ bulkId }); }}>
                                  Pickup
                                </Button>
                              )}
                              <Link href={`/rentals/bulk/${encodeURIComponent(bulkId)}`}>
                                <Button variant="ghost" size="sm" icon={<Eye size={13} />}>View All</Button>
                              </Link>
                            </div>
                          </td>
                        </tr>
                      )}
                      {items.map(r => (
                        <tr key={r.id} className="animate-fade-in"
                          style={bulkId ? { borderLeft: '3px solid rgba(139,92,246,0.3)' } : {}}>
                          <td style={bulkId ? { paddingLeft: 20 } : {}}>
                            <div className="flex items-center gap-1.5">
                              {bulkId && <span className="badge" style={{ background: 'rgba(139,92,246,0.15)', color: '#8B5CF6', border: '1px solid rgba(139,92,246,0.3)', fontSize: 10 }}>bulk</span>}
                              <span className="font-mono text-xs font-semibold" style={{ color: '#3B82F6' }}>{r.rental_no}</span>
                            </div>
                          </td>
                          <td>
                            <div className="font-medium text-sm" style={{ color: '#F1F5F9' }}>
                              {r.inventory?.brand} {r.inventory?.model_no}
                            </div>
                            <div className="text-xs font-mono" style={{ color: '#475569' }}>{r.inventory?.asset_code}</div>
                          </td>
                          <td>
                            <div className="text-xs space-y-0.5">
                              <div className="flex items-center gap-1">
                                <Cpu size={11} style={{ color: '#475569' }} />
                                <span style={{ color: '#94A3B8' }}>{r.inventory?.cpu}{r.inventory?.generation ? ` · ${r.inventory.generation} Gen` : ''}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="flex items-center gap-1">
                                  <Database size={11} style={{ color: '#475569' }} />
                                  <span style={{ color: '#64748B' }}>{r.inventory?.ram}</span>
                                </span>
                                <span className="flex items-center gap-1">
                                  <HardDrive size={11} style={{ color: '#475569' }} />
                                  <span style={{ color: '#64748B' }}>{r.inventory?.ssd}</span>
                                </span>
                              </div>
                            </div>
                          </td>
                          <td>
                            <div className="flex items-center gap-1.5 text-xs" style={{ color: '#94A3B8' }}>
                              <Calendar size={12} />
                              {fmtDate(r.delivery_date || r.start_date)}
                            </div>
                          </td>
                          <td>
                            <div className="font-semibold text-sm" style={{ color: '#10B981' }}>{fmt(r.grand_total)}</div>
                            <div className="text-xs" style={{ color: '#475569' }}>GST: {fmt(r.gst_amount)}</div>
                          </td>
                          <td><span className={`badge badge-${r.status}`}>{r.status}</span></td>
                          <td>
                            <div className="flex gap-1">
                              {r.status === 'active' && !bulkId && (
                                <Button variant="outline" size="sm" icon={<Truck size={12} />}
                                  onClick={() => { setPickupForm(EMPTY_SCHED); setPickupModal({ rentalId: r.id }); }}>
                                  Pickup
                                </Button>
                              )}
                              <Link href={`/rentals/${r.id}`}>
                                <Button variant="ghost" size="sm" icon={<Eye size={13} />}>View</Button>
                              </Link>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {lastPage > 1 && (
          <div className="flex items-center justify-between px-6 py-4" style={{ borderTop: '1px solid #1E3058' }}>
            <span className="text-xs" style={{ color: '#475569' }}>Page {page} of {lastPage}</span>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Prev</Button>
              <Button variant="ghost" size="sm" disabled={page >= lastPage} onClick={() => setPage(p => p + 1)}>Next</Button>
            </div>
          </div>
        )}
      </div>

      {/* Schedule Pickup Modal */}
      <Modal open={!!pickupModal} onClose={() => setPickupModal(null)} title="Schedule Pickup" width="max-w-lg">
        <p className="text-xs mb-4" style={{ color: '#64748B' }}>
          Request a pickup for your laptop{pickupModal?.bulkId ? 's (all laptops in this bulk group)' : ''}. Our team will contact you to confirm.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <FormField label="Pickup Address" required>
              <input className="inp" value={pickupForm.address}
                onChange={e => setPickupForm(p => ({ ...p, address: e.target.value }))}
                placeholder="123, MG Road, Pune - 411001" />
            </FormField>
          </div>
          <FormField label="Preferred Date & Time" required>
            <input className="inp" type="datetime-local" value={pickupForm.scheduled_at}
              onChange={e => setPickupForm(p => ({ ...p, scheduled_at: e.target.value }))} />
          </FormField>
          <FormField label="Contact Name">
            <input className="inp" value={pickupForm.contact_name}
              onChange={e => setPickupForm(p => ({ ...p, contact_name: e.target.value }))}
              placeholder="Rahul Sharma" />
          </FormField>
          <FormField label="Contact Phone">
            <input className="inp" value={pickupForm.contact_phone}
              onChange={e => setPickupForm(p => ({ ...p, contact_phone: e.target.value }))}
              placeholder="9876543210" />
          </FormField>
          <div className="sm:col-span-2">
            <FormField label="Notes">
              <textarea className="inp resize-none" rows={2} value={pickupForm.notes}
                onChange={e => setPickupForm(p => ({ ...p, notes: e.target.value }))}
                placeholder="Please call before coming..." />
            </FormField>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="ghost" onClick={() => setPickupModal(null)}>Cancel</Button>
          <Button icon={<Truck size={14} />} loading={pickupSaving}
            disabled={!pickupForm.address || !pickupForm.scheduled_at}
            onClick={handleSchedulePickup}>
            Request Pickup
          </Button>
        </div>
      </Modal>

      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </DashboardLayout>
  );
}
