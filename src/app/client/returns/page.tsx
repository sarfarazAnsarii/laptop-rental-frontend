'use client';

import { useEffect, useState, useCallback } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button, Modal, FormField, PageHeader, EmptyState, Toast } from '@/components/ui';
import { api } from '@/lib/api';
import {
  RotateCcw, Truck, Calendar, CheckCircle, Clock, XCircle,
  MapPin, Monitor, Layers, FileText,
} from 'lucide-react';
import Link from 'next/link';

const fmtDate = (d?: string) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const fmtDateTime = (d?: string) =>
  d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
const fmt = (n: any) => '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });

const SCHED_META: Record<string, { color: string; icon: any; label: string }> = {
  scheduled: { color: '#F59E0B', icon: Clock,        label: 'Pending'   },
  completed: { color: '#10B981', icon: CheckCircle,  label: 'Completed' },
  cancelled: { color: '#64748B', icon: XCircle,      label: 'Cancelled' },
};

const EMPTY_FORM = { address: '', scheduled_at: '', contact_name: '', contact_phone: '', notes: '', employee_name: '', employee_number: '', employee_address: '' };

export default function ClientReturnsPage() {
  const [activeRentals,  setActiveRentals]  = useState<any[]>([]);
  const [pickupSchedules, setPickupSchedules] = useState<any[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [schedsLoading,  setSchedsLoading]  = useState(true);

  const [pickupModal,  setPickupModal]  = useState<{ rentalId?: number; bulkId?: string } | null>(null);
  const [pickupForm,   setPickupForm]   = useState({ ...EMPTY_FORM });
  const [pickupSaving, setPickupSaving] = useState(false);

  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const loadRentals = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.client.myRentals({ status: 'active', per_page: '100' });
      setActiveRentals(res.data?.data || res.data || []);
    } finally { setLoading(false); }
  }, []);

  const loadSchedules = useCallback(async () => {
    setSchedsLoading(true);
    try {
      const res = await api.client.mySchedules({ type: 'pickup', per_page: '50' });
      setPickupSchedules(res.data?.data || res.data || []);
    } finally { setSchedsLoading(false); }
  }, []);

  useEffect(() => { loadRentals(); loadSchedules(); }, [loadRentals, loadSchedules]);

  async function handleSchedulePickup() {
    if (!pickupModal) return;
    setPickupSaving(true);
    try {
      if (pickupModal.bulkId) {
        await api.rentals.bulkSchedules.schedulePickup(pickupModal.bulkId, pickupForm);
      } else {
        await api.rentals.schedules.schedulePickup(pickupModal.rentalId!, pickupForm);
      }
      showToast('Return pickup scheduled — our team will contact you shortly');
      setPickupModal(null);
      setPickupForm({ ...EMPTY_FORM });
      loadSchedules();
    } catch (e: any) {
      showToast(e.message || 'Failed to schedule pickup', 'error');
    } finally { setPickupSaving(false); }
  }

  // Group active rentals by bulk_id
  const groups: Array<{ bulkId: string | null; items: any[] }> = [];
  const seenBulk = new Map<string, number>();
  for (const r of activeRentals) {
    const bid: string | null = r.bulk_id ?? null;
    if (bid && seenBulk.has(bid)) {
      groups[seenBulk.get(bid)!].items.push(r);
    } else {
      seenBulk.set(bid!, groups.length);
      groups.push({ bulkId: bid, items: [r] });
    }
  }

  const pendingCount = pickupSchedules.filter(s => s.status === 'scheduled').length;

  return (
    <DashboardLayout>
      <PageHeader
        title="Returns"
        subtitle={`${activeRentals.length} active rental${activeRentals.length !== 1 ? 's' : ''} · ${pendingCount} pending pickup${pendingCount !== 1 ? 's' : ''}`}
      />

      {/* ── Active Rentals – Request Return ── */}
      <div className="mb-2 flex items-center gap-2">
        <RotateCcw size={14} style={{ color: '#475569' }} />
        <span className="text-xs font-bold uppercase tracking-widest" style={{ color: '#475569' }}>
          Request a Return
        </span>
      </div>

      <div className="glass-card overflow-hidden mb-6">
        {loading ? (
          <div className="p-6 space-y-3">
            {[...Array(3)].map((_, i) => <div key={i} className="skeleton h-20 rounded-xl" />)}
          </div>
        ) : activeRentals.length === 0 ? (
          <EmptyState
            icon={<Monitor size={22} />}
            title="No active rentals"
            desc="You have no laptops currently on rent"
          />
        ) : (
          <div className="divide-y" style={{ borderColor: 'rgba(30,48,88,0.4)' }}>
            {groups.map(({ bulkId, items }) => (
              <div key={bulkId ?? items[0].id}>
                {/* Bulk group header */}
                {bulkId && (
                  <div className="px-4 py-3 flex items-center justify-between"
                    style={{ background: 'rgba(139,92,246,0.08)', borderLeft: '3px solid #8B5CF6' }}>
                    <div className="flex items-center gap-2">
                      <Layers size={13} style={{ color: '#8B5CF6' }} />
                      <span className="text-xs font-semibold font-mono" style={{ color: '#8B5CF6' }}>{bulkId}</span>
                      <span className="text-xs" style={{ color: '#64748B' }}>{items.length} laptops</span>
                    </div>
                    <Button variant="outline" size="sm" icon={<Truck size={12} />}
                      onClick={() => { setPickupForm({ ...EMPTY_FORM }); setPickupModal({ bulkId }); }}>
                      Request Return (All)
                    </Button>
                  </div>
                )}

                {/* Individual rental rows */}
                {items.map(r => (
                  <div key={r.id} className="flex items-center gap-4 px-4 py-4"
                    style={bulkId ? { paddingLeft: 24, borderLeft: '3px solid rgba(139,92,246,0.3)' } : {}}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-mono text-xs font-semibold" style={{ color: '#3B82F6' }}>{r.rental_no}</span>
                        <span className="badge badge-active">active</span>
                        {r.bulk_id && (
                          <span className="badge text-[10px]" style={{ background: 'rgba(139,92,246,0.12)', color: '#8B5CF6', border: '1px solid rgba(139,92,246,0.3)' }}>bulk</span>
                        )}
                      </div>
                      <div className="text-sm font-semibold">
                        {r.inventory?.brand} {r.inventory?.model_no}
                        <span className="ml-2 font-mono text-xs font-normal" style={{ color: '#475569' }}>{r.inventory?.asset_code}</span>
                      </div>
                      <div className="text-xs mt-0.5" style={{ color: '#64748B' }}>
                        {r.inventory?.cpu}{r.inventory?.generation ? ` · ${r.inventory.generation} Gen` : ''} · {r.inventory?.ram} · {r.inventory?.ssd}
                      </div>
                      <div className="flex items-center gap-1.5 mt-1 text-xs" style={{ color: '#64748B' }}>
                        <Calendar size={11} />
                        <span>Rented from {fmtDate(r.delivery_date || r.start_date)}</span>
                        <span style={{ color: '#334155' }}>·</span>
                        <span style={{ color: '#10B981' }}>{fmt(r.grand_total)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {!bulkId && (
                        <Button variant="outline" size="sm" icon={<Truck size={12} />}
                          onClick={() => { setPickupForm({ ...EMPTY_FORM }); setPickupModal({ rentalId: r.id }); }}>
                          <span className="hidden sm:inline">Request Return</span>
                          <span className="sm:hidden">Return</span>
                        </Button>
                      )}
                      <Link href={`/rentals/${r.id}`}>
                        <Button variant="ghost" size="sm" icon={<FileText size={12} />} />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Return History ── */}
      <div className="mb-2 flex items-center gap-2">
        <Clock size={14} style={{ color: '#475569' }} />
        <span className="text-xs font-bold uppercase tracking-widest" style={{ color: '#475569' }}>
          Return Pickup History
        </span>
      </div>

      <div className="glass-card overflow-hidden">
        {schedsLoading ? (
          <div className="p-6 space-y-3">
            {[...Array(3)].map((_, i) => <div key={i} className="skeleton h-16 rounded-xl" />)}
          </div>
        ) : pickupSchedules.length === 0 ? (
          <EmptyState icon={<RotateCcw size={22} />} title="No return pickups yet" desc="Your return requests will appear here" />
        ) : (
          <div className="divide-y" style={{ borderColor: 'rgba(30,48,88,0.4)' }}>
            {pickupSchedules.map(s => {
              const sm = SCHED_META[s.status] ?? SCHED_META.scheduled;
              const StatusIcon = sm.icon;
              return (
                <div key={s.id} className="px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                        style={{ background: `${sm.color}14`, border: `1px solid ${sm.color}30` }}>
                        <StatusIcon size={14} style={{ color: sm.color }} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-xs font-semibold" style={{ color: sm.color }}>{sm.label}</span>
                          {s.rental?.rental_no && (
                            <span className="font-mono text-xs" style={{ color: '#475569' }}>
                              {s.rental.rental_no}
                            </span>
                          )}
                        </div>
                        {s.address && (
                          <div className="flex items-start gap-1 text-xs" style={{ color: '#94A3B8' }}>
                            <MapPin size={11} className="flex-shrink-0 mt-0.5" />
                            <span className="truncate">{s.address}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1 text-xs mt-0.5" style={{ color: '#64748B' }}>
                          <Calendar size={11} />
                          <span>Scheduled: {fmtDateTime(s.scheduled_at)}</span>
                        </div>
                        {s.completed_at && (
                          <div className="text-xs mt-0.5" style={{ color: '#10B981' }}>
                            Completed: {fmtDateTime(s.completed_at)}
                          </div>
                        )}
                        {s.notes && (
                          <div className="text-xs mt-1 italic" style={{ color: '#475569' }}>{s.notes}</div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Schedule Pickup Modal */}
      <Modal open={!!pickupModal} onClose={() => setPickupModal(null)} title="Request Return Pickup" width="max-w-lg">
        <p className="text-xs mb-4" style={{ color: '#64748B' }}>
          {pickupModal?.bulkId
            ? 'All laptops in this bulk group will be picked up together.'
            : 'Our team will contact you to confirm the pickup date and time.'}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <FormField label="Pickup Address" required>
              <input className="inp" value={pickupForm.address}
                onChange={e => setPickupForm(p => ({ ...p, address: e.target.value }))}
                placeholder="Full address with pincode" />
            </FormField>
          </div>
          <FormField label="Preferred Date & Time" required>
            <input className="inp" type="datetime-local" value={pickupForm.scheduled_at}
              onChange={e => setPickupForm(p => ({ ...p, scheduled_at: e.target.value }))} />
          </FormField>
          <FormField label="Contact Name">
            <input className="inp" value={pickupForm.contact_name}
              onChange={e => setPickupForm(p => ({ ...p, contact_name: e.target.value }))}
              placeholder="Contact person at address" />
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
                placeholder="Any special instructions..." />
            </FormField>
          </div>
          <div className="sm:col-span-2 pt-1">
            <div className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: '#475569' }}>Employee Details</div>
          </div>
          <FormField label="Employee Name">
            <input className="inp" value={pickupForm.employee_name}
              onChange={e => setPickupForm(p => ({ ...p, employee_name: e.target.value }))}
              placeholder="Employee full name" />
          </FormField>
          <FormField label="Employee Contact Number">
            <input className="inp" value={pickupForm.employee_number}
              onChange={e => setPickupForm(p => ({ ...p, employee_number: e.target.value }))}
              placeholder="9876543210" />
          </FormField>
          <div className="sm:col-span-2">
            <FormField label="Employee Address">
              <textarea className="inp resize-none" rows={2} value={pickupForm.employee_address}
                onChange={e => setPickupForm(p => ({ ...p, employee_address: e.target.value }))}
                placeholder="Employee location / address" />
            </FormField>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="ghost" onClick={() => setPickupModal(null)}>Cancel</Button>
          <Button icon={<Truck size={14} />} loading={pickupSaving}
            disabled={!pickupForm.address || !pickupForm.scheduled_at}
            onClick={handleSchedulePickup}>
            Submit Return Request
          </Button>
        </div>
      </Modal>

      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </DashboardLayout>
  );
}
