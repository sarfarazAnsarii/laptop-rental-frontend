'use client';

import { useEffect, useState, useCallback } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button, Modal, PageHeader, FormField, EmptyState, Toast, Card } from '@/components/ui';
import { api } from '@/lib/api';
import { Inventory } from '@/types';
import {
  Monitor, Plus, Search, Edit, Trash2, Eye, Upload,
  FileSpreadsheet, AlertCircle, CheckCircle2, ImagePlus,
  X, ChevronRight, List, Grid3X3, Filter, LayoutGrid,
} from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';

const STATUS_OPTS = ['', 'available', 'rented', 'maintenance', 'sold', 'returned'];
const TYPE_OPTS   = ['', 'office', 'vendor', 'sold'];

const EMPTY_FORM = {
  brand: '', model_no: '', serial_number: '', cpu: '', generation: '', ram: '', ssd: '',
  purchase_date: '', purchaser: '', status: 'available',
  graphics: '', type: 'office', notes: '', vendor_name: '', vendor_location: '',
  employee_name: '', employee_mobile: '', employee_address: '',
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
  const [showImport,   setShowImport]   = useState(false);
  const [importFile,   setImportFile]   = useState<File | null>(null);
  const [importing,    setImporting]    = useState(false);
  const [importResult, setImportResult] = useState<{ success: boolean; message: string; failures?: any[] } | null>(null);

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

  const IMG_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://api.laptoprentalservice.com').replace(/\/api\/?$/, '') + '/';

  function openAdd() { setForm({ ...EMPTY_FORM }); setEditItem(null); setEditImages([]); setImageFiles([]); setShowModal(true); }
  function openEdit(item: Inventory) {
    setForm({
      brand: item.brand||'', model_no: item.model_no||'', serial_number: (item as any).serial_number||'',
      cpu: item.cpu||'', generation: (item as any).generation||'', ram: item.ram||'',
      ssd: item.ssd||'', purchase_date: item.purchase_date||'', purchaser: (item as any).purchaser||'',
      status: item.status||'available', graphics: item.graphics||'', type: item.type||'office',
      notes: item.notes||'', vendor_name: item.vendor_name||'', vendor_location: item.vendor_location||'',
      employee_name: item.employee_name||'', employee_mobile: item.employee_mobile||'', employee_address: item.employee_address||'',
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

  async function handleImport() {
    if (!importFile) return;
    setImporting(true); setImportResult(null);
    try {
      const res = await api.inventory.import(importFile);
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
            <Button variant="secondary" size="sm" icon={<Upload size={14} />}
              onClick={() => { setShowImport(true); setImportFile(null); setImportResult(null); }}>
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
                  {items.map(item => (
                    <Link key={item.id} href={`/inventory/${item.id}`}
                      className="flex items-center gap-4 px-4 py-4 hover:bg-slate-50 transition-colors"
                      style={{ textDecoration: 'none' }}>
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
                      </div>
                      <ChevronRight size={15} style={{ color: '#CBD5E1', flexShrink: 0 }} />
                    </Link>
                  ))}
                </div>
              </div>
            )
          )}
        </div>
      ) : (
        /* ── Admin: full list view ── */
        <>
          {/* Filters bar */}
          <div className="glass-card p-4 mb-5 flex flex-col sm:flex-row gap-3 items-start sm:items-center flex-wrap">
            <div className="relative flex-1 min-w-[220px]">
              <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: '#94A3B8' }} />
              <input className="inp" style={{ paddingLeft: '2.375rem' }}
                placeholder="Search by asset code, serial, model…"
                value={serialSearch} onChange={e => { setSerialSearch(e.target.value); setPage(1); }} />
            </div>
            <div className="flex gap-2 flex-wrap">
              <select className="inp h-9 w-36" value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}>
                {STATUS_OPTS.map(s => <option key={s} value={s}>{s||'All Status'}</option>)}
              </select>
              <select className="inp h-9 w-32" value={type} onChange={e => { setType(e.target.value); setPage(1); }}>
                {TYPE_OPTS.map(t => <option key={t} value={t}>{t||'All Types'}</option>)}
              </select>
              {/* Grid / List toggle */}
              <div className="flex items-center gap-0.5 rounded-lg p-0.5" style={{ background: '#F1F5F9', border: '1px solid #E2E8F0' }}>
                <button onClick={() => setViewMode('table')} className="w-8 h-7 rounded-md flex items-center justify-center transition-all"
                  style={{ background: viewMode==='table'?'white':'transparent', color: viewMode==='table'?'#2563EB':'#94A3B8', boxShadow: viewMode==='table'?'0 1px 2px rgba(0,0,0,0.08)':undefined }}>
                  <List size={13} />
                </button>
                <button onClick={() => setViewMode('grid')} className="w-8 h-7 rounded-md flex items-center justify-center transition-all"
                  style={{ background: viewMode==='grid'?'white':'transparent', color: viewMode==='grid'?'#2563EB':'#94A3B8', boxShadow: viewMode==='grid'?'0 1px 2px rgba(0,0,0,0.08)':undefined }}>
                  <LayoutGrid size={13} />
                </button>
              </div>
            </div>
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
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th className="w-8 text-center">#</th>
                        <th>Asset Code</th>
                        <th>Brand / Model</th>
                        <th>Serial No</th>
                        <th>Specs</th>
                        <th>Type</th>
                        <th className="text-right">Monthly</th>
                        <th>Vendor</th>
                        <th className="hidden xl:table-cell">Employee</th>
                        <th>Status</th>
                        <th>Client</th>
                        <th className="text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item, idx) => (
                        <tr key={item.id}>
                          <td className="text-center text-xs" style={{ color: '#94A3B8' }}>{(page-1)*15+idx+1}</td>
                          <td>
                            <Link href={`/inventory/${item.id}`}
                              className="font-mono text-xs font-bold"
                              style={{ color: '#2563EB', textDecoration: 'none' }}>
                              {item.asset_code}
                            </Link>
                          </td>
                          <td>
                            <div className="flex items-center gap-2">
                              {item.images?.[0] ? (
                                <img src={IMG_BASE+item.images[0]} alt={item.brand}
                                  className="w-8 h-6 object-cover rounded flex-shrink-0" style={{ border: '1px solid #E2E8F0' }} />
                              ) : (
                                <div className="w-8 h-6 rounded flex items-center justify-center flex-shrink-0" style={{ background: '#F1F5F9' }}>
                                  <Monitor size={11} style={{ color: '#CBD5E1' }} />
                                </div>
                              )}
                              <div>
                                <div className="font-semibold text-sm" style={{ color: '#0F172A' }}>{item.brand}</div>
                                <div className="text-xs" style={{ color: '#64748B' }}>{item.model_no}</div>
                              </div>
                            </div>
                          </td>
                          <td><code className="text-xs" style={{ color: '#64748B' }}>{item.serial_number||'—'}</code></td>
                          <td>
                            <div className="text-xs" style={{ color: '#334155' }}>{item.cpu}{(item as any).generation?` · ${(item as any).generation}G`:''}</div>
                            <div className="text-xs" style={{ color: '#94A3B8' }}>{item.ram} · {item.ssd}</div>
                          </td>
                          <td><span className={`badge badge-${item.type}`}>{item.type}</span></td>
                          <td className="text-right">
                            <span className="text-sm font-semibold tabular-nums" style={{ color: item.monthly_rental?'#16A34A':'#CBD5E1' }}>
                              {item.monthly_rental ? `₹${Number(item.monthly_rental).toLocaleString()}` : '—'}
                            </span>
                          </td>
                          <td>
                            <div className="text-xs" style={{ color: '#334155' }}>{item.vendor_name||'—'}</div>
                            {item.vendor_location && <div className="text-xs" style={{ color: '#94A3B8' }}>{item.vendor_location}</div>}
                          </td>
                          <td className="hidden xl:table-cell">
                            <div className="text-xs" style={{ color: '#334155' }}>{item.employee_name||'—'}</div>
                            {item.employee_mobile && <div className="text-xs" style={{ color: '#94A3B8' }}>{item.employee_mobile}</div>}
                          </td>
                          <td><span className={`badge badge-${item.status}`}>{item.status}</span></td>
                          <td>
                            {item.active_rental?.client ? (
                              <>
                                <div className="text-xs font-medium" style={{ color: '#334155' }}>{item.active_rental.client.name}</div>
                                {item.active_rental.client.company && <div className="text-xs" style={{ color: '#94A3B8' }}>{item.active_rental.client.company}</div>}
                              </>
                            ) : <span style={{ color: '#CBD5E1' }}>—</span>}
                          </td>
                          <td>
                            <div className="flex items-center justify-center gap-1">
                              <Link href={`/inventory/${item.id}`}>
                                <Button variant="ghost" size="xs" icon={<Eye size={12} />} />
                              </Link>
                              {!isStaff && (
                                <>
                                  <Button variant="ghost" size="xs" icon={<Edit size={12} />} onClick={() => openEdit(item)} />
                                  <Button variant="danger" size="xs" icon={<Trash2 size={12} />} onClick={() => handleDelete(item)} />
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile cards */}
                <div className="sm:hidden divide-y" style={{ borderColor: '#F1F5F9' }}>
                  {items.map(item => (
                    <div key={item.id} className="p-4 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <code className="text-xs font-bold px-2 py-0.5 rounded-md" style={{ background: '#EFF6FF', color: '#2563EB' }}>{item.asset_code}</code>
                        <div className="flex items-center gap-1.5">
                          <span className={`badge badge-${item.type}`}>{item.type}</span>
                          <span className={`badge badge-${item.status}`}>{item.status}</span>
                        </div>
                      </div>
                      <div className="font-semibold text-sm" style={{ color: '#0F172A' }}>{item.brand} {item.model_no}</div>
                      <div className="text-xs" style={{ color: '#64748B' }}>{item.cpu} · {item.ram} · {item.ssd}</div>
                      {item.monthly_rental && <div className="text-xs font-semibold" style={{ color: '#16A34A' }}>₹{Number(item.monthly_rental).toLocaleString()}/mo</div>}
                      <div className="flex items-center justify-end gap-1 pt-1">
                        <Link href={`/inventory/${item.id}`}><Button variant="ghost" size="sm" icon={<Eye size={13} />} /></Link>
                        {!isStaff && <><Button variant="ghost" size="sm" icon={<Edit size={13} />} onClick={() => openEdit(item)} /><Button variant="danger" size="sm" icon={<Trash2 size={13} />} onClick={() => handleDelete(item)} /></>}
                      </div>
                    </div>
                  ))}
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Brand" required><input className="inp" value={form.brand} onChange={e=>f('brand',e.target.value)} placeholder="Dell, HP, Lenovo…" /></FormField>
          <FormField label="Model No" required><input className="inp" value={form.model_no} onChange={e=>f('model_no',e.target.value)} placeholder="Latitude E5470" /></FormField>
          <FormField label="Serial Number"><input className="inp" value={form.serial_number} onChange={e=>f('serial_number',e.target.value)} placeholder="F7088H2" /></FormField>
          <FormField label="CPU" required><input className="inp" value={form.cpu} onChange={e=>f('cpu',e.target.value)} placeholder="i5, i7…" /></FormField>
          <FormField label="Generation"><input className="inp" value={form.generation} onChange={e=>f('generation',e.target.value)} placeholder="6th, 8th, 12th…" /></FormField>
          <FormField label="RAM" required><input className="inp" value={form.ram} onChange={e=>f('ram',e.target.value)} placeholder="8GB, 16GB…" /></FormField>
          <FormField label="Storage" required><input className="inp" value={form.ssd} onChange={e=>f('ssd',e.target.value)} placeholder="256 SSD, 512 NVMe…" /></FormField>
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
                {['available','rented','maintenance','sold','returned'].map(s=><option key={s} value={s}>{s}</option>)}
              </select>
            </FormField>
          )}
        </div>

        <div className="mt-5 pt-4 border-t" style={{ borderColor: '#E2E8F0' }}>
          <div className="section-title">Employee Assignment</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <FormField label="Name"><input className="inp" value={form.employee_name} onChange={e=>f('employee_name',e.target.value)} placeholder="John Doe" /></FormField>
            <FormField label="Mobile"><input className="inp" value={form.employee_mobile} onChange={e=>f('employee_mobile',e.target.value)} placeholder="9876543210" /></FormField>
            <FormField label="Address"><input className="inp" value={form.employee_address} onChange={e=>f('employee_address',e.target.value)} placeholder="12 MG Road…" /></FormField>
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
                const csv = ['Asset No,Brand,Model Number,Serial Number,CPU,Generation,Ram,HDD,Purchase Date,Purchaser,Price,Status,Vendor Name,Location,Graphics,Notes,Employee Name,Employee Mobile,Employee Address','1001,Dell,LATITUDE-E5470,F7088H2,i5,6th,8GB,256 SSD,15-Jan-23,Ravi Delhi,1100,office,Ravi Enterprises,Delhi,,,John Doe,9876543210,12 MG Road Bangalore'].join('\n');
                const blob = new Blob([csv], {type:'text/csv'}); const url = URL.createObjectURL(blob);
                const a = document.createElement('a'); a.href=url; a.download='inventory_sample.csv'; a.click(); URL.revokeObjectURL(url);
              }} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors"
                style={{ background: '#DBEAFE', color: '#1D4ED8' }}>
                <FileSpreadsheet size={11} /> Sample CSV
              </button>
            </div>
            <p className="text-xs" style={{ color: '#2563EB' }}>
              Required: Brand, Model, Serial, CPU, Generation, RAM, Storage, Purchase Date, Purchaser
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

      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </DashboardLayout>
  );
}
