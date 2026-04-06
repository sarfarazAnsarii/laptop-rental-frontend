'use client';

import { useEffect, useState, useCallback } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button, Modal, PageHeader, FormField, EmptyState, Toast } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { ReceiptText, Eye, SendHorizonal, CheckCircle, RefreshCw, Plus } from 'lucide-react';
import Link from 'next/link';

const fmt = (n: any) => '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });
const fmtDate = (d?: string) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const RESOLUTION_OPTIONS = ['', 'pending', 'refund', 'adjust_next_invoice', 'resolved'];
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

export default function CreditNotesPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [notes, setNotes]         = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [page, setPage]           = useState(1);
  const [lastPage, setLastPage]   = useState(1);
  const [total, setTotal]         = useState(0);
  const [resolution, setResolution] = useState('');
  const [toast, setToast]         = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  // Resolve modal
  const [resolveModal, setResolveModal] = useState<any | null>(null);
  const [resolveForm, setResolveForm]   = useState({ resolution: 'refund', notes: '' });
  const [resolving, setResolving]       = useState(false);

  // Send modal
  const [sendModal, setSendModal]   = useState<any | null>(null);
  const [sending, setSending]       = useState(false);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { per_page: '15', page: String(page) };
      if (resolution) params.resolution = resolution;
      const res = await api.creditNotes.list(params);
      setNotes(res.data?.data || res.data || []);
      setLastPage(res.data?.last_page || 1);
      setTotal(res.data?.total || 0);
    } finally { setLoading(false); }
  }, [page, resolution]);

  useEffect(() => { load(); }, [load]);

  async function handleSend() {
    if (!sendModal) return;
    setSending(true);
    try {
      await api.creditNotes.send(sendModal.id);
      showToast(`Credit note sent to ${sendModal.client?.email || sendModal.rental?.client?.email}`);
      setSendModal(null);
      load();
    } catch (e: any) { showToast(e.message || 'Failed to send', 'error'); }
    finally { setSending(false); }
  }

  async function handleResolve() {
    if (!resolveModal) return;
    setResolving(true);
    try {
      await api.creditNotes.resolve(resolveModal.id, resolveForm);
      showToast('Credit note updated');
      setResolveModal(null);
      load();
    } catch (e: any) { showToast(e.message || 'Failed', 'error'); }
    finally { setResolving(false); }
  }

  return (
    <DashboardLayout>
      <PageHeader
        title="Credit Notes"
        subtitle={`${total} credit note${total !== 1 ? 's' : ''}`}
      />

      {/* Filters */}
      <div className="glass-card p-4 mb-6">
        <select className="inp sm:w-52" value={resolution} onChange={e => { setResolution(e.target.value); setPage(1); }}>
          {RESOLUTION_OPTIONS.map(r => (
            <option key={r} value={r}>{r ? RESOLUTION_LABEL[r] || r : 'All Resolutions'}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="skeleton h-12 rounded-xl" />)}</div>
        ) : notes.length === 0 ? (
          <EmptyState icon={<ReceiptText size={22} />} title="No credit notes" desc="Credit notes are created when a rental is cancelled after advance payment" />
        ) : (
          <>
            {/* Mobile */}
            <div className="sm:hidden divide-y" style={{ borderColor: 'rgba(30,48,88,0.4)' }}>
              {notes.map((cn: any) => (
                <div key={cn.id} className="p-4 space-y-2 animate-fade-in">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-semibold" style={{ color: '#A78BFA' }}>{cn.credit_note_no}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                      style={{ background: `${RESOLUTION_COLOR[cn.resolution] || '#475569'}15`, color: RESOLUTION_COLOR[cn.resolution] || '#475569' }}>
                      {RESOLUTION_LABEL[cn.resolution] || cn.resolution}
                    </span>
                  </div>
                  <div className="text-sm font-medium" style={{ color: '#F1F5F9' }}>{cn.rental?.client?.name || cn.client?.name || '—'}</div>
                  <div className="text-xs font-mono" style={{ color: '#475569' }}>{cn.rental?.rental_no}</div>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs" style={{ color: '#64748B' }}>Credit Amount</div>
                      <div className="text-sm font-bold" style={{ color: '#10B981' }}>{fmt(cn.credit_amount)}</div>
                    </div>
                    <div className="flex gap-1">
                      <Link href={`/credit-notes/${cn.id}`}><Button variant="ghost" size="sm" icon={<Eye size={13} />} /></Link>
                      {isAdmin && cn.resolution === 'pending' && (
                        <Button variant="outline" size="sm" icon={<RefreshCw size={12} />}
                          onClick={() => { setResolveForm({ resolution: 'refund', notes: '' }); setResolveModal(cn); }}>
                          Resolve
                        </Button>
                      )}
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
                    <th>Credit Note No</th>
                    <th>Client</th>
                    <th>Rental</th>
                    <th>Date</th>
                    <th>Advance Paid</th>
                    <th>Pro-rated</th>
                    <th>Credit Amount</th>
                    <th>Resolution</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {notes.map((cn: any) => (
                    <tr key={cn.id} className="animate-fade-in">
                      <td>
                        <span className="font-mono text-xs font-semibold" style={{ color: '#A78BFA' }}>{cn.credit_note_no}</span>
                      </td>
                      <td>
                        <div className="text-sm" style={{ color: '#F1F5F9' }}>{cn.rental?.client?.name || cn.client?.name || '—'}</div>
                        <div className="text-xs" style={{ color: '#475569' }}>{cn.rental?.client?.company || cn.client?.company || ''}</div>
                      </td>
                      <td>
                        <Link href={`/rentals/${cn.rental_id}`} className="font-mono text-xs hover:underline" style={{ color: '#3B82F6' }}>
                          {cn.rental?.rental_no}
                        </Link>
                      </td>
                      <td className="text-xs" style={{ color: '#94A3B8' }}>{fmtDate(cn.created_at)}</td>
                      <td className="text-sm" style={{ color: '#F1F5F9' }}>{fmt(cn.advance_paid)}</td>
                      <td>
                        <div className="text-sm" style={{ color: '#F1F5F9' }}>{fmt(cn.pro_rated_total)}</div>
                        <div className="text-xs" style={{ color: '#475569' }}>{cn.days_used}/{cn.days_in_month} days</div>
                      </td>
                      <td>
                        <div className="text-sm font-bold" style={{ color: '#10B981' }}>{fmt(cn.credit_amount)}</div>
                      </td>
                      <td>
                        <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                          style={{ background: `${RESOLUTION_COLOR[cn.resolution] || '#475569'}18`, color: RESOLUTION_COLOR[cn.resolution] || '#475569' }}>
                          {RESOLUTION_LABEL[cn.resolution] || cn.resolution}
                        </span>
                      </td>
                      <td>
                        <div className="flex items-center gap-1">
                          <Link href={`/credit-notes/${cn.id}`}><Button variant="ghost" size="sm" icon={<Eye size={13} />} /></Link>
                          {isAdmin && (
                            <Button variant="outline" size="sm" icon={<SendHorizonal size={12} />}
                              title="Send credit note to client"
                              onClick={() => setSendModal(cn)} />
                          )}
                          {isAdmin && cn.resolution === 'pending' && (
                            <Button variant="outline" size="sm" icon={<RefreshCw size={12} />}
                              title="Update resolution"
                              onClick={() => { setResolveForm({ resolution: 'refund', notes: '' }); setResolveModal(cn); }} />
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {lastPage > 1 && (
          <div className="flex items-center justify-between px-6 py-4" style={{ borderTop: '1px solid #1E3058' }}>
            <span className="text-xs" style={{ color: '#475569' }}>Page {page} of {lastPage} · {total} total</span>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Prev</Button>
              <Button variant="ghost" size="sm" disabled={page >= lastPage} onClick={() => setPage(p => p + 1)}>Next</Button>
            </div>
          </div>
        )}
      </div>

      {/* Send Modal */}
      <Modal open={!!sendModal} onClose={() => setSendModal(null)} title="Send Credit Note" width="max-w-sm">
        {sendModal && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl" style={{ background: 'rgba(167,139,250,0.07)', border: '1px solid rgba(167,139,250,0.2)' }}>
              <div className="text-sm font-semibold" style={{ color: '#F1F5F9' }}>{sendModal.credit_note_no}</div>
              <div className="text-xs mt-1" style={{ color: '#475569' }}>
                Credit: <span style={{ color: '#10B981', fontWeight: 700 }}>{fmt(sendModal.credit_amount)}</span>
              </div>
              <div className="text-xs mt-1" style={{ color: '#475569' }}>
                To: <span style={{ color: '#A78BFA' }}>{sendModal.rental?.client?.email || sendModal.client?.email || '—'}</span>
              </div>
            </div>
            <p className="text-xs" style={{ color: '#64748B' }}>
              A credit note PDF will be attached and sent to the client's email.
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setSendModal(null)}>Cancel</Button>
              <Button icon={<SendHorizonal size={14} />} loading={sending} onClick={handleSend}>Send</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Resolve Modal */}
      <Modal open={!!resolveModal} onClose={() => setResolveModal(null)} title="Update Resolution" width="max-w-sm">
        {resolveModal && (
          <div className="space-y-4">
            <div className="p-3 rounded-xl text-xs" style={{ background: 'rgba(30,48,88,0.5)', border: '1px solid #1E3058' }}>
              <div className="font-semibold mb-1" style={{ color: '#F1F5F9' }}>{resolveModal.credit_note_no}</div>
              <div style={{ color: '#64748B' }}>Credit: <span style={{ color: '#10B981' }}>{fmt(resolveModal.credit_amount)}</span></div>
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
              <input className="inp" placeholder="e.g. Refund processed via bank transfer"
                value={resolveForm.notes}
                onChange={e => setResolveForm(p => ({ ...p, notes: e.target.value }))} />
            </FormField>
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setResolveModal(null)}>Cancel</Button>
              <Button icon={<CheckCircle size={14} />} loading={resolving} onClick={handleResolve}>Save</Button>
            </div>
          </div>
        )}
      </Modal>

      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </DashboardLayout>
  );
}
