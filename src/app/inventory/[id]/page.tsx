'use client';

import { ReactNode, useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button, Modal, FormField, Toast } from '@/components/ui';
import { api } from '@/lib/api';
import { Inventory, Rental } from '@/types';
import {
  ArrowLeft, Monitor, Cpu, HardDrive, Database, Zap,
  Calendar, Building2, MapPin, FileText, Edit, Trash2,
  Clock, User, CheckCircle, AlertCircle, RotateCcw, Hash,
  Tag, Package, ChevronRight,
} from 'lucide-react';

/* ── helpers ── */
const fmt = (n: number) => '₹' + new Intl.NumberFormat('en-IN').format(Number(n));
const fmtDate = (d?: string) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

/* ── status config ── */
const STATUS_META: Record<string, { bg: string; border: string; text: string; Icon: any }> = {
  available:   { bg: 'rgba(16,185,129,0.10)',  border: 'rgba(16,185,129,0.30)',  text: '#10B981', Icon: CheckCircle },
  rented:      { bg: 'rgba(59,130,246,0.10)',  border: 'rgba(59,130,246,0.30)',  text: '#3B82F6', Icon: FileText   },
  maintenance: { bg: 'rgba(245,158,11,0.10)',  border: 'rgba(245,158,11,0.30)',  text: '#F59E0B', Icon: AlertCircle},
  sold:        { bg: 'rgba(100,116,139,0.10)', border: 'rgba(100,116,139,0.30)', text: '#94A3B8', Icon: Tag        },
  returned:    { bg: 'rgba(139,92,246,0.10)',  border: 'rgba(139,92,246,0.30)',  text: '#A78BFA', Icon: RotateCcw  },
};

const EDIT_STATUSES = ['available', 'rented', 'maintenance', 'sold', 'returned'];

/* ── small helper components ── */
function InfoRow({ icon, label, value, accent }: { icon: ReactNode; label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 flex-shrink-0" style={{ color: '#475569' }}>{icon}</span>
      <div>
        <div className="text-xs mb-0.5" style={{ color: '#475569' }}>{label}</div>
        <div className="text-sm font-medium" style={{ color: accent ? '#3B82F6' : '#F1F5F9' }}>{value}</div>
      </div>
    </div>
  );
}

function SpecCard({ icon, label, value, color }: { icon: ReactNode; label: string; value: string; color: string }) {
  return (
    <div className="flex items-start gap-3 p-4 rounded-xl"
      style={{ background: 'rgba(30,48,88,0.28)', border: '1px solid rgba(30,48,88,0.7)' }}>
      <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: `${color}14` }}>
        <span style={{ color }}>{icon}</span>
      </div>
      <div>
        <div className="text-xs mb-0.5" style={{ color: '#475569' }}>{label}</div>
        <div className="text-sm font-semibold" style={{ color: '#F1F5F9' }}>{value}</div>
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: '#475569', fontFamily: 'Syne, sans-serif' }}>
      {children}
    </h2>
  );
}

