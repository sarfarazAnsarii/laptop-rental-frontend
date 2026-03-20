'use client';

import { useEffect, useState, useCallback } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button, Modal, PageHeader, FormField, EmptyState, Toast } from '@/components/ui';
import { api } from '@/lib/api';
import { Rental } from '@/types';
import { FileText, Plus, Search, CheckCircle, XCircle, Eye, Calculator } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';

const STATUS_OPTIONS = ['', 'active', 'completed', 'cancelled', 'overdue'];
const fmt = (n: number) => '₹' + new Intl.NumberFormat('en-IN').format(Number(n));
const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

const EMPTY_FORM = {
  inventory_id: '', client_id: '', start_date: '', end_date: '',
  monthly_rental: '', quantity: '1', gst_percent: '18', remarks: '',
};

export default function RentalsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('active');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [billing, setBilling] = useState<any>(null);
  const [calcLoading, setCalcLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [inventories, setInventories] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { per_page: '12', page: String(page) };
      if (status) params.status = status;
      const res = await api.rentals.list(params);
      setRentals(res.data?.data || []);
      setLastPage(res.data?.last_page || 1);
      setTotal(res.data?.total || 0);
    } finally { setLoading(false); }
  }, [page, status]);

  useEffect(() => { load(); }, [load]);

  async function openAdd() {
    setForm({ ...EMPTY_FORM });
    setBilling(null);
    const [inv, cli] = await Promise.all([
      api.inventory.available(),
      api.users.list({ role: 'vendor', per_page: '200' }),
    ]);


    setInventories(inv.data || []);
    setClients(cli.data?.data || cli.data || []);
    setShowModal(true);
  }

  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  async function calcBilling() {
    if (!form.monthly_rental || !form.start_date || !form.end_date) return;
    setCalcLoading(true);
    try {
      const res = await api.rentals.calculateBilling({
        monthly_rental: Number(form.monthly_rental),
        start_date: form.start_date,
        end_date: form.end_date,
        quantity: Number(form.quantity),
        gst_percent: Number(form.gst_percent),
      });
      setBilling(res.data);
    } finally { setCalcLoading(false); }
  }

  async function handleSave() {
    setSaving(true);
    try {
      await api.rentals.create({
        inventory_id: Number(form.inventory_id),
        client_id: Number(form.client_id),
        start_date: form.start_date,
        end_date: form.end_date,
        monthly_rental: Number(form.monthly_rental),
        quantity: Number(form.quantity),
        gst_percent: Number(form.gst_percent),
        remarks: form.remarks,
      });
      showToast('Rental created successfully');
      setShowModal(false);
      load();
    } catch (e: any) {
      showToast(e.message || 'Failed', 'error');
    } finally { setSaving(false); }
  }

  async function handleComplete(id: number) {
    if (!confirm('Mark this rental as completed?')) return;
    try {
      await api.rentals.complete(id);
      showToast('Rental completed');
      load();
    } catch (e: any) { showToast(e.message, 'error'); }
  }

  async function handleCancel(id: number) {
    if (!confirm('Cancel this rental?')) return;
    try {
      await api.rentals.cancel(id);
      showToast('Rental cancelled');
      load();
    } catch (e: any) { showToast(e.message, 'error'); }
  }

  return (
    <DashboardLayout>
      <PageHeader
        title="Rentals"
        subtitle={`${total} rentals`}
        action={isAdmin ? <Button icon={<Plus size={15} />} onClick={openAdd}>New Rental</Button> : undefined}
      />

      {/* Filters */}
      <div className="glass-card p-4 mb-6">
        <select className="inp sm:w-48" value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}>
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s || 'All Status'}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">{[...Array(6)].map((_, i) => <div key={i} className="skeleton h-12 rounded-xl" />)}</div>
        ) : rentals.length === 0 ? (
          <EmptyState icon={<FileText size={22} />} title="No rentals found" desc="Create a new rental to get started" />
        ) : (
          <>
            {/* Mobile card list */}
            <div className="sm:hidden divide-y" style={{ borderColor: 'rgba(30,48,88,0.4)' }}>
              {rentals.map(r => (
                <div key={r.id} className="p-4 space-y-2 animate-fade-in">
                  <div className="flex items-center justify-between gap-2">
                    <Link href={`/rentals/${r.id}`} className="font-mono text-xs font-medium" style={{ color: '#3B82F6' }}>{r.rental_no}</Link>
                    <span className={`badge badge-${r.status}`}>{r.status}</span>
                  </div>
                  <div>
                    <div className="text-sm font-medium" style={{ color: '#F1F5F9' }}>{r.inventory?.brand} {r.inventory?.model_no}</div>
                    <div className="text-xs font-mono" style={{ color: '#475569' }}>{r.inventory?.asset_code}</div>
                  </div>
                  {r.client?.name && (
                    <div className="text-xs" style={{ color: '#94A3B8' }}>{r.client.name}{r.client.company ? ` · ${r.client.company}` : ''}</div>
                  )}
                  <div className="text-xs" style={{ color: '#64748B' }}>
                    {fmtDate(r.start_date)} → {fmtDate(r.end_date)} · {r.duration_days} days
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <div>
                      <div className="text-sm font-semibold" style={{ color: '#10B981' }}>{fmt(r.grand_total)}</div>
                      <div className="text-xs" style={{ color: '#475569' }}>GST: {fmt(r.gst_amount)}</div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Link href={`/rentals/${r.id}`}><Button variant="ghost" size="sm" icon={<Eye size={13} />} /></Link>
                      {isAdmin && r.status === 'active' && <>
                        <Button variant="success" size="sm" icon={<CheckCircle size={13} />} onClick={() => handleComplete(r.id)} />
                        <Button variant="danger" size="sm" icon={<XCircle size={13} />} onClick={() => handleCancel(r.id)} />
                      </>}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Rental No</th>
                    <th>Laptop</th>
                    <th>Client</th>
                    <th className="hidden md:table-cell">Duration</th>
                    <th>Billing</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rentals.map(r => (
                    <tr key={r.id}>
                      <td><Link href={`/rentals/${r.id}`} className="font-mono text-xs font-medium" style={{ color: '#3B82F6' }}>{r.rental_no}</Link></td>
                      <td>
                        <div className="text-sm" style={{ color: '#F1F5F9' }}>{r.inventory?.brand} {r.inventory?.model_no}</div>
                        <div className="text-xs font-mono" style={{ color: '#475569' }}>{r.inventory?.asset_code}</div>
                      </td>
                      <td>
                        <div className="text-sm" style={{ color: '#F1F5F9' }}>{r.client?.name || '—'}</div>
                        <div className="text-xs" style={{ color: '#475569' }}>{r.client?.company || ''}</div>
                      </td>
                      <td className="hidden md:table-cell">
                        <div className="text-xs">
                          <div style={{ color: '#F1F5F9' }}>{fmtDate(r.start_date)}</div>
                          <div style={{ color: '#475569' }}>→ {fmtDate(r.end_date)}</div>
                          <div style={{ color: '#64748B' }}>{r.duration_days} days</div>
                        </div>
                      </td>
                      <td>
                        <div className="text-sm font-semibold" style={{ color: '#10B981' }}>{fmt(r.grand_total)}</div>
                        <div className="text-xs" style={{ color: '#475569' }}>GST: {fmt(r.gst_amount)}</div>
                      </td>
                      <td><span className={`badge badge-${r.status}`}>{r.status}</span></td>
                      <td>
                        <div className="flex items-center gap-1">
                          <Link href={`/rentals/${r.id}`}><Button variant="ghost" size="sm" icon={<Eye size={13} />} /></Link>
                          {r.status === 'active' && <>
                            <Button variant="success" size="sm" icon={<CheckCircle size={13} />} onClick={() => handleComplete(r.id)} />
                            <Button variant="danger" size="sm" icon={<XCircle size={13} />} onClick={() => handleCancel(r.id)} />
                          </>}
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
            <span className="text-xs" style={{ color: '#475569' }}>Page {page} of {lastPage}</span>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Prev</Button>
              <Button variant="ghost" size="sm" disabled={page >= lastPage} onClick={() => setPage(p => p + 1)}>Next</Button>
            </div>
          </div>
        )}
      </div>

      {/* Create Rental Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title="Create New Rental" width="max-w-2xl">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Laptop (Available)" required>
            <select className="inp" value={form.inventory_id} onChange={e => f('inventory_id', e.target.value)}>
              <option value="">Select laptop...</option>
              {inventories.map((inv: any) => (
                <option key={inv.id} value={inv.id}>{inv.brand} {inv.model_no} — {inv.asset_code}</option>
              ))}
            </select>
          </FormField>
          <FormField label="Client (Vendor)" required>
            <select className="inp" value={form.client_id} onChange={e => f('client_id', e.target.value)}>
              <option value="">— Select vendor —</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.name}{c.company ? ` — ${c.company}` : ''}</option>
              ))}
            </select>
          </FormField>
          <FormField label="Start Date" required><input className="inp" type="date" value={form.start_date} onChange={e => f('start_date', e.target.value)} /></FormField>
          <FormField label="End Date" required><input className="inp" type="date" value={form.end_date} onChange={e => f('end_date', e.target.value)} /></FormField>
          <FormField label="Monthly Rental (₹)" required><input className="inp" type="number" value={form.monthly_rental} onChange={e => f('monthly_rental', e.target.value)} placeholder="5000" /></FormField>
          <FormField label="Quantity"><input className="inp" type="number" value={form.quantity} onChange={e => f('quantity', e.target.value)} min="1" /></FormField>
          <FormField label="GST %"><input className="inp" type="number" value={form.gst_percent} onChange={e => f('gst_percent', e.target.value)} /></FormField>
          <div className="flex items-end">
            <Button variant="outline" icon={<Calculator size={14} />} onClick={calcBilling} loading={calcLoading} className="w-full justify-center">Preview Billing</Button>
          </div>
          <div className="col-span-1 sm:col-span-2">
            <FormField label="Remarks"><textarea className="inp resize-none" rows={2} value={form.remarks} onChange={e => f('remarks', e.target.value)} /></FormField>
          </div>
        </div>

        {/* Billing Preview */}
        {billing && (
          <div className="mt-4 p-4 rounded-xl" style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)' }}>
            <div className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: '#10B981' }}>Billing Summary</div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
              {[
                ['Duration', `${billing.duration_days} days`],
                ['Pro Rental', `₹${billing.pro_rental}`],
                ['Qty × Amount', `₹${billing.total}`],
                ['GST ({billing.gst_percent}%)', `₹${billing.gst_amount}`],
              ].map(([l, v]) => (
                <div key={l} className="text-center">
                  <div className="text-xs" style={{ color: '#64748B' }}>{l}</div>
                  <div className="font-semibold" style={{ color: '#F1F5F9' }}>{v}</div>
                </div>
              ))}
              <div className="text-center rounded-lg p-2" style={{ background: 'rgba(16,185,129,0.1)' }}>
                <div className="text-xs" style={{ color: '#64748B' }}>Grand Total</div>
                <div className="text-lg font-bold" style={{ color: '#10B981' }}>₹{billing.grand_total}</div>
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-3 mt-6">
          <Button variant="ghost" onClick={() => setShowModal(false)}>Cancel</Button>
          <Button onClick={handleSave} loading={saving}>Create Rental</Button>
        </div>
      </Modal>

      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </DashboardLayout>
  );
}
