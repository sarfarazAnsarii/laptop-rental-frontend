'use client';

import { useEffect, useState, useCallback } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button, Modal, PageHeader, FormField, EmptyState, Toast, Card } from '@/components/ui';
import { api } from '@/lib/api';
import { Inventory } from '@/types';
import {
  Monitor, Plus, Search, Edit, Trash2, Eye, Upload,
  FileSpreadsheet, AlertCircle, CheckCircle2, ImagePlus,
  X, ChevronRight, Filter, LayoutGrid, List, Download,
  Truck, Clock, Calendar, ArrowLeftRight,
} from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';

const STATUS_OPTS = ['', 'available', 'rented', 'maintenance', 'sold', 'returned', 'lost'];
const TYPE_OPTS   = ['', 'office', 'vendor', 'sold'];

const EMPTY_FORM = {
  brand: '', model_no: '', serial_number: '', cpu: '', generation: '', ram: '', ssd: '',
  graphics: '', screen_size: '', purchase_date: '', purchaser: '', status: 'available',
  type: 'office', notes: '', vendor_name: '', vendor_location: '',
};

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  available:   { bg: '#DCFCE7', text: '#15803D' },
  rented:      { bg: '#DBEAFE', text: '#1D4ED8' },
  maintenance: { bg: '#FEF3C7', text: '#92400E' },
  sold:        { bg: '#F1F5F9', text: '#475569' },
  returned:    { bg: '#EDE9FE', text: '#5B21B6' },
};

