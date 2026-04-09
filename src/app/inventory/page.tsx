'use client';

import { useEffect, useState, useCallback } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button, Modal, PageHeader, FormField, EmptyState, Toast } from '@/components/ui';
import { api } from '@/lib/api';
import { Inventory } from '@/types';
import { Monitor, Plus, Search, Edit, Trash2, Eye, Upload, FileSpreadsheet, AlertCircle, CheckCircle2, ImagePlus, X } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';

const STATUS_OPTIONS = ['', 'available', 'rented', 'maintenance', 'sold', 'returned'];
const TYPE_OPTIONS   = ['', 'office', 'vendor', 'sold'];

const EMPTY_FORM = {
  brand: '', model_no: '', serial_number: '', cpu: '', generation: '', ram: '', ssd: '',
  purchase_date: '', purchaser: '', status: 'available',
  // optional fields sent as empty to satisfy DB non-nullable columns
  graphics: '', type: 'office', notes: '', vendor_name: '', vendor_location: '',
  employee_name: '', employee_mobile: '', employee_address: '',
};

export default function InventoryPage() {
  const { user } = useAuth();
  const isStaff = user?.role === 'staff';
  const [items, setItems] = useState<Inventory[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [serialSearch, setSerialSearch] = useState('');
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<Inventory | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [vendors, setVendors] = useState<any[]>([]);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  // image upload (edit modal)
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [editImages, setEditImages] = useState<string[]>([]);

  // bulk import
  const [showImport, setShowImport] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ success: boolean; message: string; failures?: any[] } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { per_page: '12', page: String(page) };
      if (search)       params.search        = search;
      if (serialSearch) params.serial_number = serialSearch;
      if (status)       params.status        = status;
      if (type)         params.type          = type;
      const res = await api.inventory.list(params);
      setItems(res.data?.data || []);
      setLastPage(res.data?.last_page || 1);
      setTotal(res.data?.total || 0);
    } finally { setLoading(false); }
  }, [page, search, serialSearch, status, type]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    api.users.list({ role: 'vendor', per_page: '200' })
      .then((res: any) => setVendors(res.data?.data || res.data || []))
      .catch(() => {});
  }, []);

  const IMG_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://laptop-rental-api.loc/api')
    .replace('/api', '') + '/storage/';

  function openAdd() {
    setForm({ ...EMPTY_FORM });
    setEditItem(null);
    setEditImages([]);
    setImageFiles([]);
    setShowModal(true);
  }
  function openEdit(item: Inventory) {
    setForm({
      brand: item.brand || '', model_no: item.model_no || '', serial_number: (item as any).serial_number || '',
      cpu: item.cpu || '', generation: (item as any).generation || '', ram: item.ram || '',
      ssd: item.ssd || '', purchase_date: item.purchase_date || '',
      purchaser: (item as any).purchaser || '', status: item.status || 'available',
      graphics: item.graphics || '', type: item.type || 'office',
      notes: item.notes || '', vendor_name: item.vendor_name || '', vendor_location: item.vendor_location || '',
      employee_name: item.employee_name || '', employee_mobile: item.employee_mobile || '', employee_address: item.employee_address || '',
    });
    setEditItem(item);
    setEditImages(item.images || []);
    setImageFiles([]);
    setShowModal(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      if (editItem) {
        const payload = Object.fromEntries(Object.entries(form).filter(([, v]) => v !== ''));
        await api.inventory.update(editItem.id, payload);
        showToast('Inventory updated successfully');
      } else {
        await api.inventory.create(form);
        showToast('Laptop added to inventory');
      }
      setShowModal(false);
      load();
    } catch (e: any) {
      showToast(e.message || 'Failed to save', 'error');
    } finally { setSaving(false); }
  }

  async function handleDelete(item: Inventory) {
    if (!confirm(`Delete ${item.brand} ${item.model_no} (${item.asset_code})?`)) return;
    try {
      await api.inventory.delete(item.id);
      showToast('Deleted successfully');
      load();
    } catch (e: any) { showToast(e.message || 'Delete failed', 'error'); }
  }

  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  async function handleUploadImages() {
    if (!editItem || imageFiles.length === 0) return;
    setUploadingImages(true);
    try {
      const res = await api.inventory.uploadImages(editItem.id, imageFiles);
      setEditImages(res.images || []);
      setImageFiles([]);
      showToast(`${imageFiles.length} image(s) uploaded`);
    } catch (e: any) {
      showToast(e.message || 'Upload failed', 'error');
    } finally { setUploadingImages(false); }
  }

  async function handleDeleteImage(index: number) {
    if (!editItem) return;
    try {
      const res = await api.inventory.deleteImage(editItem.id, index);
      setEditImages(res.images || []);
      showToast('Image removed');
    } catch (e: any) { showToast(e.message || 'Delete failed', 'error'); }
  }

  async function handleImport() {
    if (!importFile) return;
    setImporting(true);
    setImportResult(null);
    try {
      const res = await api.inventory.import(importFile);
      setImportResult({ success: true, message: res.message });
      load();
      setShowImport(false);
    } catch (e: any) {
      setImportResult({ success: false, message: e.message || 'Import failed', failures: e.failures });
    } finally { setImporting(false); }
  }

  return (
    <DashboardLayout>
      <PageHeader
        title="Inventory"
        subtitle={`${total} laptops total`}
        action={!isStaff ? (
          <div className="flex gap-2">
            <Button variant="outline" icon={<Upload size={15} />} onClick={() => { setShowImport(true); setImportFile(null); setImportResult(null); }}>Import</Button>
            <Button icon={<Plus size={15} />} onClick={openAdd}>Add Laptop</Button>
          </div>
        ) : undefined}
      />

      {/* Filters */}
      <div className="glass-card p-4 mb-6 flex flex-col sm:flex-row gap-3 flex-wrap">        
        <div className="relative flex-1 min-w-[160px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: '#475569' }} />
          <input className="inp pl-35px"
            placeholder="Search by serial number..."
            value={serialSearch} onChange={e => { setSerialSearch(e.target.value); setPage(1); }} />
        </div>
        {!isStaff && (
          <div className="flex gap-3">
            <select className="inp flex-1 sm:w-40 sm:flex-none" value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}>
              {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s || 'All Status'}</option>)}
            </select>
            <select className="inp flex-1 sm:w-36 sm:flex-none" value={type} onChange={e => { setType(e.target.value); setPage(1); }}>
              {TYPE_OPTIONS.map(t => <option key={t} value={t}>{t || 'All Types'}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">{[...Array(6)].map((_, i) => <div key={i} className="skeleton h-12 rounded-xl" />)}</div>
        ) : items.length === 0 ? (
          <EmptyState icon={<Monitor size={22} />} title="No laptops found" desc="Add your first laptop to get started" />
        ) : (
          <>
            {/* Mobile card list */}
            <div className="sm:hidden divide-y" style={{ borderColor: 'rgba(30,48,88,0.4)' }}>
              {items.map(item => (
                <div key={item.id} className="p-4 space-y-2 animate-fade-in">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-medium px-2 py-1 rounded" style={{ background: 'rgba(59,130,246,0.08)', color: '#3B82F6' }}>{item.asset_code}</span>
                    <div className="flex items-center gap-1.5">
                      <span className={`badge badge-${item.type}`}>{item.type}</span>
                      <span className={`badge badge-${item.status}`}>{item.status}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {item.images?.[0] ? (
                      <img src={IMG_BASE + item.images[0]} alt={item.brand}
                        className="w-14 h-10 object-cover rounded-lg flex-shrink-0"
                        style={{ border: '1px solid rgba(30,48,88,0.7)' }} />
                    ) : (
                      <div className="w-14 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: 'rgba(30,48,88,0.5)', border: '1px solid rgba(30,48,88,0.7)' }}>
                        <Monitor size={16} style={{ color: '#334155' }} />
                      </div>
                    )}
                    <div>
                      <div className="font-medium text-sm" style={{ color: '#F1F5F9' }}>{item.brand}</div>
                      <div className="text-xs" style={{ color: '#475569' }}>{item.model_no}</div>
                    </div>
                  </div>
                  <div className="text-xs space-y-0.5">
                    <div style={{ color: '#94A3B8' }}>{item.cpu}{(item as any).generation ? ` · ${(item as any).generation} Gen` : ''}</div>
                    <div style={{ color: '#475569' }}>{item.ram} · {item.ssd}</div>
                    {item.graphics && <div style={{ color: '#64748B' }}>{item.graphics}</div>}
                  </div>
                  {item.serial_number && (
                    <div className="text-xs font-mono" style={{ color: '#64748B' }}>S/N: {item.serial_number}</div>
                  )}
                  {item.monthly_rental && (
                    <div className="text-xs font-medium" style={{ color: '#10B981' }}>₹{Number(item.monthly_rental).toLocaleString()}/mo</div>
                  )}
                  {item.vendor_name && (
                    <div className="text-xs" style={{ color: '#475569' }}>{item.vendor_name}{item.vendor_location ? ` · ${item.vendor_location}` : ''}</div>
                  )}
                  {item.employee_name && (
                    <div className="text-xs" style={{ color: '#64748B' }}>
                      <span style={{ color: '#94A3B8' }}>{item.employee_name}</span>
                      {item.employee_mobile ? ` · ${item.employee_mobile}` : ''}
                    </div>
                  )}
                  {item.active_rental?.client && (
                    <div className="text-xs" style={{ color: '#64748B' }}>
                      Client: <span style={{ color: '#94A3B8' }}>{item.active_rental.client.name}</span>
                      {item.active_rental.client.company ? ` · ${item.active_rental.client.company}` : ''}
                    </div>
                  )}
                  <div className="flex items-center justify-end gap-1 pt-1">
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
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Asset Code</th>
                    <th>Brand / Model</th>
                    <th>Serial No</th>
                    <th>Specs</th>
                    <th>Type</th>
                    <th>Rental/mo</th>
                    <th>Delivery</th>
                    <th>Vendor</th>
                    <th className="hidden xl:table-cell">Employee</th>
                    <th>Status / Client</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(item => (
                    <tr key={item.id} className="animate-fade-in">
                      <td>
                        <span className="font-mono text-xs font-medium px-2 py-1 rounded" style={{ background: 'rgba(59,130,246,0.08)', color: '#3B82F6' }}>{item.asset_code}</span>
                      </td>
                      <td>
                        <div className="flex items-center gap-2.5">
                          {item.images?.[0] ? (
                            <img src={IMG_BASE + item.images[0]} alt={item.brand}
                              className="w-10 h-8 object-cover rounded-lg flex-shrink-0"
                              style={{ border: '1px solid rgba(30,48,88,0.7)' }} />
                          ) : (
                            <div className="w-10 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                              style={{ background: 'rgba(30,48,88,0.5)', border: '1px solid rgba(30,48,88,0.7)' }}>
                              <Monitor size={13} style={{ color: '#334155' }} />
                            </div>
                          )}
                          <div>
                            <div className="font-medium text-sm" style={{ color: '#F1F5F9' }}>{item.brand}</div>
                            <div className="text-xs" style={{ color: '#475569' }}>{item.model_no}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="font-mono text-xs" style={{ color: '#94A3B8' }}>{item.serial_number || '—'}</span>
                      </td>
                      <td>
                        <div className="text-xs space-y-0.5">
                          <div style={{ color: '#F1F5F9' }}>{item.cpu}{item.generation ? ` · ${item.generation} Gen` : ''}</div>
                          <div style={{ color: '#475569' }}>{item.ram} · {item.ssd}</div>
                          {item.graphics && <div style={{ color: '#64748B' }}>{item.graphics}</div>}
                        </div>
                      </td>
                      <td><span className={`badge badge-${item.type}`}>{item.type}</span></td>
                      <td>
                        <span className="text-sm font-medium" style={{ color: '#10B981' }}>
                          {item.monthly_rental ? `₹${Number(item.monthly_rental).toLocaleString()}` : '—'}
                        </span>
                      </td>
                      <td>
                        <span className="text-xs" style={{ color: '#94A3B8' }}>
                          {item.delivery_date ? new Date(item.delivery_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                        </span>
                      </td>
                      <td>
                        <div className="text-xs">
                          <div style={{ color: '#F1F5F9' }}>{item.vendor_name || '—'}</div>
                          {item.vendor_location && <div style={{ color: '#475569' }}>{item.vendor_location}</div>}
                        </div>
                      </td>
                      <td className="hidden xl:table-cell">
                        <div className="text-xs">
                          <div style={{ color: '#F1F5F9' }}>{item.employee_name || '—'}</div>
                          {item.employee_mobile && <div style={{ color: '#475569' }}>{item.employee_mobile}</div>}
                          {item.employee_address && <div style={{ color: '#334155' }}>{item.employee_address}</div>}
                        </div>
                      </td>
                      <td>
                        <div className="space-y-1">
                          <span className={`badge badge-${item.status}`}>{item.status}</span>
                          {item.active_rental?.client && (
                            <div className="text-xs" style={{ color: '#64748B' }}>
                              <div style={{ color: '#94A3B8' }}>{item.active_rental.client.name}</div>
                              {item.active_rental.client.company && <div style={{ color: '#475569' }}>{item.active_rental.client.company}</div>}
                            </div>
                          )}
                        </div>
                      </td>
                      <td>
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
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Pagination */}
        {lastPage > 1 && (
          <div className="flex items-center justify-between px-6 py-4 flex-wrap gap-3" style={{ borderTop: '1px solid #1E3058' }}>
            <span className="text-xs" style={{ color: '#475569' }}>
              Page {page} of {lastPage} &mdash; {total} total
            </span>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Prev</Button>
              {(() => {
                const pages: (number | '...')[] = [];
                if (lastPage <= 7) {
                  for (let i = 1; i <= lastPage; i++) pages.push(i);
                } else {
                  pages.push(1);
                  if (page > 3) pages.push('...');
                  for (let i = Math.max(2, page - 1); i <= Math.min(lastPage - 1, page + 1); i++) pages.push(i);
                  if (page < lastPage - 2) pages.push('...');
                  pages.push(lastPage);
                }
                return pages.map((p, i) =>
                  p === '...'
                    ? <span key={`ellipsis-${i}`} className="px-2 text-xs" style={{ color: '#475569' }}>…</span>
                    : <button key={p} onClick={() => setPage(p as number)}
                        className="w-8 h-8 rounded-lg text-xs font-medium transition-all"
                        style={{
                          background: page === p ? 'rgba(59,130,246,0.2)' : 'transparent',
                          color: page === p ? '#3B82F6' : '#64748B',
                          border: page === p ? '1px solid rgba(59,130,246,0.4)' : '1px solid transparent',
                        }}>
                        {p}
                      </button>
                );
              })()}
              <Button variant="ghost" size="sm" disabled={page >= lastPage} onClick={() => setPage(p => p + 1)}>Next</Button>
            </div>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title={editItem ? `Edit — ${editItem.asset_code}` : 'Add New Laptop'} width="max-w-2xl">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Brand" required><input className="inp" value={form.brand} onChange={e => f('brand', e.target.value)} placeholder="Dell, HP, Lenovo..." /></FormField>
          <FormField label="Model No" required><input className="inp" value={form.model_no} onChange={e => f('model_no', e.target.value)} placeholder="Latitude E5470" /></FormField>
          <FormField label="Serial Number"><input className="inp" value={form.serial_number} onChange={e => f('serial_number', e.target.value)} placeholder="F7088H2" /></FormField>
          <FormField label="CPU" required><input className="inp" value={form.cpu} onChange={e => f('cpu', e.target.value)} placeholder="i5, i7..." /></FormField>
          <FormField label="Generation"><input className="inp" value={form.generation} onChange={e => f('generation', e.target.value)} placeholder="6th, 8th, 12th..." /></FormField>
          <FormField label="RAM" required><input className="inp" value={form.ram} onChange={e => f('ram', e.target.value)} placeholder="8GB, 16GB..." /></FormField>
          <FormField label="HDD / SSD" required><input className="inp" value={form.ssd} onChange={e => f('ssd', e.target.value)} placeholder="256 SSD, 512GB NVMe..." /></FormField>
          <FormField label="Purchase Date"><input className="inp" type="date" value={form.purchase_date} onChange={e => f('purchase_date', e.target.value)} /></FormField>
          <FormField label="Purchaser">
            <select className="inp" value={form.purchaser} onChange={e => f('purchaser', e.target.value)}>
              <option value="">— Select vendor —</option>
              {vendors.map((v: any) => (
                <option key={v.id} value={v.name}>{v.name}{v.company ? ` — ${v.company}` : ''}</option>
              ))}
            </select>
          </FormField>
          {editItem && (
            <FormField label="Status">
              <select className="inp" value={form.status} onChange={e => f('status', e.target.value)}>
                {['available','rented','maintenance','sold','returned'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </FormField>
          )}
        </div>

        {/* Employee fields */}
        <div className="mt-4 pt-4" style={{ borderTop: '1px solid #1E3058' }}>
          <div className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: '#475569' }}>Employee Assignment</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <FormField label="Employee Name">
              <input className="inp" value={form.employee_name} onChange={e => f('employee_name', e.target.value)} placeholder="John Doe" />
            </FormField>
            <FormField label="Employee Mobile">
              <input className="inp" value={form.employee_mobile} onChange={e => f('employee_mobile', e.target.value)} placeholder="9876543210" />
            </FormField>
            <FormField label="Employee Address">
              <input className="inp" value={form.employee_address} onChange={e => f('employee_address', e.target.value)} placeholder="12 MG Road, Bangalore" />
            </FormField>
          </div>
        </div>

        {/* Images — only shown when editing an existing item */}
        {editItem && (
          <div className="mt-4 pt-4" style={{ borderTop: '1px solid #1E3058' }}>
            <div className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: '#475569' }}>Laptop Images</div>

            {/* Existing images */}
            {editImages.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-3">
                {editImages.map((path, idx) => (
                  <div key={idx} className="relative group rounded-xl overflow-hidden" style={{ aspectRatio: '4/3', background: 'rgba(11,22,40,0.8)' }}>
                    <img src={IMG_BASE + path} alt={`Image ${idx + 1}`} className="w-full h-full object-cover" />
                    <button
                      onClick={() => handleDeleteImage(idx)}
                      className="absolute top-1 right-1 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ background: 'rgba(239,68,68,0.9)' }}>
                      <X size={12} color="#fff" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* New image picker */}
            <div className="flex items-start gap-3">
              <label className="flex-1 flex flex-col items-center justify-center gap-1.5 p-4 rounded-xl cursor-pointer transition-all"
                style={{ border: '2px dashed #1E3058', background: imageFiles.length ? 'rgba(59,130,246,0.06)' : 'rgba(11,22,40,0.5)', minHeight: '72px' }}>
                <ImagePlus size={20} style={{ color: imageFiles.length ? '#3B82F6' : '#334155' }} />
                <span className="text-xs" style={{ color: imageFiles.length ? '#3B82F6' : '#475569' }}>
                  {imageFiles.length ? `${imageFiles.length} file(s) selected` : 'Click to choose images'}
                </span>
                <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden"
                  onChange={e => setImageFiles(Array.from(e.target.files || []))} />
              </label>
              {imageFiles.length > 0 && (
                <Button icon={<Upload size={14} />} onClick={handleUploadImages} loading={uploadingImages}>
                  Upload
                </Button>
              )}
            </div>
            <p className="text-xs mt-1.5" style={{ color: '#334155' }}>JPG, PNG, WebP · max 2 MB each · up to 10 images</p>
          </div>
        )}

        <div className="flex justify-end gap-3 mt-6">
          <Button variant="ghost" onClick={() => setShowModal(false)}>Cancel</Button>
          <Button onClick={handleSave} loading={saving}>{editItem ? 'Update' : 'Add Laptop'}</Button>
        </div>
      </Modal>

      {/* Bulk Import Modal */}
      <Modal open={showImport} onClose={() => setShowImport(false)} title="Bulk Import Inventory" width="max-w-lg">
        <div className="space-y-4">
          {/* Format hint + sample download */}
          <div className="p-3 rounded-xl text-xs space-y-1" style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)' }}>
            <div className="flex items-center justify-between gap-2 mb-1">
              <div className="font-semibold" style={{ color: '#3B82F6' }}>Accepted formats: .csv, .xlsx, .xls</div>
              <button
                type="button"
                onClick={() => {
                  const csv = [
                    'Asset No,Brand,Model Number,Serial Number,CPU,Generation,Ram,HDD,Purchase Date,Purchaser,Price,Status,Vendor Name,Location,Graphics,Notes,Employee Name,Employee Mobile,Employee Address',
                    '1001,Dell,LATITUDE-E5470,F7088H2,i5,6th,8GB,256 SSD,15-Jan-23,Ravi Delhi,1100,office,Ravi Enterprises,Delhi,,,John Doe,9876543210,12 MG Road Bangalore',
                    '1002,HP,440 G1,2CE4130ZQ3,i3,4th,8GB,256 SSD,15-Jan-23,Ravi Delhi,900,office,Ravi Enterprises,Delhi,,,Jane Smith,9123456780,45 Park Street Mumbai',
                    '1003,Lenovo,ThinkPad X1,INA431QKQY,i7,8th,16GB,512 SSD,20-Mar-23,Amit Mumbai,1500,vendor,Amit Systems,Mumbai,NVIDIA MX450,,Raj Kumar,9988776655,22 Anna Nagar Chennai',
                  ].join('\n');
                  const blob = new Blob([csv], { type: 'text/csv' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url; a.download = 'inventory_sample.csv'; a.click();
                  URL.revokeObjectURL(url);
                }}
                className="flex items-center gap-1 px-2 py-1 rounded-lg transition-all"
                style={{ background: 'rgba(59,130,246,0.15)', color: '#3B82F6', fontSize: '0.7rem', fontWeight: 600 }}>
                <FileSpreadsheet size={11} /> Download Sample
              </button>
            </div>
            <div className="flex items-center gap-3 mb-1">
              <span style={{ color: '#64748B' }}>Column headers (first row):</span>
              <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(244,63,94,0.1)', color: '#F43F5E' }}>* required</span>
              <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(100,116,139,0.1)', color: '#64748B' }}>optional</span>
            </div>
            <div className="font-mono text-xs leading-5" style={{ color: '#94A3B8' }}>
              <span style={{ color: '#64748B' }}>Asset No, </span>
              <span style={{ color: '#F43F5E' }}>Brand*, Model Number*, Serial Number*, CPU*, Generation*, Ram*, HDD*, Purchase Date*, Purchaser*</span>
              <span style={{ color: '#64748B' }}>, Price, Status, Vendor Name, Location, Graphics, Notes, </span>
              <span style={{ color: '#94A3B8' }}>Employee Name, Employee Mobile, Employee Address</span>
            </div>
          </div>

          {/* File picker */}
          <FormField label="Select File" required>
            <label className="flex flex-col items-center justify-center gap-2 p-6 rounded-xl cursor-pointer transition-all"
              style={{ border: '2px dashed #1E3058', background: importFile ? 'rgba(59,130,246,0.06)' : 'rgba(11,22,40,0.5)' }}>
              <FileSpreadsheet size={28} style={{ color: importFile ? '#3B82F6' : '#334155' }} />
              <span className="text-sm font-medium" style={{ color: importFile ? '#3B82F6' : '#475569' }}>
                {importFile ? importFile.name : 'Click to choose file'}
              </span>
              {importFile && <span className="text-xs" style={{ color: '#475569' }}>{(importFile.size / 1024).toFixed(1)} KB</span>}
              <input type="file" accept=".csv,.xlsx,.xls" className="hidden"
                onChange={e => {
                  const file = e.target.files?.[0] || null;
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = () => {
                      const blob = new Blob([reader.result as ArrayBuffer], { type: file.type });
                      const frozenFile = new File([blob], file.name, { type: file.type });
                      setImportFile(frozenFile);
                    };
                    reader.readAsArrayBuffer(file);
                  } else {
                    setImportFile(null);
                  }
                  setImportResult(null);
                }} />
            </label>
          </FormField>

          {/* Result */}
          {importResult && (
            <div className="p-3 rounded-xl" style={{
              background: importResult.success ? 'rgba(16,185,129,0.08)' : 'rgba(244,63,94,0.08)',
              border: `1px solid ${importResult.success ? 'rgba(16,185,129,0.25)' : 'rgba(244,63,94,0.25)'}`,
            }}>
              <div className="flex items-center gap-2 mb-1">
                {importResult.success
                  ? <CheckCircle2 size={14} style={{ color: '#10B981' }} />
                  : <AlertCircle size={14} style={{ color: '#F43F5E' }} />}
                <span className="text-sm font-medium" style={{ color: importResult.success ? '#10B981' : '#F43F5E' }}>
                  {importResult.message}
                </span>
              </div>
              {importResult.failures && importResult.failures.length > 0 && (
                <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                  {importResult.failures.map((f: any, i: number) => (
                    <div key={i} className="text-xs" style={{ color: '#94A3B8' }}>
                      <span style={{ color: '#F43F5E' }}>Row {f.row}:</span> {f.field} — {f.errors?.join(', ')}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <Button variant="ghost" onClick={() => setShowImport(false)}>Close</Button>
          <Button icon={<Upload size={14} />} onClick={handleImport} loading={importing} disabled={!importFile}>
            Upload & Import
          </Button>
        </div>
      </Modal>

      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </DashboardLayout>
  );
}
