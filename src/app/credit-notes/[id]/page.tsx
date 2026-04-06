'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button, Modal, FormField, Toast } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import {
  ArrowLeft, ReceiptText, SendHorizonal, RefreshCw,
  CheckCircle, FileText, ChevronRight, Building2, Mail, Phone,
} from 'lucide-react';

const fmt = (n: any) => '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });
const fmtDate = (d?: string) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const RESOLUTION_LABEL: Record<string, string> = {
  pending: 'Pending',
  refund: 'Refund',
  adjust_next_invoice: 'Adjust Next Invoice',
  resolved: 'Resolved',
};
const RESOLUTION_COLOR: Record<string, string> = {
  pending: '#F59E0B',
  refund: '#3B82F6',
  adjust_next_invoice: '#A78BFA',
  resolved: '#10B981',
};

export default function CreditNoteDetailPage() {
  const params = useParams();
  const id = Number(params.id);
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [cn, setCn]           = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast]     = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const [resolveModal, setResolveModal] = useState(false);
  const [resolveForm, setResolveForm]   = useState({ resolution: 'refund', notes: '' });
  const [resolving, setResolving]       = useState(false);
  const [sending, setSending]           = useState(false);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.creditNotes.get(id);
      setCn(res.data);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function handleSend() {
    setSending(true);
    try {
      await api.creditNotes.send(id);
      showToast('Credit note sent to client');
      load();
    } catch (e: any) { showToast(e.message || 'Failed', 'error'); }
    finally { setSending(false); }
  }

  async function handleResolve() {
    setResolving(true);
    try {
      await api.creditNotes.resolve(id, resolveForm);
      showToast('Resolution updated');
      setResolveModal(false);
      load();
    } catch (e: any) { showToast(e.message || 'Failed', 'error'); }
    finally { setResolving(false); }
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

  if (!cn) return (
    <DashboardLayout>
      <div className="text-center py-20" style={{ color: '#475569' }}>Credit note not found.</div>
    </DashboardLayout>
  );

  const client = cn.rental?.client || cn.client;
  const resColor = RESOLUTION_COLOR[cn.resolution] || '#475569';

  return (
    <DashboardLayout>
      <div className="animate-fade-in space-y-5">

        {/* Breadcrumb */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2 text-sm" style={{ color: '#475569' }}>
            <Link href="/credit-notes" className="hover:text-blue-400 transition-colors">Credit Notes</Link>
            <ChevronRight size={13} />
            <span style={{ color: '#A78BFA' }}>{cn.credit_note_no}</span>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Link href="/credit-notes">
              <Button variant="ghost" size="sm" icon={<ArrowLeft size={14} />}>Back</Button>
            </Link>
            <Link href={`/credit-notes/${id}/pdf`} target="_blank">
              <Button variant="outline" size="sm" icon={<FileText size={13} />}>View PDF</Button>
            </Link>
            {isAdmin && (
              <>
                <Button variant="outline" size="sm" icon={<SendHorizonal size={13} />}
                  loading={sending} onClick={handleSend}>
                  Send to Client
                </Button>
                {cn.resolution !== 'resolved' && (
                  <Button size="sm" icon={<RefreshCw size={13} />}
                    onClick={() => { setResolveForm({ resolution: cn.resolution || 'refund', notes: '' }); setResolveModal(true); }}>
                    Update Resolution
                  </Button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Hero */}
        <div className="glass-card p-6"
          style={{ background: 'linear-gradient(135deg,rgba(13,27,46,0.95),rgba(17,34,62,0.95))', borderColor: '#1E3058' }}>
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'linear-gradient(135deg,#A78BFA,#7C3AED)', boxShadow: '0 0 30px rgba(167,139,250,0.2)' }}>
              <ReceiptText size={24} color="white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-2">
                <span className="font-mono text-sm px-2.5 py-1 rounded-lg font-semibold"
                  style={{ background: 'rgba(167,139,250,0.15)', color: '#A78BFA', border: '1px solid rgba(167,139,250,0.3)' }}>
                  {cn.credit_note_no}
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                  style={{ background: `${resColor}18`, color: resColor }}>
                  {RESOLUTION_LABEL[cn.resolution] || cn.resolution}
                </span>
              </div>
              <h1 className="text-xl font-bold" style={{ fontFamily: 'Syne, sans-serif', color: '#F1F5F9' }}>Credit Note</h1>
              <p className="text-xs mt-1" style={{ color: '#475569' }}>
                Issued: {fmtDate(cn.created_at)} · Rental:{' '}
                <Link href={`/rentals/${cn.rental_id}`} className="hover:underline" style={{ color: '#3B82F6' }}>
                  {cn.rental?.rental_no}
                </Link>
              </p>
            </div>
          </div>
        </div>

        {/* Client + Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* Client */}
          <div className="glass-card p-5 space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-widest" style={{ color: '#475569', fontFamily: 'Syne, sans-serif' }}>Client</h2>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold flex-shrink-0"
                style={{ background: 'linear-gradient(135deg,#14B8A6,#0D9488)', color: 'white' }}>
                {client?.name?.charAt(0)?.toUpperCase()}
              </div>
              <div>
                <div className="font-semibold text-sm" style={{ color: '#F1F5F9' }}>{client?.name || '—'}</div>
                {client?.company && <div className="text-xs" style={{ color: '#475569' }}>{client.company}</div>}
              </div>
            </div>
            {client?.email && (
              <div className="flex items-center gap-2 text-xs" style={{ color: '#94A3B8' }}>
                <Mail size={12} style={{ color: '#475569' }} /> {client.email}
              </div>
            )}
            {client?.phone && (
              <div className="flex items-center gap-2 text-xs" style={{ color: '#94A3B8' }}>
                <Phone size={12} style={{ color: '#475569' }} /> {client.phone}
              </div>
            )}
            {client?.company && (
              <div className="flex items-center gap-2 text-xs" style={{ color: '#94A3B8' }}>
                <Building2 size={12} style={{ color: '#475569' }} /> {client.company}
              </div>
            )}
          </div>

          {/* Billing Breakdown */}
          <div className="lg:col-span-2 glass-card p-5">
            <h2 className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: '#475569', fontFamily: 'Syne, sans-serif' }}>Credit Breakdown</h2>

            <div className="space-y-0 rounded-xl overflow-hidden" style={{ border: '1px solid #1E3058' }}>
              {[
                { label: 'Advance Paid by Client', value: fmt(cn.advance_paid), color: '#F1F5F9' },
                { label: `Pro-rated Base (${cn.days_used}/${cn.days_in_month} days)`, value: fmt(cn.pro_rated_base), color: '#94A3B8', sub: true },
                { label: `GST on Pro-rated (${cn.gst_percent || 18}%)`, value: fmt(cn.pro_rated_gst), color: '#94A3B8', sub: true },
                { label: 'Amount Owed (pro-rated + GST)', value: fmt(cn.pro_rated_total), color: '#F59E0B' },
              ].map(({ label, value, color, sub }) => (
                <div key={label} className="flex items-center justify-between px-4 py-3"
                  style={{ background: sub ? 'rgba(30,48,88,0.2)' : 'transparent', borderBottom: '1px solid rgba(30,48,88,0.6)' }}>
                  <span className="text-xs" style={{ color: sub ? '#64748B' : '#94A3B8', paddingLeft: sub ? 12 : 0 }}>{label}</span>
                  <span className="text-sm font-semibold" style={{ color }}>{value}</span>
                </div>
              ))}
              <div className="flex items-center justify-between px-4 py-4"
                style={{ background: 'rgba(16,185,129,0.07)', borderTop: '2px solid rgba(16,185,129,0.25)' }}>
                <span className="text-sm font-bold" style={{ color: '#F1F5F9' }}>Credit Amount (to be returned/adjusted)</span>
                <span className="text-lg font-bold" style={{ color: '#10B981' }}>{fmt(cn.credit_amount)}</span>
              </div>
            </div>

            {cn.notes && (
              <div className="mt-3 px-3 py-2.5 rounded-xl text-xs" style={{ background: 'rgba(30,48,88,0.4)', color: '#94A3B8' }}>
                <span style={{ color: '#475569' }}>Notes: </span>{cn.notes}
              </div>
            )}

            {/* Resolution status */}
            <div className="mt-4 flex items-center gap-3 px-4 py-3 rounded-xl"
              style={{ background: `${resColor}0d`, border: `1px solid ${resColor}30` }}>
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: resColor }} />
              <div>
                <div className="text-xs font-semibold" style={{ color: resColor }}>
                  {RESOLUTION_LABEL[cn.resolution] || cn.resolution}
                </div>
                {cn.resolved_at && (
                  <div className="text-xs" style={{ color: '#475569' }}>Resolved: {fmtDate(cn.resolved_at)}</div>
                )}
              </div>
              {cn.resolution === 'refund' && (
                <div className="ml-auto text-xs" style={{ color: '#64748B' }}>
                  Refund ₹{Number(cn.credit_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })} to client
                </div>
              )}
              {cn.resolution === 'adjust_next_invoice' && (
                <div className="ml-auto text-xs" style={{ color: '#64748B' }}>
                  Deduct from next billing cycle
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Resolve Modal */}
      <Modal open={resolveModal} onClose={() => setResolveModal(false)} title="Update Resolution" width="max-w-sm">
        <div className="space-y-4">
          <div className="p-3 rounded-xl text-xs" style={{ background: 'rgba(30,48,88,0.5)', border: '1px solid #1E3058' }}>
            <div className="font-semibold" style={{ color: '#F1F5F9' }}>{cn?.credit_note_no}</div>
            <div className="mt-1" style={{ color: '#64748B' }}>
              Credit Amount: <span style={{ color: '#10B981', fontWeight: 700 }}>{fmt(cn?.credit_amount)}</span>
            </div>
          </div>
          <FormField label="Resolution" required>
            <select className="inp" value={resolveForm.resolution}
              onChange={e => setResolveForm(p => ({ ...p, resolution: e.target.value }))}>
              <option value="refund">Refund — return money to client</option>
              <option value="adjust_next_invoice">Adjust Next Invoice — deduct from future billing</option>
              <option value="resolved">Mark Resolved</option>
            </select>
          </FormField>
          <FormField label="Notes (optional)">
            <input className="inp" placeholder="e.g. Refund processed via NEFT"
              value={resolveForm.notes}
              onChange={e => setResolveForm(p => ({ ...p, notes: e.target.value }))} />
          </FormField>
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setResolveModal(false)}>Cancel</Button>
            <Button icon={<CheckCircle size={14} />} loading={resolving} onClick={handleResolve}>Save</Button>
          </div>
        </div>
      </Modal>

      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </DashboardLayout>
  );
}
