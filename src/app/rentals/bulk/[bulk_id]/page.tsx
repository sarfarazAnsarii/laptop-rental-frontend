'use client';

import { ReactNode, useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button, Modal, Toast, FormField } from '@/components/ui';
import { api } from '@/lib/api';
import {
  ArrowLeft, Layers, CheckCircle, XCircle,
  ChevronRight, SendHorizonal, Eye,
  Building2, Mail, Phone, FileText,
  Truck, MapPin, Contact, Plus, Scissors, ReceiptText, Wallet, ArrowLeftRight,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

const fmt = (n: number) => '₹' + new Intl.NumberFormat('en-IN').format(Number(n));
const fmtDate = (d?: string) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

/** Last day of the month that startDate falls in — the billing period end for advance/monthly */
function billingEnd(startDate: string): string {
  const d = new Date(startDate);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  const y = end.getFullYear();
  const m = String(end.getMonth() + 1).padStart(2, '0');
  const day = String(end.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
/** Billing days = start_date → end of that month (inclusive) */
function billingDays(startDate: string): number {
  const start = new Date(startDate);
  const end   = new Date(start.getFullYear(), start.getMonth() + 1, 0);
  return Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
}
/** Daily rate = monthly_rental / actual days in start month */
function dailyRate(monthlyRental: number, startDate: string): number {
  const d = new Date(startDate);
  const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  return +(monthlyRental / daysInMonth).toFixed(2);
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-xs font-bold uppercase tracking-widest mb-4"
      style={{ color: '#475569', fontFamily: 'Syne, sans-serif' }}>
      {children}
    </h2>
  );
}

function InfoRow({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 flex-shrink-0" style={{ color: '#475569' }}>{icon}</span>
      <div>
        <div className="text-xs mb-0.5" style={{ color: '#475569' }}>{label}</div>
        <div className="text-sm font-medium" style={{ color: '#F1F5F9' }}>{value}</div>
      </div>
    </div>
  );
}

export default function BulkRentalDetailPage() {
  const params   = useParams();
  const router   = useRouter();
  const { user } = useAuth();
  const isAdmin        = user?.role === 'admin';
  const isAdminOrStaff = user?.role === 'admin' || user?.role === 'staff';
  const isClient       = user?.role === 'client';
  const bulkId   = decodeURIComponent(params.bulk_id as string);

  const [rentals, setRentals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting,  setActing]  = useState<string | null>(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showAdvanceModal, setShowAdvanceModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentForm, setPaymentForm] = useState({ payment_type: 'advance', payment_method: 'upi', amount: '', payment_date: new Date().toISOString().split('T')[0], notes: '' });
  const [paymentSaving, setPaymentSaving] = useState(false);

  // Schedules
  const [schedules, setSchedules] = useState<any[]>([]);
  const [scheduleModal, setScheduleModal] = useState<'pickup' | 'delivery' | null>(null);
  const EMPTY_SCHED = { address: '', scheduled_at: '', contact_name: '', contact_phone: '', notes: '', assigned_to: '' };
  const [schedForm, setSchedForm] = useState(EMPTY_SCHED);
  const [staffUsers, setStaffUsers] = useState<any[]>([]);
  const [schedSaving, setSchedSaving] = useState(false);
  const [completeModal, setCompleteModal] = useState<any | null>(null);
  const [completeNote, setCompleteNote] = useState('');

  // Partial cancel
  const [selectedIds,       setSelectedIds]       = useState<Set<number>>(new Set());
  const [partialCancelModal, setPartialCancelModal] = useState(false);
  const [pcForm,             setPcForm]            = useState({ end_date: new Date().toISOString().split('T')[0], notes: '' });
  const [pcResult,           setPcResult]          = useState<any | null>(null);
  const [pcSaving,           setPcSaving]          = useState(false);

  function toggleSelect(id: number) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }
  function toggleSelectAll() {
    const activeIds = rentals.filter(r => r.status === 'active').map(r => r.id);
    setSelectedIds(prev => prev.size === activeIds.length ? new Set() : new Set(activeIds));
  }

  async function handleRecordPayment() {
    setPaymentSaving(true);
    try {
      const cl = rentals[0]?.client;
      await api.payments.create({
        client_id:      cl.id,
        bulk_id:        bulkId,
        payment_type:   paymentForm.payment_type as any,
        payment_method: paymentForm.payment_method as any,
        amount:         Number(paymentForm.amount),
        payment_date:   paymentForm.payment_date,
        notes:          paymentForm.notes || undefined,
      });
      showToast(`Payment of ₹${Number(paymentForm.amount).toLocaleString('en-IN')} recorded`);
      setShowPaymentModal(false);
    } catch (e: any) { showToast(e.message || 'Failed to record payment', 'error'); }
    finally { setPaymentSaving(false); }
  }

  async function handlePartialCancel() {
    setPcSaving(true);
    setPcResult(null);
    try {
      const res = await api.rentals.partialCancel({
        rental_ids: [...selectedIds],
        end_date: pcForm.end_date,
        notes: pcForm.notes || undefined,
      });
      setPcResult(res);
      setSelectedIds(new Set());
      load();
    } catch (e: any) { showToast(e.message || 'Partial cancel failed', 'error'); }
    finally { setPcSaving(false); }
  }

  // Pro-rated preview (client-side estimate, mirrors backend formula)
  function previewProRated(r: any, endDate: string) {
    const start    = new Date(r.start_date);
    const monthEnd = new Date(start.getFullYear(), start.getMonth() + 1, 0);
    const daysInMonth = monthEnd.getDate();
    const ret      = new Date(endDate);
    const effective = ret > monthEnd ? monthEnd : ret;
    const daysUsed  = Math.max(1, Math.round((effective.getTime() - start.getTime()) / 86400000) + 1);
    const monthly   = Number(r.monthly_rental || 0);
    const qty       = Number(r.quantity || 1);
    const gstPct    = Number(r.gst_percent || 18);
    const proBase   = +(monthly * qty * daysUsed / daysInMonth).toFixed(2);
    const proGst    = +(proBase * gstPct / 100).toFixed(2);
    const proTotal  = +(proBase + proGst).toFixed(2);
    const origTotal = Number(r.grand_total || 0);
    const credit    = +(origTotal - proTotal).toFixed(2);
    return { daysInMonth, daysUsed, proBase, proGst, proTotal, origTotal, credit };
  }

  // Credit note generation (after partial cancel result)
  const [cnModal,        setCnModal]        = useState<{ rental_id: number; rental_no: string; advance_paid: number; grand_total: number } | null>(null);
  const [cnForm,         setCnForm]         = useState({ advance_paid: '', resolution: 'refund', notes: '' });
  const [cnSaving,       setCnSaving]       = useState(false);
  const [creditNotedIds, setCreditNotedIds] = useState<Set<number>>(new Set());

  async function handleCreateCreditNote() {
    if (!cnModal) return;
    setCnSaving(true);
    try {
      const res = await api.creditNotes.create(cnModal.rental_id, {
        advance_paid:  Number(cnForm.advance_paid) || cnModal.advance_paid,
        resolution:    cnForm.resolution || undefined,
        notes:         cnForm.notes || undefined,
      });
      showToast(`Credit note ${res.data?.credit_note_no || ''} created`);
      setCreditNotedIds(prev => new Set([...prev, cnModal.rental_id]));
      setCnModal(null);
    } catch (e: any) { showToast(e.message || 'Failed to create credit note', 'error'); }
    finally { setCnSaving(false); }
  }

  // Individual laptop pickup (client-facing)
  const [indPickupRental, setIndPickupRental] = useState<any | null>(null);
  const [indPickupForm,   setIndPickupForm]   = useState({ address: '', scheduled_at: '', contact_name: '', contact_phone: '', notes: '' });
  const [indPickupSaving, setIndPickupSaving] = useState(false);

  // Exchange
  const [exchanges,        setExchanges]        = useState<any[]>([]);
  const [exchangeModal,    setExchangeModal]    = useState<any | null>(null);
  const [exchangeForm,     setExchangeForm]     = useState({ new_inventory_id: '', exchange_date: new Date().toISOString().split('T')[0], reason: '', notes: '' });
  const [exchangeInvList,  setExchangeInvList]  = useState<any[]>([]);
  const [savingExchange,   setSavingExchange]   = useState(false);

  async function openExchangeModal(rental: any) {
    const res = await api.inventory.available();
    setExchangeInvList(res.data || []);
    setExchangeForm({ new_inventory_id: '', exchange_date: new Date().toISOString().split('T')[0], reason: '', notes: '' });
    setExchangeModal(rental);
  }

  async function confirmExchange() {
    if (!exchangeModal || !exchangeForm.new_inventory_id) return;
    setSavingExchange(true);
    try {
      await api.exchanges.create({
        rental_id:        exchangeModal.id,
        new_inventory_id: Number(exchangeForm.new_inventory_id),
        exchange_date:    exchangeForm.exchange_date,
        reason:           exchangeForm.reason || undefined,
        notes:            exchangeForm.notes  || undefined,
      });
      showToast('Laptop exchanged. Rental terms unchanged.');
      setExchangeModal(null);
      load();
    } catch (e: any) {
      showToast(e.message || 'Exchange failed', 'error');
    } finally { setSavingExchange(false); }
  }

  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.rentals.list({ bulk_id: bulkId, per_page: '100' });
      const all  = res.data?.data || res.data || [];
      const data = all.filter((r: any) => r.bulk_id === bulkId);
      if (data.length === 0) { router.push('/rentals'); return; }
      setRentals(data);
      // Load existing credit notes for this bulk to know which cancelled rentals already have one
      try {
        const cnRes = await api.creditNotes.list({ bulk_id: bulkId, per_page: '100' });
        const cnList = cnRes.data?.data || cnRes.data || [];
        setCreditNotedIds(new Set(cnList.map((cn: any) => cn.rental_id).filter(Boolean)));
      } catch { /* non-critical */ }
      // Load schedules for all rentals in this bulk
      const schedResults = await Promise.allSettled(data.map((r: any) => api.rentals.schedules.list(r.id)));
      const allSchedules = schedResults.flatMap((res, i) =>
        res.status === 'fulfilled' ? (res.value.data || []).map((s: any) => ({ ...s, _rental: data[i] })) : []
      );
      setSchedules(allSchedules.sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime()));

      // Load exchange history for all rentals in this bulk
      try {
        const excResults = await Promise.allSettled(data.map((r: any) => api.exchanges.list({ rental_id: String(r.id), per_page: '100' })));
        const allExchanges = excResults.flatMap((res, i) =>
          res.status === 'fulfilled' ? (res.value.data?.data || res.value.data || []).map((ex: any) => ({ ...ex, _rental: data[i] })) : []
        );
        setExchanges(allExchanges.sort((a: any, b: any) => new Date(b.exchange_date).getTime() - new Date(a.exchange_date).getTime()));
      } catch { /* non-critical */ }
    } catch {
      router.push('/rentals');
    } finally { setLoading(false); }
  }, [bulkId, router]);

  useEffect(() => { load(); }, [load]);

  async function handleCompleteAll() {
    if (!confirm(`Complete all ${rentals.length} rentals in this bulk?`)) return;
    setActing('complete');
    try {
      await Promise.all(rentals.filter(r => r.status === 'active').map(r => api.rentals.complete(r.id)));
      showToast('All rentals completed');
      load();
    } catch (e: any) { showToast(e.message || 'Failed', 'error'); }
    finally { setActing(null); }
  }

  async function handleCancelAll() {
    if (!confirm(`Cancel all ${rentals.length} rentals in this bulk?`)) return;
    setActing('cancel');
    try {
      await Promise.all(rentals.filter(r => r.status === 'active').map(r => api.rentals.cancel(r.id)));
      showToast('All rentals cancelled');
      load();
    } catch (e: any) { showToast(e.message || 'Failed', 'error'); }
    finally { setActing(null); }
  }

  async function confirmSendInvoice() {
    setActing('invoice');
    try {
      await Promise.all(rentals.map(r => api.rentals.sendInvoice(r.id)));
      showToast(`Invoice sent to ${rentals[0]?.client?.email} (${rentals.length} rentals)`);
      setShowInvoiceModal(false);
    } catch (e: any) { showToast(e.message || 'Failed', 'error'); }
    finally { setActing(null); }
  }

  async function confirmSendAdvanceInvoice() {
    setActing('advance');
    try {
      const res = await api.rentals.sendBulkAdvanceInvoice(bulkId, 30);
      const msg = res.message || `Advance invoice sent (${res.laptops_count ?? rentals.length} laptops)`;
      showToast(msg);
      setShowAdvanceModal(false);
    } catch (e: any) { showToast(e.message || 'Failed to send advance invoice', 'error'); }
    finally { setActing(null); }
  }

  const sf = (k: string, v: string) => setSchedForm(p => ({ ...p, [k]: v }));

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

  async function handleScheduleAll() {
    if (!scheduleModal) return;
    setSchedSaving(true);
    try {
      const payload: any = { ...schedForm };
      if (scheduleModal === 'delivery' && schedForm.assigned_to) payload.assigned_to = Number(schedForm.assigned_to);
      if (scheduleModal === 'pickup') {
        await api.rentals.bulkSchedules.schedulePickup(bulkId, payload);
        showToast(`Pickup scheduled for bulk — admin team notified`);
      } else {
        await api.rentals.bulkSchedules.scheduleDelivery(bulkId, payload);
        showToast(`Delivery scheduled and staff assigned`);
      }
      setScheduleModal(null);
      setSchedForm(EMPTY_SCHED);
      load();
    } catch (e: any) { showToast(e.message || 'Failed', 'error'); }
    finally { setSchedSaving(false); }
  }

  async function handleCompleteSchedule() {
    if (!completeModal) return;
    setSchedSaving(true);
    try {
      await api.schedules.complete(completeModal.id, completeNote);
      showToast('Marked as completed');
      setCompleteModal(null); setCompleteNote('');
      load();
    } catch (e: any) { showToast(e.message || 'Failed', 'error'); }
    finally { setSchedSaving(false); }
  }

  async function handleCancelSchedule(s: any) {
    if (!confirm('Cancel this schedule?')) return;
    try {
      await api.schedules.cancel(s.id);
      showToast('Schedule cancelled');
      load();
    } catch (e: any) { showToast(e.message || 'Failed', 'error'); }
  }

  async function handleIndividualPickup() {
    if (!indPickupRental) return;
    setIndPickupSaving(true);
    try {
      await api.rentals.schedules.schedulePickup(indPickupRental.id, indPickupForm);
      showToast(`Pickup scheduled for ${indPickupRental.inventory?.brand} ${indPickupRental.inventory?.model_no}`);
      setIndPickupRental(null);
      setIndPickupForm({ address: '', scheduled_at: '', contact_name: '', contact_phone: '', notes: '' });
      load();
    } catch (e: any) { showToast(e.message || 'Failed to schedule pickup', 'error'); }
    finally { setIndPickupSaving(false); }
  }

  if (loading) return (
    <DashboardLayout>
      <div className="space-y-5">
        <div className="skeleton h-8 w-44 rounded-xl" />
        <div className="skeleton h-40 rounded-2xl" />
        <div className="skeleton h-64 rounded-2xl" />
      </div>
    </DashboardLayout>
  );

  if (rentals.length === 0) return null;

  const client     = rentals[0]?.client;
  const vendors    = Array.from(
    new Map(
      rentals
        .filter((r: any) => r.inventory?.vendor_id)
        .map((r: any) => [r.inventory.vendor_id, r.inventory])
    ).values()
  );
  const statuses   = [...new Set(rentals.map((r: any) => r.status))];
  const allActive  = rentals.every((r: any) => r.status === 'active');
  const grandSum   = rentals.reduce((s: number, r: any) => s + Number(r.grand_total || 0), 0);
  const gstSum     = rentals.reduce((s: number, r: any) => s + Number(r.gst_amount  || 0), 0);
  const totalSum   = rentals.reduce((s: number, r: any) => s + Number(r.total       || 0), 0);

  return (
    <DashboardLayout>
      <div className="animate-fade-in space-y-5">

        {/* Breadcrumb */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2 text-sm" style={{ color: '#475569' }}>
            <Link href="/rentals" className="hover:text-blue-400 transition-colors">Rentals</Link>
            <ChevronRight size={13} />
            <span style={{ color: '#A78BFA' }}>{bulkId}</span>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Link href="/rentals">
              <Button variant="ghost" size="sm" icon={<ArrowLeft size={14} />}>Back</Button>
            </Link>
            <Link href={`/rentals/bulk/${encodeURIComponent(bulkId)}/invoice`} target="_blank">
              <Button variant="outline" size="sm" icon={<FileText size={13} />}>View Invoice</Button>
            </Link>
            {isAdmin && client?.email && (
              <>
                <Button variant="outline" size="sm" icon={<SendHorizonal size={13} />} onClick={() => setShowAdvanceModal(true)}>
                  Advance Invoice
                </Button>
                <Button variant="outline" size="sm" icon={<SendHorizonal size={13} />} onClick={() => setShowInvoiceModal(true)}>
                  Send Invoice
                </Button>
                <Button variant="outline" size="sm" icon={<Wallet size={13} />}
                  onClick={() => {
                    const cl = rentals[0]?.client;
                    setPaymentForm({
                      payment_type: cl?.payment_type === 'postpaid' ? 'monthly' : 'advance',
                      payment_method: 'upi',
                      amount: String(grandSum),
                      payment_date: new Date().toISOString().split('T')[0],
                      notes: '',
                    });
                    setShowPaymentModal(true);
                  }}>
                  Record Payment
                </Button>
              </>
            )}
            {isAdmin && allActive && (
              <>
                <Button variant="success" size="sm" icon={<CheckCircle size={13} />}
                  loading={acting === 'complete'} onClick={handleCompleteAll}>
                  Complete All
                </Button>
                <Button variant="danger" size="sm" icon={<XCircle size={13} />}
                  loading={acting === 'cancel'} onClick={handleCancelAll}>
                  Cancel All
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Hero */}
        <div className="glass-card p-6"
          style={{ background: 'linear-gradient(135deg,rgba(13,27,46,0.95),rgba(17,34,62,0.95))', borderColor: '#1E3058' }}>
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'linear-gradient(135deg,#8B5CF6,#6D28D9)', boxShadow: '0 0 30px rgba(139,92,246,0.25)' }}>
              <Layers size={24} color="white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-2">
                <span className="font-mono text-sm px-2.5 py-1 rounded-lg font-semibold"
                  style={{ background: 'rgba(139,92,246,0.15)', color: '#A78BFA', border: '1px solid rgba(139,92,246,0.3)' }}>
                  {bulkId}
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                  style={{ background: 'rgba(139,92,246,0.12)', color: '#A78BFA' }}>
                  {rentals.length} Laptops
                </span>
                {statuses.map(s => (
                  <span key={s} className={`badge badge-${s}`}>{s}</span>
                ))}
              </div>
              <h1 className="text-xl font-bold" style={{ fontFamily: 'Syne, sans-serif', color: '#F1F5F9' }}>
                Bulk Rental
              </h1>
              <p className="text-xs mt-1" style={{ color: '#475569' }}>
                Delivery: {fmtDate(rentals[0]?.delivery_date || rentals[0]?.start_date)}
              </p>
            </div>
          </div>
        </div>

        {/* Client + Vendor + Billing */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">

          {/* Client Info */}
          <div className="glass-card p-5 space-y-3.5">
            <SectionTitle>Client</SectionTitle>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold"
                style={{ background: 'linear-gradient(135deg,#14B8A6,#0D9488)', color: 'white' }}>
                {client?.name?.charAt(0)?.toUpperCase()}
              </div>
              <div>
                <div className="font-semibold text-sm" style={{ color: '#F1F5F9' }}>{client?.name || '—'}</div>
                {client?.company && <div className="text-xs" style={{ color: '#475569' }}>{client.company}</div>}
              </div>
            </div>
            {client?.phone   && <InfoRow icon={<Phone     size={13} />} label="Phone"   value={client.phone} />}
            {client?.email   && <InfoRow icon={<Mail      size={13} />} label="Email"   value={client.email} />}
            {client?.address && <InfoRow icon={<MapPin    size={13} />} label="Address" value={client.address} />}
            {client?.company && <InfoRow icon={<Building2 size={13} />} label="Company" value={client.company} />}
          </div>

          {/* Vendor Info */}
          <div className="glass-card p-5 space-y-3.5">
            <SectionTitle>Vendor</SectionTitle>
            {vendors.length === 0 ? (
              <div className="text-xs py-6 text-center" style={{ color: '#334155' }}>No vendor assigned</div>
            ) : vendors.map((inv: any) => (
              <div key={inv.vendor_id} className="space-y-3">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold flex-shrink-0"
                    style={{ background: 'linear-gradient(135deg,#F59E0B,#D97706)', color: 'white' }}>
                    {inv.vendor_name?.charAt(0)?.toUpperCase() || 'V'}
                  </div>
                  <div>
                    <div className="font-semibold text-sm" style={{ color: '#F1F5F9' }}>
                      {inv.vendor_name || `Vendor #${inv.vendor_id}`}
                    </div>
                    <div className="text-xs" style={{ color: '#475569' }}>ID: {inv.vendor_id}</div>
                  </div>
                </div>
                {inv.vendor_name     && <InfoRow icon={<Building2 size={13} />} label="Vendor Name"     value={inv.vendor_name} />}
                {inv.vendor_location && <InfoRow icon={<MapPin    size={13} />} label="Vendor Location" value={inv.vendor_location} />}
                {inv.return_location && <InfoRow icon={<MapPin    size={13} />} label="Return Location" value={inv.return_location} />}
                {inv.return_date     && <InfoRow icon={<Contact   size={13} />} label="Return Date"     value={fmtDate(inv.return_date)} />}
              </div>
            ))}
          </div>

          {/* Billing Summary */}
          <div className="lg:col-span-2 glass-card p-5">
            <SectionTitle>Billing Summary</SectionTitle>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Laptops',     value: String(rentals.length),  color: '#A78BFA' },
                { label: 'Total Rental', value: fmt(totalSum),           color: '#F1F5F9' },
                { label: 'Total GST',   value: fmt(gstSum),              color: '#F59E0B' },
                { label: 'Grand Total', value: fmt(grandSum),            color: '#10B981' },
              ].map(({ label, value, color }) => (
                <div key={label} className="text-center px-3 py-3.5 rounded-xl"
                  style={{ background: 'rgba(30,48,88,0.4)', border: '1px solid rgba(30,48,88,0.7)' }}>
                  <div className="text-xs mb-1" style={{ color: '#475569' }}>{label}</div>
                  <div className="text-base font-bold" style={{ color }}>{value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Laptops Table */}
        <div className="glass-card overflow-hidden">
          <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid #1E3058' }}>
            <h2 className="text-xs font-bold uppercase tracking-widest m-0" style={{ color: '#475569', fontFamily: 'Syne, sans-serif' }}>
              Laptops in this Bulk
            </h2>
            {isAdmin && selectedIds.size > 0 && (
              <Button variant="danger" size="sm" icon={<Scissors size={13} />}
                onClick={() => { setPcForm({ end_date: new Date().toISOString().split('T')[0], notes: '' }); setPcResult(null); setPartialCancelModal(true); }}>
                Cancel Selected ({selectedIds.size})
              </Button>
            )}
          </div>

          {/* Mobile */}
          <div className="sm:hidden divide-y" style={{ borderColor: 'rgba(30,48,88,0.4)' }}>
            {rentals.map((r: any) => (
              <div key={r.id} className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <Link href={`/rentals/${r.id}`} className="font-mono text-xs font-semibold" style={{ color: '#3B82F6' }}>{r.rental_no}</Link>
                  <span className={`badge badge-${r.status}`}>{r.status}</span>
                </div>
                <div>
                  <div className="text-sm font-medium" style={{ color: '#F1F5F9' }}>{r.inventory?.brand} {r.inventory?.model_no}</div>
                  <div className="text-xs font-mono" style={{ color: '#475569' }}>{r.inventory?.asset_code}</div>
                  {r.inventory?.cpu && <div className="text-xs" style={{ color: '#64748B' }}>{r.inventory.cpu}{r.inventory.generation ? ` ${r.inventory.generation} Gen` : ''} · {r.inventory.ram} · {r.inventory.ssd}</div>}
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs" style={{ color: '#64748B' }}>{fmtDate(r.start_date)} · {r.duration_days}d</div>
                    <div className="text-sm font-semibold" style={{ color: '#10B981' }}>{fmt(r.grand_total)}</div>
                  </div>
                  <div className="flex gap-1">
                    <Link href={`/rentals/${r.id}`}><Button variant="ghost" size="sm" icon={<Eye size={13} />} /></Link>
                    {r.status === 'active' && isClient && (
                      <Button variant="outline" size="sm" icon={<Truck size={12} />}
                        onClick={() => { setIndPickupForm({ address: '', scheduled_at: '', contact_name: '', contact_phone: '', notes: '' }); setIndPickupRental(r); }}>
                        Pickup
                      </Button>
                    )}
                    {isAdmin && r.status === 'active' && <>
                      <Button variant="ghost"   size="sm" icon={<ArrowLeftRight size={13} />} onClick={() => openExchangeModal(r)} title="Exchange laptop" />
                      <Button variant="success" size="sm" icon={<CheckCircle size={13} />} onClick={() => api.rentals.complete(r.id).then(load)} />
                      <Button variant="danger"  size="sm" icon={<XCircle    size={13} />} onClick={() => api.rentals.cancel(r.id).then(load)} />
                    </>}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  {isAdmin && (
                    <th style={{ width: 36 }}>
                      <input type="checkbox"
                        checked={selectedIds.size > 0 && selectedIds.size === rentals.filter(r => r.status === 'active').length}
                        onChange={toggleSelectAll}
                        style={{ accentColor: '#3B82F6', cursor: 'pointer' }} />
                    </th>
                  )}
                  <th>Rental No</th>
                  <th>Laptop</th>
                  <th className="hidden lg:table-cell">Specs</th>
                  <th>Delivery</th>
                  <th>Days</th>
                  <th>Monthly</th>
                  <th>Grand Total</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rentals.map((r: any) => (
                  <tr key={r.id} className="animate-fade-in"
                    style={selectedIds.has(r.id) ? { background: 'rgba(244,63,94,0.06)' } : undefined}>
                    {isAdmin && (
                      <td style={{ textAlign: 'center' }}>
                        {r.status === 'active' && (
                          <input type="checkbox"
                            checked={selectedIds.has(r.id)}
                            onChange={() => toggleSelect(r.id)}
                            style={{ accentColor: '#F43F5E', cursor: 'pointer' }} />
                        )}
                      </td>
                    )}
                    <td>
                      <Link href={`/rentals/${r.id}`} className="font-mono text-xs font-semibold hover:underline" style={{ color: '#3B82F6' }}>
                        {r.rental_no}
                      </Link>
                    </td>
                    <td>
                      <div className="text-sm font-medium" style={{ color: '#F1F5F9' }}>{r.inventory?.brand} {r.inventory?.model_no}</div>
                      <div className="text-xs font-mono" style={{ color: '#475569' }}>{r.inventory?.asset_code}</div>
                    </td>
                    <td className="hidden lg:table-cell">
                      <div className="text-xs" style={{ color: '#94A3B8' }}>
                        {[r.inventory?.cpu, r.inventory?.generation ? `${r.inventory.generation} Gen` : '', r.inventory?.ram, r.inventory?.ssd].filter(Boolean).join(' · ')}
                      </div>
                    </td>
                    <td className="text-xs" style={{ color: '#F1F5F9' }}>
                      <div>{fmtDate(r.start_date)}</div>
                      <div style={{ color: '#475569' }}>→ {fmtDate(billingEnd(r.start_date))}</div>
                    </td>
                    <td className="text-sm" style={{ color: '#94A3B8' }}>{billingDays(r.start_date)}d</td>
                    <td className="text-sm" style={{ color: '#F1F5F9' }}>{fmt(r.monthly_rental)}</td>
                    <td>
                      <div className="text-sm font-semibold" style={{ color: '#10B981' }}>{fmt(r.grand_total)}</div>
                      <div className="text-xs" style={{ color: '#475569' }}>GST: {fmt(r.gst_amount)}</div>
                    </td>
                    <td><span className={`badge badge-${r.status}`}>{r.status}</span></td>
                    <td>
                      <div className="flex items-center gap-1">
                        <Link href={`/rentals/${r.id}`}><Button variant="ghost" size="sm" icon={<Eye size={13} />} /></Link>
                        {r.status === 'active' && isClient && (
                          <Button variant="outline" size="sm" icon={<Truck size={12} />}
                            onClick={() => { setIndPickupForm({ address: '', scheduled_at: '', contact_name: '', contact_phone: '', notes: '' }); setIndPickupRental(r); }}>
                            Pickup
                          </Button>
                        )}
                        {isAdmin && r.status === 'active' && <>
                          <Button variant="ghost"   size="sm" icon={<ArrowLeftRight size={13} />} onClick={() => openExchangeModal(r)} title="Exchange laptop" />
                          <Button variant="success" size="sm" icon={<CheckCircle size={13} />} onClick={() => api.rentals.complete(r.id).then(load)} />
                          <Button variant="danger"  size="sm" icon={<XCircle    size={13} />} onClick={() => api.rentals.cancel(r.id).then(load)} />
                        </>}
                        {isAdmin && r.status === 'cancelled' && !creditNotedIds.has(r.id) && (
                          <Button variant="outline" size="sm" icon={<ReceiptText size={12} />}
                            onClick={() => {
                              setCnModal({ rental_id: r.id, rental_no: r.rental_no, advance_paid: Number(r.grand_total), grand_total: Number(r.grand_total) });
                              setCnForm({ advance_paid: String(r.grand_total), resolution: 'refund', notes: '' });
                            }}>
                            Credit Note
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: 'rgba(16,185,129,0.05)', borderTop: '2px solid rgba(16,185,129,0.2)' }}>
                  <td colSpan={isAdmin ? 7 : 6} className="text-right text-xs font-bold" style={{ color: '#475569' }}>Total ({rentals.length} rentals)</td>
                  <td>
                    <div className="text-sm font-bold" style={{ color: '#10B981' }}>{fmt(grandSum)}</div>
                    <div className="text-xs" style={{ color: '#475569' }}>GST: {fmt(gstSum)}</div>
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
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
                const isPickup   = s.type === 'pickup';
                const color      = isPickup ? '#F59E0B' : '#3B82F6';
                const bgColor    = isPickup ? 'rgba(245,158,11,0.07)' : 'rgba(59,130,246,0.07)';
                const borderColor = isPickup ? 'rgba(245,158,11,0.2)' : 'rgba(59,130,246,0.2)';
                return (
                  <div key={s.id} className="p-4 rounded-xl" style={{ background: bgColor, border: `1px solid ${borderColor}` }}>
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Truck size={14} style={{ color }} />
                        <span className="text-sm font-semibold capitalize" style={{ color }}>{s.type}</span>
                        <span className={`badge badge-${s.status}`}>{s.status}</span>
                        <span className="text-xs font-mono px-1.5 py-0.5 rounded" style={{ background: 'rgba(139,92,246,0.1)', color: '#A78BFA' }}>
                          {s._rental?.rental_no}
                        </span>
                      </div>
                      {isAdmin && s.status === 'scheduled' && (
                        <div className="flex gap-1">
                          <Button size="sm" variant="success" icon={<CheckCircle size={12} />}
                            onClick={() => { setCompleteModal(s); setCompleteNote(''); }}>
                            Complete
                          </Button>
                          <Button size="sm" variant="danger" icon={<XCircle size={12} />}
                            onClick={() => handleCancelSchedule(s)}>
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
                        <FileText size={11} style={{ color: '#475569' }} />
                        <span style={{ color: '#94A3B8' }}>
                          {new Date(s.scheduled_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      {s.contact_name && (
                        <div className="flex items-center gap-1.5">
                          <Contact size={11} style={{ color: '#475569' }} />
                          <span style={{ color: '#94A3B8' }}>{s.contact_name}{s.contact_phone ? ` · ${s.contact_phone}` : ''}</span>
                        </div>
                      )}
                      {s.notes && (
                        <div className="flex items-start gap-1.5 sm:col-span-2" style={{ color: '#64748B' }}>{s.notes}</div>
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

        {/* ── Exchange History ── */}
        {(isAdminOrStaff || exchanges.length > 0) && (
          <div className="glass-card p-5">
            <div className="flex items-center justify-between mb-4">
              <SectionTitle>Exchange History</SectionTitle>
              {exchanges.length > 0 && (
                <span className="text-xs px-2.5 py-1 rounded-full font-semibold"
                  style={{ background: 'rgba(59,130,246,0.1)', color: '#60A5FA', border: '1px solid rgba(59,130,246,0.2)' }}>
                  {exchanges.length} exchange{exchanges.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>

            {exchanges.length === 0 ? (
              <div className="flex items-center gap-2 py-4" style={{ color: '#334155' }}>
                <ArrowLeftRight size={15} />
                <span className="text-sm">No laptop exchanges on this bulk group.</span>
              </div>
            ) : (
              <div className="space-y-3">
                {exchanges.map((ex: any) => (
                  <div key={ex.id} className="rounded-xl p-4"
                    style={{ background: 'rgba(30,48,88,0.3)', border: '1px solid rgba(30,48,88,0.7)' }}>
                    {/* Header */}
                    <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-lg"
                          style={{ background: 'rgba(59,130,246,0.1)', color: '#60A5FA' }}>
                          {ex.exchange_no}
                        </span>
                        <span className="font-mono text-xs" style={{ color: '#475569' }}>
                          {ex._rental?.rental_no}
                        </span>
                      </div>
                      <span className="text-xs" style={{ color: '#64748B' }}>
                        {fmtDate(ex.exchange_date)}
                        {ex.exchanged_by_user?.name || ex.exchanged_by_name
                          ? ` · by ${ex.exchanged_by_user?.name ?? ex.exchanged_by_name}`
                          : ''}
                      </span>
                    </div>

                    {/* Old → New laptops */}
                    <div className="flex items-center gap-3">
                      <div className="flex-1 rounded-xl p-3"
                        style={{ background: 'rgba(244,63,94,0.06)', border: '1px solid rgba(244,63,94,0.15)' }}>
                        <div className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: '#F87171' }}>Returned</div>
                        <div className="text-sm font-semibold" style={{ color: '#F1F5F9' }}>
                          {ex.old_inventory?.brand} {ex.old_inventory?.model_no}
                        </div>
                        <div className="text-xs font-mono mt-0.5" style={{ color: '#64748B' }}>
                          {ex.old_inventory?.asset_code}
                          {ex.old_inventory?.serial_number ? ` · ${ex.old_inventory.serial_number}` : ''}
                        </div>
                      </div>
                      <ArrowLeftRight size={16} style={{ color: '#334155', flexShrink: 0 }} />
                      <div className="flex-1 rounded-xl p-3"
                        style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)' }}>
                        <div className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: '#34D399' }}>Received</div>
                        <div className="text-sm font-semibold" style={{ color: '#F1F5F9' }}>
                          {ex.new_inventory?.brand} {ex.new_inventory?.model_no}
                        </div>
                        <div className="text-xs font-mono mt-0.5" style={{ color: '#64748B' }}>
                          {ex.new_inventory?.asset_code}
                          {ex.new_inventory?.serial_number ? ` · ${ex.new_inventory.serial_number}` : ''}
                        </div>
                      </div>
                    </div>

                    {(ex.reason || ex.notes) && (
                      <div className="mt-2 text-xs px-2 py-1.5 rounded-lg" style={{ background: 'rgba(15,23,42,0.4)', color: '#64748B' }}>
                        {ex.reason}{ex.reason && ex.notes ? ' · ' : ''}{ex.notes}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>

      {/* Partial Cancel Modal */}
      <Modal open={partialCancelModal} onClose={() => { setPartialCancelModal(false); setPcResult(null); }}
        title="Partial Cancel — Early Return" width="max-w-2xl">
        <div className="space-y-4">

          {/* Result view after success */}
          {pcResult ? (
            <div className="space-y-4">
              <div className="p-4 rounded-xl text-center" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)' }}>
                <CheckCircle size={28} style={{ color: '#10B981', margin: '0 auto 8px' }} />
                <div className="text-sm font-bold" style={{ color: '#10B981' }}>{pcResult.message}</div>
                <div className="flex justify-center gap-6 mt-3 text-xs" style={{ color: '#94A3B8' }}>
                  <span>Credit: <strong style={{ color: '#10B981' }}>₹{Number(pcResult.total_credit || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></span>
                  <span>Adjusted Total: <strong style={{ color: '#F1F5F9' }}>₹{Number(pcResult.total_adjusted || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></span>
                </div>
              </div>

              {pcResult.cancelled?.length > 0 && (
                <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #1E3058' }}>
                  <div className="px-4 py-2.5 text-xs font-bold uppercase tracking-widest" style={{ background: 'rgba(30,48,88,0.5)', color: '#475569' }}>
                    Cancelled Rentals
                  </div>
                  <div className="divide-y" style={{ borderColor: 'rgba(30,48,88,0.6)' }}>
                    {pcResult.cancelled.map((c: any) => (
                      <div key={c.rental_id} className="px-4 py-3 text-xs space-y-1.5">
                        <div className="flex items-center justify-between">
                          <div className="font-semibold" style={{ color: '#F1F5F9' }}>
                            {c.rental_no} — {c.inventory}
                          </div>
                          <Button size="sm" variant="outline" icon={<ReceiptText size={12} />}
                            onClick={() => {
                              const data = { rental_id: c.rental_id, rental_no: c.rental_no, advance_paid: Number(c.original_total), grand_total: Number(c.original_total) };
                              const form = { advance_paid: String(c.original_total), resolution: 'refund', notes: '' };
                              setPartialCancelModal(false);
                              setPcResult(null);
                              setTimeout(() => { setCnModal(data); setCnForm(form); }, 150);
                            }}>
                            Credit Note
                          </Button>
                        </div>
                        <div className="grid grid-cols-2 gap-x-4">
                          <div style={{ color: '#64748B' }}>Days Used / Month: <span style={{ color: '#F1F5F9' }}>{c.days_used} / {c.days_in_month}</span></div>
                          <div style={{ color: '#64748B' }}>Monthly Rental: <span style={{ color: '#F1F5F9' }}>₹{Number(c.monthly_rental).toLocaleString('en-IN')}</span></div>
                          <div style={{ color: '#64748B' }}>Original Total: <span style={{ color: '#F1F5F9' }}>₹{Number(c.original_total).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
                          <div style={{ color: '#64748B' }}>Adjusted Total: <span style={{ color: '#10B981' }}>₹{Number(c.adjusted_total).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
                          <div className="col-span-2" style={{ color: '#64748B' }}>Credit: <span style={{ color: '#F59E0B', fontWeight: 700 }}>₹{Number(c.credit_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end">
                <Button onClick={() => { setPartialCancelModal(false); setPcResult(null); }}>Done</Button>
              </div>
            </div>
          ) : (
            <>
              {/* Selected rentals preview */}
              <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #1E3058' }}>
                <div className="px-4 py-2.5 flex items-center gap-2" style={{ background: 'rgba(244,63,94,0.08)' }}>
                  <Scissors size={13} style={{ color: '#F43F5E' }} />
                  <span className="text-xs font-bold uppercase tracking-widest" style={{ color: '#F43F5E' }}>
                    {selectedIds.size} Rental(s) to Cancel
                  </span>
                </div>
                <div className="divide-y" style={{ borderColor: 'rgba(30,48,88,0.6)' }}>
                  {rentals.filter(r => selectedIds.has(r.id)).map((r: any) => {
                    const preview = pcForm.end_date ? previewProRated(r, pcForm.end_date) : null;
                    return (
                      <div key={r.id} className="px-4 py-3">
                        <div className="flex items-center justify-between mb-1">
                          <div>
                            <span className="font-mono text-xs font-semibold" style={{ color: '#3B82F6' }}>{r.rental_no}</span>
                            <span className="text-xs ml-2" style={{ color: '#94A3B8' }}>{r.inventory?.brand} {r.inventory?.model_no}</span>
                          </div>
                          <button onClick={() => toggleSelect(r.id)} style={{ color: '#64748B', fontSize: 11, background: 'none', border: 'none', cursor: 'pointer' }}>✕ Remove</button>
                        </div>
                        {preview && (
                          <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs mt-1" style={{ color: '#64748B' }}>
                            <span>Used: <strong style={{ color: '#F1F5F9' }}>{preview.daysUsed}/{preview.daysInMonth}d</strong></span>
                            <span>Pro-rated: <strong style={{ color: '#F1F5F9' }}>₹{preview.proTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></span>
                            <span>Credit: <strong style={{ color: '#10B981' }}>₹{Math.max(0, preview.credit).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                {pcForm.end_date && (() => {
                  const totals = rentals.filter(r => selectedIds.has(r.id)).reduce((acc: any, r: any) => {
                    const p = previewProRated(r, pcForm.end_date);
                    return { proTotal: acc.proTotal + p.proTotal, credit: acc.credit + Math.max(0, p.credit) };
                  }, { proTotal: 0, credit: 0 });
                  return (
                    <div className="flex items-center justify-between px-4 py-3"
                      style={{ background: 'rgba(244,63,94,0.07)', borderTop: '1px solid rgba(244,63,94,0.2)' }}>
                      <span className="text-xs" style={{ color: '#F43F5E' }}>Total Credit to Client</span>
                      <span className="text-sm font-bold" style={{ color: '#10B981' }}>
                        ₹{totals.credit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  );
                })()}
              </div>

              {/* Form */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Return / End Date" required>
                  <input className="inp" type="date"
                    max={billingEnd(rentals[0]?.start_date || new Date().toISOString())}
                    value={pcForm.end_date}
                    onChange={e => setPcForm(p => ({ ...p, end_date: e.target.value }))} />
                </FormField>
                <FormField label="Notes">
                  <input className="inp" placeholder="e.g. Client returned laptops early"
                    value={pcForm.notes}
                    onChange={e => setPcForm(p => ({ ...p, notes: e.target.value }))} />
                </FormField>
              </div>

              <div className="p-3 rounded-xl text-xs" style={{ background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.2)', color: '#94A3B8' }}>
                Pro-rated = (monthly × qty × days used) ÷ days in month + GST. Credit = original grand total − pro-rated total. Each cancelled rental will record the deduction reason for invoice adjustments.
              </div>

              <div className="flex justify-end gap-3">
                <Button variant="ghost" onClick={() => setPartialCancelModal(false)}>Cancel</Button>
                <Button variant="danger" icon={<Scissors size={14} />}
                  loading={pcSaving}
                  disabled={!pcForm.end_date || selectedIds.size === 0}
                  onClick={handlePartialCancel}>
                  Confirm Cancel ({selectedIds.size})
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* Send Invoice Modal */}
      <Modal open={showInvoiceModal} onClose={() => setShowInvoiceModal(false)} title="Send Bulk Invoice" width="max-w-md">
        <div className="space-y-4">
          <div className="p-3 rounded-xl flex items-center gap-3"
            style={{ background: 'rgba(139,92,246,0.07)', border: '1px solid rgba(139,92,246,0.2)' }}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'linear-gradient(135deg,#8B5CF6,#6D28D9)', color: 'white', fontWeight: 700, fontSize: 15 }}>
              {client?.name?.charAt(0)?.toUpperCase()}
            </div>
            <div>
              <div className="text-sm font-semibold" style={{ color: '#F1F5F9' }}>{client?.name}</div>
              <div className="text-xs" style={{ color: '#A78BFA' }}>{client?.email}</div>
            </div>
          </div>

          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #1E3058' }}>
            <div className="px-4 py-2.5 flex items-center gap-2" style={{ background: 'rgba(30,48,88,0.5)' }}>
              <Layers size={13} style={{ color: '#A78BFA' }} />
              <span className="text-xs font-bold uppercase tracking-widest" style={{ color: '#475569' }}>
                {rentals.length} Rental(s)
              </span>
            </div>
            <div className="divide-y" style={{ borderColor: 'rgba(30,48,88,0.6)' }}>
              {rentals.map((r: any) => (
                <div key={r.id} className="flex items-center justify-between px-4 py-2.5">
                  <div>
                    <div className="text-xs font-medium" style={{ color: '#F1F5F9' }}>{r.inventory?.brand} {r.inventory?.model_no}</div>
                    <div className="text-xs font-mono" style={{ color: '#475569' }}>{r.rental_no}</div>
                    <div className="text-xs" style={{ color: '#64748B' }}>
                      {fmtDate(r.start_date)} → {fmtDate(billingEnd(r.start_date))} · {billingDays(r.start_date)}d
                    </div>
                  </div>
                  <div className="text-sm font-semibold" style={{ color: '#10B981' }}>{fmt(r.grand_total)}</div>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between px-4 py-3"
              style={{ background: 'rgba(16,185,129,0.07)', borderTop: '1px solid rgba(16,185,129,0.2)' }}>
              <span className="text-sm font-bold" style={{ color: '#F1F5F9' }}>Grand Total</span>
              <span className="text-base font-bold" style={{ color: '#10B981' }}>{fmt(grandSum)}</span>
            </div>
          </div>

          <p className="text-xs text-center" style={{ color: '#475569' }}>
            Invoice for all {rentals.length} rental(s) will be sent to{' '}
            <span style={{ color: '#A78BFA' }}>{client?.email}</span>
          </p>

          <div className="flex justify-end gap-3 pt-1">
            <Button variant="ghost" onClick={() => setShowInvoiceModal(false)}>Cancel</Button>
            <Button icon={<SendHorizonal size={14} />} loading={acting === 'invoice'} onClick={confirmSendInvoice}>
              Send Invoice ({rentals.length})
            </Button>
          </div>
        </div>
      </Modal>

      {/* Advance Invoice Modal */}
      <Modal open={showAdvanceModal} onClose={() => setShowAdvanceModal(false)} title="Send Advance Invoice" width="max-w-md">
        <div className="space-y-4">
          <div className="p-3 rounded-xl flex items-center gap-3"
            style={{ background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.2)' }}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'linear-gradient(135deg,#F59E0B,#D97706)', color: 'white', fontWeight: 700, fontSize: 15 }}>
              {client?.name?.charAt(0)?.toUpperCase()}
            </div>
            <div>
              <div className="text-sm font-semibold" style={{ color: '#F1F5F9' }}>{client?.name}</div>
              <div className="text-xs" style={{ color: '#F59E0B' }}>{client?.email}</div>
            </div>
          </div>

          <div className="p-3 rounded-xl text-sm" style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)' }}>
            <div className="font-semibold mb-1" style={{ color: '#F59E0B' }}>Advance Payment — Billing Period</div>
            <div className="text-xs" style={{ color: '#94A3B8' }}>
              Advance invoice from <strong style={{ color: '#F1F5F9' }}>{fmtDate(rentals[0]?.start_date)}</strong> to{' '}
              <strong style={{ color: '#F1F5F9' }}>{fmtDate(billingEnd(rentals[0]?.start_date))}</strong> will be generated
              for each of the <strong style={{ color: '#F1F5F9' }}>{rentals.length} rental(s)</strong> in this bulk group.
            </div>
          </div>

          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #1E3058' }}>
            <div className="px-4 py-2.5 flex items-center gap-2" style={{ background: 'rgba(30,48,88,0.5)' }}>
              <span className="text-xs font-bold uppercase tracking-widest" style={{ color: '#475569' }}>Advance Breakdown</span>
            </div>
            <div className="divide-y" style={{ borderColor: 'rgba(30,48,88,0.6)' }}>
              {rentals.map((r: any) => {
                const days    = billingDays(r.start_date);
                const rate    = dailyRate(Number(r.monthly_rental || 0), r.start_date);
                const advance = +(rate * days * Number(r.quantity || 1)).toFixed(2);
                const gst     = +(advance * Number(r.gst_percent || 18) / 100).toFixed(2);
                return (
                  <div key={r.id} className="flex items-center justify-between px-4 py-2.5">
                    <div>
                      <div className="text-xs font-medium" style={{ color: '#F1F5F9' }}>{r.inventory?.brand} {r.inventory?.model_no}</div>
                      <div className="text-xs font-mono" style={{ color: '#475569' }}>{r.rental_no}</div>
                      <div className="text-xs" style={{ color: '#64748B' }}>
                        {fmtDate(r.start_date)} → {fmtDate(billingEnd(r.start_date))} · {days}d
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold" style={{ color: '#F59E0B' }}>
                        {'₹' + (advance + gst).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </div>
                      <div className="text-xs" style={{ color: '#475569' }}>GST: {'₹' + gst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-between px-4 py-3"
              style={{ background: 'rgba(245,158,11,0.07)', borderTop: '1px solid rgba(245,158,11,0.2)' }}>
              <span className="text-sm font-bold" style={{ color: '#F1F5F9' }}>Total Advance</span>
              <span className="text-base font-bold" style={{ color: '#F59E0B' }}>
                {'₹' + rentals.reduce((s: number, r: any) => {
                  const days = billingDays(r.start_date);
                  const rate = dailyRate(Number(r.monthly_rental || 0), r.start_date);
                  const a    = +(rate * days * Number(r.quantity || 1)).toFixed(2);
                  return s + a + +(a * Number(r.gst_percent || 18) / 100).toFixed(2);
                }, 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          <p className="text-xs text-center" style={{ color: '#475569' }}>
            Advance invoices will be sent to <span style={{ color: '#F59E0B' }}>{client?.email}</span>
          </p>

          <div className="flex justify-end gap-3 pt-1">
            <Button variant="ghost" onClick={() => setShowAdvanceModal(false)}>Cancel</Button>
            <Button icon={<SendHorizonal size={14} />} loading={acting === 'advance'} onClick={confirmSendAdvanceInvoice}>
              Send Advance Invoice ({rentals.length})
            </Button>
          </div>
        </div>
      </Modal>

      {/* Schedule Modal (applies to ALL rentals in bulk) */}
      <Modal open={!!scheduleModal} onClose={() => setScheduleModal(null)}
        title={`Schedule ${scheduleModal === 'pickup' ? 'Pickup' : 'Delivery'} — All ${rentals.length} Rentals`}
        width="max-w-lg">
        <div className="p-3 rounded-xl mb-4 text-xs" style={{ background: 'rgba(139,92,246,0.07)', border: '1px solid rgba(139,92,246,0.2)', color: '#A78BFA' }}>
          This schedule will be applied to all {rentals.length} rentals in this bulk group.
        </div>
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
            onClick={handleScheduleAll}>
            {scheduleModal === 'pickup' ? 'Schedule Pickup' : 'Schedule Delivery'}
          </Button>
        </div>
      </Modal>

      {/* Individual Laptop Pickup Modal (client) */}
      <Modal open={!!indPickupRental} onClose={() => setIndPickupRental(null)}
        title="Schedule Pickup" width="max-w-lg">
        {indPickupRental && (
          <div className="flex items-center gap-2 mb-4 p-3 rounded-xl"
            style={{ background: 'rgba(59,130,246,0.07)', border: '1px solid rgba(59,130,246,0.18)' }}>
            <Truck size={13} style={{ color: '#3B82F6' }} />
            <span className="text-sm font-semibold" style={{ color: '#F1F5F9' }}>
              {indPickupRental.inventory?.brand} {indPickupRental.inventory?.model_no}
            </span>
            <span className="text-xs font-mono" style={{ color: '#475569' }}>{indPickupRental.inventory?.asset_code}</span>
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <FormField label="Pickup Address" required>
              <input className="inp" value={indPickupForm.address}
                onChange={e => setIndPickupForm(p => ({ ...p, address: e.target.value }))}
                placeholder="123, MG Road, Pune - 411001" />
            </FormField>
          </div>
          <FormField label="Preferred Date & Time" required>
            <input className="inp" type="datetime-local" value={indPickupForm.scheduled_at}
              onChange={e => setIndPickupForm(p => ({ ...p, scheduled_at: e.target.value }))} />
          </FormField>
          <FormField label="Contact Name">
            <input className="inp" value={indPickupForm.contact_name}
              onChange={e => setIndPickupForm(p => ({ ...p, contact_name: e.target.value }))}
              placeholder="Rahul Sharma" />
          </FormField>
          <FormField label="Contact Phone">
            <input className="inp" value={indPickupForm.contact_phone}
              onChange={e => setIndPickupForm(p => ({ ...p, contact_phone: e.target.value }))}
              placeholder="9876543210" />
          </FormField>
          <div className="sm:col-span-2">
            <FormField label="Notes">
              <textarea className="inp resize-none" rows={2} value={indPickupForm.notes}
                onChange={e => setIndPickupForm(p => ({ ...p, notes: e.target.value }))}
                placeholder="Please call before coming..." />
            </FormField>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="ghost" onClick={() => setIndPickupRental(null)}>Cancel</Button>
          <Button icon={<Truck size={14} />} loading={indPickupSaving}
            disabled={!indPickupForm.address || !indPickupForm.scheduled_at}
            onClick={handleIndividualPickup}>
            Request Pickup
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
              <div className="text-xs mt-0.5 font-mono" style={{ color: '#A78BFA' }}>{completeModal._rental?.rental_no}</div>
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

      {/* Record Payment Modal */}
      <Modal open={showPaymentModal} onClose={() => setShowPaymentModal(false)} title="Record Payment" width="max-w-sm">
        {(() => {
          const cl = rentals[0]?.client;
          const isAdvanceClient = cl?.payment_type !== 'postpaid';
          return (
            <div className="space-y-4">
              <div className="p-3 rounded-xl flex items-center gap-3"
                style={{ background: isAdvanceClient ? 'rgba(59,130,246,0.07)' : 'rgba(16,185,129,0.07)', border: `1px solid ${isAdvanceClient ? 'rgba(59,130,246,0.2)' : 'rgba(16,185,129,0.2)'}` }}>
                <div className="w-8 h-8 rounded-xl flex items-center justify-center font-bold flex-shrink-0"
                  style={{ background: isAdvanceClient ? 'linear-gradient(135deg,#3B82F6,#1D4ED8)' : 'linear-gradient(135deg,#10B981,#059669)', color: 'white' }}>
                  {cl?.name?.charAt(0)?.toUpperCase()}
                </div>
                <div>
                  <div className="text-sm font-semibold" style={{ color: '#F1F5F9' }}>{cl?.name}</div>
                  <div className="text-xs" style={{ color: isAdvanceClient ? '#3B82F6' : '#10B981' }}>
                    {isAdvanceClient ? 'Advance' : 'Postpaid'} · {bulkId}
                  </div>
                </div>
              </div>

              <FormField label="Payment Type" required>
                <select className="inp" value={paymentForm.payment_type}
                  onChange={e => setPaymentForm(p => ({ ...p, payment_type: e.target.value }))}>
                  {isAdvanceClient && <option value="advance">Advance — paid before billing period</option>}
                  {!isAdvanceClient && <option value="monthly">Monthly — paid after month ends</option>}
                  <option value="credit_adjustment">Credit Adjustment — from credit note</option>
                </select>
              </FormField>

              <div className="grid grid-cols-2 gap-4">
                <FormField label="Amount (₹)" required>
                  <input className="inp" type="number" min="0" step="0.01"
                    value={paymentForm.amount}
                    onChange={e => setPaymentForm(p => ({ ...p, amount: e.target.value }))} />
                </FormField>
                <FormField label="Method" required>
                  <select className="inp" value={paymentForm.payment_method}
                    onChange={e => setPaymentForm(p => ({ ...p, payment_method: e.target.value }))}>
                    <option value="upi">UPI</option>
                    <option value="neft">NEFT</option>
                    <option value="cash">Cash</option>
                    <option value="cheque">Cheque</option>
                    <option value="bank_transfer">Bank Transfer</option>
                  </select>
                </FormField>
              </div>

              <FormField label="Payment Date" required>
                <input className="inp" type="date" value={paymentForm.payment_date}
                  onChange={e => setPaymentForm(p => ({ ...p, payment_date: e.target.value }))} />
              </FormField>

              <FormField label="Notes (optional)">
                <input className="inp" placeholder="e.g. UPI ref: 9876543210"
                  value={paymentForm.notes}
                  onChange={e => setPaymentForm(p => ({ ...p, notes: e.target.value }))} />
              </FormField>

              <div className="flex justify-end gap-3">
                <Button variant="ghost" onClick={() => setShowPaymentModal(false)}>Cancel</Button>
                <Button icon={<Wallet size={14} />} loading={paymentSaving}
                  disabled={!paymentForm.amount || !paymentForm.payment_date}
                  onClick={handleRecordPayment}>
                  Record Payment
                </Button>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* Credit Note Modal */}
      <Modal open={!!cnModal} onClose={() => setCnModal(null)} title="Generate Credit Note" width="max-w-sm">
        {cnModal && (
          <div className="space-y-4">
            <div className="p-3 rounded-xl text-xs" style={{ background: 'rgba(167,139,250,0.07)', border: '1px solid rgba(167,139,250,0.2)' }}>
              <div className="font-semibold" style={{ color: '#A78BFA' }}>{cnModal.rental_no}</div>
              <div className="mt-1" style={{ color: '#64748B' }}>
                Original Grand Total: <span style={{ color: '#F1F5F9' }}>₹{Number(cnModal.grand_total).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
            <FormField label="Advance Paid by Client (₹)" required>
              <input className="inp" type="number" min="0" step="0.01"
                value={cnForm.advance_paid}
                onChange={e => setCnForm(p => ({ ...p, advance_paid: e.target.value }))}
                placeholder={String(cnModal.advance_paid)} />
            </FormField>
            <FormField label="Resolution">
              <select className="inp" value={cnForm.resolution}
                onChange={e => setCnForm(p => ({ ...p, resolution: e.target.value }))}>
                <option value="refund">Refund — return money to client</option>
                <option value="adjust_next_invoice">Adjust Next Invoice</option>
                <option value="pending">Pending — decide later</option>
              </select>
            </FormField>
            <FormField label="Notes (optional)">
              <input className="inp" placeholder="e.g. Refund within 7 days"
                value={cnForm.notes}
                onChange={e => setCnForm(p => ({ ...p, notes: e.target.value }))} />
            </FormField>
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setCnModal(null)}>Cancel</Button>
              <Button icon={<ReceiptText size={14} />} loading={cnSaving} onClick={handleCreateCreditNote}>
                Create Credit Note
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Exchange Modal */}
      <Modal open={!!exchangeModal} onClose={() => setExchangeModal(null)} title="Exchange Laptop" width="max-w-md">
        {exchangeModal && (
          <div className="space-y-4">
            {/* Current laptop info */}
            <div className="flex items-start gap-3 p-3 rounded-xl"
              style={{ background: 'rgba(59,130,246,0.07)', border: '1px solid rgba(59,130,246,0.2)' }}>
              <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(59,130,246,0.15)' }}>
                <ArrowLeftRight size={15} style={{ color: '#3B82F6' }} />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold" style={{ color: '#F1F5F9' }}>
                  {exchangeModal.inventory?.brand} {exchangeModal.inventory?.model_no}
                </div>
                <div className="text-xs font-mono" style={{ color: '#475569' }}>
                  {exchangeModal.rental_no} · {exchangeModal.inventory?.asset_code}
                </div>
                <div className="text-xs mt-1" style={{ color: '#64748B' }}>
                  Rental terms (amount, billing cycle) remain unchanged after exchange.
                </div>
              </div>
            </div>

            {/* New laptop selector */}
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: '#94A3B8' }}>
                Replace with <span style={{ color: '#F43F5E' }}>*</span>
              </label>
              <select
                className="inp w-full"
                value={exchangeForm.new_inventory_id}
                onChange={e => setExchangeForm(p => ({ ...p, new_inventory_id: e.target.value }))}>
                <option value="">— Select available laptop —</option>
                {exchangeInvList.map((inv: any) => (
                  <option key={inv.id} value={inv.id}>
                    {inv.brand} {inv.model_no} · {inv.asset_code}{inv.serial_number ? ` · ${inv.serial_number}` : ''}
                  </option>
                ))}
              </select>
              {exchangeForm.new_inventory_id && (() => {
                const inv = exchangeInvList.find((i: any) => String(i.id) === exchangeForm.new_inventory_id);
                return inv ? (
                  <div className="mt-1.5 text-xs px-2 py-1.5 rounded-lg"
                    style={{ background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.2)', color: '#6EE7B7' }}>
                    {inv.cpu}{inv.ram ? ` · ${inv.ram}` : ''}{inv.ssd ? ` · ${inv.ssd}` : ''}
                  </div>
                ) : null;
              })()}
            </div>

            {/* Exchange date */}
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: '#94A3B8' }}>
                Exchange Date <span style={{ color: '#F43F5E' }}>*</span>
              </label>
              <input
                className="inp w-full"
                type="date"
                value={exchangeForm.exchange_date}
                onChange={e => setExchangeForm(p => ({ ...p, exchange_date: e.target.value }))}
              />
            </div>

            {/* Reason */}
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: '#94A3B8' }}>
                Reason <span style={{ color: '#475569' }}>(optional)</span>
              </label>
              <input
                className="inp w-full"
                placeholder="Hardware fault, upgrade request, client preference…"
                value={exchangeForm.reason}
                onChange={e => setExchangeForm(p => ({ ...p, reason: e.target.value }))}
              />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: '#94A3B8' }}>
                Notes <span style={{ color: '#475569' }}>(optional)</span>
              </label>
              <textarea
                className="inp w-full resize-none"
                rows={2}
                placeholder="Any additional details…"
                value={exchangeForm.notes}
                onChange={e => setExchangeForm(p => ({ ...p, notes: e.target.value }))}
              />
            </div>

            <div className="p-3 rounded-xl text-xs"
              style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.18)', color: '#94A3B8' }}>
              The old laptop becomes <strong style={{ color: '#F1F5F9' }}>available</strong>. The new laptop is <strong style={{ color: '#F1F5F9' }}>assigned to this rental</strong>. Monthly charges, GST, and billing dates are unchanged.
            </div>

            <div className="flex justify-end gap-3 pt-1">
              <Button variant="ghost" onClick={() => setExchangeModal(null)}>Cancel</Button>
              <Button
                icon={<ArrowLeftRight size={14} />}
                loading={savingExchange}
                disabled={!exchangeForm.new_inventory_id || !exchangeForm.exchange_date}
                onClick={confirmExchange}>
                Confirm Exchange
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </DashboardLayout>
  );
}