/* ── main page ── */
export default function InventoryDetailPage() {
  const params   = useParams();
  const router   = useRouter();
  const id       = Number(params.id);

  const [item,    setItem]    = useState<Inventory | null>(null);
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [loading, setLoading] = useState(true);

  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState<Record<string, string>>({});
  const [saving,   setSaving]   = useState(false);

  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [invRes, renRes] = await Promise.all([
        api.inventory.get(id),
        api.rentals.list({ inventory_id: String(id), per_page: '30' }),
      ]);
      setItem(invRes.data);
      setRentals(renRes.data?.data || []);
    } catch {
      router.push('/inventory');
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => { load(); }, [load]);

  function openEdit() {
    if (!item) return;
    setEditForm({
      brand:            item.brand,
      model_no:         item.model_no,
      cpu:              item.cpu,
      ram:              item.ram,
      ssd:              item.ssd,
      graphics:         item.graphics,
      purchase_date:    item.purchase_date,
      type:             item.type,
      status:           item.status,
      vendor_name:      item.vendor_name      || '',
      vendor_location:  item.vendor_location  || '',
      delivery_date:    item.delivery_date    || '',
      return_date:      item.return_date      || '',
      return_location:  item.return_location  || '',
      notes:            item.notes            || '',
    });
    setShowEdit(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await api.inventory.update(id, editForm);
      showToast('Laptop updated successfully');
      setShowEdit(false);
      load();
    } catch (e: any) {
      showToast(e.message || 'Failed to update', 'error');
    } finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!item || !confirm(`Delete ${item.brand} ${item.model_no} (${item.asset_code})?`)) return;
    try {
      await api.inventory.delete(id);
      showToast('Deleted successfully');
      setTimeout(() => router.push('/inventory'), 1200);
    } catch (e: any) { showToast(e.message || 'Delete failed', 'error'); }
  }

  const f = (k: string, v: string) => setEditForm(p => ({ ...p, [k]: v }));

  /* ── loading skeleton ── */
  if (loading) return (
    <DashboardLayout>
      <div className="space-y-5">
        <div className="skeleton h-8 w-44 rounded-xl" />
        <div className="skeleton h-40 rounded-2xl" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 skeleton h-52 rounded-2xl" />
          <div className="skeleton h-52 rounded-2xl" />
        </div>
        <div className="skeleton h-36 rounded-2xl" />
      </div>
    </DashboardLayout>
  );

  if (!item) return null;

  const sm = STATUS_META[item.status] ?? STATUS_META.available;
  const { Icon: StatusIcon } = sm;
  const activeRental = item.active_rental;

  return (
    <DashboardLayout>
      <div className="animate-fade-in space-y-5">

        {/* ── Breadcrumb / Back bar ── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm" style={{ color: '#475569' }}>
            <Link href="/inventory" className="hover:text-blue-400 transition-colors">Inventory</Link>
            <ChevronRight size={13} />
            <span style={{ color: '#94A3B8' }}>{item.asset_code}</span>
          </div>
          <div className="flex gap-2">
            <Link href="/inventory">
              <Button variant="ghost" size="sm" icon={<ArrowLeft size={14} />}>Back</Button>
            </Link>
            <Button variant="outline" size="sm" icon={<Edit size={13} />} onClick={openEdit}>Edit</Button>
            <Button variant="danger"  size="sm" icon={<Trash2 size={13} />} onClick={handleDelete}>Delete</Button>
          </div>
        </div>

        {/* ── Hero ── */}
        <div className="glass-card p-6" style={{
          background: 'linear-gradient(135deg, rgba(13,27,46,0.95) 0%, rgba(17,34,62,0.95) 100%)',
          borderColor: '#1E3058',
        }}>
          <div className="flex items-start gap-5">
            {/* laptop icon */}
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #3B82F6, #14B8A6)', boxShadow: '0 0 30px rgba(59,130,246,0.25)' }}>
              <Monitor size={28} color="white" />
            </div>

            {/* info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  {/* asset code + type */}
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className="font-mono text-sm px-2.5 py-1 rounded-lg font-semibold"
                      style={{ background: 'rgba(59,130,246,0.15)', color: '#3B82F6', border: '1px solid rgba(59,130,246,0.3)' }}>
                      {item.asset_code}
                    </span>
                    <span className={`badge badge-${item.type}`}>{item.type}</span>
                  </div>

                  {/* brand + model */}
                  <h1 className="text-2xl font-bold mb-1"
                    style={{ fontFamily: 'Syne, sans-serif', color: '#F1F5F9' }}>
                    {item.brand} {item.model_no}
                  </h1>
                  <p className="text-xs" style={{ color: '#475569' }}>
                    Added {fmtDate(item.created_at)} &nbsp;·&nbsp; Updated {fmtDate(item.updated_at)}
                  </p>
                </div>

                {/* status pill */}
                <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl flex-shrink-0"
                  style={{ background: sm.bg, border: `1px solid ${sm.border}` }}>
                  <StatusIcon size={15} style={{ color: sm.text }} />
                  <span className="text-sm font-semibold capitalize" style={{ color: sm.text }}>
                    {item.status}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Specs + Purchase Info ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* Specs */}
          <div className="lg:col-span-2 glass-card p-5">
            <SectionTitle>Specifications</SectionTitle>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <SpecCard icon={<Cpu size={16} />}      label="Processor" value={item.cpu}      color="#3B82F6" />
              <SpecCard icon={<Database size={16} />} label="Memory"    value={item.ram}      color="#14B8A6" />
              <SpecCard icon={<HardDrive size={16} />} label="Storage"  value={item.ssd}      color="#8B5CF6" />
              <SpecCard icon={<Zap size={16} />}      label="Graphics"  value={item.graphics} color="#F59E0B" />
            </div>
          </div>

          {/* Purchase / Vendor */}
          <div className="glass-card p-5 space-y-3.5">
            <SectionTitle>Purchase Info</SectionTitle>
            <InfoRow icon={<Calendar size={13} />}  label="Purchase Date"   value={fmtDate(item.purchase_date)} />
            <InfoRow icon={<Package size={13} />}   label="Delivery Date"   value={fmtDate(item.delivery_date)} />
            {item.return_date     && <InfoRow icon={<RotateCcw size={13} />} label="Return Date"     value={fmtDate(item.return_date)} />}
            {item.return_location && <InfoRow icon={<MapPin size={13} />}    label="Return Location" value={item.return_location} />}

            <div className="pt-3 mt-1" style={{ borderTop: '1px solid #1E3058' }}>
              <div className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: '#334155' }}>Vendor</div>
              <div className="space-y-3">
                <InfoRow icon={<Building2 size={13} />} label="Name"     value={item.vendor_name     || '—'} />
                <InfoRow icon={<MapPin size={13} />}    label="Location" value={item.vendor_location || '—'} />
              </div>
            </div>
          </div>
        </div>

        {/* ── Active Rental ── */}
        {activeRental && (
          <div className="glass-card p-5"
            style={{ border: '1px solid rgba(59,130,246,0.3)', background: 'rgba(59,130,246,0.04)' }}>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#3B82F6' }} />
                <SectionTitle>Active Rental</SectionTitle>
              </div>
              <Link href={`/rentals/${activeRental.id}`}>
                <Button variant="outline" size="sm">View Rental →</Button>
              </Link>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-5">
              <InfoRow icon={<Hash size={13} />}     label="Rental No" value={activeRental.rental_no} accent />
              <InfoRow icon={<User size={13} />}     label="Client"    value={activeRental.client?.name || `Client #${activeRental.client_id}`} />
              <InfoRow icon={<Calendar size={13} />} label="Start Date" value={fmtDate(activeRental.start_date)} />
              <InfoRow icon={<Calendar size={13} />} label="End Date"   value={fmtDate(activeRental.end_date)} />
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-4" style={{ borderTop: '1px solid rgba(59,130,246,0.15)' }}>
              {[
                { label: 'Duration',      value: `${activeRental.duration_days} days` },
                { label: 'Monthly Rent',  value: fmt(activeRental.monthly_rental) },
                { label: `GST (${activeRental.gst_percent}%)`, value: fmt(activeRental.gst_amount) },
              ].map(({ label, value }) => (
                <div key={label} className="text-center px-3 py-2.5 rounded-xl"
                  style={{ background: 'rgba(30,48,88,0.4)', border: '1px solid rgba(30,48,88,0.7)' }}>
                  <div className="text-xs mb-1" style={{ color: '#475569' }}>{label}</div>
                  <div className="text-sm font-semibold" style={{ color: '#F1F5F9' }}>{value}</div>
                </div>
              ))}
              <div className="text-center px-3 py-2.5 rounded-xl"
                style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)' }}>
                <div className="text-xs mb-1" style={{ color: '#10B981' }}>Grand Total</div>
                <div className="text-base font-bold" style={{ color: '#10B981' }}>{fmt(activeRental.grand_total)}</div>
              </div>
            </div>
          </div>
        )}

        {/* ── Notes ── */}
        {item.notes && (
          <div className="glass-card p-5">
            <SectionTitle>Notes</SectionTitle>
            <p className="text-sm leading-relaxed" style={{ color: '#94A3B8' }}>{item.notes}</p>
          </div>
        )}

        {/* ── Rental History ── */}
        <div className="glass-card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #1E3058' }}>
            <div className="flex items-center gap-2">
              <SectionTitle>Rental History</SectionTitle>
              {rentals.length > 0 && (
                <span className="text-xs px-2 py-0.5 rounded-full font-semibold -mt-4"
                  style={{ background: 'rgba(59,130,246,0.15)', color: '#3B82F6' }}>
                  {rentals.length}
                </span>
              )}
            </div>
          </div>

          {rentals.length === 0 ? (
            <div className="py-12 text-center">
              <div className="w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center"
                style={{ background: 'rgba(30,48,88,0.4)' }}>
                <Clock size={20} style={{ color: '#334155' }} />
              </div>
              <p className="text-sm" style={{ color: '#475569' }}>No rental history found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Rental No</th>
                  <th>Client</th>
                  <th className="hidden sm:table-cell">Period</th>
                  <th className="hidden sm:table-cell">Days</th>
                  <th>Grand Total</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rentals.map(r => (
                  <tr key={r.id} className="animate-fade-in">
                    <td>
                      <Link href={`/rentals/${r.id}`}
                        className="font-mono text-xs font-semibold hover:underline"
                        style={{ color: '#3B82F6' }}>
                        {r.rental_no}
                      </Link>
                    </td>
                    <td>
                      <div style={{ color: '#F1F5F9' }}>{r.client?.name || '—'}</div>
                      {r.client?.company && (
                        <div className="text-xs" style={{ color: '#475569' }}>{r.client.company}</div>
                      )}
                    </td>
                    <td className="hidden sm:table-cell">
                      <div className="text-xs">
                        <div style={{ color: '#F1F5F9' }}>{fmtDate(r.start_date)}</div>
                        <div style={{ color: '#475569' }}>→ {fmtDate(r.end_date)}</div>
                      </div>
                    </td>
                    <td className="hidden sm:table-cell text-sm">{r.duration_days}d</td>
                    <td>
                      <span className="font-semibold" style={{ color: '#10B981' }}>{fmt(r.grand_total)}</span>
                    </td>
                    <td><span className={`badge badge-${r.status}`}>{r.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Edit Modal ── */}
      <Modal open={showEdit} onClose={() => setShowEdit(false)}
        title={`Edit — ${item.asset_code}`} width="max-w-3xl">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Brand"   required><input className="inp" value={editForm.brand}    onChange={e => f('brand', e.target.value)} /></FormField>
          <FormField label="Model No" required><input className="inp" value={editForm.model_no} onChange={e => f('model_no', e.target.value)} /></FormField>
          <FormField label="CPU"     required><input className="inp" value={editForm.cpu}      onChange={e => f('cpu', e.target.value)} /></FormField>
          <FormField label="RAM"     required><input className="inp" value={editForm.ram}      onChange={e => f('ram', e.target.value)} /></FormField>
          <FormField label="SSD"     required><input className="inp" value={editForm.ssd}      onChange={e => f('ssd', e.target.value)} /></FormField>
          <FormField label="Graphics" required><input className="inp" value={editForm.graphics} onChange={e => f('graphics', e.target.value)} /></FormField>
          <FormField label="Purchase Date" required>
            <input className="inp" type="date" value={editForm.purchase_date} onChange={e => f('purchase_date', e.target.value)} />
          </FormField>
          <FormField label="Type" required>
            <select className="inp" value={editForm.type} onChange={e => f('type', e.target.value)}>
              <option value="vendor">Vendor</option>
              <option value="office">Office</option>
              <option value="sold">Sold</option>
            </select>
          </FormField>
          <FormField label="Status">
            <select className="inp" value={editForm.status} onChange={e => f('status', e.target.value)}>
              {EDIT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </FormField>
          <FormField label="Vendor Name">
            <input className="inp" value={editForm.vendor_name} onChange={e => f('vendor_name', e.target.value)} />
          </FormField>
          <FormField label="Vendor Location">
            <input className="inp" value={editForm.vendor_location} onChange={e => f('vendor_location', e.target.value)} />
          </FormField>
          <FormField label="Delivery Date">
            <input className="inp" type="date" value={editForm.delivery_date} onChange={e => f('delivery_date', e.target.value)} />
          </FormField>
          <FormField label="Return Date">
            <input className="inp" type="date" value={editForm.return_date} onChange={e => f('return_date', e.target.value)} />
          </FormField>
          <FormField label="Return Location">
            <input className="inp" value={editForm.return_location} onChange={e => f('return_location', e.target.value)} />
          </FormField>
          <div className="col-span-1 sm:col-span-2">
            <FormField label="Notes">
              <textarea className="inp resize-none" rows={3} value={editForm.notes} onChange={e => f('notes', e.target.value)} />
            </FormField>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="ghost" onClick={() => setShowEdit(false)}>Cancel</Button>
          <Button onClick={handleSave} loading={saving}>Save Changes</Button>
        </div>
      </Modal>

      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </DashboardLayout>
  );
}
