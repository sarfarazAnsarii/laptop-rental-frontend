'use client';

import React, { useEffect, useState, useCallback } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button, Modal, PageHeader, FormField, EmptyState, Toast } from '@/components/ui';
import { api } from '@/lib/api';
import { Rental } from '@/types';
import { FileText, Plus, CheckCircle, XCircle, Eye, SendHorizonal, Layers, Trash2, PlusCircle, Sparkles, RotateCcw, Copy, Check, CreditCard, Clock, Calendar, Scissors } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { generateInvoiceEmail, generateBulkInvoiceEmail } from '@/lib/ai';

const STATUS_OPTIONS = ['', 'active', 'completed', 'cancelled', 'overdue'];
const fmt = (n: number) => '₹' + new Intl.NumberFormat('en-IN').format(Number(n));
const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

/** Returns ISO "YYYY-MM-DD" of the last day of start_date's month */
function billingMonthEnd(startDate: string): string {
  const d = new Date(startDate);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  const y = end.getFullYear();
  const m = String(end.getMonth() + 1).padStart(2, '0');
  const day = String(end.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Billing period = start_date → last day of start month
 * Daily rate     = monthly_rental / actual days in that month (not always 30)
 * Example: rental starts 6 Apr → billing period is 6 Apr–30 Apr (25 days)
 *          daily rate = monthly_rental / 30  (April has 30 days)
 */
function calcDeduction(rental: Rental, returnDate: string) {
  const start       = new Date(rental.start_date);
  // Billing period end = last day of start month
  const billingEnd  = new Date(start.getFullYear(), start.getMonth() + 1, 0);
  const daysInMonth = billingEnd.getDate();                          // actual days in that month
  // Total billable days from start to end of month (inclusive)
  const totalBillingDays = Math.round((billingEnd.getTime() - start.getTime()) / 86400000) + 1;

  const ret            = new Date(returnDate);
  // Cap return at billing end (can't return "after" the month ends for this billing)
  const effectiveRet   = ret > billingEnd ? billingEnd : ret;
  const usedDays       = Math.max(1, Math.round((effectiveRet.getTime() - start.getTime()) / 86400000) + 1);
  const unusedDays     = Math.max(0, totalBillingDays - usedDays);

  const dailyRate  = +(Number(rental.monthly_rental) / daysInMonth).toFixed(2);
  const rawDeduct  = +(dailyRate * unusedDays).toFixed(2);
  const gstDeduct  = +(rawDeduct * (Number(rental.gst_percent) || 18) / 100).toFixed(2);
  const deduction  = +(rawDeduct + gstDeduct).toFixed(2);
  const adjusted   = Math.max(0, +(Number(rental.grand_total) - deduction).toFixed(2));
  return { daysInMonth, totalBillingDays, billingEndISO: billingMonthEnd(rental.start_date), usedDays, unusedDays, dailyRate, rawDeduct, gstDeduct, deduction, adjusted };
}

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
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [invoiceRental, setInvoiceRental] = useState<Rental | null>(null);
  const [bulkInvoiceGroup, setBulkInvoiceGroup] = useState<Rental[] | null>(null);
  const [sendingInvoice, setSendingInvoice] = useState(false);

  // Cancel / Complete modal
  const [actionModal, setActionModal] = useState<{ rental: Rental; type: 'complete' | 'cancel' } | null>(null);
  const [actionForm, setActionForm] = useState({ end_date: '', notes: '' });
  const [actioning, setActioning] = useState(false);

  // AI email composer state
  const [aiSubject,     setAiSubject]     = useState('');
  const [aiBody,        setAiBody]        = useState('');
  const [aiGenerating,  setAiGenerating]  = useState(false);
  const [aiCopied,      setAiCopied]      = useState(false);

  // Return adjustment state
  const [adjustment, setAdjustment] = useState({ enabled: false, return_date: '', reason: '' });
  const [bulkAdjustments, setBulkAdjustments] = useState<Record<number, { enabled: boolean; return_date: string }>>({});
  const [inventories, setInventories] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);

  // Partial cancel
  const [pcSelectedIds,    setPcSelectedIds]    = useState<Set<number>>(new Set());
  const [pcModal,          setPcModal]          = useState(false);
  const [pcForm2,          setPcForm2]          = useState({ end_date: new Date().toISOString().split('T')[0], notes: '' });
  const [pcResult2,        setPcResult2]        = useState<any | null>(null);
  const [pcSaving2,        setPcSaving2]        = useState(false);
  const [pcGroupId,        setPcGroupId]        = useState<string | null>(null); // which bulk group is selecting

  function openPartialCancel(bulkId: string, items: Rental[]) {
    setPcGroupId(bulkId);
    setPcSelectedIds(new Set(items.filter(r => r.status === 'active').map(r => r.id)));
    setPcForm2({ end_date: new Date().toISOString().split('T')[0], notes: '' });
    setPcResult2(null);
    setPcModal(true);
  }

  function pcPreview(r: Rental, endDate: string) {
    const start    = new Date(r.start_date);
    const monthEnd = new Date(start.getFullYear(), start.getMonth() + 1, 0);
    const daysInMonth = monthEnd.getDate();
    const ret      = new Date(endDate);
    const effective = ret > monthEnd ? monthEnd : ret;
    const daysUsed  = Math.max(1, Math.round((effective.getTime() - start.getTime()) / 86400000) + 1);
    const monthly   = Number(r.monthly_rental || 0);
    const qty       = Number(r.quantity || 1);
    const gstPct    = Number((r as any).gst_percent || 18);
    const proBase   = +(monthly * qty * daysUsed / daysInMonth).toFixed(2);
    const proGst    = +(proBase * gstPct / 100).toFixed(2);
    const proTotal  = +(proBase + proGst).toFixed(2);
    const credit    = +(Number(r.grand_total || 0) - proTotal).toFixed(2);
    return { daysInMonth, daysUsed, proTotal, credit };
  }

  async function confirmPartialCancel() {
    setPcSaving2(true);
    try {
      const res = await api.rentals.partialCancel({
        rental_ids: [...pcSelectedIds],
        end_date: pcForm2.end_date,
        notes: pcForm2.notes || undefined,
      });
      setPcResult2(res);
      setPcSelectedIds(new Set());
      load();
    } catch (e: any) { showToast(e.message || 'Partial cancel failed', 'error'); }
    finally { setPcSaving2(false); }
  }

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

  function openActionModal(rental: Rental, type: 'complete' | 'cancel') {
    setActionForm({ end_date: new Date().toISOString().split('T')[0], notes: '' });
    setActionModal({ rental, type });
  }

  async function confirmAction() {
    if (!actionModal) return;
    setActioning(true);
    try {
      const data = { end_date: actionForm.end_date || undefined, notes: actionForm.notes || undefined };
      if (actionModal.type === 'complete') {
        await api.rentals.complete(actionModal.rental.id, data);
        showToast('Rental completed');
      } else {
        await api.rentals.cancel(actionModal.rental.id, data);
        showToast('Rental cancelled');
      }
      setActionModal(null);
      load();
    } catch (e: any) { showToast(e.message || 'Action failed', 'error'); }
    finally { setActioning(false); }
  }

  function handleSendInvoice(r: Rental) {
    if (!r.client?.email) { showToast('No client email on this rental', 'error'); return; }
    setAiSubject(''); setAiBody(''); setAiCopied(false);
    setAdjustment({ enabled: false, return_date: '', reason: '' });
    const bid: string | null = (r as any).bulk_id ?? null;
    if (bid) {
      setBulkInvoiceGroup(rentals.filter(x => (x as any).bulk_id === bid));
      setBulkAdjustments({});
    } else {
      setInvoiceRental(r);
    }
  }

  function handleSendBulkInvoice(group: Rental[]) {
    if (!group[0]?.client?.email) { showToast('No client email on this rental', 'error'); return; }
    setAiSubject(''); setAiBody(''); setAiCopied(false);
    setBulkAdjustments({});
    setBulkInvoiceGroup(group);
  }

  async function handleGenerateEmail(rental: Rental | null, group: Rental[] | null) {
    setAiGenerating(true);
    try {
      const result = rental
        ? await generateInvoiceEmail(rental)
        : await generateBulkInvoiceEmail(group!);
      setAiSubject(result.subject);
      setAiBody(result.body);
    } catch (e: any) {
      showToast(e.message || 'AI generation failed', 'error');
    } finally { setAiGenerating(false); }
  }

  function handleCopyEmail() {
    const text = `Subject: ${aiSubject}\n\n${aiBody}`;
    navigator.clipboard.writeText(text).then(() => {
      setAiCopied(true);
      setTimeout(() => setAiCopied(false), 2000);
    });
  }

  async function confirmSendInvoice() {
    if (!invoiceRental) return;
    setSendingInvoice(true);
    try {
      const adjExtra = adjustment.enabled && adjustment.return_date
        ? { return_date: adjustment.return_date, deduction_amount: calcDeduction(invoiceRental, adjustment.return_date).deduction, deduction_reason: adjustment.reason || undefined }
        : {};
      const extra = { ...(aiSubject || aiBody ? { subject: aiSubject || undefined, body: aiBody || undefined } : {}), ...adjExtra };
      await api.rentals.sendInvoice(invoiceRental.id, Object.keys(extra).length ? extra : undefined);
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
      const aiExtra = aiSubject || aiBody ? { subject: aiSubject || undefined, body: aiBody || undefined } : {};
      await Promise.all(bulkInvoiceGroup.map(r => {
        const adj = bulkAdjustments[r.id];
        const adjExtra = adj?.enabled && adj?.return_date
          ? { return_date: adj.return_date, deduction_amount: calcDeduction(r, adj.return_date).deduction }
          : {};
        const extra = { ...aiExtra, ...adjExtra };
        return api.rentals.sendInvoice(r.id, Object.keys(extra).length ? extra : undefined);
      }));
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
            <Button variant="outline" icon={<Layers size={15} />} onClick={openBulk}>Create Rental</Button>            
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
            {/* Mobile card list — one card per bulk group */}
            <div className="sm:hidden divide-y" style={{ borderColor: 'rgba(30,48,88,0.4)' }}>
              {rentalGroups.map(({ bulkId, items }) => {
                const client   = items[0].client;
                const grandSum = items.reduce((s, r) => s + Number(r.grand_total || 0), 0);
                const statuses = [...new Set(items.map(r => r.status))];
                const startDate = items[0].start_date;
                const pt = (client as any)?.payment_type || 'advance';
                const isAdv = pt === 'advance';

                if (bulkId) return (
                  <div key={bulkId} className="p-4 space-y-3 animate-fade-in">
                    {/* Top: bulk badge + statuses */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Layers size={13} style={{ color: '#A78BFA' }} />
                        <span className="font-mono text-xs font-bold" style={{ color: '#A78BFA' }}>{bulkId.substring(0, 10)}</span>
                        <span className="text-xs px-1.5 py-0.5 rounded font-semibold" style={{ background: 'rgba(139,92,246,0.12)', color: '#A78BFA' }}>{items.length} laptops</span>
                      </div>
                      <div className="flex gap-1 flex-wrap justify-end">
                        {statuses.map(s => <span key={s} className={`badge badge-${s}`}>{s}</span>)}
                      </div>
                    </div>
                    {/* Client + payment type */}
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium" style={{ color: '#F1F5F9' }}>{client?.company || client?.name || '—'}</div>
                        {client?.company && <div className="text-xs" style={{ color: '#94A3B8' }}>{client.name}</div>}
                      </div>
                      <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: isAdv ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)', color: isAdv ? '#10B981' : '#F59E0B' }}>
                        {isAdv ? 'Advance' : 'Postpaid'}
                      </span>
                    </div>
                    {/* Laptops */}
                    <div className="text-xs" style={{ color: '#64748B' }}>
                      {items.map(r => `${r.inventory?.brand} ${r.inventory?.model_no}`).join(' · ')}
                    </div>
                    {/* Billing + amount */}
                    <div className="flex items-center justify-between">
                      <div className="text-xs" style={{ color: '#475569' }}>{fmtDate(startDate)} → {fmtDate(billingMonthEnd(startDate))}</div>
                      <div className="text-sm font-bold" style={{ color: '#10B981' }}>{fmt(grandSum)}</div>
                    </div>
                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <Link href={`/rentals/bulk/${encodeURIComponent(bulkId)}`}>
                        <Button variant="ghost" size="sm" icon={<Eye size={13} />}>View</Button>
                      </Link>
                      {isAdmin && <Button variant="outline" size="sm" icon={<SendHorizonal size={12} />} onClick={() => handleSendBulkInvoice(items)}>Invoice</Button>}
                      {isAdmin && items.some(r => r.status === 'active') && (
                        <Button variant="danger" size="sm" icon={<Scissors size={12} />} onClick={() => openPartialCancel(bulkId, items)}>Cancel</Button>
                      )}
                    </div>
                  </div>
                );

                // Single rental
                const r = items[0];
                return (
                  <div key={r.id} className="p-4 space-y-2 animate-fade-in">
                    <div className="flex items-center justify-between">
                      <Link href={`/rentals/${r.id}`} className="font-mono text-xs font-medium" style={{ color: '#3B82F6' }}>{r.rental_no}</Link>
                      <span className={`badge badge-${r.status}`}>{r.status}</span>
                    </div>
                    <div>
                      <div className="text-sm font-medium" style={{ color: '#F1F5F9' }}>{r.inventory?.brand} {r.inventory?.model_no}</div>
                      <div className="text-xs" style={{ color: '#94A3B8' }}>{r.client?.name}{r.client?.company ? ` · ${r.client.company}` : ''}</div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="text-xs" style={{ color: '#475569' }}>{fmtDate(r.start_date)} → {fmtDate(billingMonthEnd(r.start_date))}</div>
                      <div className="text-sm font-bold" style={{ color: '#10B981' }}>{fmt(r.grand_total)}</div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Link href={`/rentals/${r.id}`}><Button variant="ghost" size="sm" icon={<Eye size={13} />} /></Link>
                      {isAdmin && <Button variant="outline" size="sm" icon={<SendHorizonal size={13} />} onClick={() => handleSendInvoice(r)} />}
                      {isAdmin && r.status === 'active' && <>
                        <Button variant="success" size="sm" icon={<CheckCircle size={13} />} onClick={() => openActionModal(r, 'complete')} />
                        <Button variant="danger" size="sm" icon={<XCircle size={13} />} onClick={() => openActionModal(r, 'cancel')} />
                      </>}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop table — one row per bulk group */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Bulk / Rental</th>
                    <th>Client</th>
                    <th>Laptops</th>
                    <th>Billing Period</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rentalGroups.map(({ bulkId, items }) => {
                    const client   = items[0].client;
                    const grandSum = items.reduce((s, r) => s + Number(r.grand_total || 0), 0);
                    const gstSum   = items.reduce((s, r) => s + Number(r.gst_amount  || 0), 0);
                    const statuses = [...new Set(items.map(r => r.status))];
                    const startDate = items[0].start_date;
                    const pt = (client as any)?.payment_type || 'advance';
                    const isAdv = pt === 'advance';

                    if (bulkId) return (
                      <tr key={`bulk-${bulkId}`}>
                        <td>
                          <div className="flex items-center gap-1.5">
                            <Layers size={12} style={{ color: '#A78BFA' }} />
                            <Link href={`/rentals/bulk/${encodeURIComponent(bulkId)}`} className="font-mono text-xs font-bold" style={{ color: '#A78BFA' }}>
                              {bulkId.substring(0, 10)}
                            </Link>
                          </div>
                          <div className="text-[10px] mt-0.5" style={{ color: '#475569' }}>{items.length} laptop{items.length > 1 ? 's' : ''}</div>
                        </td>
                        <td>
                          <div className="text-sm font-medium" style={{ color: '#F1F5F9' }}>{client?.company || client?.name || '—'}</div>
                          {client?.company && <div className="text-xs" style={{ color: '#64748B' }}>{client.name}</div>}
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold mt-1 inline-block" style={{ background: isAdv ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)', color: isAdv ? '#10B981' : '#F59E0B' }}>
                            {isAdv ? 'advance' : 'postpaid'}
                          </span>
                        </td>
                        <td>
                          <div className="space-y-0.5">
                            {items.map(r => (
                              <div key={r.id} className="text-xs" style={{ color: '#94A3B8' }}>
                                {r.inventory?.brand} {r.inventory?.model_no}
                              </div>
                            ))}
                          </div>
                        </td>
                        <td>
                          <div className="text-xs" style={{ color: '#F1F5F9' }}>{fmtDate(startDate)}</div>
                          <div className="text-xs" style={{ color: '#475569' }}>→ {fmtDate(billingMonthEnd(startDate))}</div>
                        </td>
                        <td>
                          <div className="text-sm font-bold" style={{ color: '#10B981' }}>{fmt(grandSum)}</div>
                          <div className="text-xs" style={{ color: '#475569' }}>GST: {fmt(gstSum)}</div>
                        </td>
                        <td>
                          <div className="flex flex-wrap gap-1">
                            {statuses.map(s => <span key={s} className={`badge badge-${s}`}>{s}</span>)}
                          </div>
                        </td>
                        <td>
                          <div className="flex items-center gap-1">
                            <Link href={`/rentals/bulk/${encodeURIComponent(bulkId)}`}>
                              <Button variant="ghost" size="sm" icon={<Eye size={13} />} />
                            </Link>
                            {isAdmin && <Button variant="outline" size="sm" icon={<SendHorizonal size={12} />} onClick={() => handleSendBulkInvoice(items)} />}
                            {isAdmin && items.some(r => r.status === 'active') && (
                              <Button variant="danger" size="sm" icon={<Scissors size={12} />} onClick={() => openPartialCancel(bulkId, items)} />
                            )}
                          </div>
                        </td>
                      </tr>
                    );

                    // Single rental
                    const r = items[0];
                    return (
                      <tr key={r.id}>
                        <td>
                          <Link href={`/rentals/${r.id}`} className="font-mono text-xs font-medium" style={{ color: '#3B82F6' }}>{r.rental_no}</Link>
                        </td>
                        <td>
                          <div className="text-sm" style={{ color: '#F1F5F9' }}>{client?.company || client?.name || '—'}</div>
                          {client?.company && <div className="text-xs" style={{ color: '#64748B' }}>{client.name}</div>}
                        </td>
                        <td>
                          <div className="text-sm" style={{ color: '#F1F5F9' }}>{r.inventory?.brand} {r.inventory?.model_no}</div>
                          <div className="text-xs font-mono" style={{ color: '#475569' }}>{r.inventory?.asset_code}</div>
                        </td>
                        <td>
                          <div className="text-xs" style={{ color: '#F1F5F9' }}>{fmtDate(r.start_date)}</div>
                          <div className="text-xs" style={{ color: '#475569' }}>→ {fmtDate(r.end_date || billingMonthEnd(r.start_date))}</div>
                        </td>
                        <td>
                          <div className="text-sm font-semibold" style={{ color: '#10B981' }}>{fmt(r.grand_total)}</div>
                          <div className="text-xs" style={{ color: '#475569' }}>GST: {fmt(r.gst_amount)}</div>
                        </td>
                        <td><span className={`badge badge-${r.status}`}>{r.status}</span></td>
                        <td>
                          <div className="flex items-center gap-1">
                            <Link href={`/rentals/${r.id}`}><Button variant="ghost" size="sm" icon={<Eye size={13} />} /></Link>
                            {isAdmin && <Button variant="outline" size="sm" icon={<SendHorizonal size={13} />} onClick={() => handleSendInvoice(r)} />}
                            {isAdmin && r.status === 'active' && <>
                              <Button variant="success" size="sm" icon={<CheckCircle size={13} />} onClick={() => openActionModal(r, 'complete')} />
                              <Button variant="danger" size="sm" icon={<XCircle size={13} />} onClick={() => openActionModal(r, 'cancel')} />
                            </>}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
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

      {/* Invoice Confirmation Modal */}
      <Modal open={!!invoiceRental} onClose={() => setInvoiceRental(null)} title="Send Invoice" width="max-w-lg">
        {invoiceRental && (
          <div className="space-y-4">

            {/* Client + billing summary row */}
            <div className="flex items-center gap-3 p-3 rounded-xl"
              style={{ background: 'rgba(59,130,246,0.07)', border: '1px solid rgba(59,130,246,0.18)' }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-base font-bold"
                style={{ background: 'linear-gradient(135deg,#3B82F6,#14B8A6)', color: 'white' }}>
                {invoiceRental.client?.name?.charAt(0)?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold" style={{ color: '#F1F5F9' }}>{invoiceRental.client?.name}</div>
                <div className="text-xs" style={{ color: '#3B82F6' }}>{invoiceRental.client?.email}</div>
                {invoiceRental.client?.company && <div className="text-xs" style={{ color: '#475569' }}>{invoiceRental.client.company}</div>}
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-xs" style={{ color: '#475569' }}>{invoiceRental.rental_no}</div>
                <div className="text-sm font-bold" style={{ color: '#10B981' }}>{fmt(invoiceRental.grand_total)}</div>
                <div className="text-xs" style={{ color: '#64748B' }}>{invoiceRental.inventory?.brand} {invoiceRental.inventory?.model_no}</div>
              </div>
            </div>

            {/* Payment type + billing period */}
            {(() => {
              const pt = (invoiceRental.client as any)?.payment_type || 'advance';
              const isAdv = pt === 'advance';
              return (
                <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                  style={{ background: isAdv ? 'rgba(16,185,129,0.06)' : 'rgba(245,158,11,0.06)', border: `1px solid ${isAdv ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.2)'}` }}>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {isAdv
                      ? <CreditCard size={13} style={{ color: '#10B981' }} />
                      : <Clock size={13} style={{ color: '#F59E0B' }} />}
                    <span className="text-xs font-bold" style={{ color: isAdv ? '#10B981' : '#F59E0B' }}>
                      {isAdv ? 'Advance' : 'Postpaid'}
                    </span>
                  </div>
                  <div className="flex-1 border-l pl-3" style={{ borderColor: isAdv ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.2)' }}>
                    <div className="flex items-center gap-1.5 text-xs" style={{ color: '#94A3B8' }}>
                      <Calendar size={11} />
                      <span>Billing period: <span style={{ color: '#F1F5F9' }}>{fmtDate(invoiceRental.start_date)}</span> → <span style={{ color: '#F1F5F9' }}>{fmtDate(billingMonthEnd(invoiceRental.start_date))}</span></span>
                    </div>
                    <div className="text-[10px] mt-0.5" style={{ color: isAdv ? '#10B981' : '#F59E0B' }}>
                      {isAdv ? 'Payment due upfront — before period starts' : 'Payment due after month completes'}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* ── Return Adjustment ── */}
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(244,63,94,0.2)', background: 'rgba(244,63,94,0.03)' }}>
              <div className="flex items-center justify-between px-4 py-2.5"
                style={{ background: 'rgba(244,63,94,0.07)', borderBottom: adjustment.enabled ? '1px solid rgba(244,63,94,0.15)' : 'none' }}>
                <div className="flex items-center gap-2">
                  <RotateCcw size={13} style={{ color: '#F43F5E' }} />
                  <span className="text-xs font-bold uppercase tracking-widest" style={{ color: '#F43F5E' }}>Return Adjustment</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ background: 'rgba(244,63,94,0.1)', color: '#F43F5E' }}>
                    {(invoiceRental.client as any)?.payment_type === 'advance' ? 'Credit unused days' : 'Charge actual days used'}
                  </span>
                </div>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <span className="text-xs" style={{ color: '#64748B' }}>Apply</span>
                  <div
                    onClick={() => setAdjustment(p => ({ ...p, enabled: !p.enabled, return_date: '', reason: '' }))}
                    className="relative w-9 h-5 rounded-full transition-all cursor-pointer"
                    style={{ background: adjustment.enabled ? '#F43F5E' : 'rgba(30,48,88,0.8)' }}>
                    <div className="absolute top-0.5 w-4 h-4 rounded-full transition-all"
                      style={{ left: adjustment.enabled ? '18px' : '2px', background: 'white' }} />
                  </div>
                </label>
              </div>

              {adjustment.enabled && (() => {
                const isAdv = (invoiceRental.client as any)?.payment_type !== 'postpaid';
                const calc = adjustment.return_date ? calcDeduction(invoiceRental, adjustment.return_date) : null;
                return (
                  <div className="p-3 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <FormField label="Return Date">
                        <input className="inp" type="date"
                          min={invoiceRental.start_date} max={billingMonthEnd(invoiceRental.start_date)}
                          value={adjustment.return_date}
                          onChange={e => setAdjustment(p => ({ ...p, return_date: e.target.value }))} />
                      </FormField>
                      <FormField label="Reason (optional)">
                        <input className="inp" value={adjustment.reason}
                          onChange={e => setAdjustment(p => ({ ...p, reason: e.target.value }))}
                          placeholder="Early return, project end..." />
                      </FormField>
                    </div>

                    {calc && (
                      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(244,63,94,0.2)' }}>
                        <div className="px-3 py-2 text-xs font-bold uppercase tracking-widest" style={{ background: 'rgba(244,63,94,0.07)', color: '#F43F5E' }}>Deduction Breakdown</div>
                        <div className="divide-y" style={{ borderColor: 'rgba(30,48,88,0.5)' }}>
                          <div className="flex justify-between px-3 py-2 text-xs">
                            <span style={{ color: '#64748B' }}>Billing period ({calc.daysInMonth}-day month)</span>
                            <span style={{ color: '#94A3B8' }}>{calc.totalBillingDays} days ({fmtDate(invoiceRental.start_date)} → {fmtDate(calc.billingEndISO)})</span>
                          </div>
                          <div className="flex justify-between px-3 py-2 text-xs">
                            <span style={{ color: '#64748B' }}>Days used</span>
                            <span style={{ color: '#F1F5F9' }}>{calc.usedDays} days (returned {fmtDate(adjustment.return_date)})</span>
                          </div>
                          <div className="flex justify-between px-3 py-2 text-xs">
                            <span style={{ color: '#64748B' }}>{isAdv ? 'Unused days (credit)' : 'Unused days (deduct)'}</span>
                            <span style={{ color: '#F43F5E' }}>{calc.unusedDays} days × ₹{calc.dailyRate}/day = {fmt(calc.rawDeduct)}</span>
                          </div>
                          <div className="flex justify-between px-3 py-2 text-xs">
                            <span style={{ color: '#64748B' }}>GST on deduction ({invoiceRental.gst_percent}%)</span>
                            <span style={{ color: '#F43F5E' }}>-{fmt(calc.gstDeduct)}</span>
                          </div>
                          <div className="flex justify-between px-3 py-2 text-xs font-semibold" style={{ background: 'rgba(244,63,94,0.06)' }}>
                            <span style={{ color: '#F1F5F9' }}>Total Deduction</span>
                            <span style={{ color: '#F43F5E' }}>-{fmt(calc.deduction)}</span>
                          </div>
                          <div className="flex justify-between px-3 py-3" style={{ background: 'rgba(16,185,129,0.07)', borderTop: '1px solid rgba(16,185,129,0.2)' }}>
                            <span className="text-sm font-bold" style={{ color: '#F1F5F9' }}>Adjusted Invoice Total</span>
                            <span className="text-base font-bold" style={{ color: '#10B981' }}>{fmt(calc.adjusted)}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* ── AI Email Composer ── */}
            <div className="rounded-xl overflow-hidden"
              style={{ border: '1px solid rgba(139,92,246,0.3)', background: 'rgba(139,92,246,0.04)' }}>

              {/* Composer header */}
              <div className="flex items-center justify-between px-4 py-2.5"
                style={{ borderBottom: '1px solid rgba(139,92,246,0.2)', background: 'rgba(139,92,246,0.08)' }}>
                <div className="flex items-center gap-2">
                  <Sparkles size={13} style={{ color: '#A78BFA' }} />
                  <span className="text-xs font-bold uppercase tracking-widest" style={{ color: '#A78BFA' }}>
                    AI Email Composer
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  {(aiSubject || aiBody) && (
                    <button onClick={handleCopyEmail}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold transition-all"
                      style={{ background: aiCopied ? 'rgba(16,185,129,0.15)' : 'rgba(30,48,88,0.6)', color: aiCopied ? '#10B981' : '#64748B', border: `1px solid ${aiCopied ? 'rgba(16,185,129,0.3)' : 'rgba(30,48,88,0.8)'}` }}>
                      {aiCopied ? <><Check size={11} /> Copied</> : <><Copy size={11} /> Copy</>}
                    </button>
                  )}
                  <button
                    onClick={() => handleGenerateEmail(invoiceRental, null)}
                    disabled={aiGenerating}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all disabled:opacity-60"
                    style={{ background: 'linear-gradient(135deg,rgba(139,92,246,0.25),rgba(99,102,241,0.25))', color: '#A78BFA', border: '1px solid rgba(139,92,246,0.35)' }}>
                    {aiGenerating
                      ? <><span className="animate-spin inline-block w-3 h-3 border border-purple-400 border-t-transparent rounded-full" /> Generating…</>
                      : aiSubject
                        ? <><RotateCcw size={11} /> Regenerate</>
                        : <><Sparkles size={11} /> Generate with AI</>}
                  </button>
                </div>
              </div>

              {/* Email fields */}
              <div className="p-3 space-y-2.5">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: '#475569' }}>Subject</div>
                  <input
                    className="inp w-full text-sm"
                    placeholder={aiGenerating ? 'Generating…' : 'Click "Generate with AI" or type manually'}
                    value={aiSubject}
                    onChange={e => setAiSubject(e.target.value)}
                    disabled={aiGenerating}
                  />
                </div>
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: '#475569' }}>Email Body</div>
                  <textarea
                    className="inp w-full text-sm resize-none"
                    rows={7}
                    placeholder={aiGenerating ? 'Generating…' : 'AI will write the email body here. You can edit before sending.'}
                    value={aiBody}
                    onChange={e => setAiBody(e.target.value)}
                    disabled={aiGenerating}
                    style={{ lineHeight: '1.6' }}
                  />
                  {aiBody && (
                    <div className="text-[10px] mt-1 text-right" style={{ color: '#334155' }}>
                      {aiBody.split(' ').filter(Boolean).length} words
                    </div>
                  )}
                </div>
              </div>
            </div>

            <p className="text-xs text-center" style={{ color: '#475569' }}>
              Invoice PDF will be attached and sent to{' '}
              <span style={{ color: '#3B82F6' }}>{invoiceRental.client?.email}</span>
            </p>

            <div className="flex justify-end gap-3">
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
      <Modal open={!!bulkInvoiceGroup} onClose={() => setBulkInvoiceGroup(null)} title="Send Bulk Invoice" width="max-w-lg">
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

            {/* Payment type + billing period */}
            {(() => {
              const pt    = (bulkInvoiceGroup[0].client as any)?.payment_type || 'advance';
              const isAdv = pt === 'advance';
              const startDate = bulkInvoiceGroup[0].start_date;
              return (
                <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                  style={{ background: isAdv ? 'rgba(16,185,129,0.06)' : 'rgba(245,158,11,0.06)', border: `1px solid ${isAdv ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.2)'}` }}>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {isAdv
                      ? <CreditCard size={13} style={{ color: '#10B981' }} />
                      : <Clock size={13} style={{ color: '#F59E0B' }} />}
                    <span className="text-xs font-bold" style={{ color: isAdv ? '#10B981' : '#F59E0B' }}>
                      {isAdv ? 'Advance' : 'Postpaid'}
                    </span>
                  </div>
                  <div className="flex-1 border-l pl-3" style={{ borderColor: isAdv ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.2)' }}>
                    <div className="flex items-center gap-1.5 text-xs" style={{ color: '#94A3B8' }}>
                      <Calendar size={11} />
                      <span>Billing period: <span style={{ color: '#F1F5F9' }}>{fmtDate(startDate)}</span> → <span style={{ color: '#F1F5F9' }}>{fmtDate(billingMonthEnd(startDate))}</span></span>
                    </div>
                    <div className="text-[10px] mt-0.5" style={{ color: isAdv ? '#10B981' : '#F59E0B' }}>
                      {isAdv ? 'Payment due upfront — before period starts' : 'Payment due after month completes'}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* ── Bulk Return Adjustments ── */}
            {(() => {
              const isAdv = (bulkInvoiceGroup[0].client as any)?.payment_type !== 'postpaid';
              const anyEnabled = Object.values(bulkAdjustments).some(a => a.enabled && a.return_date);
              const totalDeduction = bulkInvoiceGroup.reduce((sum, r) => {
                const adj = bulkAdjustments[r.id];
                return sum + (adj?.enabled && adj?.return_date ? calcDeduction(r, adj.return_date).deduction : 0);
              }, 0);
              const originalTotal = bulkInvoiceGroup.reduce((s, r) => s + Number(r.grand_total || 0), 0);
              const adjustedTotal = Math.max(0, originalTotal - totalDeduction);
              return (
                <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(244,63,94,0.2)', background: 'rgba(244,63,94,0.03)' }}>
                  {/* Header */}
                  <div className="flex items-center gap-2 px-4 py-2.5" style={{ background: 'rgba(244,63,94,0.07)', borderBottom: '1px solid rgba(244,63,94,0.15)' }}>
                    <RotateCcw size={13} style={{ color: '#F43F5E' }} />
                    <span className="text-xs font-bold uppercase tracking-widest" style={{ color: '#F43F5E' }}>Return Adjustments</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded font-medium ml-1" style={{ background: 'rgba(244,63,94,0.1)', color: '#F43F5E' }}>
                      {isAdv ? 'Credit unused days' : 'Charge actual days used'}
                    </span>
                    {anyEnabled && (
                      <span className="ml-auto text-xs font-semibold" style={{ color: '#F43F5E' }}>
                        {Object.values(bulkAdjustments).filter(a => a.enabled && a.return_date).length} laptop(s) returned
                      </span>
                    )}
                  </div>

                  {/* Per-rental rows */}
                  <div className="divide-y" style={{ borderColor: 'rgba(30,48,88,0.4)', maxHeight: 240, overflowY: 'auto' }}>
                    {bulkInvoiceGroup.map(r => {
                      const adj = bulkAdjustments[r.id] ?? { enabled: false, return_date: '' };
                      const calc = adj.enabled && adj.return_date ? calcDeduction(r, adj.return_date) : null;
                      return (
                        <div key={r.id} className="px-3 py-2.5 space-y-2">
                          <div className="flex items-center gap-2">
                            {/* Toggle */}
                            <div
                              onClick={() => setBulkAdjustments(p => ({ ...p, [r.id]: { enabled: !(p[r.id]?.enabled), return_date: p[r.id]?.return_date || '' } }))}
                              className="relative w-8 h-4 rounded-full transition-all cursor-pointer flex-shrink-0"
                              style={{ background: adj.enabled ? '#F43F5E' : 'rgba(30,48,88,0.8)' }}>
                              <div className="absolute top-0.5 w-3 h-3 rounded-full transition-all"
                                style={{ left: adj.enabled ? '17px' : '2px', background: 'white' }} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-medium truncate" style={{ color: '#F1F5F9' }}>{r.inventory?.brand} {r.inventory?.model_no}</div>
                              <div className="text-[10px]" style={{ color: '#475569' }}>{r.rental_no} · {fmtDate(r.start_date)}{r.end_date ? ` → ${fmtDate(r.end_date)}` : ''}</div>
                            </div>
                            <div className="text-xs font-semibold flex-shrink-0" style={{ color: calc ? '#F43F5E' : '#10B981' }}>
                              {calc ? `-${fmt(calc.deduction)}` : fmt(r.grand_total)}
                            </div>
                          </div>
                          {adj.enabled && (
                            <div className="flex items-center gap-2 pl-10">
                              <div className="flex-1">
                                <input className="inp w-full text-xs py-1" type="date"
                                  min={r.start_date} max={billingMonthEnd(r.start_date)}
                                  value={adj.return_date}
                                  onChange={e => setBulkAdjustments(p => ({ ...p, [r.id]: { ...p[r.id], return_date: e.target.value } }))} />
                              </div>
                              {calc && (
                                <span className="text-[10px] whitespace-nowrap" style={{ color: '#64748B' }}>
                                  {calc.unusedDays}d unused · ₹{calc.dailyRate}/day
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Total deduction summary */}
                  {anyEnabled && (
                    <div className="divide-y" style={{ borderColor: 'rgba(244,63,94,0.15)', borderTop: '1px solid rgba(244,63,94,0.15)' }}>
                      <div className="flex justify-between px-4 py-2 text-xs">
                        <span style={{ color: '#64748B' }}>Original Total</span>
                        <span style={{ color: '#94A3B8' }}>{fmt(originalTotal)}</span>
                      </div>
                      <div className="flex justify-between px-4 py-2 text-xs font-semibold">
                        <span style={{ color: '#F43F5E' }}>Total Deduction</span>
                        <span style={{ color: '#F43F5E' }}>-{fmt(totalDeduction)}</span>
                      </div>
                      <div className="flex justify-between px-4 py-3" style={{ background: 'rgba(16,185,129,0.07)' }}>
                        <span className="text-sm font-bold" style={{ color: '#F1F5F9' }}>Adjusted Invoice Total</span>
                        <span className="text-base font-bold" style={{ color: '#10B981' }}>{fmt(adjustedTotal)}</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ── AI Email Composer ── */}
            <div className="rounded-xl overflow-hidden"
              style={{ border: '1px solid rgba(139,92,246,0.3)', background: 'rgba(139,92,246,0.04)' }}>
              <div className="flex items-center justify-between px-4 py-2.5"
                style={{ borderBottom: '1px solid rgba(139,92,246,0.2)', background: 'rgba(139,92,246,0.08)' }}>
                <div className="flex items-center gap-2">
                  <Sparkles size={13} style={{ color: '#A78BFA' }} />
                  <span className="text-xs font-bold uppercase tracking-widest" style={{ color: '#A78BFA' }}>
                    AI Email Composer
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  {(aiSubject || aiBody) && (
                    <button onClick={handleCopyEmail}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold transition-all"
                      style={{ background: aiCopied ? 'rgba(16,185,129,0.15)' : 'rgba(30,48,88,0.6)', color: aiCopied ? '#10B981' : '#64748B', border: `1px solid ${aiCopied ? 'rgba(16,185,129,0.3)' : 'rgba(30,48,88,0.8)'}` }}>
                      {aiCopied ? <><Check size={11} /> Copied</> : <><Copy size={11} /> Copy</>}
                    </button>
                  )}
                  <button
                    onClick={() => handleGenerateEmail(null, bulkInvoiceGroup)}
                    disabled={aiGenerating}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all disabled:opacity-60"
                    style={{ background: 'linear-gradient(135deg,rgba(139,92,246,0.25),rgba(99,102,241,0.25))', color: '#A78BFA', border: '1px solid rgba(139,92,246,0.35)' }}>
                    {aiGenerating
                      ? <><span className="animate-spin inline-block w-3 h-3 border border-purple-400 border-t-transparent rounded-full" /> Generating…</>
                      : aiSubject
                        ? <><RotateCcw size={11} /> Regenerate</>
                        : <><Sparkles size={11} /> Generate with AI</>}
                  </button>
                </div>
              </div>
              <div className="p-3 space-y-2.5">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: '#475569' }}>Subject</div>
                  <input
                    className="inp w-full text-sm"
                    placeholder={aiGenerating ? 'Generating…' : 'Click "Generate with AI" or type manually'}
                    value={aiSubject}
                    onChange={e => setAiSubject(e.target.value)}
                    disabled={aiGenerating}
                  />
                </div>
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: '#475569' }}>Email Body</div>
                  <textarea
                    className="inp w-full text-sm resize-none"
                    rows={6}
                    placeholder={aiGenerating ? 'Generating…' : 'AI will write the email body here. You can edit before sending.'}
                    value={aiBody}
                    onChange={e => setAiBody(e.target.value)}
                    disabled={aiGenerating}
                    style={{ lineHeight: '1.6' }}
                  />
                  {aiBody && (
                    <div className="text-[10px] mt-1 text-right" style={{ color: '#334155' }}>
                      {aiBody.split(' ').filter(Boolean).length} words
                    </div>
                  )}
                </div>
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

      {/* Complete / Cancel Modal */}
      <Modal
        open={!!actionModal}
        onClose={() => setActionModal(null)}
        title={actionModal?.type === 'complete' ? 'Complete Rental' : 'Cancel Rental'}
        width="max-w-sm">
        {actionModal && (
          <div className="space-y-4">
            {/* Rental info */}
            <div className="flex items-center gap-3 p-3 rounded-xl"
              style={{ background: actionModal.type === 'complete' ? 'rgba(16,185,129,0.07)' : 'rgba(244,63,94,0.07)', border: `1px solid ${actionModal.type === 'complete' ? 'rgba(16,185,129,0.2)' : 'rgba(244,63,94,0.2)'}` }}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: actionModal.type === 'complete' ? 'rgba(16,185,129,0.15)' : 'rgba(244,63,94,0.12)' }}>
                {actionModal.type === 'complete'
                  ? <CheckCircle size={16} style={{ color: '#10B981' }} />
                  : <XCircle size={16} style={{ color: '#F43F5E' }} />}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold truncate" style={{ color: '#F1F5F9' }}>
                  {actionModal.rental.inventory?.brand} {actionModal.rental.inventory?.model_no}
                </div>
                <div className="text-xs font-mono" style={{ color: '#475569' }}>
                  {actionModal.rental.rental_no} · {actionModal.rental.client?.name}
                </div>
                <div className="text-xs mt-0.5" style={{ color: '#64748B' }}>
                  Started: {fmtDate(actionModal.rental.start_date)}
                </div>
              </div>
            </div>

            <FormField label="Return / End Date" required>
              <input
                className="inp"
                type="date"
                min={actionModal.rental.start_date}
                max={new Date().toISOString().split('T')[0]}
                value={actionForm.end_date}
                onChange={e => setActionForm(p => ({ ...p, end_date: e.target.value }))}
              />
            </FormField>

            <FormField label="Notes (optional)">
              <input
                className="inp"
                value={actionForm.notes}
                onChange={e => setActionForm(p => ({ ...p, notes: e.target.value }))}
                placeholder={actionModal.type === 'complete' ? 'Returned in good condition...' : 'Reason for cancellation...'}
              />
            </FormField>

            <div className="flex justify-end gap-3 pt-1">
              <Button variant="ghost" onClick={() => setActionModal(null)}>Back</Button>
              <Button
                variant={actionModal.type === 'complete' ? 'success' : 'danger'}
                icon={actionModal.type === 'complete' ? <CheckCircle size={14} /> : <XCircle size={14} />}
                loading={actioning}
                disabled={!actionForm.end_date}
                onClick={confirmAction}>
                {actionModal.type === 'complete' ? 'Complete Rental' : 'Cancel Rental'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Partial Cancel Modal */}
      <Modal open={pcModal} onClose={() => { setPcModal(false); setPcResult2(null); }}
        title="Partial Cancel — Early Return" width="max-w-2xl">
        {(() => {
          const groupRentals = pcGroupId
            ? rentals.filter(r => (r as any).bulk_id === pcGroupId)
            : [];
          const selected = groupRentals.filter(r => pcSelectedIds.has(r.id));

          if (pcResult2) return (
            <div className="space-y-4">
              <div className="p-4 rounded-xl text-center" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)' }}>
                <CheckCircle size={28} style={{ color: '#10B981', margin: '0 auto 8px' }} />
                <div className="text-sm font-bold" style={{ color: '#10B981' }}>{pcResult2.message}</div>
                <div className="flex justify-center gap-6 mt-3 text-xs" style={{ color: '#94A3B8' }}>
                  <span>Credit: <strong style={{ color: '#10B981' }}>₹{Number(pcResult2.total_credit || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></span>
                  <span>Adjusted Total: <strong style={{ color: '#F1F5F9' }}>₹{Number(pcResult2.total_adjusted || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></span>
                </div>
              </div>
              {pcResult2.cancelled?.map((c: any) => (
                <div key={c.rental_id} className="px-4 py-3 rounded-xl grid grid-cols-2 gap-x-4 gap-y-1 text-xs"
                  style={{ background: 'rgba(30,48,88,0.4)', border: '1px solid #1E3058' }}>
                  <div className="col-span-2 font-semibold mb-1" style={{ color: '#F1F5F9' }}>{c.rental_no} — {c.inventory}</div>
                  <div style={{ color: '#64748B' }}>Days Used / Month: <span style={{ color: '#F1F5F9' }}>{c.days_used} / {c.days_in_month}</span></div>
                  <div style={{ color: '#64748B' }}>Adjusted Total: <span style={{ color: '#10B981' }}>₹{Number(c.adjusted_total).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
                  <div className="col-span-2" style={{ color: '#64748B' }}>Credit: <span style={{ color: '#F59E0B', fontWeight: 700 }}>₹{Number(c.credit_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
                </div>
              ))}
              <div className="flex justify-end">
                <Button onClick={() => { setPcModal(false); setPcResult2(null); }}>Done</Button>
              </div>
            </div>
          );

          return (
            <div className="space-y-4">
              {/* Selection checkboxes */}
              <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #1E3058' }}>
                <div className="px-4 py-2.5 flex items-center gap-2" style={{ background: 'rgba(244,63,94,0.08)' }}>
                  <Scissors size={13} style={{ color: '#F43F5E' }} />
                  <span className="text-xs font-bold uppercase tracking-widest" style={{ color: '#F43F5E' }}>
                    Select Rentals to Cancel
                  </span>
                </div>
                <div className="divide-y" style={{ borderColor: 'rgba(30,48,88,0.6)' }}>
                  {groupRentals.filter(r => r.status === 'active').map(r => {
                    const preview = pcForm2.end_date ? pcPreview(r, pcForm2.end_date) : null;
                    const checked = pcSelectedIds.has(r.id);
                    return (
                      <label key={r.id} className="flex items-start gap-3 px-4 py-3 cursor-pointer"
                        style={{ background: checked ? 'rgba(244,63,94,0.05)' : undefined }}>
                        <input type="checkbox" checked={checked} style={{ accentColor: '#F43F5E', marginTop: 2, flexShrink: 0 }}
                          onChange={() => setPcSelectedIds(prev => {
                            const next = new Set(prev);
                            next.has(r.id) ? next.delete(r.id) : next.add(r.id);
                            return next;
                          })} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-semibold" style={{ color: '#3B82F6' }}>{r.rental_no}</span>
                            <span className="text-xs" style={{ color: '#94A3B8' }}>{r.inventory?.brand} {r.inventory?.model_no}</span>
                          </div>
                          {preview && (
                            <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs mt-1" style={{ color: '#64748B' }}>
                              <span>Used: <strong style={{ color: '#F1F5F9' }}>{preview.daysUsed}/{preview.daysInMonth}d</strong></span>
                              <span>Pro-rated: <strong style={{ color: '#F1F5F9' }}>₹{preview.proTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></span>
                              <span>Credit: <strong style={{ color: '#10B981' }}>₹{Math.max(0, preview.credit).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></span>
                            </div>
                          )}
                        </div>
                      </label>
                    );
                  })}
                </div>
                {selected.length > 0 && pcForm2.end_date && (() => {
                  const total = selected.reduce((acc, r) => {
                    const p = pcPreview(r, pcForm2.end_date);
                    return { proTotal: acc.proTotal + p.proTotal, credit: acc.credit + Math.max(0, p.credit) };
                  }, { proTotal: 0, credit: 0 });
                  return (
                    <div className="flex items-center justify-between px-4 py-3"
                      style={{ background: 'rgba(244,63,94,0.07)', borderTop: '1px solid rgba(244,63,94,0.2)' }}>
                      <span className="text-xs" style={{ color: '#F43F5E' }}>{selected.length} selected — Total Credit</span>
                      <span className="text-sm font-bold" style={{ color: '#10B981' }}>
                        ₹{total.credit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  );
                })()}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Return / End Date" required>
                  <input className="inp" type="date"
                    value={pcForm2.end_date}
                    onChange={e => setPcForm2(p => ({ ...p, end_date: e.target.value }))} />
                </FormField>
                <FormField label="Notes">
                  <input className="inp" placeholder="e.g. Client returned laptops early"
                    value={pcForm2.notes}
                    onChange={e => setPcForm2(p => ({ ...p, notes: e.target.value }))} />
                </FormField>
              </div>

              <div className="p-3 rounded-xl text-xs" style={{ background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.2)', color: '#94A3B8' }}>
                Pro-rated = (monthly × qty × days used) ÷ days in month + GST. Credit = original grand total − pro-rated total.
              </div>

              <div className="flex justify-end gap-3">
                <Button variant="ghost" onClick={() => setPcModal(false)}>Cancel</Button>
                <Button variant="danger" icon={<Scissors size={14} />}
                  loading={pcSaving2}
                  disabled={!pcForm2.end_date || pcSelectedIds.size === 0}
                  onClick={confirmPartialCancel}>
                  Confirm Cancel ({pcSelectedIds.size})
                </Button>
              </div>
            </div>
          );
        })()}
      </Modal>

      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </DashboardLayout>
  );
}
