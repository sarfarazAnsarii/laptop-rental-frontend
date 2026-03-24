'use client';

import { ReactNode, useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button, Modal, Toast } from '@/components/ui';
import { api } from '@/lib/api';
import { Rental } from '@/types';
import {
  ArrowLeft, FileText, Monitor, User, Calendar,
  CheckCircle, XCircle, Clock, Hash, Building2,
  Mail, Phone, ChevronRight, AlertTriangle,
  ReceiptText, Percent, Package, SendHorizonal, Printer,
  Truck, MapPin, Contact, Plus,
} from 'lucide-react';
import { FormField } from '@/components/ui';
import { useAuth } from '@/lib/auth-context';

const fmt = (n: number) => '₹' + new Intl.NumberFormat('en-IN').format(Number(n));
const fmtDate = (d?: string) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const STATUS_META: Record<string, { bg: string; border: string; text: string; Icon: any }> = {
  active:    { bg: 'rgba(16,185,129,0.10)',  border: 'rgba(16,185,129,0.30)',  text: '#10B981', Icon: CheckCircle  },
  completed: { bg: 'rgba(59,130,246,0.10)',  border: 'rgba(59,130,246,0.30)',  text: '#3B82F6', Icon: CheckCircle  },
  cancelled: { bg: 'rgba(100,116,139,0.10)', border: 'rgba(100,116,139,0.30)', text: '#94A3B8', Icon: XCircle      },
  overdue:   { bg: 'rgba(244,63,94,0.10)',   border: 'rgba(244,63,94,0.30)',   text: '#F43F5E', Icon: AlertTriangle },
};

function InfoRow({ icon, label, value, accent }: { icon: ReactNode; label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 flex-shrink-0" style={{ color: '#475569' }}>{icon}</span>
      <div>
        <div className="text-xs mb-0.5" style={{ color: '#475569' }}>{label}</div>
        <div className="text-sm font-medium" style={{ color: accent ? '#3B82F6' : '#F1F5F9' }}>{value}</div>
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: '#475569', fontFamily: 'Syne, sans-serif' }}>
      {children}
    </h2>
  );
}

function BillingRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2.5" style={{ borderBottom: '1px solid rgba(30,48,88,0.6)' }}>
      <span className="text-sm" style={{ color: highlight ? '#F1F5F9' : '#64748B' }}>{label}</span>
      <span className="text-sm font-semibold" style={{ color: highlight ? '#10B981' : '#94A3B8' }}>{value}</span>
    </div>
  );
}