export default function InventoryPage() {
  const { user } = useAuth();
  const isStaff = user?.role === 'staff';
  const [staffQ,       setStaffQ]       = useState('');
  const [viewMode,     setViewMode]     = useState<'table' | 'grid'>('table');
  const [items,        setItems]        = useState<Inventory[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [page,         setPage]         = useState(1);
  const [lastPage,     setLastPage]     = useState(1);
  const [total,        setTotal]        = useState(0);
  const [search,       setSearch]       = useState('');
  const [serialSearch, setSerialSearch] = useState('');
  const [status,       setStatus]       = useState('');
  const [type,         setType]         = useState('');
  const [showModal,    setShowModal]    = useState(false);
  const [editItem,     setEditItem]     = useState<Inventory | null>(null);
  const [form,         setForm]         = useState({ ...EMPTY_FORM });
  const [saving,       setSaving]       = useState(false);
  const [vendors,      setVendors]      = useState<any[]>([]);
  const [toast,        setToast]        = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [imageFiles,   setImageFiles]   = useState<File[]>([]);
  const [uploadingImg, setUploadingImg] = useState(false);
  const [editImages,   setEditImages]   = useState<string[]>([]);
  const [showImport,         setShowImport]         = useState(false);
  const [importFile,         setImportFile]         = useState<File | null>(null);
  const [importing,          setImporting]          = useState(false);
  const [importDefaultStatus, setImportDefaultStatus] = useState('available');
  const [importResult,       setImportResult]       = useState<{ success: boolean; message: string; failures?: any[] } | null>(null);
  const [exporting,    setExporting]    = useState(false);

  // Schedule state (staff actions)
  const EMPTY_SF = { address: '', scheduled_at: '', contact_name: '', contact_phone: '', employee_name: '', employee_number: '', employee_address: '', notes: '', assigned_to: '', replacement_inventory_id: '', client_id: '', monthly_rental: '' };

  const SCHED_META: Record<
    string,
    {
      label: string;
      color: string;
      bg: string;
      border: string;
      dateLabel: string;
    }
  > = {
    delivery: {
      label: 'New Delivery',
      color: '#3B82F6',
      bg: 'rgba(59,130,246,0.07)',
      border: 'rgba(59,130,246,0.2)',
      dateLabel: 'Delivery Date & Time',
    },

    replacement_delivery: {
      label: 'Replacement Delivery',
      color: '#8B5CF6',
      bg: 'rgba(139,92,246,0.07)',
      border: 'rgba(139,92,246,0.2)',
      dateLabel: 'Replacement Date & Time',
    },

    replacement_receive: {
      label: 'Replacement Receive',
      color: '#0D9488',
      bg: 'rgba(13,148,136,0.07)',
      border: 'rgba(13,148,136,0.2)',
      dateLabel: 'Replacement Date & Time',
    },

    pickup: {
      label: 'Return',
      color: '#F59E0B',
      bg: 'rgba(245,158,11,0.07)',
      border: 'rgba(245,158,11,0.2)',
      dateLabel: 'Return Date & Time',
    },
  };
  const [schedModal,   setSchedModal]   = useState<string | null>(null);
  const [schedItem,    setSchedItem]    = useState<Inventory | null>(null);
  const [schedForm,    setSchedForm]    = useState({ ...EMPTY_SF });
  const [staffUsers,   setStaffUsers]   = useState<any[]>([]);
  const [schedSaving,  setSchedSaving]  = useState(false);
  const [rentalScheds, setRentalScheds] = useState<Record<number, any[]>>({});

  // Available inventory for replacement / exchange selectors
  const [availableInvs, setAvailableInvs] = useState<any[]>([]);
  const [replSearch,    setReplSearch]    = useState('');
  const [replFocus,     setReplFocus]     = useState(false);

  // Exchange modal
  const [exchModal,         setExchModal]         = useState<Inventory | null>(null);
  const [exchForm,          setExchForm]          = useState({ new_inventory_id: '', exchange_date: '', reason: '', notes: '', client_id: '', rental_id: '' });
  const [exchSaving,        setExchSaving]        = useState(false);
  const [exchSearch,        setExchSearch]        = useState('');
  const [exchFocus,         setExchFocus]         = useState(false);
  const [exchClientRentals, setExchClientRentals] = useState<any[]>([]);
  const [exchRentalsLoading, setExchRentalsLoading] = useState(false);

  // Clients list (for delivery + exchange on available laptops)
  const [clients,          setClients]          = useState<any[]>([]);
  const [clientSearch,     setClientSearch]     = useState('');
  const [clientFocus,      setClientFocus]      = useState(false);
  const [exchClientSearch, setExchClientSearch] = useState('');
  const [exchClientFocus,  setExchClientFocus]  = useState(false);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const load = useCallback(async () => {
    if (isStaff && !serialSearch.trim() && !search.trim()) return;
    setLoading(true);
    try {
      const p: Record<string, string> = { per_page: '15', page: String(page) };
      if (search)       p.search        = search;
      if (serialSearch) p.serial_number = serialSearch;
      if (status)       p.status        = status;
      if (type)         p.type          = type;
      const res = await api.inventory.list(p);      
      setItems(res.data?.data || []);
      setLastPage(res.data?.last_page || 1);
      setTotal(res.data?.total || 0);
    } finally { setLoading(false); }
  }, [page, search, serialSearch, status, type, isStaff]);

  function doStaffSearch() {
    const q = staffQ.trim();
    if (!q) return;
    setSearch(q); setSerialSearch(''); setPage(1);
  }

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    api.users.list({ role: 'vendor', per_page: '200' })
      .then((r: any) => setVendors(r.data?.data || r.data || [])).catch(() => {});
  }, []);

  // Load staff + admin users for schedule assignment
  useEffect(() => {
    if (!isStaff) return;
    api.users.list({ role: 'staff', per_page: '100' })
      .then(res => {
        const staff = res.data?.data || res.data || [];
        api.users.list({ role: 'admin', per_page: '100' })
          .then(res2 => setStaffUsers([...staff, ...(res2.data?.data || res2.data || [])]))
          .catch(() => setStaffUsers(staff));
      }).catch(() => {});
  }, [isStaff]);

  // Fetch schedules for each result's active rental (staff only)
  useEffect(() => {
    if (!isStaff || items.length === 0) return;
    const rentalIds = items.map(i => (i as any).active_rental?.id).filter(Boolean) as number[];
    if (rentalIds.length === 0) return;
    Promise.all(
      rentalIds.map(rid =>
        api.rentals.schedules.list(rid)
          .then(res => ({ rid, scheds: res.data?.data || res.data || [] }))
          .catch(() => ({ rid, scheds: [] }))
      )
    ).then(results => {
      const map: Record<number, any[]> = {};
      results.forEach(({ rid, scheds }) => { map[rid] = scheds; });
      setRentalScheds(map);
    });
  }, [items, isStaff]);

  function fetchClients() {
    api.clients.list({ per_page: '300' })
      .then(res => setClients(res.data?.data || res.data || []))
      .catch(() => {});
  }

  function openSchedModal(type: string, item: Inventory) {
    setSchedItem(item);
    setSchedModal(type);
    setSchedForm({ ...EMPTY_SF });
    setReplSearch(''); setReplFocus(false);
    setClientSearch(''); setClientFocus(false);
    if (type === 'replacement_receive') {
      api.inventory.list({ status: 'available', per_page: '200' })
        .then(res => setAvailableInvs(res.data?.data || res.data || []))
        .catch(() => {});
    }
    if (type === 'delivery') fetchClients();
  }

  function openExchangeModal(item: Inventory) {
    setExchModal(item);
    setExchForm({ new_inventory_id: '', exchange_date: '', reason: '', notes: '', client_id: '', rental_id: '' });
    setExchSearch(''); setExchFocus(false);
    setExchClientSearch(''); setExchClientFocus(false);
    setExchClientRentals([]); setExchRentalsLoading(false);
    api.inventory.list({ status: 'available', per_page: '200' })
      .then(res => setAvailableInvs(res.data?.data || res.data || []))
      .catch(() => {});
    if (item.status === 'available') fetchClients();
  }

  const sf = (k: string, v: string) => setSchedForm(p => ({ ...p, [k]: v }));
  const ef = (k: string, v: string) => setExchForm(p => ({ ...p, [k]: v }));

  async function handleExchangeSubmit() {
    if (!exchModal) return;
    const isAvailable = exchModal.status === 'available';
    const rentalId = isAvailable ? Number(exchForm.rental_id) : (exchModal as any).active_rental?.id;

    if (!isAvailable && !rentalId) { showToast('No active rental found for this laptop', 'error'); return; }
    if (!isAvailable && !exchForm.new_inventory_id) { showToast('Please select a replacement laptop', 'error'); return; }
    if (isAvailable && !exchForm.client_id) { showToast('Please select a client', 'error'); return; }
    if (isAvailable && !exchForm.rental_id) { showToast('Please select the rented laptop to replace', 'error'); return; }
    if (!exchForm.exchange_date) { showToast('Exchange date is required', 'error'); return; }
    setExchSaving(true);
    // For available laptops, this laptop itself is the replacement going out
    const newInvId = isAvailable ? exchModal.id : Number(exchForm.new_inventory_id);
    try {
      await api.exchanges.create({
        rental_id:        rentalId,
        new_inventory_id: newInvId,
        exchange_date:    new Date(exchForm.exchange_date).toISOString(),
        reason:           exchForm.reason || undefined,
        notes:            exchForm.notes  || undefined,
      });
      showToast('Exchange created successfully');
      setExchModal(null);
      load();
    } catch (e: any) {
      showToast(e.message || 'Failed to create exchange', 'error');
    } finally {
      setExchSaving(false);
    }
  }

  async function handleScheduleSubmit() {
    if (!schedModal || !schedItem) return;
    const rentalId = (schedItem as any).active_rental?.id;
    // Standalone delivery for available laptop — uses inventory-level endpoint
    const isStandaloneDelivery = schedModal === 'delivery' && !rentalId;
    if (!isStandaloneDelivery && !rentalId) {
      showToast('No active rental found for this laptop', 'error'); return;
    }
    if (isStandaloneDelivery && !schedForm.client_id) {
      showToast('Please select a client', 'error'); return;
    }
    setSchedSaving(true);
    try {
      const payload: any = {
        address:          schedForm.address,
        scheduled_at:     new Date(schedForm.scheduled_at).toISOString(),
        contact_name:     schedForm.contact_name     || undefined,
        contact_phone:    schedForm.contact_phone    || undefined,
        employee_name:    schedForm.employee_name    || undefined,
        employee_number:  schedForm.employee_number  || undefined,
        employee_address: schedForm.employee_address || undefined,
        notes:            schedForm.notes            || undefined,
      };
      if (schedModal !== 'pickup' && !isStandaloneDelivery) {
        payload.assigned_to = isStaff ? user!.id : Number(schedForm.assigned_to);
      }
      if (schedModal === 'replacement_receive' && schedForm.replacement_inventory_id) {
        payload.replacement_inventory_id = Number(schedForm.replacement_inventory_id);
      }

      if (isStandaloneDelivery) {
        const standalonePayload: any = { ...payload, client_id: Number(schedForm.client_id) };
        if (schedForm.monthly_rental) standalonePayload.monthly_rental = Number(schedForm.monthly_rental);
        await api.inventory.scheduleDelivery(schedItem.id, standalonePayload);
      } else if (schedModal === 'pickup') {
        await api.rentals.schedules.schedulePickup(rentalId, payload);
      } else if (schedModal === 'delivery') {
        await api.rentals.schedules.scheduleDelivery(rentalId, payload);
      } else {
        await api.rentals.schedules.scheduleType(rentalId, { ...payload, type: schedModal });
      }
      showToast(`${SCHED_META[schedModal].label} scheduled`);
      setSchedModal(null);
      setSchedItem(null);
    } catch (e: any) {
      showToast(e.message || 'Failed to schedule', 'error');
    } finally { setSchedSaving(false); }
  }

  const IMG_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://api.laptoprentalservice.com').replace(/\/api\/?$/, '') + '/';

  function openAdd() { setForm({ ...EMPTY_FORM }); setEditItem(null); setEditImages([]); setImageFiles([]); setShowModal(true); }
  function openEdit(item: Inventory) {
    setForm({
      brand: item.brand||'', model_no: item.model_no||'', serial_number: (item as any).serial_number||'',
      cpu: item.cpu||'', generation: (item as any).generation||'', ram: item.ram||'',
      ssd: item.ssd||'', graphics: item.graphics||'', screen_size: (item as any).screen_size||'',
      purchase_date: item.purchase_date||'', purchaser: (item as any).purchaser||'',
      status: item.status||'available', type: item.type||'office',
      notes: item.notes||'', vendor_name: item.vendor_name||'', vendor_location: item.vendor_location||'',
    });
    setEditItem(item); setEditImages(item.images||[]); setImageFiles([]); setShowModal(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      if (editItem) {
        await api.inventory.update(editItem.id, Object.fromEntries(Object.entries(form).filter(([,v]) => v !== '')));
        showToast('Inventory updated successfully');
      } else {
        await api.inventory.create(form);
        showToast('Laptop added to inventory');
      }
      setShowModal(false); load();
    } catch (e: any) { showToast(e.message || 'Failed to save', 'error'); }
    finally { setSaving(false); }
  }

  async function handleDelete(item: Inventory) {
    if (!confirm(`Delete ${item.brand} ${item.model_no} (${item.asset_code})?`)) return;
    try { await api.inventory.delete(item.id); showToast('Deleted successfully'); load(); }
    catch (e: any) { showToast(e.message || 'Delete failed', 'error'); }
  }

  async function handleMarkStatus(item: Inventory, newStatus: string) {
    if (!confirm(`Mark ${item.brand} ${item.model_no} (${item.asset_code}) as ${newStatus}?`)) return;
    try {
      await api.inventory.update(item.id, { status: newStatus });
      showToast(`Marked as ${newStatus}`);
      load();
    } catch (e: any) { showToast(e.message || 'Failed to update status', 'error'); }
  }

  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  async function handleUploadImages() {
    if (!editItem || imageFiles.length === 0) return;
    setUploadingImg(true);
    try {
      const res = await api.inventory.uploadImages(editItem.id, imageFiles);
      setEditImages(res.images||[]); setImageFiles([]); showToast(`${imageFiles.length} image(s) uploaded`);
    } catch (e: any) { showToast(e.message || 'Upload failed', 'error'); }
    finally { setUploadingImg(false); }
  }

  async function handleDeleteImage(idx: number) {
    if (!editItem) return;
    try { const res = await api.inventory.deleteImage(editItem.id, idx); setEditImages(res.images||[]); showToast('Image removed'); }
    catch (e: any) { showToast(e.message || 'Delete failed', 'error'); }
  }

  async function handleExport() {
    setExporting(true);
    try {
      const p: Record<string, string> = {};
      if (serialSearch) p.serial_number = serialSearch;
      if (search)       p.search        = search;
      if (status)       p.status        = status;
      if (type)         p.type          = type;
      await api.inventory.export(Object.keys(p).length ? p : undefined);
      showToast('Export downloaded successfully');
    } catch (e: any) {
      showToast(e.message || 'Export failed', 'error');
    } finally {
      setExporting(false);
    }
  }

  async function handleImport() {
    if (!importFile) return;
    setImporting(true); setImportResult(null);
    try {
      const res = await api.inventory.import(importFile, importDefaultStatus);
      setImportResult({ success: true, message: res.message }); load(); setShowImport(false);
    } catch (e: any) {
      setImportResult({ success: false, message: e.message||'Import failed', failures: e.failures });
    } finally { setImporting(false); }
  }

  /* ── Pagination helper ── */
  function Pagination() {
    if (lastPage <= 1) return null;
    const pages: (number|'...')[] = [];
    if (lastPage <= 7) { for (let i=1;i<=lastPage;i++) pages.push(i); }
    else {
      pages.push(1);
      if (page>3) pages.push('...');
      for (let i=Math.max(2,page-1);i<=Math.min(lastPage-1,page+1);i++) pages.push(i);
      if (page<lastPage-2) pages.push('...');
      pages.push(lastPage);
    }
    return (
      <div className="flex items-center justify-between px-5 py-3.5 flex-wrap gap-3 border-t" style={{ borderColor: '#E2E8F0' }}>
        <span className="text-xs" style={{ color: '#64748B' }}>Page {page} of {lastPage} &mdash; {total} results</span>
        <div className="flex items-center gap-1">
          <Button variant="secondary" size="sm" disabled={page<=1} onClick={() => setPage(p=>p-1)}>Prev</Button>
          {pages.map((p, i) => p==='...'
            ? <span key={`e${i}`} className="px-2 text-xs" style={{ color: '#94A3B8' }}>…</span>
            : <button key={p} onClick={()=>setPage(p as number)}
                className="w-8 h-8 rounded-lg text-xs font-medium transition-all"
                style={{ background: page===p?'#EFF6FF':'transparent', color: page===p?'#2563EB':'#64748B', border: page===p?'1px solid rgba(37,99,235,0.3)':'1px solid transparent' }}>
                {p}
              </button>
          )}
          <Button variant="secondary" size="sm" disabled={page>=lastPage} onClick={() => setPage(p=>p+1)}>Next</Button>
        </div>
      </div>
    );
  }

  return (
    <DashboardLayout>
      <PageHeader
        title="Inventory"
        subtitle={`${total} laptop${total !== 1 ? 's' : ''} in fleet`}
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Inventory' }]}
        action={!isStaff ? (
          <>
            <Button variant="secondary" size="sm" icon={<Download size={14} />}
              loading={exporting} onClick={handleExport}>
              Export
            </Button>
            <Button variant="secondary" size="sm" icon={<Upload size={14} />}
              onClick={() => { setShowImport(true); setImportFile(null); setImportResult(null); setImportDefaultStatus('available'); }}>
              Import
            </Button>
            <Button size="sm" icon={<Plus size={14} />} onClick={openAdd}>Add Laptop</Button>
          </>
        ) : undefined}
      />

      {isStaff ? (
        /* ── Staff: search-first view ── */
        <div className="space-y-4">
          <div className="glass-card p-8">
            <div className="text-center mb-6">
              <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #2563EB, #7C3AED)' }}>
                <Monitor size={24} color="white" />
              </div>
              <h2 className="text-xl font-bold mb-1" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', color: '#0F172A' }}>
                Find Laptop
              </h2>
              <p className="text-sm" style={{ color: '#64748B' }}>Search by asset code, serial number, or model</p>
            </div>
            <div className="flex gap-2 max-w-lg mx-auto">
              <div className="relative flex-1">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: '#94A3B8' }} />
                <input className="inp" style={{ paddingLeft: '2.375rem' }}
                  placeholder="e.g. DL-TEST-001 or F7088H2"
                  value={staffQ}
                  onChange={e => setStaffQ(e.target.value)}
                  onKeyDown={e => e.key==='Enter' && doStaffSearch()}
                  autoFocus />
              </div>
              <Button onClick={doStaffSearch} loading={loading && !!search} disabled={!staffQ.trim()}>
                Search
              </Button>
            </div>
            {(serialSearch || search) && (
              <div className="text-center mt-3">
                <button onClick={() => { setStaffQ(''); setSearch(''); setSerialSearch(''); setItems([]); }}
                  className="text-xs px-3 py-1.5 rounded-lg inline-flex items-center gap-1.5 transition-colors"
                  style={{ color: '#64748B', background: '#F1F5F9', border: '1px solid #E2E8F0' }}>
                  <X size={11} /> Clear search
                </button>
              </div>
            )}
          </div>

          {(serialSearch || search) && (
            loading ? (
              <div className="glass-card p-5 space-y-3">
                {[...Array(3)].map((_,i) => <div key={i} className="skeleton h-16 rounded-xl" />)}
              </div>
            ) : items.length === 0 ? (
              <EmptyState icon={<Monitor size={20} />} title="No results found"
                desc={`No laptops match "${serialSearch||search}"`} />
            ) : (
              <div className="glass-card overflow-hidden">
                <div className="px-4 py-2.5 flex items-center gap-2 border-b" style={{ background: '#F8FAFC', borderColor: '#E2E8F0' }}>
                  <Search size={12} style={{ color: '#94A3B8' }} />
                  <span className="text-xs font-semibold" style={{ color: '#64748B' }}>
                    {items.length} result{items.length!==1?'s':''} for &ldquo;{serialSearch||search}&rdquo;
                  </span>
                </div>
                <div className="divide-y" style={{ borderColor: '#F1F5F9' }}>
                  {items.map(item => {
                    const rentalId = (item as any).active_rental?.id;
                    return (
                      <div key={item.id} className="px-4 py-4">
                        {/* Laptop info row */}
                        <div className="flex items-center gap-4 mb-3">
                          {item.images?.[0] ? (
                            <img src={IMG_BASE+item.images[0]} alt={item.brand}
                              className="w-14 h-11 object-cover rounded-xl flex-shrink-0 border" style={{ borderColor: '#E2E8F0' }} />
                          ) : (
                            <div className="w-14 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                              style={{ background: '#F1F5F9', border: '1px solid #E2E8F0' }}>
                              <Monitor size={16} style={{ color: '#94A3B8' }} />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <code className="text-xs font-bold px-2 py-0.5 rounded-md" style={{ background: '#EFF6FF', color: '#2563EB' }}>{item.asset_code}</code>
                              <span className={`badge badge-${item.status}`}>{item.status}</span>
                            </div>
                            <div className="text-sm font-semibold" style={{ color: '#0F172A' }}>{item.brand} {item.model_no}</div>
                            <div className="text-xs" style={{ color: '#64748B' }}>
                              {item.cpu}{(item as any).generation ? ` · ${(item as any).generation} Gen` : ''} · {item.ram} · {item.ssd}
                            </div>
                            {item.serial_number && <div className="text-xs font-mono mt-0.5" style={{ color: '#94A3B8' }}>S/N: {item.serial_number}</div>}
                            {rentalId && (
                              <div className="text-xs mt-0.5" style={{ color: '#64748B' }}>
                                Client: {(item as any).active_rental.client?.company || (item as any).active_rental.client?.name || '—'}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Action buttons based on laptop status */}
                        {item.status === 'rented' ? (() => {
                          const pendingSched = rentalId ? (rentalScheds[rentalId] || []).find((s: any) => s.status === 'scheduled') : null;
                          if (pendingSched) {
                            const meta = SCHED_META[pendingSched.type] ?? { label: pendingSched.type, color: '#64748B', bg: 'rgba(100,116,139,0.07)', border: 'rgba(100,116,139,0.2)' };
                            return (
                              <div className="flex flex-col gap-1.5">
                                <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg"
                                  style={{ background: meta.bg, border: `1px solid ${meta.border}` }}>
                                  <Clock size={13} style={{ color: meta.color, flexShrink: 0 }} />
                                  <span className="text-xs font-semibold" style={{ color: meta.color }}>{meta.label} — Scheduled</span>
                                </div>
                                {pendingSched.scheduled_at && (
                                  <div className="flex items-center gap-1.5 text-xs" style={{ color: '#64748B' }}>
                                    <Calendar size={11} />
                                    {new Date(pendingSched.scheduled_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                  </div>
                                )}
                                {pendingSched.address && (
                                  <div className="text-xs" style={{ color: '#94A3B8' }}>{pendingSched.address}</div>
                                )}
                              </div>
                            );
                          }
                          return (
                            <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
                              <button onClick={() => openExchangeModal(item)}
                                className="flex items-center justify-center gap-1.5 text-xs font-semibold px-3 py-2.5 rounded-lg transition-all"
                                style={{ background: 'rgba(16,185,129,0.07)', color: '#10B981', border: '1px solid rgba(16,185,129,0.2)' }}>
                                <ArrowLeftRight size={12} />
                                Exchange
                              </button>
                              <button onClick={() => openSchedModal('replacement_delivery', item)}
                                className="flex items-center justify-center gap-1.5 text-xs font-semibold px-3 py-2.5 rounded-lg transition-all"
                                style={{ background: 'rgba(139,92,246,0.07)', color: '#8B5CF6', border: '1px solid rgba(139,92,246,0.2)' }}>
                                <Truck size={12} />
                                Repl. Delivery
                              </button>
                              <button onClick={() => openSchedModal('replacement_receive', item)}
                                className="flex items-center justify-center gap-1.5 text-xs font-semibold px-3 py-2.5 rounded-lg transition-all"
                                style={{ background: 'rgba(13,148,136,0.07)', color: '#0D9488', border: '1px solid rgba(13,148,136,0.2)' }}>
                                <Truck size={12} />
                                Repl. Receive
                              </button>
                              <button onClick={() => handleMarkStatus(item, 'sold')}
                                className="flex items-center justify-center gap-1.5 text-xs font-semibold px-3 py-2.5 rounded-lg transition-all"
                                style={{ background: 'rgba(71,85,105,0.07)', color: '#475569', border: '1px solid rgba(71,85,105,0.2)' }}>
                                Mark Sold
                              </button>
                              <button onClick={() => handleMarkStatus(item, 'lost')}
                                className="col-span-2 sm:col-span-1 flex items-center justify-center gap-1.5 text-xs font-semibold px-3 py-2.5 rounded-lg transition-all"
                                style={{ background: 'rgba(239,68,68,0.07)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.2)' }}>
                                Mark Lost
                              </button>
                            </div>
                          );
                        })() : item.status === 'available' ? (
                          <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
                            <button onClick={() => openExchangeModal(item)}
                              className="flex items-center justify-center gap-1.5 text-xs font-semibold px-3 py-2.5 rounded-lg transition-all"
                              style={{ background: 'rgba(16,185,129,0.07)', color: '#10B981', border: '1px solid rgba(16,185,129,0.2)' }}>
                              <ArrowLeftRight size={12} />
                              Exchange
                            </button>
                            <button onClick={() => openSchedModal('delivery', item)}
                              className="flex items-center justify-center gap-1.5 text-xs font-semibold px-3 py-2.5 rounded-lg transition-all"
                              style={{ background: 'rgba(59,130,246,0.07)', color: '#3B82F6', border: '1px solid rgba(59,130,246,0.2)' }}>
                              <Truck size={12} />
                              New Delivery
                            </button>
                            <button onClick={() => handleMarkStatus(item, 'maintenance')}
                              className="col-span-2 sm:col-span-1 flex items-center justify-center gap-1.5 text-xs font-semibold px-3 py-2.5 rounded-lg transition-all"
                              style={{ background: 'rgba(245,158,11,0.07)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.2)' }}>
                              Mark Maintenance
                            </button>
                            <button onClick={() => handleMarkStatus(item, 'sold')}
                              className="flex items-center justify-center gap-1.5 text-xs font-semibold px-3 py-2.5 rounded-lg transition-all"
                              style={{ background: 'rgba(71,85,105,0.07)', color: '#475569', border: '1px solid rgba(71,85,105,0.2)' }}>
                              Mark Sold
                            </button>
                            <button onClick={() => handleMarkStatus(item, 'lost')}
                              className="flex items-center justify-center gap-1.5 text-xs font-semibold px-3 py-2.5 rounded-lg transition-all"
                              style={{ background: 'rgba(239,68,68,0.07)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.2)' }}>
                              Mark Lost
                            </button>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            )
          )}
        </div>
      ) : (
        /* ── Admin: full list view ── */
        <>
          {/* ── Filter bar ── */}
          <div className="glass-card mb-5 overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center gap-0 divide-y sm:divide-y-0 sm:divide-x divide-slate-200">

              {/* Search — primary action */}
              <div className="relative flex-1 min-w-0">
                <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: '#94A3B8' }} />
                <input
                  className="w-full bg-transparent border-0 outline-none text-sm py-3.5 pr-4 focus:ring-0"
                  style={{ paddingLeft: '2.75rem', color: '#0F172A', fontFamily: 'Inter, sans-serif' }}
                  placeholder="Search by asset code, serial number, brand or model…"
                  value={serialSearch}
                  onChange={e => { setSerialSearch(e.target.value); setPage(1); }}
                />
                {serialSearch && (
                  <button onClick={() => { setSerialSearch(''); setPage(1); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full flex items-center justify-center transition-colors hover:bg-slate-200"
                    style={{ color: '#94A3B8' }}>
                    <X size={11} />
                  </button>
                )}
              </div>

              {/* Filter group */}
              <div className="flex items-center gap-0 divide-x divide-slate-200 flex-wrap" style={{ flexShrink: 0 }}>

                {/* Status filter */}
                <div className="relative">
                  <select
                    className="appearance-none h-full px-4 py-3.5 pr-8 text-xs font-medium bg-transparent border-0 outline-none cursor-pointer focus:ring-0 transition-colors hover:bg-slate-50"
                    style={{ color: status ? '#2563EB' : '#64748B', minWidth: 120 }}
                    value={status}
                    onChange={e => { setStatus(e.target.value); setPage(1); }}>
                    {STATUS_OPTS.map(s => <option key={s} value={s}>{s || 'All Status'}</option>)}
                  </select>
                  {status && (
                    <span className="absolute right-7 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full" style={{ background: '#2563EB' }} />
                  )}
                  <ChevronRight size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 rotate-90 pointer-events-none" style={{ color: '#CBD5E1' }} />
                </div>

                {/* Type filter */}
                <div className="relative">
                  <select
                    className="appearance-none h-full px-4 py-3.5 pr-8 text-xs font-medium bg-transparent border-0 outline-none cursor-pointer focus:ring-0 transition-colors hover:bg-slate-50"
                    style={{ color: type ? '#2563EB' : '#64748B', minWidth: 110 }}
                    value={type}
                    onChange={e => { setType(e.target.value); setPage(1); }}>
                    {TYPE_OPTS.map(t => <option key={t} value={t}>{t || 'All Types'}</option>)}
                  </select>
                  {type && (
                    <span className="absolute right-7 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full" style={{ background: '#2563EB' }} />
                  )}
                  <ChevronRight size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 rotate-90 pointer-events-none" style={{ color: '#CBD5E1' }} />
                </div>

                {/* Clear filters */}
                {(serialSearch || status || type) && (
                  <button
                    onClick={() => { setSerialSearch(''); setStatus(''); setType(''); setPage(1); }}
                    className="flex items-center gap-1.5 px-3.5 py-3.5 text-xs font-medium transition-colors hover:bg-red-50"
                    style={{ color: '#EF4444', whiteSpace: 'nowrap' }}>
                    <X size={11} />
                    Clear
                  </button>
                )}

                {/* Divider + View toggle */}
                <div className="flex items-center gap-0.5 px-3 py-2.5">
                  <button
                    onClick={() => setViewMode('table')}
                    className="w-8 h-7 rounded-lg flex items-center justify-center transition-all"
                    style={{
                      background: viewMode === 'table' ? '#EFF6FF' : 'transparent',
                      color: viewMode === 'table' ? '#2563EB' : '#CBD5E1',
                    }}
                    title="Table view">
                    <List size={14} />
                  </button>
                  <button
                    onClick={() => setViewMode('grid')}
                    className="w-8 h-7 rounded-lg flex items-center justify-center transition-all"
                    style={{
                      background: viewMode === 'grid' ? '#EFF6FF' : 'transparent',
                      color: viewMode === 'grid' ? '#2563EB' : '#CBD5E1',
                    }}
                    title="Grid view">
                    <LayoutGrid size={14} />
                  </button>
                </div>
              </div>
            </div>

            {/* Active filter pills */}
            {(status || type) && (
              <div className="flex items-center gap-2 px-4 py-2 border-t" style={{ borderColor: '#EFF6FF', background: '#FAFCFF' }}>
                <Filter size={10} style={{ color: '#94A3B8' }} />
                <span className="text-xs" style={{ color: '#94A3B8' }}>Active:</span>
                {status && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                    style={{ background: '#EFF6FF', color: '#2563EB', border: '1px solid rgba(37,99,235,0.2)' }}>
                    {status}
                    <button onClick={() => { setStatus(''); setPage(1); }}><X size={9} /></button>
                  </span>
                )}
                {type && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                    style={{ background: '#EFF6FF', color: '#2563EB', border: '1px solid rgba(37,99,235,0.2)' }}>
                    {type}
                    <button onClick={() => { setType(''); setPage(1); }}><X size={9} /></button>
                  </span>
                )}
                <span className="ml-auto text-xs" style={{ color: '#94A3B8' }}>
                  {total} result{total !== 1 ? 's' : ''}
                </span>
              </div>
            )}
          </div>

          <div className="glass-card overflow-hidden">
            {loading ? (
              <div className="p-6 space-y-3">
                {[...Array(6)].map((_,i) => <div key={i} className="skeleton h-12 rounded-xl" />)}
              </div>
            ) : items.length === 0 ? (
              <EmptyState icon={<Monitor size={22} />} title="No laptops found"
                desc="Add your first laptop or adjust filters" action={<Button icon={<Plus size={14} />} onClick={openAdd}>Add Laptop</Button>} />
            ) : viewMode === 'grid' ? (
              /* ── Grid view ── */
              <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {items.map(item => {
                  const sc = STATUS_COLORS[item.status] || STATUS_COLORS.available;
                  return (
                    <div key={item.id} className="rounded-2xl border overflow-hidden transition-all hover:shadow-md hover:-translate-y-0.5"
                      style={{ background: 'white', borderColor: '#E2E8F0' }}>
                      {item.images?.[0] ? (
                        <img src={IMG_BASE+item.images[0]} alt={item.brand} className="w-full h-32 object-cover" />
                      ) : (
                        <div className="w-full h-32 flex items-center justify-center" style={{ background: '#F8FAFC' }}>
                          <Monitor size={32} style={{ color: '#CBD5E1' }} />
                        </div>
                      )}
                      <div className="p-3">
                        <div className="flex items-center justify-between mb-1.5">
                          <code className="text-xs font-bold" style={{ color: '#2563EB' }}>{item.asset_code}</code>
                          <span className="badge" style={{ background: sc.bg, color: sc.text }}>{item.status}</span>
                        </div>
                        <div className="font-semibold text-sm truncate" style={{ color: '#0F172A' }}>{item.brand} {item.model_no}</div>
                        <div className="text-xs mt-0.5" style={{ color: '#64748B' }}>{item.cpu} · {item.ram} · {item.ssd}</div>
                        {item.monthly_rental && (
                          <div className="text-xs font-semibold mt-1.5" style={{ color: '#16A34A' }}>₹{Number(item.monthly_rental).toLocaleString()}/mo</div>
                        )}
                        <div className="flex items-center gap-1 mt-2.5">
                          <Link href={`/inventory/${item.id}`} className="flex-1">
                            <Button variant="secondary" size="xs" fullWidth icon={<Eye size={11} />}>View</Button>
                          </Link>
                          <Button variant="ghost" size="xs" icon={<Edit size={11} />} onClick={() => openEdit(item)} />
                          <Button variant="danger" size="xs" icon={<Trash2 size={11} />} onClick={() => handleDelete(item)} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* ── Table view ── */
              <>
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full" style={{ borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #E2E8F0' }}>
                        {[
                          { label: 'Laptop', wide: true },
                          { label: 'Specs' },
                          { label: 'Monthly', right: true },
                          { label: 'Type', center: true },
                          { label: 'Vendor' },
                          { label: 'Status', center: true },
                          { label: 'Client' },
                          { label: '', center: true, w: 80 },
                        ].map(h => (
                          <th key={h.label}
                            style={{
                              padding: '10px 14px',
                              background: '#F8FAFC',
                              color: '#64748B',
                              fontWeight: 600,
                              fontSize: 11,
                              textTransform: 'uppercase',
                              letterSpacing: '0.05em',
                              textAlign: h.right ? 'right' : h.center ? 'center' : 'left',
                              whiteSpace: 'nowrap',
                              width: h.w,
                            }}>
                            {h.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item) => {
                        const sc = STATUS_COLORS[item.status] || STATUS_COLORS.available;
                        const isActive = item.status === 'rented';
                        return (
                          <tr key={item.id}
                            className="group transition-colors hover:bg-slate-50"
                            style={{ borderBottom: '1px solid #F1F5F9' }}>

                            {/* Laptop — merged thumbnail + asset code + brand/model */}
                            <td style={{ padding: '10px 14px' }}>
                              <div className="flex items-center gap-3">
                                {/* Thumbnail */}
                                <div className="flex-shrink-0 relative">
                                  {item.images?.[0] ? (
                                    <img src={IMG_BASE + item.images[0]} alt={item.brand}
                                      className="w-10 h-8 object-cover rounded-lg"
                                      style={{ border: '1px solid #E2E8F0' }} />
                                  ) : (
                                    <div className="w-10 h-8 rounded-lg flex items-center justify-center"
                                      style={{ background: '#F1F5F9', border: '1px solid #E2E8F0' }}>
                                      <Monitor size={13} style={{ color: '#CBD5E1' }} />
                                    </div>
                                  )}
                                  {/* Active rental indicator dot */}
                                  {isActive && (
                                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full border-2 border-white"
                                      style={{ background: '#2563EB' }} />
                                  )}
                                </div>

                                {/* Info */}
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5 mb-0.5">
                                    <Link href={`/inventory/${item.id}`}
                                      className="font-mono text-xs font-bold hover:underline"
                                      style={{ color: '#2563EB', textDecoration: 'none' }}>
                                      {item.asset_code}
                                    </Link>
                                  </div>
                                  <div className="font-semibold text-sm leading-tight" style={{ color: '#0F172A' }}>
                                    {item.brand} {item.model_no}
                                  </div>
                                  {item.serial_number && (
                                    <div className="font-mono text-xs mt-0.5" style={{ color: '#94A3B8' }}>
                                      {item.serial_number}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>

                            {/* Specs */}
                            <td style={{ padding: '10px 14px' }}>
                              <div className="text-xs font-medium" style={{ color: '#334155' }}>
                                {item.cpu}{(item as any).generation ? ` ${(item as any).generation}G` : ''}
                              </div>
                              <div className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>
                                {item.ram} · {item.ssd}
                              </div>
                            </td>

                            {/* Monthly */}
                            <td style={{ padding: '10px 14px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                              {item.monthly_rental ? (
                                <span className="text-sm font-bold tabular-nums" style={{ color: '#16A34A' }}>
                                  ₹{Number(item.monthly_rental).toLocaleString()}
                                </span>
                              ) : (
                                <span style={{ color: '#E2E8F0' }}>—</span>
                              )}
                            </td>

                            {/* Type */}
                            <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                              <span className={`badge badge-${item.type}`}>{item.type}</span>
                            </td>

                            {/* Vendor */}
                            <td style={{ padding: '10px 14px', maxWidth: 140 }}>
                              {item.vendor_name ? (
                                <>
                                  <div className="text-xs font-medium truncate" style={{ color: '#334155' }}>{item.vendor_name}</div>
                                  {item.vendor_location && (
                                    <div className="text-xs truncate mt-0.5" style={{ color: '#94A3B8' }}>{item.vendor_location}</div>
                                  )}
                                </>
                              ) : (
                                <span style={{ color: '#E2E8F0', fontSize: 12 }}>—</span>
                              )}
                            </td>

                            {/* Status */}
                            <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold"
                                style={{ background: sc.bg, color: sc.text }}>
                                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                                  style={{ background: sc.text }} />
                                {item.status}
                              </span>
                            </td>

                            {/* Client */}
                            <td style={{ padding: '10px 14px', maxWidth: 130 }}>
                              {item.active_rental?.client ? (
                                <div>
                                  <div className="text-xs font-medium truncate" style={{ color: '#334155' }}>
                                    {item.active_rental.client.name}
                                  </div>
                                  {item.active_rental.client.company && (
                                    <div className="text-xs truncate" style={{ color: '#94A3B8' }}>
                                      {item.active_rental.client.company}
                                    </div>
                                  )}
                                </div>
                              ) : <span style={{ color: '#E2E8F0', fontSize: 12 }}>—</span>}
                            </td>

                            {/* Actions — always visible, tighter */}
                            <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                              <div className="flex items-center justify-center gap-0.5">
                                <Link href={`/inventory/${item.id}`}>
                                  <button
                                    className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:bg-blue-50"
                                    style={{ color: '#94A3B8' }}
                                    title="View details">
                                    <Eye size={13} />
                                  </button>
                                </Link>
                                {!isStaff && (
                                  <>
                                    <button
                                      className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:bg-slate-100"
                                      style={{ color: '#94A3B8' }}
                                      onClick={() => openEdit(item)}
                                      title="Edit">
                                      <Edit size={13} />
                                    </button>
                                    <button
                                      className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:bg-red-50"
                                      style={{ color: '#94A3B8' }}
                                      onClick={() => handleDelete(item)}
                                      title="Delete">
                                      <Trash2 size={13} />
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile cards */}
                <div className="sm:hidden divide-y" style={{ borderColor: '#F1F5F9' }}>
                  {items.map(item => {
                    const sc = STATUS_COLORS[item.status] || STATUS_COLORS.available;
                    return (
                      <div key={item.id} className="p-4">
                        <div className="flex items-start gap-3">
                          {/* Thumbnail */}
                          {item.images?.[0] ? (
                            <img src={IMG_BASE + item.images[0]} alt={item.brand}
                              className="w-12 h-10 object-cover rounded-xl flex-shrink-0"
                              style={{ border: '1px solid #E2E8F0' }} />
                          ) : (
                            <div className="w-12 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                              style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                              <Monitor size={16} style={{ color: '#CBD5E1' }} />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2 mb-1">
                              <div>
                                <Link href={`/inventory/${item.id}`}
                                  className="font-mono text-xs font-bold"
                                  style={{ color: '#2563EB', textDecoration: 'none' }}>
                                  {item.asset_code}
                                </Link>
                                <div className="font-semibold text-sm mt-0.5" style={{ color: '#0F172A' }}>
                                  {item.brand} {item.model_no}
                                </div>
                              </div>
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold flex-shrink-0"
                                style={{ background: sc.bg, color: sc.text }}>
                                {item.status}
                              </span>
                            </div>
                            <div className="text-xs" style={{ color: '#64748B' }}>
                              {item.cpu} · {item.ram} · {item.ssd}
                            </div>
                            {item.monthly_rental && (
                              <div className="text-xs font-bold mt-1" style={{ color: '#16A34A' }}>
                                ₹{Number(item.monthly_rental).toLocaleString()}/mo
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center justify-between mt-3 pt-3" style={{ borderTop: '1px solid #F8FAFC' }}>
                          <span className={`badge badge-${item.type}`}>{item.type}</span>
                          <div className="flex items-center gap-1">
                            <Link href={`/inventory/${item.id}`}>
                              <Button variant="ghost" size="sm" icon={<Eye size={13} />} />
                            </Link>
                            {!isStaff && (
                              <>
                                <Button variant="ghost" size="sm" icon={<Edit size={13} />} onClick={() => openEdit(item)} />
                                <Button variant="danger" size="sm" icon={<Trash2 size={13} />} onClick={() => handleDelete(item)} />
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
            <Pagination />
          </div>
        </>
      )}

      {/* ── Add / Edit Modal ── */}
      <Modal open={showModal} onClose={() => setShowModal(false)}
        title={editItem ? `Edit — ${editItem.asset_code}` : 'Add New Laptop'} width="max-w-2xl">
        {/* Core specs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Brand" required><input className="inp" value={form.brand} onChange={e=>f('brand',e.target.value)} placeholder="Dell, HP, Lenovo…" /></FormField>
          <FormField label="Model No" required><input className="inp" value={form.model_no} onChange={e=>f('model_no',e.target.value)} placeholder="Latitude E5470" /></FormField>
          <FormField label="Serial Number"><input className="inp" value={form.serial_number} onChange={e=>f('serial_number',e.target.value)} placeholder="F7088H2" /></FormField>
          <FormField label="CPU" required><input className="inp" value={form.cpu} onChange={e=>f('cpu',e.target.value)} placeholder="i5, i7…" /></FormField>
          <FormField label="Generation"><input className="inp" value={form.generation} onChange={e=>f('generation',e.target.value)} placeholder="6th, 8th, 12th…" /></FormField>
          <FormField label="RAM" required><input className="inp" value={form.ram} onChange={e=>f('ram',e.target.value)} placeholder="8GB, 16GB…" /></FormField>
          <FormField label="Storage (HDD/SSD)" required><input className="inp" value={form.ssd} onChange={e=>f('ssd',e.target.value)} placeholder="256 SSD, 512 NVMe…" /></FormField>
          <FormField label="Graphics"><input className="inp" value={form.graphics} onChange={e=>f('graphics',e.target.value)} placeholder="Integrated, NVIDIA GTX 1650…" /></FormField>
          <FormField label="Screen Size"><input className="inp" value={form.screen_size} onChange={e=>f('screen_size',e.target.value)} placeholder='14", 15.6", 13.3"…' /></FormField>
          <FormField label="Purchase Date"><input className="inp" type="date" value={form.purchase_date} onChange={e=>f('purchase_date',e.target.value)} /></FormField>
          <FormField label="Purchaser">
            <select className="inp" value={form.purchaser} onChange={e=>f('purchaser',e.target.value)}>
              <option value="">— Select vendor —</option>
              {vendors.map((v:any) => <option key={v.id} value={v.name}>{v.name}{v.company?` — ${v.company}`:''}</option>)}
            </select>
          </FormField>
          {editItem && (
            <FormField label="Status">
              <select className="inp" value={form.status} onChange={e=>f('status',e.target.value)}>
                {['available','rented','maintenance','sold','returned','lost'].map(s=><option key={s} value={s}>{s}</option>)}
              </select>
            </FormField>
          )}
        </div>

        {/* Vendor info */}
        <div className="mt-5 pt-4 border-t" style={{ borderColor: '#E2E8F0' }}>
          <div className="section-title">Vendor Info</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Vendor Name"><input className="inp" value={form.vendor_name} onChange={e=>f('vendor_name',e.target.value)} placeholder="Ravi Enterprises" /></FormField>
            <FormField label="Location"><input className="inp" value={form.vendor_location} onChange={e=>f('vendor_location',e.target.value)} placeholder="Delhi, Mumbai…" /></FormField>
          </div>
        </div>

        {editItem && (
          <div className="mt-5 pt-4 border-t" style={{ borderColor: '#E2E8F0' }}>
            <div className="section-title">Images</div>
            {editImages.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mb-3">
                {editImages.map((path, idx) => (
                  <div key={idx} className="relative group rounded-xl overflow-hidden" style={{ aspectRatio:'4/3', background:'#F1F5F9' }}>
                    <img src={IMG_BASE+path} alt="" className="w-full h-full object-cover" />
                    <button onClick={() => handleDeleteImage(idx)}
                      className="absolute top-1 right-1 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ background: 'rgba(220,38,38,0.9)' }}>
                      <X size={11} color="#fff" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-start gap-3">
              <label className="flex-1 flex flex-col items-center gap-1.5 p-4 rounded-xl cursor-pointer transition-all"
                style={{ border: '2px dashed #E2E8F0', background: imageFiles.length?'#EFF6FF':'#F8FAFC' }}>
                <ImagePlus size={20} style={{ color: imageFiles.length?'#2563EB':'#CBD5E1' }} />
                <span className="text-xs" style={{ color: imageFiles.length?'#2563EB':'#94A3B8' }}>
                  {imageFiles.length ? `${imageFiles.length} file(s) selected` : 'Click to choose images'}
                </span>
                <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden"
                  onChange={e => setImageFiles(Array.from(e.target.files||[]))} />
              </label>
              {imageFiles.length > 0 && (
                <Button icon={<Upload size={14} />} onClick={handleUploadImages} loading={uploadingImg}>Upload</Button>
              )}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-3 mt-6">
          <Button variant="ghost" onClick={() => setShowModal(false)}>Cancel</Button>
          <Button onClick={handleSave} loading={saving}>{editItem ? 'Update' : 'Add Laptop'}</Button>
        </div>
      </Modal>

      {/* ── Bulk Import Modal ── */}
      <Modal open={showImport} onClose={() => setShowImport(false)} title="Bulk Import Inventory" width="max-w-lg">
        <div className="space-y-4">
          <div className="p-4 rounded-xl" style={{ background: '#EFF6FF', border: '1px solid rgba(37,99,235,0.15)' }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold" style={{ color: '#1D4ED8' }}>Accepted: .csv, .xlsx, .xls</span>
              <button onClick={() => {
                const csv = ['Asset No,Brand,Model Number,Serial Number,CPU,Generation,Ram,HDD,Graphics,Screen Size,Purchase Date,Purchaser,Purchasing Price,Vendor Name,Location,Notes,Status','1001,Dell,LATITUDE-E5470,F7088H2,i5,6th,8GB,256 SSD,Integrated,15.6",15-Jan-23,Ravi Delhi,1100,Ravi Enterprises,Delhi,Good condition,available'].join('\n');
                const blob = new Blob([csv], {type:'text/csv'}); const url = URL.createObjectURL(blob);
                const a = document.createElement('a'); a.href=url; a.download='inventory_sample.csv'; a.click(); URL.revokeObjectURL(url);
              }} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors"
                style={{ background: '#DBEAFE', color: '#1D4ED8' }}>
                <FileSpreadsheet size={11} /> Sample CSV
              </button>
            </div>
            <p className="text-xs" style={{ color: '#2563EB' }}>
              Required: Brand, Model Number, Serial Number, CPU, Generation, Ram, HDD, Purchase Date, Purchaser
            </p>
            <p className="text-xs mt-1" style={{ color: '#3B82F6' }}>
              Optional: Asset No, Graphics, Screen Size, Purchasing Price, Vendor Name, Location, Notes, <strong>Status</strong>
            </p>
            <p className="text-xs mt-1" style={{ color: '#64748B' }}>
              Status values: available · maintenance · sold · returned · lost
            </p>
          </div>


          <FormField label="Select File" required>
            <label className="flex flex-col items-center justify-center gap-2 p-6 rounded-xl cursor-pointer transition-all"
              style={{ border: '2px dashed #E2E8F0', background: importFile?'#EFF6FF':'#F8FAFC' }}>
              <FileSpreadsheet size={28} style={{ color: importFile?'#2563EB':'#CBD5E1' }} />
              <span className="text-sm font-medium" style={{ color: importFile?'#2563EB':'#94A3B8' }}>
                {importFile ? importFile.name : 'Click to choose file'}
              </span>
              {importFile && <span className="text-xs" style={{ color: '#64748B' }}>{(importFile.size/1024).toFixed(1)} KB</span>}
              <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={e => {
                const file = e.target.files?.[0]||null;
                if (file) { const r=new FileReader(); r.onload=()=>setImportFile(new File([r.result as ArrayBuffer],file.name,{type:file.type})); r.readAsArrayBuffer(file); }
                else setImportFile(null);
                setImportResult(null);
              }} />
            </label>
          </FormField>

          {importResult && (
            <div className="p-3 rounded-xl flex items-start gap-2"
              style={{ background: importResult.success?'#F0FDF4':'#FEF2F2', border: `1px solid ${importResult.success?'#86EFAC':'#FECACA'}` }}>
              {importResult.success ? <CheckCircle2 size={16} style={{ color: '#16A34A', flexShrink: 0 }} /> : <AlertCircle size={16} style={{ color: '#DC2626', flexShrink: 0 }} />}
              <div>
                <p className="text-sm font-medium" style={{ color: importResult.success?'#15803D':'#991B1B' }}>{importResult.message}</p>
                {importResult.failures?.map((f:any,i:number) => (
                  <p key={i} className="text-xs mt-1" style={{ color: '#DC2626' }}>Row {f.row}: {f.field} — {f.errors?.join(', ')}</p>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="ghost" onClick={() => setShowImport(false)}>Close</Button>
          <Button icon={<Upload size={14} />} onClick={handleImport} loading={importing} disabled={!importFile}>Import</Button>
        </div>
      </Modal>

      {/* ── Staff Schedule Modal ── */}
      <Modal open={!!schedModal} onClose={() => { setSchedModal(null); setSchedItem(null); }}
        title={schedModal ? SCHED_META[schedModal].label : ''} width="max-w-lg">
        {schedModal && schedItem && (
          <>
            {/* Laptop + client context */}
            <div className="mb-4 px-3 py-2.5 rounded-xl"
              style={{ background: `${SCHED_META[schedModal].bg}`, border: `1px solid ${SCHED_META[schedModal].border}` }}>
              <div className="flex items-center gap-2 mb-0.5">
                <code className="text-xs font-bold" style={{ color: SCHED_META[schedModal].color }}>{schedItem.asset_code}</code>
                <span className="text-xs font-semibold" style={{ color: '#334155' }}>{schedItem.brand} {schedItem.model_no}</span>
              </div>
              {(schedItem as any).active_rental?.client && (
                <div className="text-xs" style={{ color: '#64748B' }}>
                  Client: {(schedItem as any).active_rental.client.company || (schedItem as any).active_rental.client.name}
                </div>
              )}
            </div>

            {/* Client selector — for delivery on available laptop */}
            {schedModal === 'delivery' && (() => {
              const selectedClient = clients.find(c => String(c.id) === schedForm.client_id);
              const filteredClients = clients.filter(c => {
                if (!clientSearch.trim()) return true;
                const q = clientSearch.toLowerCase();
                return (
                  String(c.name    || '').toLowerCase().includes(q) ||
                  String(c.company || '').toLowerCase().includes(q) ||
                  String(c.email   || '').toLowerCase().includes(q)
                );
              });
              return (
                <div className="mb-4 p-3 rounded-xl" style={{ background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.2)' }}>
                  <div className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: '#3B82F6' }}>
                    Client <span style={{ color: '#EF4444' }}>*</span>
                  </div>
                  <div className="relative">
                    {selectedClient ? (
                      <div className="inp flex items-center gap-2 cursor-pointer"
                        onClick={() => { sf('client_id', ''); setClientSearch(''); setClientFocus(true); }}>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold truncate" style={{ color: '#252525' }}>
                            {selectedClient.company || selectedClient.name}
                          </div>
                          {selectedClient.company && (
                            <div className="text-xs" style={{ color: '#64748B' }}>{selectedClient.name}</div>
                          )}
                        </div>
                        <X size={12} style={{ color: '#64748B', flexShrink: 0 }} />
                      </div>
                    ) : (
                      <div className="relative">
                        <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: '#64748B' }} />
                        <input className="inp w-full" style={{ paddingLeft: '1.75rem', fontSize: 12 }}
                          type="text" autoComplete="off"
                          placeholder="Search by name, company, email…"
                          value={clientSearch}
                          onChange={e => { setClientSearch(e.target.value); setClientFocus(true); }}
                          onFocus={() => setClientFocus(true)}
                          onBlur={() => setTimeout(() => setClientFocus(false), 160)} />
                      </div>
                    )}
                    {clientFocus && !selectedClient && (
                      <div className="absolute left-0 right-0 z-50 rounded-xl mt-1 overflow-hidden"
                        style={{ background: '#0D1929', border: '1px solid rgba(59,130,246,0.3)', boxShadow: '0 8px 32px rgba(0,0,0,0.5)', maxHeight: 200, overflowY: 'auto' }}>
                        {filteredClients.length === 0 ? (
                          <div className="px-3 py-3 text-xs text-center" style={{ color: '#64748B' }}>
                            {clientSearch ? `No match for "${clientSearch}"` : 'No clients found'}
                          </div>
                        ) : filteredClients.slice(0, 25).map((c: any, i: number) => (
                          <button key={c.id} type="button"
                            onMouseDown={() => { sf('client_id', String(c.id)); setClientSearch(''); setClientFocus(false); }}
                            className="w-full text-left px-3 py-2.5 transition-colors"
                            style={{ background: 'transparent', borderBottom: i < filteredClients.length - 1 ? '1px solid rgba(30,48,88,0.5)' : 'none' }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(59,130,246,0.1)')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                            <div className="text-sm font-semibold" style={{ color: '#F1F5F9' }}>{c.company || c.name}</div>
                            {c.company && <div className="text-xs" style={{ color: '#94A3B8' }}>{c.name}</div>}
                            {c.email && <div className="text-xs font-mono" style={{ color: '#475569' }}>{c.email}</div>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Monthly rental — for standalone delivery only */}
            {schedModal === 'delivery' && !(schedItem as any)?.active_rental?.id && (
              <div className="mb-4 p-3 rounded-xl" style={{ background: 'rgba(22,163,74,0.05)', border: '1px solid rgba(22,163,74,0.2)' }}>
                <div className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: '#16A34A' }}>
                  Monthly Rental <span className="font-normal normal-case tracking-normal" style={{ color: '#64748B' }}>(Optional)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold" style={{ color: '#64748B' }}>₹</span>
                  <input className="inp flex-1" type="number" min="0" step="0.01"
                    placeholder="e.g. 5000"
                    value={schedForm.monthly_rental}
                    onChange={e => sf('monthly_rental', e.target.value)} />
                  <span className="text-xs" style={{ color: '#64748B' }}>/month</span>
                </div>
              </div>
            )}

            {/* Replacement laptop selector — only for replacement_receive */}
            {schedModal === 'replacement_receive' && (() => {
              const selectedRepl = availableInvs.find(i => String(i.id) === schedForm.replacement_inventory_id);
              const filteredRepl = availableInvs.filter(inv => {
                if (!replSearch.trim()) return true;
                const q = replSearch.toLowerCase();
                return (
                  String(inv.asset_code || '').toLowerCase().includes(q) ||
                  String(inv.serial_number || '').toLowerCase().includes(q) ||
                  String(inv.brand || '').toLowerCase().includes(q) ||
                  String(inv.model_no || '').toLowerCase().includes(q)
                );
              });
              return (
                <div className="mb-4 p-3 rounded-xl" style={{ background: 'rgba(13,148,136,0.05)', border: '1px solid rgba(13,148,136,0.2)' }}>
                  <div className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: '#0D9488' }}>
                    Replacement Laptop Being Sent
                  </div>
                  <div className="relative">
                    {selectedRepl ? (
                      <div className="inp flex items-center gap-2 cursor-pointer"
                        onClick={() => { sf('replacement_inventory_id', ''); setReplSearch(''); setReplFocus(true); }}>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold truncate" style={{ color: '#252525' }}>{selectedRepl.brand} {selectedRepl.model_no}</div>
                          <div className="text-xs flex gap-2 mt-0.5">
                            <span className="font-mono" style={{ color: '#60A5FA' }}>{selectedRepl.asset_code}</span>
                            {selectedRepl.serial_number && <span className="font-mono" style={{ color: '#64748B' }}>S/N: {selectedRepl.serial_number}</span>}
                          </div>
                        </div>
                        <X size={12} style={{ color: '#64748B', flexShrink: 0 }} />
                      </div>
                    ) : (
                      <div className="relative">
                        <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: '#64748B' }} />
                        <input className="inp w-full" style={{ paddingLeft: '1.75rem', fontSize: 12 }}
                          type="text" autoComplete="off"
                          placeholder="Search by serial no., asset code, brand…"
                          value={replSearch}
                          onChange={e => { setReplSearch(e.target.value); setReplFocus(true); }}
                          onFocus={() => setReplFocus(true)}
                          onBlur={() => setTimeout(() => setReplFocus(false), 160)} />
                      </div>
                    )}
                    {replFocus && !selectedRepl && (
                      <div className="absolute left-0 right-0 z-50 rounded-xl mt-1 overflow-hidden"
                        style={{ background: '#0D1929', border: '1px solid rgba(13,148,136,0.3)', boxShadow: '0 8px 32px rgba(0,0,0,0.5)', maxHeight: 220, overflowY: 'auto' }}>
                        {filteredRepl.length === 0 ? (
                          <div className="px-3 py-3 text-xs text-center" style={{ color: '#64748B' }}>
                            {replSearch ? `No match for "${replSearch}"` : 'No available laptops'}
                          </div>
                        ) : filteredRepl.slice(0, 20).map((inv: any, i: number) => (
                          <button key={inv.id} type="button"
                            onMouseDown={() => { sf('replacement_inventory_id', String(inv.id)); setReplSearch(''); setReplFocus(false); }}
                            className="w-full text-left px-3 py-2.5 transition-colors"
                            style={{ background: 'transparent', borderBottom: i < filteredRepl.length - 1 ? '1px solid rgba(30,48,88,0.5)' : 'none' }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(13,148,136,0.1)')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                            <div className="text-sm font-semibold" style={{ color: '#F1F5F9' }}>{inv.brand} {inv.model_no}</div>
                            <div className="flex gap-2 mt-0.5">
                              <span className="font-mono text-xs font-bold" style={{ color: '#60A5FA' }}>{inv.asset_code}</span>
                              {inv.serial_number && <span className="font-mono text-xs" style={{ color: '#475569' }}>S/N: {inv.serial_number}</span>}
                            </div>
                            <div className="text-xs mt-0.5" style={{ color: '#475569' }}>
                              {inv.cpu}{inv.generation ? ` · ${inv.generation} Gen` : ''}{inv.ram ? ` · ${inv.ram}` : ''}{inv.ssd ? ` · ${inv.ssd}` : ''}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Date */}
              <div className="col-span-full">
                <FormField label={SCHED_META[schedModal].dateLabel} required>
                  <input className="inp" type="datetime-local" value={schedForm.scheduled_at}
                    min={new Date(Date.now() - new Date().getTimezoneOffset() * 60000 + 60000).toISOString().slice(0, 16)}
                    onChange={e => sf('scheduled_at', e.target.value)} />
                </FormField>
              </div>

              {/* Assign to staff — admin only; staff auto-assigned to themselves */}
              {schedModal !== 'pickup' && !isStaff && (
                <div className="col-span-full">
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
              <div className="col-span-full">
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FormField label="Employee Name">
                  <input className="inp" value={schedForm.employee_name} onChange={e => sf('employee_name', e.target.value)} placeholder="Employee full name" />
                </FormField>
                <FormField label="Employee Number">
                  <input className="inp" value={schedForm.employee_number} onChange={e => sf('employee_number', e.target.value)} placeholder="Employee ID / number" />
                </FormField>
                <div className="col-span-full">
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

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 mt-6">
              <Button variant="ghost" onClick={() => { setSchedModal(null); setSchedItem(null); }}>Cancel</Button>
              <Button
                loading={schedSaving}
                disabled={(() => {
                  const base = !schedForm.scheduled_at || !schedForm.contact_name || !schedForm.contact_phone || !schedForm.address;
                  if (base) return true;
                  const isStandaloneDelivery = schedModal === 'delivery' && !(schedItem as any)?.active_rental?.id;
                  if (isStandaloneDelivery) return !schedForm.client_id;
                  if (!isStaff && schedModal !== 'pickup' && !schedForm.assigned_to) return true;
                  return false;
                })()}
                onClick={handleScheduleSubmit}
                style={{ background: SCHED_META[schedModal].color }}>
                Confirm {SCHED_META[schedModal].label}
              </Button>
            </div>
          </>
        )}
      </Modal>

      {/* ── Exchange Modal ── */}
      <Modal open={!!exchModal} onClose={() => setExchModal(null)} title="Exchange Laptop" width="max-w-lg">
        {exchModal && (() => {
          const rental = (exchModal as any).active_rental;
          const selectedExch = availableInvs.find(i => String(i.id) === exchForm.new_inventory_id);
          const filteredExch = availableInvs.filter(inv => {
            if (!exchSearch.trim()) return true;
            const q = exchSearch.toLowerCase();
            return (
              String(inv.asset_code    || '').toLowerCase().includes(q) ||
              String(inv.serial_number || '').toLowerCase().includes(q) ||
              String(inv.brand         || '').toLowerCase().includes(q) ||
              String(inv.model_no      || '').toLowerCase().includes(q)
            );
          });
          return (
            <>
              {/* Current laptop context */}
              <div className="mb-4 px-3 py-2.5 rounded-xl"
                style={{ background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.2)' }}>
                <div className="text-xs font-bold uppercase tracking-widest mb-1.5" style={{ color: '#10B981' }}>
                  Current Laptop (Being Exchanged)
                </div>
                <div className="flex items-center gap-2">
                  <code className="text-xs font-bold px-1.5 py-0.5 rounded-md" style={{ background: 'rgba(16,185,129,0.12)', color: '#10B981' }}>
                    {exchModal.asset_code}
                  </code>
                  <span className="text-sm font-semibold" style={{ color: '#272727' }}>
                    {exchModal.brand} {exchModal.model_no}
                  </span>
                </div>
                {rental?.client && (
                  <div className="text-xs mt-1" style={{ color: '#64748B' }}>
                    Client: {rental.client.company || rental.client.name}
                  </div>
                )}
                {!rental && exchModal.status !== 'available' && (
                  <div className="text-xs mt-1" style={{ color: '#F59E0B' }}>
                    ⚠ No active rental found — exchange cannot be submitted
                  </div>
                )}
              </div>

              {/* Client selector — only for available laptops */}
              {exchModal.status === 'available' && (() => {
                const selCli = clients.find(c => String(c.id) === exchForm.client_id);
                const filtCli = clients.filter(c => {
                  if (!exchClientSearch.trim()) return true;
                  const q = exchClientSearch.toLowerCase();
                  return (
                    String(c.name    || '').toLowerCase().includes(q) ||
                    String(c.company || '').toLowerCase().includes(q) ||
                    String(c.email   || '').toLowerCase().includes(q)
                  );
                });
                return (
                  <div className="mb-4 p-3 rounded-xl" style={{ background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.2)' }}>
                    <div className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: '#3B82F6' }}>
                      Client <span style={{ color: '#EF4444' }}>*</span>
                    </div>
                    <div className="relative">
                      {selCli ? (
                        <div className="inp flex items-center gap-2 cursor-pointer"
                          onClick={() => { ef('client_id', ''); ef('rental_id', ''); setExchClientSearch(''); setExchClientFocus(true); setExchClientRentals([]); }}>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold truncate" style={{ color: '#202020' }}>
                              {selCli.company || selCli.name}
                            </div>
                            {selCli.company && <div className="text-xs" style={{ color: '#64748B' }}>{selCli.name}</div>}
                          </div>
                          <X size={12} style={{ color: '#64748B', flexShrink: 0 }} />
                        </div>
                      ) : (
                        <div className="relative">
                          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: '#64748B' }} />
                          <input className="inp w-full" style={{ paddingLeft: '1.75rem', fontSize: 12 }}
                            type="text" autoComplete="off"
                            placeholder="Search by name, company, email…"
                            value={exchClientSearch}
                            onChange={e => { setExchClientSearch(e.target.value); setExchClientFocus(true); }}
                            onFocus={() => setExchClientFocus(true)}
                            onBlur={() => setTimeout(() => setExchClientFocus(false), 160)} />
                        </div>
                      )}
                      {exchClientFocus && !selCli && (
                        <div className="absolute left-0 right-0 z-50 rounded-xl mt-1 overflow-hidden"
                          style={{ background: '#0D1929', border: '1px solid rgba(59,130,246,0.3)', boxShadow: '0 8px 32px rgba(0,0,0,0.5)', maxHeight: 200, overflowY: 'auto' }}>
                          {filtCli.length === 0 ? (
                            <div className="px-3 py-3 text-xs text-center" style={{ color: '#64748B' }}>
                              {exchClientSearch ? `No match for "${exchClientSearch}"` : 'No clients found'}
                            </div>
                          ) : filtCli.slice(0, 25).map((c: any, i: number) => (
                            <button key={c.id} type="button"
                              onMouseDown={() => {
                                ef('client_id', String(c.id)); ef('rental_id', '');
                                setExchClientSearch(''); setExchClientFocus(false);
                                setExchClientRentals([]); setExchRentalsLoading(true);
                                api.rentals.list({ client_id: String(c.id), status: 'active', per_page: '50' })
                                  .then(res => setExchClientRentals(res.data?.data || res.data || []))
                                  .catch(() => {})
                                  .finally(() => setExchRentalsLoading(false));
                              }}
                              className="w-full text-left px-3 py-2.5 transition-colors"
                              style={{ background: 'transparent', borderBottom: i < filtCli.length - 1 ? '1px solid rgba(30,48,88,0.5)' : 'none' }}
                              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(59,130,246,0.1)')}
                              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                              <div className="text-sm font-semibold" style={{ color: '#F1F5F9' }}>{c.company || c.name}</div>
                              {c.company && <div className="text-xs" style={{ color: '#94A3B8' }}>{c.name}</div>}
                              {c.email && <div className="text-xs font-mono" style={{ color: '#475569' }}>{c.email}</div>}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Rented laptop selector — shown for available laptops after a client is chosen */}
              {exchModal.status === 'available' && exchForm.client_id && (
                <div className="mb-4 p-3 rounded-xl" style={{ background: 'rgba(139,92,246,0.05)', border: '1px solid rgba(139,92,246,0.2)' }}>
                  <div className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: '#8B5CF6' }}>
                    Rented Laptop to Replace <span style={{ color: '#EF4444' }}>*</span>
                  </div>
                  {exchRentalsLoading ? (
                    <div className="text-xs py-2" style={{ color: '#64748B' }}>Loading rentals…</div>
                  ) : exchClientRentals.length === 0 ? (
                    <div className="text-xs py-2" style={{ color: '#F59E0B' }}>No active rentals found for this client</div>
                  ) : (
                    <div className="flex flex-col gap-1.5">
                      {exchClientRentals.map((r: any) => {
                        const isSelected = exchForm.rental_id === String(r.id);
                        return (
                          <button key={r.id} type="button"
                            onClick={() => ef('rental_id', String(r.id))}
                            className="w-full text-left px-3 py-2 rounded-lg transition-all"
                            style={{
                              background: isSelected ? 'rgba(139,92,246,0.15)' : 'rgba(30,48,88,0.3)',
                              border: `1px solid ${isSelected ? 'rgba(139,92,246,0.5)' : 'rgba(30,48,88,0.5)'}`,
                            }}>
                            <div className="flex items-center gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-semibold" style={{ color: '#F1F5F9' }}>
                                  {r.inventory?.brand} {r.inventory?.model_no}
                                </div>
                                <div className="flex gap-2 mt-0.5">
                                  <span className="font-mono text-xs" style={{ color: '#60A5FA' }}>{r.inventory?.asset_code}</span>
                                  {r.inventory?.serial_number && (
                                    <span className="font-mono text-xs" style={{ color: '#475569' }}>S/N: {r.inventory.serial_number}</span>
                                  )}
                                  <span className="font-mono text-xs" style={{ color: '#64748B' }}>{r.rental_no}</span>
                                </div>
                              </div>
                              {isSelected && (
                                <div className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0"
                                  style={{ background: '#8B5CF6' }}>
                                  <div className="w-1.5 h-1.5 rounded-full bg-white" />
                                </div>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Replacement laptop combobox — only for rented laptops; available laptop IS the replacement */}
              {exchModal.status === 'rented' && <div className="mb-4">
                <div className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: '#64748B' }}>
                  Replacement Laptop <span className="font-normal normal-case tracking-normal" style={{ color: '#EF4444' }}>*</span>
                </div>
                <div className="relative">
                  {selectedExch ? (
                    <div className="inp flex items-center gap-2 cursor-pointer"
                      onClick={() => { ef('new_inventory_id', ''); setExchSearch(''); setExchFocus(true); }}>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold truncate" style={{ color: '#252525' }}>
                          {selectedExch.brand} {selectedExch.model_no}
                        </div>
                        <div className="text-xs flex gap-2 mt-0.5">
                          <span className="font-mono" style={{ color: '#60A5FA' }}>{selectedExch.asset_code}</span>
                          {selectedExch.serial_number && (
                            <span className="font-mono" style={{ color: '#64748B' }}>S/N: {selectedExch.serial_number}</span>
                          )}
                        </div>
                      </div>
                      <X size={12} style={{ color: '#64748B', flexShrink: 0 }} />
                    </div>
                  ) : (
                    <div className="relative">
                      <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: '#64748B' }} />
                      <input className="inp w-full" style={{ paddingLeft: '1.75rem', fontSize: 12 }}
                        type="text" autoComplete="off"
                        placeholder="Search by serial no., asset code, brand…"
                        value={exchSearch}
                        onChange={e => { setExchSearch(e.target.value); setExchFocus(true); }}
                        onFocus={() => setExchFocus(true)}
                        onBlur={() => setTimeout(() => setExchFocus(false), 160)} />
                    </div>
                  )}
                  {exchFocus && !selectedExch && (
                    <div className="absolute left-0 right-0 z-50 rounded-xl mt-1 overflow-hidden"
                      style={{ background: '#0D1929', border: '1px solid rgba(16,185,129,0.3)', boxShadow: '0 8px 32px rgba(0,0,0,0.5)', maxHeight: 220, overflowY: 'auto' }}>
                      {filteredExch.length === 0 ? (
                        <div className="px-3 py-3 text-xs text-center" style={{ color: '#64748B' }}>
                          {exchSearch ? `No match for "${exchSearch}"` : 'No available laptops'}
                        </div>
                      ) : filteredExch.slice(0, 20).map((inv: any, i: number) => (
                        <button key={inv.id} type="button"
                          onMouseDown={() => { ef('new_inventory_id', String(inv.id)); setExchSearch(''); setExchFocus(false); }}
                          className="w-full text-left px-3 py-2.5 transition-colors"
                          style={{ background: 'transparent', borderBottom: i < filteredExch.length - 1 ? '1px solid rgba(30,48,88,0.5)' : 'none' }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(16,185,129,0.1)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                          <div className="text-sm font-semibold" style={{ color: '#F1F5F9' }}>{inv.brand} {inv.model_no}</div>
                          <div className="flex gap-2 mt-0.5">
                            <span className="font-mono text-xs font-bold" style={{ color: '#60A5FA' }}>{inv.asset_code}</span>
                            {inv.serial_number && <span className="font-mono text-xs" style={{ color: '#475569' }}>S/N: {inv.serial_number}</span>}
                          </div>
                          <div className="text-xs mt-0.5" style={{ color: '#475569' }}>
                            {inv.cpu}{inv.generation ? ` · ${inv.generation} Gen` : ''}{inv.ram ? ` · ${inv.ram}` : ''}{inv.ssd ? ` · ${inv.ssd}` : ''}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>}

              {/* Exchange date */}
              <div className="mb-4">
                <FormField label="Exchange Date" required>
                  <input className="inp" type="date" value={exchForm.exchange_date}
                    onChange={e => ef('exchange_date', e.target.value)} />
                </FormField>
              </div>

              {/* Reason + Notes */}
              <div className="flex flex-col gap-3 mb-2">
                <FormField label="Reason (optional)">
                  <input className="inp" value={exchForm.reason}
                    onChange={e => ef('reason', e.target.value)}
                    placeholder="e.g. Hardware failure, upgrade request…" />
                </FormField>
                <FormField label="Notes (optional)">
                  <textarea className="inp resize-none" rows={2} value={exchForm.notes}
                    onChange={e => ef('notes', e.target.value)}
                    placeholder="Additional instructions or context…" />
                </FormField>
              </div>

              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 mt-6">
                <Button variant="ghost" onClick={() => setExchModal(null)}>Cancel</Button>
                <Button
                  loading={exchSaving}
                  disabled={
                    !exchForm.exchange_date ||
                    (exchModal.status === 'rented' && (!rental || !exchForm.new_inventory_id)) ||
                    (exchModal.status === 'available' && (!exchForm.client_id || !exchForm.rental_id))
                  }
                  onClick={handleExchangeSubmit}
                  style={{ background: '#10B981' }}>
                  <ArrowLeftRight size={13} style={{ marginRight: 6 }} />
                  Confirm Exchange
                </Button>
              </div>
            </>
          );
        })()}
      </Modal>

      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </DashboardLayout>
  );
}
