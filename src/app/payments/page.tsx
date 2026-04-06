'use client';

import { useEffect, useState, useCallback } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button, Modal, PageHeader, FormField, EmptyState, Toast } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import {
  Wallet, Plus, Eye, Edit2, CheckCircle, TrendingUp,
  TrendingDown, AlertCircle, CreditCard, IndianRupee,
} from 'lucide-react';
import Link from 'next/link';

const fmt = (n: any) => '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });
const fmtDate = (d?: string) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const PAYMENT_TYPE_LABEL: Record<string, string> = {
  advance: 'Advance',
  monthly: 'Monthly',
  credit_adjustment: 'Credit Adj.',
};
const PAYMENT_TYPE_COLOR: Record<string, string> = {
  advance: '#3B82F6',
  monthly: '#10B981',
  credit_adjustment: '#A78BFA',
};
const METHOD_LABEL: Record<string, string> = {
  upi: 'UPI', neft: 'NEFT', cash: 'Cash', cheque: 'Cheque', bank_transfer: 'Bank Transfer',
};

const EMPTY_FORM = {
  client_id: '', rental_id: '', bulk_id: '',
  payment_type: 'advance',
  payment_method: 'upi',
  amount: '',
  payment_date: new Date().toISOString().split('T')[0],
  notes: '',
};

