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
  Tag, Package, ChevronRight, ChevronLeft, X,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

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

const IMG_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://laptop-rental-api.loc/api')
  .replace('/api', '') + '/storage/';

/* ── main page ── */
export default function InventoryDetailPage() {
  const params   = useParams();
  const router   = useRouter();
  const id       = Number(params.id);
  const { user } = useAuth();
  const isAdmin  = user?.role === 'admin';

  const [item,    setItem]    = useState<Inventory | null>(null);
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [loading, setLoading] = useState(true);

  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState<Record<string, string>>({});
  const [saving,   setSaving]   = useState(false);

  const [lightbox, setLightbox] = useState<number | null>(null); // index of open image

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
      brand:            item.brand                   || '',
      model_no:         item.model_no                || '',
      serial_number:    (item as any).serial_number  || '',
      cpu:              item.cpu                     || '',
      generation:       (item as any).generation     || '',
      ram:              item.ram                     || '',
      ssd:              item.ssd                     || '',
      purchase_date:    item.purchase_date           || '',
      purchaser:        (item as any).purchaser      || '',
      status:           item.status                  || '',
      employee_name:    item.employee_name           || '',
      employee_mobile:  item.employee_mobile         || '',
      employee_address: item.employee_address        || '',
    });
    setShowEdit(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const payload = Object.fromEntries(Object.entries(editForm).filter(([, v]) => v !== ''));
      await api.inventory.update(id, payload);
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
      <div className="animate-fade-in space-y-4 sm:space-y-5">

        {/* ── Breadcrumb / Back bar ── */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 text-sm min-w-0" style={{ color: '#475569' }}>
            <Link href="/inventory" className="hover:text-blue-400 transition-colors shrink-0">Inventory</Link>
            <ChevronRight size={13} className="shrink-0" />
            <span className="truncate font-mono text-xs" style={{ color: '#94A3B8' }}>{item.asset_code}</span>
          </div>
          <div className="flex gap-1.5 sm:gap-2 shrink-0">
            <Link href="/inventory">
              <Button variant="ghost" size="sm" icon={<ArrowLeft size={14} />}>
                <span className="hidden sm:inline">Back</span>
              </Button>
            </Link>
            {isAdmin && <>
              <Button variant="outline" size="sm" icon={<Edit size={13} />} onClick={openEdit}>
                <span className="hidden sm:inline">Edit</span>
              </Button>
              <Button variant="danger" size="sm" icon={<Trash2 size={13} />} onClick={handleDelete}>
                <span className="hidden sm:inline">Delete</span>
              </Button>
            </>}
          </div>
        </div>

        {/* ── Hero ── */}
        <div className="glass-card p-4 sm:p-6" style={{
          background: 'linear-gradient(135deg, rgba(13,27,46,0.95) 0%, rgba(17,34,62,0.95) 100%)',
          borderColor: '#1E3058',
        }}>
          <div className="flex items-start gap-3 sm:gap-5">
            {/* laptop thumbnail or icon */}
            {item.images?.[0] ? (
              <div className="w-16 h-14 sm:w-20 sm:h-16 rounded-2xl overflow-hidden flex-shrink-0 cursor-pointer"
                style={{ border: '1px solid rgba(59,130,246,0.3)', boxShadow: '0 0 20px rgba(59,130,246,0.15)' }}
                onClick={() => setLightbox(0)}>
                <img src={IMG_BASE + item.images![0]} alt={item.brand} className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, #3B82F6, #14B8A6)', boxShadow: '0 0 30px rgba(59,130,246,0.25)' }}>
                <Monitor size={22} className="sm:hidden" color="white" />
                <Monitor size={28} className="hidden sm:block" color="white" />
              </div>
            )}

            {/* info */}
            <div className="flex-1 min-w-0">
              {/* asset code + type badges */}
              <div className="flex items-center gap-2 mb-1.5 sm:mb-2 flex-wrap">
                <span className="font-mono text-xs sm:text-sm px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg font-semibold"
                  style={{ background: 'rgba(59,130,246,0.15)', color: '#3B82F6', border: '1px solid rgba(59,130,246,0.3)' }}>
                  {item.asset_code}
                </span>
                <span className={`badge badge-${item.type}`}>{item.type}</span>
                {/* status badge inline on mobile, pill on desktop */}
                <span className="sm:hidden flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-semibold"
                  style={{ background: sm.bg, border: `1px solid ${sm.border}`, color: sm.text }}>
                  <StatusIcon size={11} />
                  {item.status}
                </span>
              </div>

              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h1 className="text-lg sm:text-2xl font-bold mb-0.5 sm:mb-1 leading-tight"
                    style={{ fontFamily: 'Syne, sans-serif', color: '#F1F5F9' }}>
                    {item.brand} {item.model_no}
                  </h1>
                  <p className="text-xs" style={{ color: '#475569' }}>
                    Added {fmtDate(item.created_at)} · Updated {fmtDate(item.updated_at)}
                  </p>
                </div>

                {/* status pill — desktop only */}
                <div className="hidden sm:flex items-center gap-2 px-4 py-2.5 rounded-xl flex-shrink-0"
                  style={{ background: sm.bg, border: `1px solid ${sm.border}` }}>
                  <StatusIcon size={15} style={{ color: sm.text }} />
                  <span className="text-sm font-semibold capitalize" style={{ color: sm.text }}>{item.status}</span>
                </div>
              </div>

              {/* quick spec pills */}
              <div className="flex flex-wrap gap-1.5 mt-2.5">
                {[item.cpu, item.ram, item.ssd].filter(Boolean).map(spec => (
                  <span key={spec} className="text-xs px-2 py-0.5 rounded-md"
                    style={{ background: 'rgba(30,48,88,0.6)', color: '#94A3B8', border: '1px solid rgba(30,48,88,0.9)' }}>
                    {spec}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Specs + Purchase Info ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5">

          {/* Specs */}
          <div className="lg:col-span-2 glass-card p-4 sm:p-5">
            <SectionTitle>Specifications</SectionTitle>
            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              <SpecCard icon={<Cpu size={15} />}       label="Processor"  value={item.cpu}                               color="#3B82F6" />
              <SpecCard icon={<Database size={15} />}  label="Memory"     value={item.ram}                               color="#14B8A6" />
              <SpecCard icon={<HardDrive size={15} />} label="Storage"    value={item.ssd}                               color="#8B5CF6" />
              {(item as any).generation && (
                <SpecCard icon={<Hash size={15} />}    label="Generation" value={(item as any).generation}               color="#6366F1" />
              )}
              {item.graphics && (
                <SpecCard icon={<Zap size={15} />}     label="Graphics"   value={item.graphics}                          color="#F59E0B" />
              )}
            </div>
          </div>

          {/* Purchase / Vendor */}
          <div className="glass-card p-4 sm:p-5 space-y-3 sm:space-y-3.5">
            <SectionTitle>Purchase Info</SectionTitle>
            {(item as any).serial_number && <InfoRow icon={<Hash size={13} />}     label="Serial Number"  value={(item as any).serial_number} />}
            {(item as any).purchaser     && <InfoRow icon={<User size={13} />}     label="Purchaser"      value={(item as any).purchaser} />}
            <InfoRow icon={<Calendar size={13} />}  label="Purchase Date"  value={fmtDate(item.purchase_date)} />
            <InfoRow icon={<Package size={13} />}   label="Delivery Date"  value={fmtDate(item.delivery_date)} />
            {item.return_date     && <InfoRow icon={<RotateCcw size={13} />} label="Return Date"     value={fmtDate(item.return_date)} />}
            {item.return_location && <InfoRow icon={<MapPin size={13} />}    label="Return Location" value={item.return_location} />}

            <div className="pt-3 mt-1" style={{ borderTop: '1px solid #1E3058' }}>
              <div className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: '#334155' }}>Vendor</div>
              <div className="space-y-3">
                <InfoRow icon={<Building2 size={13} />} label="Name"     value={item.vendor_name     || '—'} />
                <InfoRow icon={<MapPin size={13} />}    label="Location" value={item.vendor_location || '—'} />
              </div>
            </div>

            {(item.employee_name || item.employee_mobile || item.employee_address) && (
              <div className="pt-3 mt-1" style={{ borderTop: '1px solid #1E3058' }}>
                <div className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: '#334155' }}>Employee</div>
                <div className="space-y-3">
                  {item.employee_name    && <InfoRow icon={<User size={13} />}    label="Name"    value={item.employee_name} />}
                  {item.employee_mobile  && <InfoRow icon={<Hash size={13} />}    label="Mobile"  value={item.employee_mobile} />}
                  {item.employee_address && <InfoRow icon={<MapPin size={13} />}  label="Address" value={item.employee_address} />}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Active Rental ── */}
        {activeRental && (
          <div className="glass-card p-4 sm:p-5"
            style={{ border: '1px solid rgba(59,130,246,0.3)', background: 'rgba(59,130,246,0.04)' }}>

            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#3B82F6' }} />
                <span className="text-xs font-bold uppercase tracking-widest" style={{ color: '#475569', fontFamily: 'Syne, sans-serif' }}>
                  Active Rental
                </span>
              </div>
              <Link href={`/rentals/${activeRental.id}`}>
                <Button variant="outline" size="sm" icon={<FileText size={12} />}>
                  <span className="hidden sm:inline">View Rental</span>
                  <span className="sm:hidden">View</span>
                </Button>
              </Link>
            </div>

            {/* Rental info — 2×2 on mobile, row on desktop */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              <InfoRow icon={<Hash size={13} />}     label="Rental No"  value={activeRental.rental_no} accent />
              <InfoRow icon={<User size={13} />}     label="Client"     value={activeRental.client?.name || `Client #${activeRental.client_id}`} />
              <InfoRow icon={<Calendar size={13} />} label="Start Date" value={fmtDate(activeRental.start_date)} />
              <InfoRow icon={<Calendar size={13} />} label="End Date"   value={fmtDate(activeRental.end_date)} />
            </div>

            {/* Billing stats — 2-col on mobile, 4-col on sm+ */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 pt-4"
              style={{ borderTop: '1px solid rgba(59,130,246,0.15)' }}>
              {[
                { label: 'Duration',                              value: `${activeRental.duration_days} days` },
                { label: 'Monthly Rent',                         value: fmt(activeRental.monthly_rental) },
                { label: `GST (${activeRental.gst_percent}%)`,   value: fmt(activeRental.gst_amount) },
              ].map(({ label, value }) => (
                <div key={label} className="text-center px-2 sm:px-3 py-2.5 rounded-xl"
                  style={{ background: 'rgba(30,48,88,0.4)', border: '1px solid rgba(30,48,88,0.7)' }}>
                  <div className="text-[10px] sm:text-xs mb-1 leading-tight" style={{ color: '#475569' }}>{label}</div>
                  <div className="text-sm font-semibold" style={{ color: '#F1F5F9' }}>{value}</div>
                </div>
              ))}
              <div className="text-center px-2 sm:px-3 py-2.5 rounded-xl"
                style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)' }}>
                <div className="text-[10px] sm:text-xs mb-1" style={{ color: '#10B981' }}>Grand Total</div>
                <div className="text-sm sm:text-base font-bold" style={{ color: '#10B981' }}>{fmt(activeRental.grand_total)}</div>
              </div>
            </div>
          </div>
        )}

        {/* ── Notes ── */}
        {item.notes && (
          <div className="glass-card p-4 sm:p-5">
            <SectionTitle>Notes</SectionTitle>
            <p className="text-sm leading-relaxed" style={{ color: '#94A3B8' }}>{item.notes}</p>
          </div>
        )}

        {/* ── Images Gallery ── */}
        {item.images && item.images.length > 0 && (
          <div className="glass-card p-4 sm:p-5">
            <SectionTitle>Images ({item.images.length})</SectionTitle>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 sm:gap-3">
              {item.images.map((path, idx) => (
                <div key={idx} onClick={() => setLightbox(idx)}
                  className="relative rounded-xl overflow-hidden cursor-pointer group"
                  style={{ aspectRatio: '4/3', background: 'rgba(11,22,40,0.8)', border: '1px solid rgba(30,48,88,0.7)' }}>
                  <img src={IMG_BASE + path} alt={`${item.brand} image ${idx + 1}`}
                    className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105" />
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                    style={{ background: 'rgba(0,0,0,0.3)' }}>
                    <span className="text-xs font-semibold text-white px-2 py-1 rounded-lg" style={{ background: 'rgba(0,0,0,0.5)' }}>
                      View
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Rental History ── */}
        <div className="glass-card overflow-hidden">
          <div className="flex items-center gap-3 px-4 sm:px-5 py-3.5 sm:py-4"
            style={{ borderBottom: '1px solid #1E3058' }}>
            <span className="text-xs font-bold uppercase tracking-widest"
              style={{ color: '#475569', fontFamily: 'Syne, sans-serif' }}>
              Rental History
            </span>
            {rentals.length > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                style={{ background: 'rgba(59,130,246,0.15)', color: '#3B82F6' }}>
                {rentals.length}
              </span>
            )}
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
            <>
              {/* Mobile card list */}
              <div className="sm:hidden divide-y" style={{ borderColor: 'rgba(30,48,88,0.4)' }}>
                {rentals.map(r => (
                  <Link key={r.id} href={`/rentals/${r.id}`}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors"
                    style={{ textDecoration: 'none' }}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-mono text-xs font-semibold" style={{ color: '#3B82F6' }}>{r.rental_no}</span>
                        <span className={`badge badge-${r.status} text-[10px]`}>{r.status}</span>
                      </div>
                      <div className="text-xs truncate" style={{ color: '#94A3B8' }}>
                        {r.client?.name || '—'} · {fmtDate(r.start_date)} → {fmtDate(r.end_date)}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-sm font-bold" style={{ color: '#10B981' }}>{fmt(r.grand_total)}</div>
                      <div className="text-[10px]" style={{ color: '#475569' }}>{r.duration_days}d</div>
                    </div>
                  </Link>
                ))}
              </div>

              {/* Desktop table */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Rental No</th>
                      <th>Client</th>
                      <th className="hidden md:table-cell">Period</th>
                      <th className="hidden md:table-cell">Days</th>
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
                        <td className="hidden md:table-cell">
                          <div className="text-xs">
                            <div style={{ color: '#F1F5F9' }}>{fmtDate(r.start_date)}</div>
                            <div style={{ color: '#475569' }}>→ {fmtDate(r.end_date)}</div>
                          </div>
                        </td>
                        <td className="hidden md:table-cell text-sm">{r.duration_days}d</td>
                        <td>
                          <span className="font-semibold" style={{ color: '#10B981' }}>{fmt(r.grand_total)}</span>
                        </td>
                        <td><span className={`badge badge-${r.status}`}>{r.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Edit Modal ── */}
      <Modal open={showEdit} onClose={() => setShowEdit(false)}
        title={`Edit — ${item.asset_code}`} width="max-w-2xl">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <FormField label="Brand" required><input className="inp" value={editForm.brand} onChange={e => f('brand', e.target.value)} /></FormField>
          <FormField label="Model No" required><input className="inp" value={editForm.model_no} onChange={e => f('model_no', e.target.value)} /></FormField>
          <FormField label="Serial Number"><input className="inp" value={editForm.serial_number} onChange={e => f('serial_number', e.target.value)} placeholder="F7088H2" /></FormField>
          <FormField label="CPU" required><input className="inp" value={editForm.cpu} onChange={e => f('cpu', e.target.value)} /></FormField>
          <FormField label="Generation"><input className="inp" value={editForm.generation} onChange={e => f('generation', e.target.value)} placeholder="6th, 8th, 12th..." /></FormField>
          <FormField label="RAM" required><input className="inp" value={editForm.ram} onChange={e => f('ram', e.target.value)} /></FormField>
          <FormField label="HDD / SSD" required><input className="inp" value={editForm.ssd} onChange={e => f('ssd', e.target.value)} /></FormField>
          <FormField label="Purchase Date"><input className="inp" type="date" value={editForm.purchase_date} onChange={e => f('purchase_date', e.target.value)} /></FormField>
          <FormField label="Purchaser"><input className="inp" value={editForm.purchaser} onChange={e => f('purchaser', e.target.value)} placeholder="Ravi Delhi" /></FormField>
          <FormField label="Status">
            <select className="inp" value={editForm.status} onChange={e => f('status', e.target.value)}>
              {EDIT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </FormField>
        </div>

        <div className="mt-4 pt-4" style={{ borderTop: '1px solid #1E3058' }}>
          <div className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: '#475569' }}>Employee Assignment</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            <FormField label="Employee Name">
              <input className="inp" value={editForm.employee_name} onChange={e => f('employee_name', e.target.value)} placeholder="John Doe" />
            </FormField>
            <FormField label="Employee Mobile">
              <input className="inp" value={editForm.employee_mobile} onChange={e => f('employee_mobile', e.target.value)} placeholder="9876543210" />
            </FormField>
            <FormField label="Employee Address">
              <input className="inp" value={editForm.employee_address} onChange={e => f('employee_address', e.target.value)} placeholder="12 MG Road, Bangalore" />
            </FormField>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-5 sm:mt-6">
          <Button variant="ghost" onClick={() => setShowEdit(false)}>Cancel</Button>
          <Button onClick={handleSave} loading={saving}>Save Changes</Button>
        </div>
      </Modal>

      {/* ── Lightbox ── */}
      {lightbox !== null && item.images && item.images.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.92)' }}
          onClick={() => setLightbox(null)}>
          {/* Close */}
          <button className="absolute top-4 right-4 p-2 rounded-full z-10"
            style={{ background: 'rgba(255,255,255,0.1)' }}
            onClick={() => setLightbox(null)}>
            <X size={20} color="#fff" />
          </button>
          {/* Prev */}
          {item.images.length > 1 && (
            <button className="absolute left-4 p-2 rounded-full z-10"
              style={{ background: 'rgba(255,255,255,0.1)' }}
              onClick={e => { e.stopPropagation(); setLightbox(i => ((i! - 1 + item.images!.length) % item.images!.length)); }}>
              <ChevronLeft size={24} color="#fff" />
            </button>
          )}
          {/* Image */}
          <img src={IMG_BASE + item.images[lightbox]} alt={`${item.brand} image ${lightbox + 1}`}
            className="max-w-[90vw] max-h-[85vh] object-contain rounded-xl"
            style={{ boxShadow: '0 0 60px rgba(0,0,0,0.8)' }}
            onClick={e => e.stopPropagation()} />
          {/* Next */}
          {item.images.length > 1 && (
            <button className="absolute right-4 p-2 rounded-full z-10"
              style={{ background: 'rgba(255,255,255,0.1)' }}
              onClick={e => { e.stopPropagation(); setLightbox(i => (i! + 1) % item.images!.length); }}>
              <ChevronRight size={24} color="#fff" />
            </button>
          )}
          {/* Counter */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs font-semibold px-3 py-1 rounded-full"
            style={{ background: 'rgba(255,255,255,0.15)', color: '#fff' }}>
            {lightbox + 1} / {item.images.length}
          </div>
        </div>
      )}

      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </DashboardLayout>
  );
}
