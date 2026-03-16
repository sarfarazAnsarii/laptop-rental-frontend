'use client';

import { ReactNode, useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button, Toast } from '@/components/ui';
import { api } from '@/lib/api';
import { Rental } from '@/types';
import {
  ArrowLeft, FileText, Monitor, User, Calendar,
  CheckCircle, XCircle, Clock, Hash, Building2,
  Mail, Phone, ChevronRight, AlertTriangle,
  ReceiptText, Percent, Package,
} from 'lucide-react';

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

  const [rental, setRental] = useState<Rental | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<'complete' | 'cancel' | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.rentals.get(id);
      setRental(res.data);
    } catch {
      router.push('/rentals');
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => { load(); }, [load]);

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
            {rental.status === 'active' && (
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
              <SectionTitle>Rental Period</SectionTitle>
              <div className="space-y-3.5">
                <InfoRow icon={<Calendar size={13} />} label="Start Date" value={fmtDate(rental.start_date)} />
                <InfoRow icon={<Calendar size={13} />} label="End Date"   value={fmtDate(rental.end_date)} />
                <div className="flex items-center gap-2.5 pt-1">
                  <span style={{ color: '#475569' }}><Clock size={13} /></span>
                  <div>
                    <div className="text-xs mb-0.5" style={{ color: '#475569' }}>Duration</div>
                    <div className="text-lg font-bold" style={{ color: '#3B82F6' }}>{rental.duration_days} days</div>
                  </div>
                </div>
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

      </div>

      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </DashboardLayout>
  );
}