export default function PaymentsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [payments, setPayments]   = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [page, setPage]           = useState(1);
  const [lastPage, setLastPage]   = useState(1);
  const [total, setTotal]         = useState(0);
  const [filterType, setFilterType] = useState('');
  const [toast, setToast]         = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  // Add payment modal
  const [showAdd, setShowAdd]     = useState(false);
  const [form, setForm]           = useState({ ...EMPTY_FORM });
  const [saving, setSaving]       = useState(false);
  const [clients, setClients]     = useState<any[]>([]);
  const [clientRentals, setClientRentals] = useState<any[]>([]);
  const [balance, setBalance]     = useState<any | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);

  // Edit modal
  const [editModal, setEditModal] = useState<any | null>(null);
  const [editForm, setEditForm]   = useState({ payment_method: '', payment_date: '', notes: '' });
  const [editing, setEditing]     = useState(false);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { per_page: '15', page: String(page) };
      if (filterType) params.payment_type = filterType;
      const res = await api.payments.list(params);
      setPayments(res.data?.data || res.data || []);
      setLastPage(res.data?.last_page || 1);
      setTotal(res.data?.total || 0);
    } finally { setLoading(false); }
  }, [page, filterType]);

  useEffect(() => { load(); }, [load]);

  async function openAdd() {
    setForm({ ...EMPTY_FORM });
    setBalance(null);
    setClientRentals([]);
    const res = await api.users.list({ role: 'client', per_page: '200' });
    setClients(res.data?.data || res.data || []);
    setShowAdd(true);
  }

  async function onClientChange(clientId: string) {
    setForm(p => ({ ...p, client_id: clientId, rental_id: '', bulk_id: '' }));
    setClientRentals([]);
    setBalance(null);
    if (!clientId) return;
    // Load client's active rentals + balance in parallel
    setBalanceLoading(true);
    try {
      const [rentRes, balRes] = await Promise.allSettled([
        api.rentals.list({ client_id: clientId, status: 'active', per_page: '100' }),
        api.payments.clientBalance(Number(clientId)),
      ]);
      if (rentRes.status === 'fulfilled') {
        setClientRentals(rentRes.value.data?.data || rentRes.value.data || []);
      }
      if (balRes.status === 'fulfilled') {
        setBalance(balRes.value.data || balRes.value);
      }
    } finally { setBalanceLoading(false); }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const client = clients.find(c => String(c.id) === form.client_id);
      const paymentType = form.payment_type as 'advance' | 'monthly' | 'credit_adjustment';
      await api.payments.create({
        client_id:      Number(form.client_id),
        rental_id:      form.rental_id ? Number(form.rental_id) : undefined,
        bulk_id:        form.bulk_id   || undefined,
        payment_type:   paymentType,
        payment_method: form.payment_method as any,
        amount:         Number(form.amount),
        payment_date:   form.payment_date,
        notes:          form.notes || undefined,
      });
      showToast(`Payment of ${fmt(form.amount)} recorded for ${client?.name || 'client'}`);
      setShowAdd(false);
      load();
    } catch (e: any) { showToast(e.message || 'Failed to record payment', 'error'); }
    finally { setSaving(false); }
  }

  async function handleEdit() {
    if (!editModal) return;
    setEditing(true);
    try {
      await api.payments.update(editModal.id, editForm);
      showToast('Payment updated');
      setEditModal(null);
      load();
    } catch (e: any) { showToast(e.message || 'Failed', 'error'); }
    finally { setEditing(false); }
  }

  // Derive bulk groups from selected client's rentals
  const bulkGroups = [...new Map(
    clientRentals.filter(r => r.bulk_id).map(r => [r.bulk_id, r])
  ).values()];

  const selectedClient = clients.find(c => String(c.id) === form.client_id);
  const paymentTypeIsAdvance = selectedClient?.payment_type === 'advance';

  return (
    <DashboardLayout>
      <PageHeader
        title="Payments"
        subtitle={`${total} payment${total !== 1 ? 's' : ''}`}
        action={isAdmin ? (
          <Button icon={<Plus size={15} />} onClick={openAdd}>Record Payment</Button>
        ) : undefined}
      />

      {/* Filters */}
      <div className="glass-card p-4 mb-6">
        <select className="inp sm:w-52" value={filterType} onChange={e => { setFilterType(e.target.value); setPage(1); }}>
          <option value="">All Types</option>
          <option value="advance">Advance</option>
          <option value="monthly">Monthly</option>
          <option value="credit_adjustment">Credit Adjustment</option>
        </select>
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">{[...Array(6)].map((_, i) => <div key={i} className="skeleton h-12 rounded-xl" />)}</div>
        ) : payments.length === 0 ? (
          <EmptyState icon={<Wallet size={22} />} title="No payments recorded" desc="Record advance or monthly payments for rentals" />
        ) : (
          <>
            {/* Mobile */}
            <div className="sm:hidden divide-y" style={{ borderColor: 'rgba(30,48,88,0.4)' }}>
              {payments.map((p: any) => (
                <div key={p.id} className="p-4 space-y-2 animate-fade-in">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-semibold" style={{ color: '#3B82F6' }}>
                      #{String(p.id).padStart(5, '0')}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                      style={{ background: `${PAYMENT_TYPE_COLOR[p.payment_type] || '#475569'}18`, color: PAYMENT_TYPE_COLOR[p.payment_type] || '#475569' }}>
                      {PAYMENT_TYPE_LABEL[p.payment_type] || p.payment_type}
                    </span>
                  </div>
                  <div className="text-sm font-medium" style={{ color: '#F1F5F9' }}>
                    {p.client?.name || '—'}
                    {p.client?.payment_type && (
                      <span className="ml-2 text-xs px-1.5 py-0.5 rounded font-semibold"
                        style={{ background: p.client.payment_type === 'advance' ? 'rgba(59,130,246,0.12)' : 'rgba(16,185,129,0.12)', color: p.client.payment_type === 'advance' ? '#3B82F6' : '#10B981' }}>
                        {p.client.payment_type}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-lg font-bold" style={{ color: '#10B981' }}>{fmt(p.amount)}</div>
                      <div className="text-xs" style={{ color: '#475569' }}>{METHOD_LABEL[p.payment_method] || p.payment_method} · {fmtDate(p.payment_date)}</div>
                    </div>
                    {isAdmin && (
                      <Button variant="ghost" size="sm" icon={<Edit2 size={13} />}
                        onClick={() => { setEditForm({ payment_method: p.payment_method, payment_date: p.payment_date?.split('T')[0] || '', notes: p.notes || '' }); setEditModal(p); }} />
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Client</th>
                    <th>Type</th>
                    <th>Method</th>
                    <th>Date</th>
                    <th>Rental / Bulk</th>
                    <th>Amount</th>
                    <th>Notes</th>
                    {isAdmin && <th>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p: any) => (
                    <tr key={p.id} className="animate-fade-in">
                      <td className="font-mono text-xs" style={{ color: '#64748B' }}>#{String(p.id).padStart(5, '0')}</td>
                      <td>
                        <div className="text-sm" style={{ color: '#F1F5F9' }}>{p.client?.name || '—'}</div>
                        {p.client?.payment_type && (
                          <span className="text-xs px-1.5 py-0.5 rounded font-semibold"
                            style={{ background: p.client.payment_type === 'advance' ? 'rgba(59,130,246,0.12)' : 'rgba(16,185,129,0.12)', color: p.client.payment_type === 'advance' ? '#3B82F6' : '#10B981' }}>
                            {p.client.payment_type}
                          </span>
                        )}
                      </td>
                      <td>
                        <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                          style={{ background: `${PAYMENT_TYPE_COLOR[p.payment_type] || '#475569'}18`, color: PAYMENT_TYPE_COLOR[p.payment_type] || '#475569' }}>
                          {PAYMENT_TYPE_LABEL[p.payment_type] || p.payment_type}
                        </span>
                      </td>
                      <td className="text-xs" style={{ color: '#94A3B8' }}>{METHOD_LABEL[p.payment_method] || p.payment_method}</td>
                      <td className="text-xs" style={{ color: '#94A3B8' }}>{fmtDate(p.payment_date)}</td>
                      <td>
                        {p.rental?.rental_no && (
                          <Link href={`/rentals/${p.rental_id}`} className="font-mono text-xs hover:underline" style={{ color: '#3B82F6' }}>
                            {p.rental.rental_no}
                          </Link>
                        )}
                        {p.bulk_id && !p.rental?.rental_no && (
                          <Link href={`/rentals/bulk/${encodeURIComponent(p.bulk_id)}`} className="font-mono text-xs hover:underline" style={{ color: '#A78BFA' }}>
                            {p.bulk_id}
                          </Link>
                        )}
                      </td>
                      <td>
                        <div className="text-sm font-bold" style={{ color: p.payment_type === 'credit_adjustment' ? '#A78BFA' : '#10B981' }}>
                          {p.payment_type === 'credit_adjustment' ? '−' : '+'}{fmt(p.amount)}
                        </div>
                      </td>
                      <td className="text-xs" style={{ color: '#64748B', maxWidth: 160 }}>
                        <div className="truncate">{p.notes || '—'}</div>
                      </td>
                      {isAdmin && (
                        <td>
                          <Button variant="ghost" size="sm" icon={<Edit2 size={13} />}
                            onClick={() => { setEditForm({ payment_method: p.payment_method, payment_date: p.payment_date?.split('T')[0] || '', notes: p.notes || '' }); setEditModal(p); }} />
                        </td>
                      )}
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

      {/* Record Payment Modal */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Record Payment" width="max-w-lg">
        <div className="space-y-4">

          {/* Client selector */}
          <FormField label="Client" required>
            <select className="inp" value={form.client_id} onChange={e => onClientChange(e.target.value)}>
              <option value="">— Select client —</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name}{c.company ? ` — ${c.company}` : ''} [{c.payment_type || 'advance'}]
                </option>
              ))}
            </select>
          </FormField>

          {/* Balance summary */}
          {form.client_id && (
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #1E3058' }}>
              <div className="px-4 py-2 flex items-center gap-2" style={{ background: 'rgba(30,48,88,0.5)' }}>
                <IndianRupee size={12} style={{ color: '#475569' }} />
                <span className="text-xs font-bold uppercase tracking-widest" style={{ color: '#475569' }}>
                  Client Balance
                  {selectedClient?.payment_type && (
                    <span className="ml-2 px-1.5 py-0.5 rounded text-xs font-semibold normal-case"
                      style={{ background: paymentTypeIsAdvance ? 'rgba(59,130,246,0.15)' : 'rgba(16,185,129,0.15)', color: paymentTypeIsAdvance ? '#3B82F6' : '#10B981' }}>
                      {selectedClient.payment_type}
                    </span>
                  )}
                </span>
              </div>
              {balanceLoading ? (
                <div className="px-4 py-3 text-xs" style={{ color: '#475569' }}>Loading balance…</div>
              ) : balance ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-0 divide-x divide-y" style={{ borderColor: 'rgba(30,48,88,0.5)' }}>
                  {[
                    { label: 'Total Billed', value: fmt(balance.total_billed), color: '#F1F5F9' },
                    { label: 'Total Paid', value: fmt(balance.total_paid), color: '#10B981' },
                    { label: 'Outstanding', value: fmt(balance.outstanding), color: balance.outstanding > 0 ? '#F43F5E' : '#10B981' },
                    { label: 'Pending Credits', value: fmt(balance.pending_credits), color: '#A78BFA' },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="px-4 py-3 text-center">
                      <div className="text-xs mb-1" style={{ color: '#475569' }}>{label}</div>
                      <div className="text-sm font-bold" style={{ color }}>{value}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="px-4 py-3 text-xs" style={{ color: '#475569' }}>No balance data yet</div>
              )}
            </div>
          )}

          {/* Payment type — reflects client type */}
          <FormField label="Payment Type" required>
            <select className="inp" value={form.payment_type}
              onChange={e => setForm(p => ({ ...p, payment_type: e.target.value }))}>
              {paymentTypeIsAdvance || !form.client_id
                ? <option value="advance">Advance — paid before billing period</option>
                : null}
              {(!paymentTypeIsAdvance || !form.client_id)
                ? <option value="monthly">Monthly — paid after month ends</option>
                : null}
              <option value="credit_adjustment">Credit Adjustment — from credit note</option>
            </select>
          </FormField>

          {/* Rental / Bulk link */}
          {clientRentals.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Rental (optional)">
                <select className="inp" value={form.rental_id}
                  onChange={e => setForm(p => ({ ...p, rental_id: e.target.value, bulk_id: '' }))}>
                  <option value="">— Link to rental (optional) —</option>
                  {clientRentals.map((r: any) => (
                    <option key={r.id} value={r.id}>
                      {r.rental_no} — {r.inventory?.brand} {r.inventory?.model_no}
                    </option>
                  ))}
                </select>
              </FormField>
              {bulkGroups.length > 0 && (
                <FormField label="or Bulk ID (optional)">
                  <select className="inp" value={form.bulk_id}
                    onChange={e => setForm(p => ({ ...p, bulk_id: e.target.value, rental_id: '' }))}>
                    <option value="">— Link to bulk group —</option>
                    {bulkGroups.map((r: any) => (
                      <option key={r.bulk_id} value={r.bulk_id}>{r.bulk_id}</option>
                    ))}
                  </select>
                </FormField>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Amount (₹)" required>
              <input className="inp" type="number" min="0" step="0.01"
                placeholder={balance?.outstanding > 0 ? String(balance.outstanding) : '0.00'}
                value={form.amount}
                onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} />
            </FormField>
            <FormField label="Payment Method" required>
              <select className="inp" value={form.payment_method}
                onChange={e => setForm(p => ({ ...p, payment_method: e.target.value }))}>
                <option value="upi">UPI</option>
                <option value="neft">NEFT</option>
                <option value="cash">Cash</option>
                <option value="cheque">Cheque</option>
                <option value="bank_transfer">Bank Transfer</option>
              </select>
            </FormField>
            <FormField label="Payment Date" required>
              <input className="inp" type="date" value={form.payment_date}
                onChange={e => setForm(p => ({ ...p, payment_date: e.target.value }))} />
            </FormField>
            <FormField label="Notes">
              <input className="inp" placeholder="e.g. UPI ref: 12345"
                value={form.notes}
                onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
            </FormField>
          </div>

          {/* Context hint */}
          <div className="p-3 rounded-xl text-xs" style={{ background: form.payment_type === 'advance' ? 'rgba(59,130,246,0.07)' : form.payment_type === 'credit_adjustment' ? 'rgba(167,139,250,0.07)' : 'rgba(16,185,129,0.07)', border: `1px solid ${form.payment_type === 'advance' ? 'rgba(59,130,246,0.2)' : form.payment_type === 'credit_adjustment' ? 'rgba(167,139,250,0.2)' : 'rgba(16,185,129,0.2)'}`, color: '#94A3B8' }}>
            {form.payment_type === 'advance' && 'Advance payment — received before billing period starts. Client pre-pays for the month.'}
            {form.payment_type === 'monthly' && 'Monthly payment — received after the billing month is fully completed (postpaid).'}
            {form.payment_type === 'credit_adjustment' && 'Credit adjustment — amount from a credit note applied as deduction against outstanding dues.'}
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button icon={<CheckCircle size={14} />} loading={saving}
              disabled={!form.client_id || !form.amount || !form.payment_date}
              onClick={handleSave}>
              Record Payment
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit Payment Modal */}
      <Modal open={!!editModal} onClose={() => setEditModal(null)} title="Edit Payment" width="max-w-sm">
        {editModal && (
          <div className="space-y-4">
            <div className="p-3 rounded-xl text-xs" style={{ background: 'rgba(30,48,88,0.5)', border: '1px solid #1E3058' }}>
              <div className="font-semibold" style={{ color: '#F1F5F9' }}>{editModal.client?.name}</div>
              <div className="mt-1" style={{ color: '#64748B' }}>
                {PAYMENT_TYPE_LABEL[editModal.payment_type] || editModal.payment_type} ·{' '}
                <span style={{ color: '#10B981', fontWeight: 700 }}>{fmt(editModal.amount)}</span>
              </div>
            </div>
            <FormField label="Payment Method">
              <select className="inp" value={editForm.payment_method}
                onChange={e => setEditForm(p => ({ ...p, payment_method: e.target.value }))}>
                <option value="upi">UPI</option>
                <option value="neft">NEFT</option>
                <option value="cash">Cash</option>
                <option value="cheque">Cheque</option>
                <option value="bank_transfer">Bank Transfer</option>
              </select>
            </FormField>
            <FormField label="Payment Date">
              <input className="inp" type="date" value={editForm.payment_date}
                onChange={e => setEditForm(p => ({ ...p, payment_date: e.target.value }))} />
            </FormField>
            <FormField label="Notes">
              <input className="inp" value={editForm.notes}
                onChange={e => setEditForm(p => ({ ...p, notes: e.target.value }))}
                placeholder="e.g. NEFT ref: TXN12345" />
            </FormField>
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setEditModal(null)}>Cancel</Button>
              <Button icon={<CheckCircle size={14} />} loading={editing} onClick={handleEdit}>Save</Button>
            </div>
          </div>
        )}
      </Modal>

      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </DashboardLayout>
  );
}