export default function RentalDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = Number(params.id);

  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const isAdminOrStaff = user?.role === 'admin' || user?.role === 'staff';
  const isClient = user?.role === 'client';

  const [rental, setRental] = useState<Rental | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<'complete' | 'cancel' | 'invoice' | 'advance' | null>(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showAdvanceModal, setShowAdvanceModal] = useState(false);

  // Schedules
  const [schedules, setSchedules] = useState<any[]>([]);
  const [scheduleModal, setScheduleModal] = useState<'pickup' | 'delivery' | null>(null);
  const [schedForm, setSchedForm] = useState({ address: '', scheduled_at: '', contact_name: '', contact_phone: '', notes: '', assigned_to: '' });
  const [staffUsers, setStaffUsers] = useState<any[]>([]);
  const [schedSaving, setSchedSaving] = useState(false);
  const [completeModal, setCompleteModal] = useState<any | null>(null);
  const [completeNote, setCompleteNote] = useState('');

  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rentalRes, schedRes] = await Promise.all([
        api.rentals.get(id),
        api.rentals.schedules.list(id).catch(() => ({ data: [] })),
      ]);
      setRental(rentalRes.data);
      setSchedules(schedRes.data || []);
    } catch {
      router.push('/rentals');
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  // Load staff/admin users for delivery assignment
  useEffect(() => {
    if (!isAdminOrStaff) return;
    api.users.list({ role: 'staff', per_page: '100' })
      .then(res => {
        const staff = res.data?.data || res.data || [];
        api.users.list({ role: 'admin', per_page: '100' })
          .then(res2 => setStaffUsers([...staff, ...(res2.data?.data || res2.data || [])]))
          .catch(() => setStaffUsers(staff));
      })
      .catch(() => {});
  }, [isAdminOrStaff]);

  useEffect(() => { load(); }, [load]);

  const sf = (k: string, v: string) => setSchedForm(p => ({ ...p, [k]: v }));

  const EMPTY_SCHED = { address: '', scheduled_at: '', contact_name: '', contact_phone: '', notes: '', assigned_to: '' };

  async function handleScheduleSubmit() {
    if (!scheduleModal) return;
    setSchedSaving(true);
    try {
      const payload: any = { ...schedForm };
      if (scheduleModal === 'delivery' && schedForm.assigned_to) payload.assigned_to = Number(schedForm.assigned_to);
      if (scheduleModal === 'pickup') {
        await api.rentals.schedules.schedulePickup(id, payload);
        showToast('Pickup scheduled — admin team notified');
      } else {
        await api.rentals.schedules.scheduleDelivery(id, payload);
        showToast('Delivery scheduled and staff assigned');
      }
      setScheduleModal(null);
      setSchedForm(EMPTY_SCHED);
      load();
    } catch (e: any) {
      showToast(e.message || 'Failed to schedule', 'error');
    } finally { setSchedSaving(false); }
  }

  async function handleCompleteSchedule() {
    if (!completeModal) return;
    setSchedSaving(true);
    try {
      await api.schedules.complete(completeModal.id, completeNote);
      showToast('Marked as completed');
      setCompleteModal(null);
      setCompleteNote('');
      load();
    } catch (e: any) {
      showToast(e.message || 'Failed', 'error');
    } finally { setSchedSaving(false); }
  }

  async function handleCancelSchedule(scheduleId: number) {
    if (!confirm('Cancel this schedule?')) return;
    try {
      await api.schedules.cancel(scheduleId);
      showToast('Schedule cancelled');
      load();
    } catch (e: any) { showToast(e.message || 'Failed', 'error'); }
  }

  async function handleComplete() {
    if (!confirm('Mark this rental as completed?')) return;
    setActing('complete');
    try {
      await api.rentals.complete(id);
      showToast('Rental marked as completed');
      load();
    } catch (e: any) {
      showToast(e.message || 'Failed', 'error');
    } finally { setActing(null); }
  }

  async function handleCancel() {
    if (!confirm('Cancel this rental? This cannot be undone.')) return;
    setActing('cancel');
    try {
      await api.rentals.cancel(id);
      showToast('Rental cancelled');
      load();
    } catch (e: any) {
      showToast(e.message || 'Failed', 'error');
    } finally { setActing(null); }
  }

  async function handleSendInvoice() {
    if (!rental?.client?.email) { showToast('No client email on this rental', 'error'); return; }
    setShowInvoiceModal(true);
  }

  async function confirmAdvanceInvoice() {
    setActing('advance');
    try {
      await api.rentals.sendAdvanceInvoice(id, 30);
      showToast(`Advance invoice (30 days) sent to ${rental!.client!.email}`);
      setShowAdvanceModal(false);
    } catch (e: any) {
      showToast(e.message || 'Failed to send advance invoice', 'error');
    } finally { setActing(null); }
  }

  async function confirmSendInvoice() {
    setActing('invoice');
    try {
      await api.rentals.sendInvoice(id);
      showToast(`Invoice sent to ${rental!.client!.email}`);
      setShowInvoiceModal(false);
    } catch (e: any) {
      showToast(e.message || 'Failed to send invoice', 'error');
    } finally { setActing(null); }
  }

  /* Loading skeleton */
  if (loading) return (
    <DashboardLayout>
      <div className="space-y-5">
        <div className="skeleton h-8 w-44 rounded-xl" />
        <div className="skeleton h-36 rounded-2xl" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 skeleton h-52 rounded-2xl" />
          <div className="skeleton h-52 rounded-2xl" />
        </div>
        <div className="skeleton h-40 rounded-2xl" />
      </div>
    </DashboardLayout>
  );

  if (!rental) return null;

  const sm = STATUS_META[rental.status] ?? STATUS_META.active;
  const { Icon: StatusIcon } = sm;

  return (
    <DashboardLayout>
      <div className="animate-fade-in space-y-5">

        {/* Breadcrumb */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2 text-sm" style={{ color: '#475569' }}>
            <Link href="/rentals" className="hover:text-blue-400 transition-colors">Rentals</Link>
            <ChevronRight size={13} />
            <span className="font-mono" style={{ color: '#94A3B8' }}>{rental.rental_no}</span>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Link href="/rentals">
              <Button variant="ghost" size="sm" icon={<ArrowLeft size={14} />}>Back</Button>
            </Link>
            <Link href={`/rentals/${id}/invoice`} target="_blank">
              <Button variant="outline" size="sm" icon={<Printer size={13} />}>View Invoice</Button>
            </Link>
            {isAdmin && (
              <>
                <Button
                  variant="outline" size="sm"
                  icon={<SendHorizonal size={13} />}
                  loading={acting === 'invoice'}
                  onClick={handleSendInvoice}
                >
                  Send Invoice
                </Button>
                <Button
                  variant="outline" size="sm"
                  icon={<SendHorizonal size={13} />}
                  loading={acting === 'advance'}
                  onClick={() => setShowAdvanceModal(true)}
                  style={{ borderColor: 'rgba(245,158,11,0.4)', color: '#F59E0B' }}
                >
                  Advance Payment
                </Button>
              </>
            )}
            {isAdmin && rental.status === 'active' && (
              <>
                <Button
                  variant="success" size="sm"
                  icon={<CheckCircle size={13} />}
                  loading={acting === 'complete'}
                  onClick={handleComplete}
                >
                  Complete
                </Button>
                <Button
                  variant="danger" size="sm"
                  icon={<XCircle size={13} />}
                  loading={acting === 'cancel'}
                  onClick={handleCancel}
                >
                  Cancel
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Hero */}
        <div className="glass-card p-6" style={{
          background: 'linear-gradient(135deg, rgba(13,27,46,0.95) 0%, rgba(17,34,62,0.95) 100%)',
          borderColor: '#1E3058',
        }}>
          <div className="flex items-start gap-5 flex-wrap">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #3B82F6, #14B8A6)', boxShadow: '0 0 30px rgba(59,130,246,0.25)' }}>
              <FileText size={28} color="white" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className="font-mono text-sm px-2.5 py-1 rounded-lg font-semibold"
                      style={{ background: 'rgba(59,130,246,0.15)', color: '#3B82F6', border: '1px solid rgba(59,130,246,0.3)' }}>
                      {rental.rental_no}
                    </span>
                    <span className={`badge badge-${rental.status}`}>{rental.status}</span>
                  </div>
                  <h1 className="text-2xl font-bold mb-1"
                    style={{ fontFamily: 'Syne, sans-serif', color: '#F1F5F9' }}>
                    {rental.inventory?.brand} {rental.inventory?.model_no}
                  </h1>
                  <p className="text-xs font-mono" style={{ color: '#475569' }}>
                    {rental.inventory?.asset_code} &nbsp;·&nbsp; Created {fmtDate(rental.created_at)}
                  </p>
                </div>

                {/* Status pill */}
                <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl flex-shrink-0"
                  style={{ background: sm.bg, border: `1px solid ${sm.border}` }}>
                  <StatusIcon size={15} style={{ color: sm.text }} />
                  <span className="text-sm font-semibold capitalize" style={{ color: sm.text }}>
                    {rental.status}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Details grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* Left: Laptop + Client */}
          <div className="lg:col-span-2 space-y-5">

            {/* Laptop Info */}
            <div className="glass-card p-5">
              <SectionTitle>Laptop Details</SectionTitle>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InfoRow icon={<Monitor size={13} />}  label="Brand & Model" value={`${rental.inventory?.brand || '—'} ${rental.inventory?.model_no || ''}`} />
                <InfoRow icon={<Hash size={13} />}     label="Asset Code"   value={rental.inventory?.asset_code || '—'} accent />
                <InfoRow icon={<Package size={13} />}  label="Quantity"     value={String(rental.quantity)} />
                <InfoRow icon={<FileText size={13} />} label="Type"         value={rental.inventory?.type || '—'} />
              </div>
              {rental.inventory && (
                <div className="mt-4 pt-4" style={{ borderTop: '1px solid #1E3058' }}>
                  <Link href={`/inventory/${rental.inventory_id}`}>
                    <Button variant="outline" size="sm">View Laptop →</Button>
                  </Link>
                </div>
              )}
            </div>

            {/* Client Info */}
            <div className="glass-card p-5">
              <SectionTitle>Client Details</SectionTitle>
              {rental.client ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <InfoRow icon={<User size={13} />}      label="Name"    value={rental.client.name} />
                  <InfoRow icon={<Mail size={13} />}      label="Email"   value={rental.client.email} />
                  {rental.client.phone   && <InfoRow icon={<Phone size={13} />}     label="Phone"   value={rental.client.phone} />}
                  {rental.client.company && <InfoRow icon={<Building2 size={13} />} label="Company" value={rental.client.company} />}
                  <InfoRow icon={<Hash size={13} />}      label="Client ID" value={`#${rental.client_id}`} />
                </div>
              ) : (
                <p className="text-sm" style={{ color: '#475569' }}>Client #{rental.client_id}</p>
              )}
            </div>

            {/* Remarks */}
            {rental.remarks && (
              <div className="glass-card p-5">
                <SectionTitle>Remarks</SectionTitle>
                <p className="text-sm leading-relaxed" style={{ color: '#94A3B8' }}>{rental.remarks}</p>
              </div>
            )}
          </div>

          {/* Right: Duration + Billing */}
          <div className="space-y-5">

            {/* Duration */}
            <div className="glass-card p-5">
              <SectionTitle>Rental started</SectionTitle>
              <div className="space-y-3.5">
                <InfoRow icon={<Calendar size={13} />} label="Start Date" value={fmtDate(rental.start_date)} />
                {/* <InfoRow icon={<Calendar size={13} />} label="End Date"   value={fmtDate(rental.end_date)} />
                <div className="flex items-center gap-2.5 pt-1">
                  <span style={{ color: '#475569' }}><Clock size={13} /></span>
                  <div>
                    <div className="text-xs mb-0.5" style={{ color: '#475569' }}>Duration</div>
                    <div className="text-lg font-bold" style={{ color: '#3B82F6' }}>{rental.duration_days} days</div>
                  </div>
                </div> */}
              </div>
            </div>

            {/* Billing Breakdown */}
            <div className="glass-card p-5">
              <SectionTitle>Billing Breakdown</SectionTitle>
              <div>
                <BillingRow label="Monthly Rental"    value={fmt(rental.monthly_rental)} />
                <BillingRow label="Pro-rated Amount"  value={fmt(rental.pro_rental)} />
                <BillingRow label={`Qty × Pro Rental`} value={fmt(rental.total)} />
                <BillingRow label={`GST (${rental.gst_percent}%)`} value={fmt(rental.gst_amount)} />
              </div>
              <div className="mt-4 p-4 rounded-xl flex items-center justify-between"
                style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
                <div className="flex items-center gap-2">
                  <ReceiptText size={16} style={{ color: '#10B981' }} />
                  <span className="text-sm font-semibold" style={{ color: '#F1F5F9' }}>Grand Total</span>
                </div>
                <span className="text-xl font-bold" style={{ color: '#10B981' }}>{fmt(rental.grand_total)}</span>
              </div>
            </div>

          </div>
        </div>

        {/* ── Schedule Pickup & Delivery ── */}
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <SectionTitle>Pickup &amp; Delivery Schedules</SectionTitle>
            <div className="flex gap-2">
              {isAdminOrStaff && (
                <Button size="sm" variant="outline" icon={<Truck size={13} />}
                  onClick={() => { setSchedForm(EMPTY_SCHED); setScheduleModal('delivery'); }}>
                  Schedule Delivery
                </Button>
              )}
              {(isAdminOrStaff || isClient) && (
                <Button size="sm" variant="outline" icon={<Plus size={13} />}
                  onClick={() => { setSchedForm(EMPTY_SCHED); setScheduleModal('pickup'); }}>
                  Schedule Pickup
                </Button>
              )}
            </div>
          </div>

          {schedules.length === 0 ? (
            <p className="text-sm" style={{ color: '#475569' }}>No schedules yet.</p>
          ) : (
            <div className="space-y-3">
              {schedules.map((s: any) => {
                const isPickup = s.type === 'pickup';
                const color = isPickup ? '#F59E0B' : '#3B82F6';
                const bgColor = isPickup ? 'rgba(245,158,11,0.07)' : 'rgba(59,130,246,0.07)';
                const borderColor = isPickup ? 'rgba(245,158,11,0.2)' : 'rgba(59,130,246,0.2)';
                return (
                  <div key={s.id} className="p-4 rounded-xl" style={{ background: bgColor, border: `1px solid ${borderColor}` }}>
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-2">
                        <Truck size={14} style={{ color }} />
                        <span className="text-sm font-semibold capitalize" style={{ color }}>{s.type}</span>
                        <span className={`badge badge-${s.status}`}>{s.status}</span>
                      </div>
                      {(user?.role === 'admin' || user?.role === 'staff') && s.status === 'scheduled' && (
                        <div className="flex gap-1">
                          <Button size="sm" variant="success" icon={<CheckCircle size={12} />}
                            onClick={() => { setCompleteModal(s); setCompleteNote(''); }}>
                            Complete
                          </Button>
                          <Button size="sm" variant="danger" icon={<XCircle size={12} />}
                            onClick={() => handleCancelSchedule(s.id)}>
                            Cancel
                          </Button>
                        </div>
                      )}
                    </div>
                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      <div className="flex items-start gap-1.5">
                        <MapPin size={11} style={{ color: '#475569', marginTop: 2, flexShrink: 0 }} />
                        <span style={{ color: '#94A3B8' }}>{s.address}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Calendar size={11} style={{ color: '#475569' }} />
                        <span style={{ color: '#94A3B8' }}>
                          {new Date(s.scheduled_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      {s.assigned_to && (
                        <div className="flex items-center gap-1.5">
                          <User size={11} style={{ color: '#3B82F6' }} />
                          <span style={{ color: '#3B82F6' }}>Assigned: {s.assigned_to?.name ?? s.assigned_to}</span>
                        </div>
                      )}
                      {s.contact_name && (
                        <div className="flex items-center gap-1.5">
                          <Contact size={11} style={{ color: '#475569' }} />
                          <span style={{ color: '#94A3B8' }}>{s.contact_name}{s.contact_phone ? ` · ${s.contact_phone}` : ''}</span>
                        </div>
                      )}
                      {s.notes && (
                        <div className="flex items-start gap-1.5 sm:col-span-2">
                          <FileText size={11} style={{ color: '#475569', marginTop: 2, flexShrink: 0 }} />
                          <span style={{ color: '#64748B' }}>{s.notes}</span>
                        </div>
                      )}
                      {s.completed_at && (
                        <div className="flex items-center gap-1.5">
                          <CheckCircle size={11} style={{ color: '#10B981' }} />
                          <span style={{ color: '#10B981' }}>Completed: {new Date(s.completed_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>

      {/* Invoice Confirmation Modal */}
      <Modal open={showInvoiceModal} onClose={() => setShowInvoiceModal(false)} title="Send Invoice" width="max-w-md">
        {rental && (
          <div className="space-y-4">
            {/* To */}
            <div className="p-3 rounded-xl flex items-center gap-3" style={{ background: 'rgba(59,130,246,0.07)', border: '1px solid rgba(59,130,246,0.18)' }}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'linear-gradient(135deg,#3B82F6,#14B8A6)', color: 'white', fontWeight: 700, fontSize: 15 }}>
                {rental.client?.name?.charAt(0)?.toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold truncate" style={{ color: '#F1F5F9' }}>{rental.client?.name}</div>
                <div className="text-xs truncate" style={{ color: '#3B82F6' }}>{rental.client?.email}</div>
                {rental.client?.company && <div className="text-xs truncate" style={{ color: '#475569' }}>{rental.client.company}</div>}
              </div>
            </div>

            {/* Rental details */}
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #1E3058' }}>
              <div className="px-4 py-2.5 text-xs font-bold uppercase tracking-widest" style={{ background: 'rgba(30,48,88,0.5)', color: '#475569' }}>
                Rental Details
              </div>
              <div className="divide-y" style={{ borderColor: 'rgba(30,48,88,0.6)' }}>
                {[
                  ['Rental No',   rental.rental_no],
                  ['Laptop',      `${rental.inventory?.brand || ''} ${rental.inventory?.model_no || ''}`],
                  ['Asset Code',  rental.inventory?.asset_code || '—'],
                  ['Start Date',  fmtDate(rental.start_date)],
                  ['End Date',    fmtDate(rental.end_date)],
                  ['Duration',    `${rental.duration_days} days`],
                  ['Quantity',    String(rental.quantity)],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between px-4 py-2.5 text-sm">
                    <span style={{ color: '#64748B' }}>{label}</span>
                    <span className="font-medium" style={{ color: '#F1F5F9' }}>{value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Billing summary */}
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #1E3058' }}>
              <div className="px-4 py-2.5 text-xs font-bold uppercase tracking-widest" style={{ background: 'rgba(30,48,88,0.5)', color: '#475569' }}>
                Billing Summary
              </div>
              <div className="divide-y" style={{ borderColor: 'rgba(30,48,88,0.6)' }}>
                {[
                  ['Monthly Rental',              `₹${Number(rental.monthly_rental).toLocaleString('en-IN')}`],
                  ['Pro-rated Amount',             `₹${Number(rental.pro_rental).toLocaleString('en-IN')}`],
                  [`GST (${rental.gst_percent}%)`, `₹${Number(rental.gst_amount).toLocaleString('en-IN')}`],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between px-4 py-2.5 text-sm">
                    <span style={{ color: '#64748B' }}>{label}</span>
                    <span style={{ color: '#94A3B8' }}>{value}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between px-4 py-3"
                  style={{ background: 'rgba(16,185,129,0.07)' }}>
                  <span className="text-sm font-bold" style={{ color: '#F1F5F9' }}>Grand Total</span>
                  <span className="text-lg font-bold" style={{ color: '#10B981' }}>
                    ₹{Number(rental.grand_total).toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
            </div>

            <p className="text-xs text-center" style={{ color: '#475569' }}>
              The invoice will be sent to <span style={{ color: '#3B82F6' }}>{rental.client?.email}</span>
            </p>

            <div className="flex justify-end gap-3 pt-1">
              <Button variant="ghost" onClick={() => setShowInvoiceModal(false)}>Cancel</Button>
              <Button icon={<SendHorizonal size={14} />} loading={acting === 'invoice'} onClick={confirmSendInvoice}>
                Send Invoice
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Advance Payment Modal */}
      <Modal open={showAdvanceModal} onClose={() => setShowAdvanceModal(false)} title="Send Advance Payment Invoice" width="max-w-md">
        {rental && (() => {
          const monthly   = Number(rental.monthly_rental) || 0;
          const qty       = Number(rental.quantity) || 1;
          const gstPct    = Number(rental.gst_percent) || 18;
          const advance   = +(monthly * qty).toFixed(2);
          const advGst    = +(advance * gstPct / 100).toFixed(2);
          const advTotal  = +(advance + advGst).toFixed(2);
          const loc = (n: number) => '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2 });
          return (
            <div className="space-y-4">
              {/* Client */}
              <div className="p-3 rounded-xl flex items-center gap-3"
                style={{ background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.2)' }}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg,#F59E0B,#D97706)', color: 'white', fontWeight: 700, fontSize: 15 }}>
                  {rental.client?.name?.charAt(0)?.toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate" style={{ color: '#F1F5F9' }}>{rental.client?.name}</div>
                  <div className="text-xs truncate" style={{ color: '#F59E0B' }}>{rental.client?.email}</div>
                  {rental.client?.company && <div className="text-xs truncate" style={{ color: '#475569' }}>{rental.client.company}</div>}
                </div>
              </div>

              {/* Info banner */}
              <div className="px-4 py-3 rounded-xl text-xs" style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)', color: '#F59E0B' }}>
                Advance payment covers <strong>30 days</strong> from delivery date ({new Date((rental as any).delivery_date || rental.start_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })})
              </div>

              {/* Billing breakdown */}
              <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #1E3058' }}>
                <div className="px-4 py-2.5 text-xs font-bold uppercase tracking-widest"
                  style={{ background: 'rgba(30,48,88,0.5)', color: '#475569' }}>
                  Advance Billing — 30 Days
                </div>
                <div className="divide-y" style={{ borderColor: 'rgba(30,48,88,0.6)' }}>
                  {[
                    [`Monthly Rental × ${qty}`, loc(advance)],
                    [`GST (${gstPct}%)`,         loc(advGst)],
                  ].map(([label, value]) => (
                    <div key={label} className="flex items-center justify-between px-4 py-2.5 text-sm">
                      <span style={{ color: '#64748B' }}>{label}</span>
                      <span style={{ color: '#94A3B8' }}>{value}</span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between px-4 py-3"
                    style={{ background: 'rgba(245,158,11,0.07)' }}>
                    <span className="text-sm font-bold" style={{ color: '#F1F5F9' }}>Advance Total</span>
                    <span className="text-lg font-bold" style={{ color: '#F59E0B' }}>{loc(advTotal)}</span>
                  </div>
                </div>
              </div>

              <p className="text-xs text-center" style={{ color: '#475569' }}>
                Advance invoice will be sent to <span style={{ color: '#F59E0B' }}>{rental.client?.email}</span>
              </p>

              <div className="flex justify-end gap-3 pt-1">
                <Button variant="ghost" onClick={() => setShowAdvanceModal(false)}>Cancel</Button>
                <Button
                  icon={<SendHorizonal size={14} />}
                  loading={acting === 'advance'}
                  onClick={confirmAdvanceInvoice}
                  style={{ background: '#F59E0B' }}
                >
                  Send Advance Invoice
                </Button>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* Schedule Pickup / Delivery Modal */}
      <Modal open={!!scheduleModal} onClose={() => setScheduleModal(null)}
        title={scheduleModal === 'pickup' ? 'Schedule Pickup' : 'Schedule Delivery'} width="max-w-lg">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <FormField label="Address" required>
              <input className="inp" value={schedForm.address} onChange={e => sf('address', e.target.value)} placeholder="123, MG Road, Pune - 411001" />
            </FormField>
          </div>
          <FormField label="Scheduled Date & Time" required>
            <input className="inp" type="datetime-local" value={schedForm.scheduled_at} onChange={e => sf('scheduled_at', e.target.value)} />
          </FormField>
          {scheduleModal === 'delivery' && (
            <FormField label="Assign To (Staff)" required>
              <select className="inp" value={schedForm.assigned_to} onChange={e => sf('assigned_to', e.target.value)}>
                <option value="">— Select staff member —</option>
                {staffUsers.map((u: any) => (
                  <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                ))}
              </select>
            </FormField>
          )}
          <FormField label="Contact Name">
            <input className="inp" value={schedForm.contact_name} onChange={e => sf('contact_name', e.target.value)} placeholder="Rahul Sharma" />
          </FormField>
          <FormField label="Contact Phone">
            <input className="inp" value={schedForm.contact_phone} onChange={e => sf('contact_phone', e.target.value)} placeholder="9876543210" />
          </FormField>
          <div className="sm:col-span-2">
            <FormField label="Notes">
              <textarea className="inp resize-none" rows={2} value={schedForm.notes} onChange={e => sf('notes', e.target.value)} placeholder="Call before arrival..." />
            </FormField>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="ghost" onClick={() => setScheduleModal(null)}>Cancel</Button>
          <Button loading={schedSaving}
            disabled={!schedForm.address || !schedForm.scheduled_at || (scheduleModal === 'delivery' && !schedForm.assigned_to)}
            onClick={handleScheduleSubmit}>
            {scheduleModal === 'pickup' ? 'Schedule Pickup' : 'Schedule Delivery'}
          </Button>
        </div>
      </Modal>

      {/* Complete Schedule Modal */}
      <Modal open={!!completeModal} onClose={() => setCompleteModal(null)} title="Mark as Completed" width="max-w-sm">
        <div className="space-y-4">
          {completeModal && (
            <div className="p-3 rounded-xl text-sm" style={{ background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.2)' }}>
              <div className="font-semibold capitalize" style={{ color: '#10B981' }}>{completeModal.type}</div>
              <div className="text-xs mt-1" style={{ color: '#94A3B8' }}>{completeModal.address}</div>
            </div>
          )}
          <FormField label="Completion Notes">
            <textarea className="inp resize-none" rows={3} value={completeNote} onChange={e => setCompleteNote(e.target.value)} placeholder="Delivered successfully, received by..." />
          </FormField>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="ghost" onClick={() => setCompleteModal(null)}>Cancel</Button>
          <Button icon={<CheckCircle size={14} />} loading={schedSaving} onClick={handleCompleteSchedule}>
            Mark Completed
          </Button>
        </div>
      </Modal>

      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </DashboardLayout>
  );
}
