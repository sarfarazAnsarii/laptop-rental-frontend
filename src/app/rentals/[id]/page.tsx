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

const STATUS_META: Record<string, { bg: string; border: string; text: string; accent: string; Icon: any }> = {
  active:    { bg: '#F0FDF4', border: '#BBF7D0', text: '#16A34A', accent: '#16A34A', Icon: CheckCircle  },
  completed: { bg: '#EFF6FF', border: '#BFDBFE', text: '#1D4ED8', accent: '#2563EB', Icon: CheckCircle  },
  cancelled: { bg: '#F8FAFC', border: '#E2E8F0', text: '#64748B', accent: '#94A3B8', Icon: XCircle      },
  overdue:   { bg: '#FFF1F2', border: '#FECDD3', text: '#DC2626', accent: '#DC2626', Icon: AlertTriangle },
};

function InfoRow({ icon, label, value, accent }: { icon: ReactNode; label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 flex-shrink-0" style={{ color: '#94A3B8' }}>{icon}</span>
      <div>
        <div className="text-xs mb-0.5 font-medium uppercase tracking-wider" style={{ color: '#94A3B8' }}>{label}</div>
        <div className="text-sm font-semibold" style={{ color: accent ? '#2563EB' : '#0F172A' }}>{value}</div>
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: '#94A3B8', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
      {children}
    </h2>
  );
}

function BillingRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2.5" style={{ borderBottom: '1px solid #F1F5F9' }}>
      <span className="text-sm" style={{ color: highlight ? '#0F172A' : '#64748B' }}>{label}</span>
      <span className="text-sm font-semibold tabular-nums" style={{ color: highlight ? '#16A34A' : '#334155' }}>{value}</span>
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
  const [advanceMonth, setAdvanceMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [invoiceMonth,  setInvoiceMonth]  = useState(() => new Date().toISOString().slice(0, 7));

  // Schedules
  type ScheduleType = 'pickup' | 'delivery' | 'replacement_delivery' | 'replacement_receive' | 'event_delivery' | 'event_return';
  const TYPE_META: Record<ScheduleType, { label: string; color: string; bg: string; border: string; dateLabel: string }> = {
    pickup:               { label: 'Return',               color: '#F59E0B', bg: 'rgba(245,158,11,0.07)',  border: 'rgba(245,158,11,0.2)',  dateLabel: 'Return Date & Time'              },
    delivery:             { label: 'New Delivery',         color: '#3B82F6', bg: 'rgba(59,130,246,0.07)',  border: 'rgba(59,130,246,0.2)',  dateLabel: 'Delivery Date & Time'            },
    replacement_delivery: { label: 'Replacement Delivery', color: '#8B5CF6', bg: 'rgba(139,92,246,0.07)', border: 'rgba(139,92,246,0.2)',  dateLabel: 'Replacement Date & Time'         },
    replacement_receive:  { label: 'Replacement Receive',  color: '#0D9488', bg: 'rgba(13,148,136,0.07)', border: 'rgba(13,148,136,0.2)',  dateLabel: 'Replacement Date & Time'         },
    event_delivery:       { label: 'Event Delivery',       color: '#6366F1', bg: 'rgba(99,102,241,0.07)', border: 'rgba(99,102,241,0.2)',  dateLabel: 'Event Delivery Date & Time'      },
    event_return:         { label: 'Event Return',         color: '#F43F5E', bg: 'rgba(244,63,94,0.07)',  border: 'rgba(244,63,94,0.2)',   dateLabel: 'Event Return Date & Time'        },
  };

  const [schedules, setSchedules] = useState<any[]>([]);
  const [scheduleModal, setScheduleModal] = useState<ScheduleType | null>(null);
  const [schedForm, setSchedForm] = useState({ address: '', scheduled_at: '', contact_name: '', contact_phone: '', employee_name: '', employee_number: '', employee_address: '', notes: '', assigned_to: '' });
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

  const EMPTY_SCHED = { address: '', scheduled_at: '', contact_name: '', contact_phone: '', employee_name: '', employee_number: '', employee_address: '', notes: '', assigned_to: '' };

  async function handleScheduleSubmit() {
    if (!scheduleModal) return;
    setSchedSaving(true);
    try {
      const payload: any = {
        address:          schedForm.address,
        scheduled_at:     new Date(schedForm.scheduled_at).toISOString(),
        contact_name:     schedForm.contact_name  || undefined,
        contact_phone:    schedForm.contact_phone || undefined,
        employee_name:    schedForm.employee_name    || undefined,
        employee_number:  schedForm.employee_number  || undefined,
        employee_address: schedForm.employee_address || undefined,
        notes:            schedForm.notes || undefined,
      };
      if (scheduleModal !== 'pickup' && schedForm.assigned_to) payload.assigned_to = Number(schedForm.assigned_to);
      if (scheduleModal === 'pickup') {
        await api.rentals.schedules.schedulePickup(id, payload);
        showToast('Pickup scheduled — admin team notified');
      } else if (scheduleModal === 'delivery') {
        await api.rentals.schedules.scheduleDelivery(id, payload);
        showToast('Delivery scheduled and staff assigned');
      } else {
        await api.rentals.schedules.scheduleType(id, { ...payload, type: scheduleModal });
        showToast(`${TYPE_META[scheduleModal].label} scheduled and staff assigned`);
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
      await api.rentals.sendAdvanceInvoice(id, advanceMonth);
      showToast(`Advance invoice (${advanceMonth}) sent to ${rental!.client!.email}`);
      setShowAdvanceModal(false);
    } catch (e: any) {
      showToast(e.message || 'Failed to send advance invoice', 'error');
    } finally { setActing(null); }
  }

  async function confirmSendInvoice() {
    setActing('invoice');
    try {
      await api.rentals.sendInvoice(id, { invoice_month: invoiceMonth });
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
          <div className="flex items-center gap-2 text-sm" style={{ color: '#64748B' }}>
            <Link href="/rentals" className="hover:text-blue-600 transition-colors" style={{ color: '#64748B' }}>Rentals</Link>
            <ChevronRight size={13} style={{ color: '#CBD5E1' }} />
            <span className="font-mono text-xs" style={{ color: '#94A3B8' }}>{rental.rental_no}</span>
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

        {/* ── Hero ── */}
        <div className="glass-card overflow-hidden">
          {/* Status accent bar */}
          <div className="h-1 w-full" style={{ background: sm.accent }} />

          <div className="p-6">
            <div className="flex items-start gap-4 flex-wrap sm:flex-nowrap">

              {/* Icon */}
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
                style={{ background: sm.bg, border: `1px solid ${sm.border}` }}>
                <FileText size={22} style={{ color: sm.text }} />
              </div>

              {/* Main info */}
              <div className="flex-1 min-w-0">
                {/* Rental No + status */}
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <code className="text-xs font-bold px-2.5 py-1 rounded-lg"
                    style={{ background: '#EFF6FF', color: '#2563EB', border: '1px solid rgba(37,99,235,0.2)' }}>
                    {rental.rental_no}
                  </code>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
                    style={{ background: sm.bg, border: `1px solid ${sm.border}`, color: sm.text }}>
                    <StatusIcon size={11} />
                    {rental.status}
                  </span>
                </div>

                {/* Laptop name */}
                <h1 className="text-xl sm:text-2xl font-bold leading-tight mb-1"
                  style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', color: '#0F172A', letterSpacing: '-0.02em' }}>
                  {rental.inventory?.brand} {rental.inventory?.model_no}
                </h1>

                {/* Sub-line */}
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="font-mono text-xs font-semibold px-1.5 py-0.5 rounded"
                    style={{ background: '#F1F5F9', color: '#64748B' }}>
                    {rental.inventory?.asset_code}
                  </span>
                  <span className="text-xs" style={{ color: '#94A3B8' }}>
                    Created {fmtDate(rental.created_at)}
                  </span>
                  {rental.client?.company && (
                    <>
                      <span style={{ color: '#E2E8F0' }}>·</span>
                      <span className="text-xs font-medium" style={{ color: '#64748B' }}>{rental.client.company}</span>
                    </>
                  )}
                </div>
              </div>

              {/* Grand total — right aligned */}
              <div className="flex-shrink-0 text-right sm:text-right">
                <div className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: '#94A3B8' }}>Grand Total</div>
                <div className="text-2xl font-bold tabular-nums" style={{ color: '#16A34A', fontFamily: 'Plus Jakarta Sans, sans-serif', letterSpacing: '-0.02em' }}>
                  {fmt(rental.grand_total)}
                </div>
                <div className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>
                  incl. GST {rental.gst_percent}%
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
                <div className="mt-4 pt-4" style={{ borderTop: '1px solid #F1F5F9' }}>
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
                <p className="text-sm" style={{ color: '#64748B' }}>Client #{rental.client_id}</p>
              )}
            </div>

            {/* Remarks */}
            {rental.remarks && (
              <div className="glass-card p-5">
                <SectionTitle>Remarks</SectionTitle>
                <p className="text-sm leading-relaxed" style={{ color: '#64748B' }}>{rental.remarks}</p>
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
                style={{ background: '#F0FDF4', border: '1px solid #BBF7D0' }}>
                <div className="flex items-center gap-2">
                  <ReceiptText size={16} style={{ color: '#16A34A' }} />
                  <span className="text-sm font-semibold" style={{ color: '#0F172A' }}>Grand Total</span>
                </div>
                <span className="text-xl font-bold tabular-nums" style={{ color: '#16A34A' }}>{fmt(rental.grand_total)}</span>
              </div>
            </div>

          </div>
        </div>

        {/* ── Schedule Pickup & Delivery ── */}
        <div className="glass-card p-5">
          <div className="flex items-start justify-between mb-4 flex-wrap gap-3">
            <SectionTitle>Pickup &amp; Delivery Schedules</SectionTitle>
            <div className="flex gap-2 flex-wrap">
              {isAdminOrStaff && (
                <>
                  <Button size="sm" variant="outline" icon={<Truck size={13} />}
                    onClick={() => { setSchedForm(EMPTY_SCHED); setScheduleModal('delivery'); }}>
                    Delivery
                  </Button>
                  <Button size="sm" variant="outline" icon={<Truck size={13} />}
                    style={{ borderColor: 'rgba(139,92,246,0.4)', color: '#8B5CF6' }}
                    onClick={() => { setSchedForm(EMPTY_SCHED); setScheduleModal('replacement_delivery'); }}>
                    Replacement Delivery
                  </Button>
                  <Button size="sm" variant="outline" icon={<Truck size={13} />}
                    style={{ borderColor: 'rgba(13,148,136,0.4)', color: '#0D9488' }}
                    onClick={() => { setSchedForm(EMPTY_SCHED); setScheduleModal('replacement_receive'); }}>
                    Replacement Receive
                  </Button>
                  <Button size="sm" variant="outline" icon={<Truck size={13} />}
                    style={{ borderColor: 'rgba(99,102,241,0.4)', color: '#6366F1' }}
                    onClick={() => { setSchedForm(EMPTY_SCHED); setScheduleModal('event_delivery'); }}>
                    Event Delivery
                  </Button>
                  <Button size="sm" variant="outline" icon={<Truck size={13} />}
                    style={{ borderColor: 'rgba(244,63,94,0.4)', color: '#F43F5E' }}
                    onClick={() => { setSchedForm(EMPTY_SCHED); setScheduleModal('event_return'); }}>
                    Event Return
                  </Button>
                </>
              )}
              {(isAdminOrStaff || isClient) && (
                <Button size="sm" variant="outline" icon={<Plus size={13} />}
                  onClick={() => { setSchedForm(EMPTY_SCHED); setScheduleModal('pickup'); }}>
                  Pickup
                </Button>
              )}
            </div>
          </div>

          {schedules.length === 0 ? (
            <p className="text-sm" style={{ color: '#94A3B8' }}>No schedules yet.</p>
          ) : (
            <div className="space-y-3">
              {schedules.map((s: any) => {
                const tm = TYPE_META[s.type as ScheduleType] ?? TYPE_META.delivery;
                const { color, bg: bgColor, border: borderColor, label: typeLabel } = tm;
                return (
                  <div key={s.id} className="p-4 rounded-xl" style={{ background: bgColor, border: `1px solid ${borderColor}` }}>
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-2">
                        <Truck size={14} style={{ color }} />
                        <span className="text-sm font-semibold" style={{ color }}>{typeLabel}</span>
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
                          <span style={{ color: '#94A3B8' }}>IT: {s.contact_name}{s.contact_phone ? ` · ${s.contact_phone}` : ''}</span>
                        </div>
                      )}
                      {s.employee_name && (
                        <div className="flex items-center gap-1.5">
                          <User size={11} style={{ color: '#475569' }} />
                          <span style={{ color: '#94A3B8' }}>Emp: {s.employee_name}{s.employee_number ? ` (${s.employee_number})` : ''}</span>
                        </div>
                      )}
                      {s.employee_address && (
                        <div className="flex items-start gap-1.5 sm:col-span-2">
                          <MapPin size={11} style={{ color: '#475569', marginTop: 2, flexShrink: 0 }} />
                          <span style={{ color: '#94A3B8' }}>Emp Address: {s.employee_address}</span>
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
            <div className="p-3 rounded-xl flex items-center gap-3" style={{ background: '#EFF6FF', border: '1px solid #BFDBFE' }}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 font-bold text-white text-base"
                style={{ background: 'linear-gradient(135deg,#2563EB,#7C3AED)' }}>
                {rental.client?.name?.charAt(0)?.toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold truncate" style={{ color: '#0F172A' }}>{rental.client?.name}</div>
                <div className="text-xs truncate" style={{ color: '#2563EB' }}>{rental.client?.email}</div>
                {rental.client?.company && <div className="text-xs truncate" style={{ color: '#64748B' }}>{rental.client.company}</div>}
              </div>
            </div>

            {/* Rental details */}
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #E2E8F0' }}>
              <div className="px-4 py-2.5 text-xs font-bold uppercase tracking-widest" style={{ background: '#F8FAFC', color: '#64748B', borderBottom: '1px solid #E2E8F0' }}>
                Rental Details
              </div>
              <div className="divide-y divide-slate-100">
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
                    <span className="font-semibold" style={{ color: '#0F172A' }}>{value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Invoice Month picker */}
            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#64748B' }}>Invoice Month</label>
              <input
                type="month"
                className="inp w-full"
                value={invoiceMonth}
                onChange={e => setInvoiceMonth(e.target.value)}
              />
            </div>

            {/* Billing summary */}
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #E2E8F0' }}>
              <div className="px-4 py-2.5 text-xs font-bold uppercase tracking-widest" style={{ background: '#F8FAFC', color: '#64748B', borderBottom: '1px solid #E2E8F0' }}>
                Billing Summary
              </div>
              <div className="divide-y divide-slate-100">
                {[
                  ['Monthly Rental',              `₹${Number(rental.monthly_rental).toLocaleString('en-IN')}`],
                  ['Pro-rated Amount',             `₹${Number(rental.pro_rental).toLocaleString('en-IN')}`],
                  [`GST (${rental.gst_percent}%)`, `₹${Number(rental.gst_amount).toLocaleString('en-IN')}`],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between px-4 py-2.5 text-sm">
                    <span style={{ color: '#64748B' }}>{label}</span>
                    <span className="font-medium tabular-nums" style={{ color: '#334155' }}>{value}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between px-4 py-3"
                  style={{ background: '#F0FDF4' }}>
                  <span className="text-sm font-bold" style={{ color: '#0F172A' }}>Grand Total</span>
                  <span className="text-lg font-bold tabular-nums" style={{ color: '#16A34A' }}>
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
          const monthly  = Number(rental.monthly_rental) || 0;
          const qty      = Number(rental.quantity) || 1;
          const gstPct   = Number(rental.gst_percent) || 18;
          const selMonth = new Date(advanceMonth + '-01');
          const dim      = new Date(selMonth.getFullYear(), selMonth.getMonth() + 1, 0).getDate();
          const delivDt  = new Date((rental as any).delivery_date || rental.start_date);
          const delivYM  = `${delivDt.getFullYear()}-${String(delivDt.getMonth()+1).padStart(2,'0')}`;
          const pStart   = advanceMonth === delivYM ? delivDt.getDate() : 1;
          const advDays  = dim - pStart + 1;
          const advance  = +((monthly * qty) / dim * advDays).toFixed(2);
          const advGst   = +(advance * gstPct / 100).toFixed(2);
          const advTotal = +(advance + advGst).toFixed(2);
          const loc = (n: number) => '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2 });
          const fmtPeriodDate = (y: number, m: number, d: number) =>
            new Date(y, m, d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
          const periodStartStr = fmtPeriodDate(selMonth.getFullYear(), selMonth.getMonth(), pStart);
          const periodEndStr   = fmtPeriodDate(selMonth.getFullYear(), selMonth.getMonth(), dim);
          return (
            <div className="space-y-4">
              {/* Client */}
              <div className="p-3 rounded-xl flex items-center gap-3"
                style={{ background: '#FFFBEB', border: '1px solid #FDE68A' }}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 font-bold text-white text-base"
                  style={{ background: 'linear-gradient(135deg,#F59E0B,#D97706)' }}>
                  {rental.client?.name?.charAt(0)?.toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate" style={{ color: '#0F172A' }}>{rental.client?.name}</div>
                  <div className="text-xs truncate" style={{ color: '#D97706' }}>{rental.client?.email}</div>
                  {rental.client?.company && <div className="text-xs truncate" style={{ color: '#64748B' }}>{rental.client.company}</div>}
                </div>
              </div>

              {/* Month picker */}
              <div>
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#64748B' }}>Invoice Month</label>
                <input
                  type="month"
                  className="inp w-full"
                  value={advanceMonth}
                  onChange={e => setAdvanceMonth(e.target.value)}
                />
              </div>

              {/* Billing breakdown */}
              <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #E2E8F0' }}>
                <div className="px-4 py-2.5 text-xs font-bold uppercase tracking-widest"
                  style={{ background: '#F8FAFC', color: '#64748B', borderBottom: '1px solid #E2E8F0' }}>
                  Advance Billing — {periodStartStr} → {periodEndStr} ({advDays} days)
                </div>
                <div className="divide-y divide-slate-100">
                  {[
                    [`Monthly Rental × ${qty}`, loc(monthly * qty)],
                    [`Prorated (${advDays}/${dim} days)`, loc(advance)],
                    [`GST (${gstPct}%)`, loc(advGst)],
                  ].map(([label, value]) => (
                    <div key={label} className="flex items-center justify-between px-4 py-2.5 text-sm">
                      <span style={{ color: '#64748B' }}>{label}</span>
                      <span className="font-medium tabular-nums" style={{ color: '#334155' }}>{value}</span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between px-4 py-3"
                    style={{ background: '#FFFBEB' }}>
                    <span className="text-sm font-bold" style={{ color: '#0F172A' }}>Advance Total</span>
                    <span className="text-lg font-bold tabular-nums" style={{ color: '#D97706' }}>{loc(advTotal)}</span>
                  </div>
                </div>
              </div>

              <p className="text-xs text-center" style={{ color: '#64748B' }}>
                Advance invoice will be sent to <span style={{ color: '#D97706' }}>{rental.client?.email}</span>
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

      {/* Schedule Modal */}
      <Modal open={!!scheduleModal} onClose={() => setScheduleModal(null)}
        title={scheduleModal ? TYPE_META[scheduleModal].label : 'Schedule'} width="max-w-lg">
        {scheduleModal && (
          <>
            {/* Client info (read-only) */}
            {rental.client && (
              <div className="mb-4 px-3 py-2.5 rounded-xl flex items-center gap-3"
                style={{ background: 'rgba(59,130,246,0.07)', border: '1px solid rgba(59,130,246,0.18)' }}>
                <User size={13} style={{ color: '#3B82F6', flexShrink: 0 }} />
                <div className="text-sm font-semibold" style={{ color: '#3B82F6' }}>
                  {rental.client.company || rental.client.name}
                  {rental.client.company && rental.client.name && (
                    <span className="font-normal ml-1.5" style={{ color: '#64748B' }}>({rental.client.name})</span>
                  )}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Date */}
              <div className="sm:col-span-2">
                <FormField label={TYPE_META[scheduleModal].dateLabel} required>
                  <input className="inp" type="datetime-local" value={schedForm.scheduled_at}
                    min={new Date(Date.now() - new Date().getTimezoneOffset() * 60000 + 60000).toISOString().slice(0, 16)}
                    onChange={e => sf('scheduled_at', e.target.value)} />
                </FormField>
              </div>

              {/* Assign to staff (not for pickup/return) */}
              {scheduleModal !== 'pickup' && (
                <div className="sm:col-span-2">
                  <FormField label="Assign To (Staff)" required>
                    <select className="inp" value={schedForm.assigned_to} onChange={e => sf('assigned_to', e.target.value)}>
                      <option value="">— Select staff member —</option>
                      {staffUsers.map((u: any) => (
                        <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                      ))}
                    </select>
                  </FormField>
                </div>
              )}

              {/* IT Contact */}
              <FormField label="IT Name" required>
                <input className="inp" value={schedForm.contact_name} onChange={e => sf('contact_name', e.target.value)} placeholder="IT contact person name" />
              </FormField>
              <FormField label="IT Contact Number" required>
                <input className="inp" value={schedForm.contact_phone} onChange={e => sf('contact_phone', e.target.value)} placeholder="9876543210" />
              </FormField>

              {/* Location */}
              <div className="sm:col-span-2">
                <FormField label="Location" required>
                  <input className="inp" value={schedForm.address} onChange={e => sf('address', e.target.value)} placeholder="Building, Street, Area, City - Pincode" />
                </FormField>
              </div>
            </div>

            {/* Optional employee section */}
            <div className="mt-4 pt-4" style={{ borderTop: '1px solid rgba(30,48,88,0.5)' }}>
              <div className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: '#475569' }}>
                Employee Details <span className="font-normal normal-case tracking-normal" style={{ color: '#64748B' }}>(Optional)</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Employee Name">
                  <input className="inp" value={schedForm.employee_name} onChange={e => sf('employee_name', e.target.value)} placeholder="Employee full name" />
                </FormField>
                <FormField label="Employee Number">
                  <input className="inp" value={schedForm.employee_number} onChange={e => sf('employee_number', e.target.value)} placeholder="Employee ID / number" />
                </FormField>
                <div className="sm:col-span-2">
                  <FormField label="Employee Address">
                    <textarea className="inp resize-none" rows={2} value={schedForm.employee_address} onChange={e => sf('employee_address', e.target.value)} placeholder="Employee's work address" />
                  </FormField>
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="mt-4">
              <FormField label="Notes">
                <textarea className="inp resize-none" rows={2} value={schedForm.notes} onChange={e => sf('notes', e.target.value)} placeholder="Any additional instructions..." />
              </FormField>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <Button variant="ghost" onClick={() => setScheduleModal(null)}>Cancel</Button>
              <Button loading={schedSaving}
                disabled={
                  !schedForm.scheduled_at ||
                  !schedForm.contact_name ||
                  !schedForm.contact_phone ||
                  !schedForm.address ||
                  (scheduleModal !== 'pickup' && !schedForm.assigned_to)
                }
                onClick={handleScheduleSubmit}>
                Confirm {TYPE_META[scheduleModal].label}
              </Button>
            </div>
          </>
        )}
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
