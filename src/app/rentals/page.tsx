'use client';

import React, { useEffect, useState, useCallback } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button, Modal, PageHeader, FormField, EmptyState, Toast } from '@/components/ui';
import { api } from '@/lib/api';
import { Rental } from '@/types';
import { FileText, Plus, Search, CheckCircle, XCircle, Eye, SendHorizonal, Layers, Trash2, PlusCircle } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';

const STATUS_OPTIONS = ['', 'active', 'completed', 'cancelled', 'overdue'];
const fmt = (n: number) => '₹' + new Intl.NumberFormat('en-IN').format(Number(n));
const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

const EMPTY_FORM = {
  inventory_id: '', client_id: '', delivery_date: '', monthly_rental: '', quantity: '1', gst_percent: '18', notes: '',
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
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [invoiceRental, setInvoiceRental] = useState<Rental | null>(null);
  const [bulkInvoiceGroup, setBulkInvoiceGroup] = useState<Rental[] | null>(null);
  const [sendingInvoice, setSendingInvoice] = useState(false);
  const [inventories, setInventories] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);

  // Bulk rental
  const EMPTY_LAPTOP = { inventory_id: '', monthly_rental: '', quantity: '1' };
  const [showBulk, setShowBulk] = useState(false);
  const [bulkForm, setBulkForm] = useState({ client_id: '', delivery_date: '', gst_percent: '18', notes: '' });
  const [laptops, setLaptops] = useState([{ ...EMPTY_LAPTOP }]);
  const [savingBulk, setSavingBulk] = useState(false);
  const [bulkError, setBulkError] = useState<{ unavailable?: any[] } | null>(null);

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
    const [inv, cli] = await Promise.all([
      api.inventory.available(),
      api.users.list({ role: 'client', per_page: '200' }),
    ]);
    setInventories(inv.data || []);
    setClients(cli.data?.data || cli.data || []);
    setShowModal(true);
  }

  async function openBulk() {
    setBulkForm({ client_id: '', delivery_date: '', gst_percent: '18', notes: '' });
    setLaptops([{ ...EMPTY_LAPTOP }]);
    setBulkError(null);
    const [inv, cli] = await Promise.all([
      api.inventory.available(),
      api.users.list({ role: 'client', per_page: '200' }),
    ]);
    setInventories(inv.data || []);
    setClients(cli.data?.data || cli.data || []);
    setShowBulk(true);
  }

  function setLaptopField(idx: number, key: string, val: string) {
    setLaptops(prev => {
      const next = [...prev];
      if (key === 'inventory_id') {
        const inv = inventories.find((i: any) => String(i.id) === val);
        next[idx] = { ...next[idx], inventory_id: val, monthly_rental: inv?.monthly_rental ? String(inv.monthly_rental) : next[idx].monthly_rental };
      } else {
        next[idx] = { ...next[idx], [key]: val };
      }
      return next;
    });
  }

  async function handleBulkSave() {
    setSavingBulk(true);
    setBulkError(null);
    try {
      await api.rentals.createBulk({
        client_id:    Number(bulkForm.client_id),
        delivery_date: bulkForm.delivery_date,
        gst_percent:  bulkForm.gst_percent ? Number(bulkForm.gst_percent) : undefined,
        notes:        bulkForm.notes || undefined,
        laptops: laptops
          .filter(l => l.inventory_id)
          .map(l => ({
            inventory_id:   Number(l.inventory_id),
            monthly_rental: Number(l.monthly_rental),
            quantity:       Number(l.quantity) || 1,
          })),
      });
      showToast(`${laptops.filter(l => l.inventory_id).length} rental(s) created`);
      setShowBulk(false);
      load();
    } catch (e: any) {
      if (e.unavailable) {
        setBulkError({ unavailable: e.unavailable });
      }
      showToast(e.message || 'Bulk create failed', 'error');
    } finally { setSavingBulk(false); }
  }

  const f = (k: string, v: string) => setForm(p => {
    if (k === 'inventory_id') {
      const inv = inventories.find((i: any) => String(i.id) === v);
      return { ...p, inventory_id: v, monthly_rental: inv?.monthly_rental ? String(inv.monthly_rental) : '' };
    }
    return { ...p, [k]: v };
  });

  async function handleSave() {
    setSaving(true);
    try {
      await api.rentals.create({
        inventory_id: Number(form.inventory_id),
        client_id:    Number(form.client_id),
        monthly_rental: Number(form.monthly_rental),
        delivery_date: form.delivery_date,
        quantity:    form.quantity   ? Number(form.quantity)   : undefined,
        gst_percent: form.gst_percent ? Number(form.gst_percent) : undefined,
        notes:       form.notes || undefined,
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

  function handleSendInvoice(r: Rental) {
    if (!r.client?.email) { showToast('No client email on this rental', 'error'); return; }
    const bid: string | null = (r as any).bulk_id ?? null;
    if (bid) {
      setBulkInvoiceGroup(rentals.filter(x => (x as any).bulk_id === bid));
    } else {
      setInvoiceRental(r);
    }
  }

  function handleSendBulkInvoice(group: Rental[]) {
    if (!group[0]?.client?.email) { showToast('No client email on this rental', 'error'); return; }
    setBulkInvoiceGroup(group);
  }

  async function confirmSendInvoice() {
    if (!invoiceRental) return;
    setSendingInvoice(true);
    try {
      await api.rentals.sendInvoice(invoiceRental.id);
      showToast(`Invoice sent to ${invoiceRental.client!.email}`);
      setInvoiceRental(null);
    } catch (e: any) {
      showToast(e.message || 'Failed to send invoice', 'error');
    } finally { setSendingInvoice(false); }
  }

  async function confirmBulkInvoice() {
    if (!bulkInvoiceGroup) return;
    setSendingInvoice(true);
    try {
      await Promise.all(bulkInvoiceGroup.map(r => api.rentals.sendInvoice(r.id)));
      showToast(`Invoice sent to ${bulkInvoiceGroup[0].client?.email} (${bulkInvoiceGroup.length} rentals)`);
      setBulkInvoiceGroup(null);
    } catch (e: any) {
      showToast(e.message || 'Failed to send invoice', 'error');
    } finally { setSendingInvoice(false); }
  }

  // Group rentals by bulk_id (string or null from API)
  const rentalGroups = (() => {
    const result: Array<{ bulkId: string | null; items: Rental[] }> = [];
    const seen = new Map<string, number>();
    for (const r of rentals) {
      const bid: string | null = (r as any).bulk_id ?? null;
      if (bid && seen.has(bid)) {
        result[seen.get(bid)!].items.push(r);
      } else {
        if (bid) seen.set(bid, result.length);
        result.push({ bulkId: bid, items: [r] });
      }
    }
    return result;
  })();

  return (
    <DashboardLayout>
      <PageHeader
        title="Rentals"
        subtitle={`${total} rentals`}
        action={isAdmin ? (
          <div className="flex gap-2">
            <Button variant="outline" icon={<Layers size={15} />} onClick={openBulk}>Bulk Rental</Button>
            <Button icon={<Plus size={15} />} onClick={openAdd}>New Rental</Button>
          </div>
        ) : undefined}
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
              {rentalGroups.map(({ bulkId, items }) => (
                <div key={bulkId ?? items[0].id}>
                  {/* Bulk group header */}
                  {bulkId && (
                    <div className="px-4 py-2 flex items-center justify-between" style={{ background: 'rgba(139,92,246,0.07)', borderBottom: '1px solid rgba(139,92,246,0.15)' }}>
                      <div className="flex items-center gap-2">
                        <Layers size={12} style={{ color: '#A78BFA' }} />
                        <span className="text-xs font-semibold" style={{ color: '#A78BFA' }}>Bulk · {items.length} laptops</span>
                        <span className="text-xs" style={{ color: '#64748B' }}>{items[0].client?.name}</span>
                      </div>
                      {isAdmin && (
                        <Button variant="outline" size="sm" icon={<SendHorizonal size={12} />} onClick={() => handleSendBulkInvoice(items)}>
                          Invoice All
                        </Button>
                      )}
                    </div>
                  )}
                  {items.map(r => (
                    <div key={r.id} className="p-4 space-y-2 animate-fade-in" style={bulkId ? { paddingLeft: 24, background: 'rgba(139,92,246,0.02)' } : {}}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Link href={`/rentals/${r.id}`} className="font-mono text-xs font-medium" style={{ color: '#3B82F6' }}>{r.rental_no}</Link>
                          {bulkId && <span className="text-xs px-1.5 py-0.5 rounded font-semibold" style={{ background: 'rgba(139,92,246,0.12)', color: '#A78BFA' }}>bulk</span>}
                        </div>
                        <span className={`badge badge-${r.status}`}>{r.status}</span>
                      </div>
                      <div>
                        <div className="text-sm font-medium" style={{ color: '#F1F5F9' }}>{r.inventory?.brand} {r.inventory?.model_no}</div>
                        <div className="text-xs font-mono" style={{ color: '#475569' }}>{r.inventory?.asset_code}</div>
                      </div>
                      {!bulkId && r.client?.name && (
                        <div className="text-xs" style={{ color: '#94A3B8' }}>{r.client.name}{r.client.company ? ` · ${r.client.company}` : ''}</div>
                      )}
                      <div className="flex items-center justify-between pt-1">
                        <div>
                          <div className="text-sm font-semibold" style={{ color: '#10B981' }}>{fmt(r.grand_total)}</div>
                          <div className="text-xs" style={{ color: '#475569' }}>GST: {fmt(r.gst_amount)}</div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Link href={`/rentals/${r.id}`}><Button variant="ghost" size="sm" icon={<Eye size={13} />} /></Link>
                          {isAdmin && !bulkId && <Button variant="outline" size="sm" icon={<SendHorizonal size={13} />} onClick={() => handleSendInvoice(r)} title="Send Invoice" />}
                          {isAdmin && r.status === 'active' && <>
                            <Button variant="success" size="sm" icon={<CheckCircle size={13} />} onClick={() => handleComplete(r.id)} />
                            <Button variant="danger" size="sm" icon={<XCircle size={13} />} onClick={() => handleCancel(r.id)} />
                          </>}
                        </div>
                      </div>
                    </div>
                  ))}
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
                  {rentalGroups.map(({ bulkId, items }) => (
                    <React.Fragment key={bulkId ?? items[0].id}>
                      {/* Bulk group header row */}
                      {bulkId && (() => {
                        const statuses = [...new Set(items.map(r => r.status))];
                        const allStatus = statuses.length === 1 ? statuses[0] : 'mixed';
                        const grandSum = items.reduce((s, r) => s + Number(r.grand_total || 0), 0);
                        const gstSum   = items.reduce((s, r) => s + Number(r.gst_amount  || 0), 0);
                        const client   = items[0].client;
                        return (
                          <tr key={`bulk-${bulkId}`} style={{ background: 'rgba(139,92,246,0.08)', borderLeft: '3px solid #8B5CF6' }}>
                            <td>
                              <div className="flex items-center gap-1.5">
                                <Layers size={13} style={{ color: '#A78BFA' }} />
                                <span className="text-xs font-bold" style={{ color: '#A78BFA' }}>Bulk</span>
                                <span className="text-xs font-mono" style={{ color: '#64748B' }}>{items.length}×</span>
                              </div>
                            </td>
                            <td>
                              <div className="text-xs font-medium" style={{ color: '#94A3B8' }}>{items.length} laptop{items.length > 1 ? 's' : ''}</div>
                              <div className="text-xs font-mono" style={{ color: '#475569' }}>{bulkId}</div>
                            </td>
                            <td>
                              <div className="text-sm font-medium" style={{ color: '#F1F5F9' }}>{client?.name || '—'}</div>
                              {client?.company && <div className="text-xs" style={{ color: '#475569' }}>{client.company}</div>}
                            </td>
                            <td className="hidden md:table-cell">
                              <div className="text-xs" style={{ color: '#F1F5F9' }}>{fmtDate(items[0].start_date)}</div>
                              <div className="text-xs" style={{ color: '#475569' }}>{items[0].duration_days} days</div>
                            </td>
                            <td>
                              <div className="text-sm font-bold" style={{ color: '#10B981' }}>{fmt(grandSum)}</div>
                              <div className="text-xs" style={{ color: '#475569' }}>GST: {fmt(gstSum)}</div>
                            </td>
                            <td>
                              <span className={`badge badge-${allStatus}`}>{allStatus}</span>
                            </td>
                            <td>
                              <div className="flex items-center gap-1">
                                <Link href={`/rentals/bulk/${encodeURIComponent(bulkId)}`}>
                                  <Button variant="ghost" size="sm" icon={<Eye size={13} />} />
                                </Link>
                                {isAdmin && (
                                  <Button variant="outline" size="sm" icon={<SendHorizonal size={12} />} onClick={() => handleSendBulkInvoice(items)} />
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })()}
                      {/* Individual rows */}
                      {items.map(r => (
                        <tr key={r.id} style={bulkId ? { background: 'rgba(139,92,246,0.02)' } : {}}>
                          <td>
                            <div className="flex items-center gap-1.5">
                              {bulkId && <span style={{ width: 12, display: 'inline-block', borderLeft: '2px solid rgba(139,92,246,0.3)', height: 16 }} />}
                              <Link href={`/rentals/${r.id}`} className="font-mono text-xs font-medium" style={{ color: '#3B82F6' }}>{r.rental_no}</Link>
                              {bulkId && <span className="text-xs px-1 py-0.5 rounded font-semibold" style={{ background: 'rgba(139,92,246,0.12)', color: '#A78BFA', fontSize: 10 }}>bulk</span>}
                            </div>
                          </td>
                          <td>
                            <div className="text-sm" style={{ color: '#F1F5F9' }}>{r.inventory?.brand} {r.inventory?.model_no}</div>
                            <div className="text-xs font-mono" style={{ color: '#475569' }}>{r.inventory?.asset_code}</div>
                          </td>
                          <td>
                            {!bulkId && <>
                              <div className="text-sm" style={{ color: '#F1F5F9' }}>{r.client?.name || '—'}</div>
                              <div className="text-xs" style={{ color: '#475569' }}>{r.client?.company || ''}</div>
                            </>}
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
                              {isAdmin && !bulkId && <Button variant="outline" size="sm" icon={<SendHorizonal size={13} />} onClick={() => handleSendInvoice(r)} title="Send Invoice" />}
                              {isAdmin && r.status === 'active' && <>
                                <Button variant="success" size="sm" icon={<CheckCircle size={13} />} onClick={() => handleComplete(r.id)} />
                                <Button variant="danger" size="sm" icon={<XCircle size={13} />} onClick={() => handleCancel(r.id)} />
                              </>}
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

      {/* Create Rental Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title="Create New Rental" width="max-w-lg">
        <div className="space-y-4">
          <FormField label="Laptop (Available)" required>
            <select className="inp" value={form.inventory_id} onChange={e => f('inventory_id', e.target.value)}>
              <option value="">— Select laptop —</option>
              {inventories.map((inv: any) => (
                <option key={inv.id} value={inv.id}>{inv.brand} {inv.model_no} — {inv.asset_code}</option>
              ))}
            </select>
          </FormField>
          <FormField label="Client" required>
            <select className="inp" value={form.client_id} onChange={e => f('client_id', e.target.value)}>
              <option value="">— Select client —</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.name}{c.company ? ` — ${c.company}` : ''}</option>
              ))}
            </select>
          </FormField>
          <FormField label="Delivery Date" required>
            <input className="inp" type="date" value={form.delivery_date} onChange={e => f('delivery_date', e.target.value)} />
          </FormField>
          <div className="grid grid-cols-3 gap-4">
            <FormField label="Monthly Rental (₹)" required>
              <input className="inp" type="number" min="0" value={form.monthly_rental} onChange={e => f('monthly_rental', e.target.value)} placeholder="e.g. 1100" />
            </FormField>
            <FormField label="Quantity">
              <input className="inp" type="number" min="1" value={form.quantity} onChange={e => f('quantity', e.target.value)} />
            </FormField>
            <FormField label="GST (%)">
              <input className="inp" type="number" min="0" max="100" value={form.gst_percent} onChange={e => f('gst_percent', e.target.value)} />
            </FormField>
          </div>

          {/* Live billing preview */}
          {form.monthly_rental && Number(form.monthly_rental) > 0 && (() => {
            const monthly = Number(form.monthly_rental);
            const qty     = Number(form.quantity) || 1;
            const gst     = Number(form.gst_percent) || 0;
            const total      = +(monthly * qty).toFixed(2);
            const gst_amount = +(total * gst / 100).toFixed(2);
            const grand_total = +(total + gst_amount).toFixed(2);
            const loc = (n: number) => '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2 });
            return (
              <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(16,185,129,0.25)' }}>
                <div className="px-4 py-2 text-xs font-bold uppercase tracking-widest" style={{ background: 'rgba(16,185,129,0.07)', color: '#10B981' }}>
                  Billing Preview
                </div>
                <div className="divide-y" style={{ borderColor: 'rgba(30,48,88,0.5)' }}>
                  <div className="flex justify-between px-4 py-2.5 text-sm">
                    <span style={{ color: '#64748B' }}>Monthly Rental × {qty}</span>
                    <span style={{ color: '#F1F5F9' }}>{loc(total)}</span>
                  </div>
                  <div className="flex justify-between px-4 py-2.5 text-sm">
                    <span style={{ color: '#64748B' }}>GST ({gst}%)</span>
                    <span style={{ color: '#F1F5F9' }}>{loc(gst_amount)}</span>
                  </div>
                  <div className="flex justify-between px-4 py-3" style={{ background: 'rgba(16,185,129,0.08)' }}>
                    <span className="text-sm font-bold" style={{ color: '#F1F5F9' }}>Grand Total</span>
                    <span className="text-lg font-bold" style={{ color: '#10B981' }}>{loc(grand_total)}</span>
                  </div>
                </div>
              </div>
            );
          })()}

          <FormField label="Notes">
            <textarea className="inp resize-none" rows={2} value={form.notes} onChange={e => f('notes', e.target.value)} placeholder="Delivered to office..." />
          </FormField>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="ghost" onClick={() => setShowModal(false)}>Cancel</Button>
          <Button
            onClick={handleSave}
            loading={saving}
            disabled={!form.inventory_id || !form.client_id || !form.delivery_date || !form.monthly_rental}
          >
            Create Rental
          </Button>
        </div>
      </Modal>

      {/* Invoice Confirmation Modal */}
      <Modal open={!!invoiceRental} onClose={() => setInvoiceRental(null)} title="Send Invoice" width="max-w-md">
        {invoiceRental && (
          <div className="space-y-4">
            {/* Client */}
            <div className="p-3 rounded-xl flex items-center gap-3" style={{ background: 'rgba(59,130,246,0.07)', border: '1px solid rgba(59,130,246,0.18)' }}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'linear-gradient(135deg,#3B82F6,#14B8A6)', color: 'white', fontWeight: 700, fontSize: 15 }}>
                {invoiceRental.client?.name?.charAt(0)?.toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold truncate" style={{ color: '#F1F5F9' }}>{invoiceRental.client?.name}</div>
                <div className="text-xs truncate" style={{ color: '#3B82F6' }}>{invoiceRental.client?.email}</div>
                {invoiceRental.client?.company && <div className="text-xs truncate" style={{ color: '#475569' }}>{invoiceRental.client.company}</div>}
              </div>
            </div>

            {/* Rental details */}
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #1E3058' }}>
              <div className="px-4 py-2.5 text-xs font-bold uppercase tracking-widest" style={{ background: 'rgba(30,48,88,0.5)', color: '#475569' }}>
                Rental Details
              </div>
              <div className="divide-y" style={{ borderColor: 'rgba(30,48,88,0.6)' }}>
                {[
                  ['Rental No',  invoiceRental.rental_no],
                  ['Laptop',     `${invoiceRental.inventory?.brand || ''} ${invoiceRental.inventory?.model_no || ''}`],
                  ['Asset Code', invoiceRental.inventory?.asset_code || '—'],
                  ['Start Date', fmtDate(invoiceRental.start_date)],
                  ['End Date',   fmtDate(invoiceRental.end_date)],
                  ['Duration',   `${invoiceRental.duration_days} days`],
                  ['Quantity',   String(invoiceRental.quantity)],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between px-4 py-2.5 text-sm">
                    <span style={{ color: '#64748B' }}>{label}</span>
                    <span className="font-medium" style={{ color: '#F1F5F9' }}>{value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Billing */}
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #1E3058' }}>
              <div className="px-4 py-2.5 text-xs font-bold uppercase tracking-widest" style={{ background: 'rgba(30,48,88,0.5)', color: '#475569' }}>
                Billing Summary
              </div>
              <div className="divide-y" style={{ borderColor: 'rgba(30,48,88,0.6)' }}>
                {[
                  ['Monthly Rental',                       fmt(invoiceRental.monthly_rental)],
                  ['Pro-rated Amount',                     fmt(invoiceRental.pro_rental)],
                  [`GST (${invoiceRental.gst_percent}%)`,  fmt(invoiceRental.gst_amount)],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between px-4 py-2.5 text-sm">
                    <span style={{ color: '#64748B' }}>{label}</span>
                    <span style={{ color: '#94A3B8' }}>{value}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between px-4 py-3" style={{ background: 'rgba(16,185,129,0.07)' }}>
                  <span className="text-sm font-bold" style={{ color: '#F1F5F9' }}>Grand Total</span>
                  <span className="text-lg font-bold" style={{ color: '#10B981' }}>{fmt(invoiceRental.grand_total)}</span>
                </div>
              </div>
            </div>

            <p className="text-xs text-center" style={{ color: '#475569' }}>
              Invoice will be sent to <span style={{ color: '#3B82F6' }}>{invoiceRental.client?.email}</span>
            </p>

            <div className="flex justify-end gap-3 pt-1">
              <Button variant="ghost" onClick={() => setInvoiceRental(null)}>Cancel</Button>
              <Button icon={<SendHorizonal size={14} />} loading={sendingInvoice} onClick={confirmSendInvoice}>
                Send Invoice
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Bulk Rental Modal */}
      <Modal open={showBulk} onClose={() => setShowBulk(false)} title="Create Bulk Rental" width="max-w-3xl">
        <div className="space-y-5">

          {/* Header fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <FormField label="Client" required>
              <select className="inp" value={bulkForm.client_id} onChange={e => setBulkForm(p => ({ ...p, client_id: e.target.value }))}>
                <option value="">— Select client —</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{c.name}{c.company ? ` — ${c.company}` : ''}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Delivery Date" required>
              <input className="inp" type="date" value={bulkForm.delivery_date} onChange={e => setBulkForm(p => ({ ...p, delivery_date: e.target.value }))} />
            </FormField>
            <FormField label="GST (%)">
              <input className="inp" type="number" min="0" max="100" value={bulkForm.gst_percent} onChange={e => setBulkForm(p => ({ ...p, gst_percent: e.target.value }))} />
            </FormField>
            <FormField label="Notes">
              <input className="inp" value={bulkForm.notes} onChange={e => setBulkForm(p => ({ ...p, notes: e.target.value }))} placeholder="Office deployment..." />
            </FormField>
          </div>

          {/* Laptop rows */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="text-xs font-bold uppercase tracking-widest" style={{ color: '#475569' }}>Laptops</div>
                <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                  style={{ background: 'rgba(139,92,246,0.12)', color: '#A78BFA' }}>
                  {laptops.filter(l => l.inventory_id).length} selected
                </span>
              </div>
              <button
                type="button"
                onClick={() => setLaptops(p => [...p, { ...EMPTY_LAPTOP }])}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all"
                style={{ background: 'rgba(59,130,246,0.1)', color: '#3B82F6', border: '1px solid rgba(59,130,246,0.2)' }}>
                <PlusCircle size={13} /> Add Laptop
              </button>
            </div>

            {/* Desktop column headers — hidden on mobile */}
            <div className="hidden sm:grid gap-2 px-3 mb-1" style={{ gridTemplateColumns: '1fr 110px 70px 100px 32px' }}>
              {['Laptop', 'Monthly (₹)', 'Qty', 'Subtotal', ''].map(h => (
                <div key={h} className="text-xs font-semibold" style={{ color: '#475569' }}>{h}</div>
              ))}
            </div>

            <div className="space-y-2">
              {laptops.map((row, idx) => {
                const monthly = Number(row.monthly_rental) || 0;
                const qty = Number(row.quantity) || 1;
                const subtotal = monthly * qty;
                const selectedInv = inventories.find((i: any) => String(i.id) === String(row.inventory_id));
                return (
                  <div key={idx} className="rounded-xl overflow-hidden"
                    style={{ background: 'rgba(30,48,88,0.3)', border: '1px solid rgba(30,48,88,0.7)' }}>

                    {/* Mobile layout */}
                    <div className="sm:hidden p-3 space-y-3">
                      {/* Row header */}
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold" style={{ color: '#475569' }}>Laptop {idx + 1}</span>
                        <button
                          type="button"
                          disabled={laptops.length === 1}
                          onClick={() => setLaptops(p => p.filter((_, i) => i !== idx))}
                          className="flex items-center justify-center rounded-lg transition-all disabled:opacity-30"
                          style={{ width: 28, height: 28, background: 'rgba(244,63,94,0.08)', color: '#F43F5E', border: '1px solid rgba(244,63,94,0.2)' }}>
                          <Trash2 size={12} />
                        </button>
                      </div>

                      {/* Laptop selector — full width */}
                      <div>
                        <div className="text-xs mb-1.5 font-medium" style={{ color: '#64748B' }}>Select Laptop</div>
                        <select className="inp w-full" value={row.inventory_id}
                          onChange={e => setLaptopField(idx, 'inventory_id', e.target.value)}>
                          <option value="">— Choose an available laptop —</option>
                          {inventories
                            .filter((inv: any) => !laptops.some((l, i) => i !== idx && String(l.inventory_id) === String(inv.id)))
                            .map((inv: any) => (
                              <option key={inv.id} value={inv.id}>
                                {inv.brand} {inv.model_no} · {inv.asset_code}
                              </option>
                            ))}
                        </select>
                        {selectedInv && (
                          <div className="mt-1.5 text-xs px-2 py-1 rounded-lg flex items-center gap-1.5"
                            style={{ background: 'rgba(59,130,246,0.07)', color: '#64748B' }}>
                            <span style={{ color: '#3B82F6' }}>●</span>
                            {selectedInv.cpu} · {selectedInv.ram} · {selectedInv.ssd}
                          </div>
                        )}
                      </div>

                      {/* Monthly + Qty + Subtotal in a row */}
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <div className="text-xs mb-1 font-medium" style={{ color: '#64748B' }}>Monthly (₹)</div>
                          <input className="inp w-full" type="number" min="0"
                            value={row.monthly_rental}
                            onChange={e => setLaptopField(idx, 'monthly_rental', e.target.value)}
                            placeholder="1100" />
                        </div>
                        <div>
                          <div className="text-xs mb-1 font-medium" style={{ color: '#64748B' }}>Qty</div>
                          <input className="inp w-full" type="number" min="1"
                            value={row.quantity}
                            onChange={e => setLaptopField(idx, 'quantity', e.target.value)} />
                        </div>
                        <div>
                          <div className="text-xs mb-1 font-medium" style={{ color: '#64748B' }}>Subtotal</div>
                          <div className="inp flex items-center text-sm font-bold"
                            style={{ color: '#10B981', background: 'rgba(16,185,129,0.06)' }}>
                            {subtotal > 0 ? '₹' + subtotal.toLocaleString('en-IN') : '—'}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Desktop layout — single row */}
                    <div className="hidden sm:grid gap-2 items-center p-3"
                      style={{ gridTemplateColumns: '1fr 110px 70px 100px 32px' }}>
                      <div>
                        <select className="inp" value={row.inventory_id}
                          onChange={e => setLaptopField(idx, 'inventory_id', e.target.value)}>
                          <option value="">— Select laptop —</option>
                          {inventories
                            .filter((inv: any) => !laptops.some((l, i) => i !== idx && String(l.inventory_id) === String(inv.id)))
                            .map((inv: any) => (
                              <option key={inv.id} value={inv.id}>{inv.brand} {inv.model_no} — {inv.asset_code}</option>
                            ))}
                        </select>
                      </div>
                      <input className="inp" type="number" min="0"
                        value={row.monthly_rental}
                        onChange={e => setLaptopField(idx, 'monthly_rental', e.target.value)}
                        placeholder="1100" />
                      <input className="inp" type="number" min="1"
                        value={row.quantity}
                        onChange={e => setLaptopField(idx, 'quantity', e.target.value)} />
                      <div className="inp flex items-center text-sm font-bold"
                        style={{ color: '#10B981', background: 'rgba(16,185,129,0.06)' }}>
                        {subtotal > 0 ? '₹' + subtotal.toLocaleString('en-IN') : '—'}
                      </div>
                      <button
                        type="button"
                        disabled={laptops.length === 1}
                        onClick={() => setLaptops(p => p.filter((_, i) => i !== idx))}
                        className="flex items-center justify-center rounded-lg transition-all disabled:opacity-30"
                        style={{ width: 32, height: 36, background: 'rgba(244,63,94,0.08)', color: '#F43F5E', border: '1px solid rgba(244,63,94,0.2)' }}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Billing summary */}
          {(() => {
            const gst = Number(bulkForm.gst_percent) || 0;
            const subtotals = laptops.map(l => (Number(l.monthly_rental) || 0) * (Number(l.quantity) || 1));
            const total = subtotals.reduce((a, b) => a + b, 0);
            const gstAmt = +(total * gst / 100).toFixed(2);
            const grand = +(total + gstAmt).toFixed(2);
            if (total === 0) return null;
            const loc = (n: number) => '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2 });
            return (
              <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(16,185,129,0.25)' }}>
                <div className="px-4 py-2 text-xs font-bold uppercase tracking-widest" style={{ background: 'rgba(16,185,129,0.07)', color: '#10B981' }}>
                  Billing Summary · {laptops.filter(l => l.inventory_id).length} laptop(s)
                </div>
                <div className="divide-y" style={{ borderColor: 'rgba(30,48,88,0.5)' }}>
                  <div className="flex justify-between px-4 py-2.5 text-sm">
                    <span style={{ color: '#64748B' }}>Total Rental</span>
                    <span style={{ color: '#F1F5F9' }}>{loc(total)}</span>
                  </div>
                  <div className="flex justify-between px-4 py-2.5 text-sm">
                    <span style={{ color: '#64748B' }}>GST ({gst}%)</span>
                    <span style={{ color: '#F1F5F9' }}>{loc(gstAmt)}</span>
                  </div>
                  <div className="flex justify-between px-4 py-3" style={{ background: 'rgba(16,185,129,0.08)' }}>
                    <span className="text-sm font-bold" style={{ color: '#F1F5F9' }}>Grand Total</span>
                    <span className="text-lg font-bold" style={{ color: '#10B981' }}>{loc(grand)}</span>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Unavailable error */}
          {bulkError?.unavailable && (
            <div className="p-3 rounded-xl" style={{ background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.25)' }}>
              <div className="text-xs font-bold mb-2" style={{ color: '#F43F5E' }}>Unavailable laptops — no rentals were created:</div>
              {bulkError.unavailable.map((u: any) => (
                <div key={u.inventory_id} className="text-xs" style={{ color: '#94A3B8' }}>
                  Row {u.index + 1}: {u.brand} — {u.asset_code} (unavailable)
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 mt-5">
          <Button variant="ghost" onClick={() => setShowBulk(false)}>Cancel</Button>
          <Button
            icon={<Layers size={14} />}
            onClick={handleBulkSave}
            loading={savingBulk}
            disabled={!bulkForm.client_id || !bulkForm.delivery_date || laptops.every(l => !l.inventory_id)}>
            Create {laptops.filter(l => l.inventory_id).length} Rental(s)
          </Button>
        </div>
      </Modal>

      {/* Bulk Invoice Confirmation Modal */}
      <Modal open={!!bulkInvoiceGroup} onClose={() => setBulkInvoiceGroup(null)} title="Send Bulk Invoice" width="max-w-md">
        {bulkInvoiceGroup && (
          <div className="space-y-4">
            {/* Client */}
            <div className="p-3 rounded-xl flex items-center gap-3" style={{ background: 'rgba(139,92,246,0.07)', border: '1px solid rgba(139,92,246,0.2)' }}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'linear-gradient(135deg,#8B5CF6,#6D28D9)', color: 'white', fontWeight: 700, fontSize: 15 }}>
                {bulkInvoiceGroup[0].client?.name?.charAt(0)?.toUpperCase()}
              </div>
              <div>
                <div className="text-sm font-semibold" style={{ color: '#F1F5F9' }}>{bulkInvoiceGroup[0].client?.name}</div>
                <div className="text-xs" style={{ color: '#A78BFA' }}>{bulkInvoiceGroup[0].client?.email}</div>
                {bulkInvoiceGroup[0].client?.company && <div className="text-xs" style={{ color: '#475569' }}>{bulkInvoiceGroup[0].client.company}</div>}
              </div>
            </div>

            {/* Laptops list */}
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #1E3058' }}>
              <div className="px-4 py-2.5 flex items-center gap-2" style={{ background: 'rgba(30,48,88,0.5)' }}>
                <Layers size={13} style={{ color: '#A78BFA' }} />
                <span className="text-xs font-bold uppercase tracking-widest" style={{ color: '#475569' }}>
                  {bulkInvoiceGroup.length} Laptop{bulkInvoiceGroup.length > 1 ? 's' : ''} in this Bulk
                </span>
              </div>
              <div className="divide-y" style={{ borderColor: 'rgba(30,48,88,0.6)' }}>
                {bulkInvoiceGroup.map(r => (
                  <div key={r.id} className="flex items-center justify-between px-4 py-2.5">
                    <div>
                      <div className="text-xs font-medium" style={{ color: '#F1F5F9' }}>{r.inventory?.brand} {r.inventory?.model_no}</div>
                      <div className="text-xs font-mono" style={{ color: '#475569' }}>{r.rental_no} · {r.inventory?.asset_code}</div>
                    </div>
                    <div className="text-sm font-semibold" style={{ color: '#10B981' }}>{fmt(r.grand_total)}</div>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between px-4 py-3" style={{ background: 'rgba(16,185,129,0.07)', borderTop: '1px solid rgba(16,185,129,0.2)' }}>
                <span className="text-sm font-bold" style={{ color: '#F1F5F9' }}>Grand Total</span>
                <span className="text-base font-bold" style={{ color: '#10B981' }}>
                  {fmt(bulkInvoiceGroup.reduce((s, r) => s + Number(r.grand_total || 0), 0))}
                </span>
              </div>
            </div>

            <p className="text-xs text-center" style={{ color: '#475569' }}>
              Invoice for all {bulkInvoiceGroup.length} rental(s) will be sent to{' '}
              <span style={{ color: '#A78BFA' }}>{bulkInvoiceGroup[0].client?.email}</span>
            </p>

            <div className="flex justify-end gap-3 pt-1">
              <Button variant="ghost" onClick={() => setBulkInvoiceGroup(null)}>Cancel</Button>
              <Button icon={<SendHorizonal size={14} />} loading={sendingInvoice} onClick={confirmBulkInvoice}>
                Send Invoice ({bulkInvoiceGroup.length})
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </DashboardLayout>
  );
}
