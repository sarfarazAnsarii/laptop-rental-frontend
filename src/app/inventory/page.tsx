'use client';

import { useEffect, useState, useCallback } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button, Modal, PageHeader, FormField, EmptyState, Toast } from '@/components/ui';
import { api } from '@/lib/api';
import { Inventory } from '@/types';
import { Monitor, Plus, Search, Edit, Trash2, Eye } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';

const STATUS_OPTIONS = ['', 'available', 'rented', 'maintenance', 'sold', 'returned'];
const TYPE_OPTIONS   = ['', 'office', 'vendor', 'sold'];

const EMPTY_FORM = {
  brand: '', model_no: '', cpu: '', ram: '', ssd: '', graphics: '',
  purchase_date: '', type: 'vendor', vendor_id: '', vendor_name: '', vendor_location: '',
  delivery_date: '', notes: '', status: 'available',
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
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<Inventory | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [clients, setClients] = useState<any[]>([]);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { per_page: '12', page: String(page) };
      if (search) params.search = search;
      if (status) params.status = status;
      if (type)   params.type   = type;
      const res = await api.inventory.list(params);
      setItems(res.data?.data || []);
      setLastPage(res.data?.last_page || 1);
      setTotal(res.data?.total || 0);
    } finally { setLoading(false); }
  }, [page, search, status, type]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    api.users.list({ role: 'vendor', per_page: '200' })
      .then((res: any) => setClients(res.data?.data || res.data || []))
      .catch(() => {});
  }, []);

  function openAdd() { setForm({ ...EMPTY_FORM }); setEditItem(null); setShowModal(true); }
  function openEdit(item: Inventory) {
    setForm({
      brand: item.brand, model_no: item.model_no, cpu: item.cpu, ram: item.ram,
      ssd: item.ssd, graphics: item.graphics, purchase_date: item.purchase_date,
      type: item.type, vendor_id: String(item.vendor_id || ''), vendor_name: item.vendor_name || '', vendor_location: item.vendor_location || '',
      delivery_date: item.delivery_date || '', notes: item.notes || '', status: item.status,
    });
    setEditItem(item);
    setShowModal(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      if (editItem) {
        await api.inventory.update(editItem.id, form);
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

  return (
    <DashboardLayout>
      <PageHeader
        title="Inventory"
        subtitle={`${total} laptops total`}
        action={!isStaff ? <Button icon={<Plus size={15} />} onClick={openAdd}>Add Laptop</Button> : undefined}
      />

      {/* Filters */}
      <div className="glass-card p-4 mb-6 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#475569' }} />
          <input className="inp pl-9"
            placeholder={isStaff ? 'Search by laptop unique code...' : 'Search brand, model, asset code...'}
            value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
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
                  <div>
                    <div className="font-medium text-sm" style={{ color: '#F1F5F9' }}>{item.brand}</div>
                    <div className="text-xs" style={{ color: '#475569' }}>{item.model_no}</div>
                  </div>
                  <div className="text-xs space-y-0.5">
                    <div style={{ color: '#94A3B8' }}>{item.cpu}</div>
                    <div style={{ color: '#475569' }}>{item.ram} · {item.ssd}</div>
                  </div>
                  {item.vendor_name && (
                    <div className="text-xs" style={{ color: '#475569' }}>{item.vendor_name}{item.vendor_location ? ` · ${item.vendor_location}` : ''}</div>
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
                    <th className="hidden md:table-cell">Specs</th>
                    <th>Type</th>
                    <th className="hidden lg:table-cell">Vendor</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(item => (
                    <tr key={item.id} className="animate-fade-in">
                      <td><span className="font-mono text-xs font-medium px-2 py-1 rounded" style={{ background: 'rgba(59,130,246,0.08)', color: '#3B82F6' }}>{item.asset_code}</span></td>
                      <td>
                        <div className="font-medium text-sm" style={{ color: '#F1F5F9' }}>{item.brand}</div>
                        <div className="text-xs" style={{ color: '#475569' }}>{item.model_no}</div>
                      </td>
                      <td className="hidden md:table-cell">
                        <div className="text-xs space-y-0.5">
                          <div>{item.cpu}</div>
                          <div style={{ color: '#475569' }}>{item.ram} · {item.ssd}</div>
                        </div>
                      </td>
                      <td><span className={`badge badge-${item.type}`}>{item.type}</span></td>
                      <td className="hidden lg:table-cell">
                        <div className="text-xs">
                          <div style={{ color: '#F1F5F9' }}>{item.vendor_name || '—'}</div>
                          <div style={{ color: '#475569' }}>{item.vendor_location || ''}</div>
                        </div>
                      </td>
                      <td><span className={`badge badge-${item.status}`}>{item.status}</span></td>
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
          <div className="flex items-center justify-between px-6 py-4" style={{ borderTop: '1px solid #1E3058' }}>
            <span className="text-xs" style={{ color: '#475569' }}>Page {page} of {lastPage}</span>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Prev</Button>
              <Button variant="ghost" size="sm" disabled={page >= lastPage} onClick={() => setPage(p => p + 1)}>Next</Button>
            </div>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title={editItem ? `Edit — ${editItem.asset_code}` : 'Add New Laptop'} width="max-w-3xl">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Brand" required><input className="inp" value={form.brand} onChange={e => f('brand', e.target.value)} placeholder="Dell, HP, Lenovo..." /></FormField>
          <FormField label="Model No" required><input className="inp" value={form.model_no} onChange={e => f('model_no', e.target.value)} placeholder="Latitude 5520" /></FormField>
          <FormField label="CPU" required><input className="inp" value={form.cpu} onChange={e => f('cpu', e.target.value)} placeholder="Intel Core i7-11th Gen" /></FormField>
          <FormField label="RAM" required><input className="inp" value={form.ram} onChange={e => f('ram', e.target.value)} placeholder="16GB DDR4" /></FormField>
          <FormField label="SSD" required><input className="inp" value={form.ssd} onChange={e => f('ssd', e.target.value)} placeholder="512GB NVMe" /></FormField>
          <FormField label="Graphics" required><input className="inp" value={form.graphics} onChange={e => f('graphics', e.target.value)} placeholder="Intel Iris Xe" /></FormField>          
          
          <FormField label="Delivery Date"><input className="inp" type="date" value={form.delivery_date} onChange={e => f('delivery_date', e.target.value)} /></FormField>
          {editItem && (
            <FormField label="Status">
              <select className="inp" value={form.status} onChange={e => f('status', e.target.value)}>
                {['available','rented','maintenance','sold','returned'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </FormField>
          )}
          <div className="col-span-1 sm:col-span-2">
            <FormField label="Notes"><textarea className="inp resize-none" rows={2} value={form.notes} onChange={e => f('notes', e.target.value)} placeholder="Additional remarks..." /></FormField>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="ghost" onClick={() => setShowModal(false)}>Cancel</Button>
          <Button onClick={handleSave} loading={saving}>{editItem ? 'Update' : 'Add Laptop'}</Button>
        </div>
      </Modal>

      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </DashboardLayout>
  );
}
