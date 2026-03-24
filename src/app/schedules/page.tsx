'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button, Modal, FormField, PageHeader, EmptyState, Toast } from '@/components/ui';
import { api } from '@/lib/api';
import {
  Truck, MapPin, Calendar, CheckCircle, Clock, XCircle,
  FileText, User, Layers, Monitor, Users, Phone, Mail,
  Building2, Hash, ChevronRight,
} from 'lucide-react';

const fmtDate = (d?: string) =>
  d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

const fmtShort = (d?: string) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const STATUS_META: Record<string, { color: string; bg: string; icon: any }> = {
  scheduled: { color: '#F59E0B', bg: 'rgba(245,158,11,0.1)',  icon: Clock       },
  completed: { color: '#10B981', bg: 'rgba(16,185,129,0.1)', icon: CheckCircle },
  cancelled: { color: '#64748B', bg: 'rgba(100,116,139,0.1)', icon: XCircle    },
};

export default function SchedulesPage() {
  const [schedules, setSchedules] = useState<any[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [typeTab,   setTypeTab]   = useState<'all' | 'pickup' | 'delivery'>('all');
  const [statusTab, setStatusTab] = useState<'all' | 'scheduled' | 'completed' | 'cancelled'>('all');
  const [page,      setPage]      = useState(1);
  const [lastPage,  setLastPage]  = useState(1);
  const [total,     setTotal]     = useState(0);

  const [completeModal, setCompleteModal] = useState<any | null>(null);
  const [completeNote,  setCompleteNote]  = useState('');
  const [completing,    setCompleting]    = useState(false);

  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { per_page: '20', page: String(page) };
      if (typeTab   !== 'all') params.type   = typeTab;
      if (statusTab !== 'all') params.status = statusTab;
      const res = await api.schedules.list(params);
      setSchedules(res.data?.data || res.data || []);
      setLastPage(res.data?.last_page || 1);
      setTotal(res.data?.total || 0);
    } catch (e: any) {
      showToast(e.message || 'Failed to load schedules', 'error');
    } finally { setLoading(false); }
  }, [typeTab, statusTab, page]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [typeTab, statusTab]);

  async function handleComplete() {
    if (!completeModal) return;
    setCompleting(true);
    try {
      await api.schedules.complete(completeModal.id, completeNote);
      showToast('Marked as completed');
      setCompleteModal(null);
      setCompleteNote('');
      load();
    } catch (e: any) { showToast(e.message || 'Failed', 'error'); }
    finally { setCompleting(false); }
  }

  async function handleCancel(s: any) {
    if (!confirm('Cancel this schedule?')) return;
    try {
      await api.schedules.cancel(s.id);
      showToast('Schedule cancelled');
      load();
    } catch (e: any) { showToast(e.message || 'Failed', 'error'); }
  }

  const pending    = schedules.filter(s => s.status === 'scheduled').length;
  const pickups    = schedules.filter(s => s.type === 'pickup').length;
  const deliveries = schedules.filter(s => s.type === 'delivery').length;

  return (
    <DashboardLayout>
      <PageHeader title="Schedules" subtitle={`${total} total schedule${total !== 1 ? 's' : ''}`} />

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {[
          { label: 'Total',      value: total,      color: '#3B82F6' },
          { label: 'Pending',    value: pending,    color: '#F59E0B' },
          { label: 'Pickups',    value: pickups,    color: '#F97316' },
          { label: 'Deliveries', value: deliveries, color: '#3B82F6' },
        ].map(s => (
          <div key={s.label} className="glass-card px-4 py-3">
            <div className="text-2xl font-bold" style={{ fontFamily: 'Syne, sans-serif', color: '#F1F5F9' }}>{s.value}</div>
            <div className="text-xs mt-0.5" style={{ color: '#64748B' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'rgba(30,48,88,0.3)' }}>
          {(['all', 'pickup', 'delivery'] as const).map(t => (
            <button key={t} onClick={() => setTypeTab(t)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all"
              style={{
                background: typeTab === t ? 'rgba(59,130,246,0.2)' : 'transparent',
                color:      typeTab === t ? '#3B82F6' : '#64748B',
                border:     typeTab === t ? '1px solid rgba(59,130,246,0.3)' : '1px solid transparent',
              }}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
        <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'rgba(30,48,88,0.3)' }}>
          {(['all', 'scheduled', 'completed', 'cancelled'] as const).map(t => (
            <button key={t} onClick={() => setStatusTab(t)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all"
              style={{
                background: statusTab === t ? 'rgba(59,130,246,0.2)' : 'transparent',
                color:      statusTab === t ? '#3B82F6' : '#64748B',
                border:     statusTab === t ? '1px solid rgba(59,130,246,0.3)' : '1px solid transparent',
              }}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Cards */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <div key={i} className="skeleton h-48 rounded-2xl" />)}
        </div>
      ) : schedules.length === 0 ? (
        <div className="glass-card">
          <EmptyState icon={<Truck size={22} />} title="No schedules found" />
        </div>
      ) : (
        <div className="space-y-4">
          {schedules.map(s => {
            const isPickup   = s.type === 'pickup';
            const typeColor  = isPickup ? '#F97316' : '#3B82F6';
            const typeBg     = isPickup ? 'rgba(249,115,22,0.08)' : 'rgba(59,130,246,0.08)';
            const meta       = STATUS_META[s.status] ?? STATUS_META.scheduled;
            const StatusIcon = meta.icon;
            const inv        = s.rental?.inventory;
            const client     = s.rental?.client;
            const specs      = [inv?.cpu, inv?.generation ? `${inv.generation} Gen` : '', inv?.ram, inv?.ssd].filter(Boolean).join(' · ');

            return (
              <div key={s.id} className="glass-card overflow-hidden animate-fade-in">

                {/* Header bar */}
                <div className="flex items-center justify-between px-5 py-3 flex-wrap gap-3"
                  style={{ background: typeBg, borderBottom: '1px solid rgba(30,48,88,0.5)' }}>
                  <div className="flex items-center gap-3">
                    {/* Type */}
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-bold"
                      style={{ background: `${typeColor}18`, color: typeColor, border: `1px solid ${typeColor}30` }}>
                      <Truck size={13} />
                      <span className="capitalize">{s.type}</span>
                    </div>
                    {/* Status */}
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold"
                      style={{ background: meta.bg, color: meta.color, border: `1px solid ${meta.color}30` }}>
                      <StatusIcon size={11} />
                      <span className="capitalize">{s.status}</span>
                    </div>
                    {/* Rental link */}
                    {s.rental?.bulk_id ? (
                      <Link href={`/rentals/bulk/${encodeURIComponent(s.rental.bulk_id)}`}
                        className="flex items-center gap-1 text-xs font-mono font-semibold hover:underline"
                        style={{ color: '#8B5CF6' }}>
                        <Layers size={11} /> {s.rental.bulk_id}
                      </Link>
                    ) : s.rental?.rental_no ? (
                      <Link href={`/rentals/${s.rental.id}`}
                        className="flex items-center gap-1 text-xs font-mono font-semibold hover:underline"
                        style={{ color: '#3B82F6' }}>
                        <Hash size={11} /> {s.rental.rental_no}
                      </Link>
                    ) : null}
                    {s.rental?.status && (
                      <span className={`badge badge-${s.rental.status}`}>{s.rental.status}</span>
                    )}
                  </div>
                  {/* Actions */}
                  {s.status === 'scheduled' && (
                    <div className="flex gap-2">
                      <Button size="sm" variant="success" icon={<CheckCircle size={12} />}
                        onClick={() => { setCompleteNote(''); setCompleteModal(s); }}>
                        Complete
                      </Button>
                      <Button size="sm" variant="danger" icon={<XCircle size={12} />}
                        onClick={() => handleCancel(s)}>
                        Cancel
                      </Button>
                    </div>
                  )}
                </div>

                {/* Body — 3 column grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-0 divide-y md:divide-y-0 md:divide-x"
                  style={{ borderColor: 'rgba(30,48,88,0.4)' }}>

                  {/* Col 1: Schedule Details */}
                  <div className="p-4 space-y-2.5">
                    <div className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: '#475569' }}>Schedule Details</div>
                    <div className="flex items-start gap-2 text-xs">
                      <MapPin size={12} style={{ color: '#475569', marginTop: 1, flexShrink: 0 }} />
                      <span style={{ color: '#94A3B8' }}>{s.address}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <Calendar size={12} style={{ color: '#475569' }} />
                      <span style={{ color: '#94A3B8' }}>{fmtDate(s.scheduled_at)}</span>
                    </div>
                    {s.contact_name && (
                      <div className="flex items-center gap-2 text-xs">
                        <User size={12} style={{ color: '#475569' }} />
                        <span style={{ color: '#94A3B8' }}>{s.contact_name}</span>
                        {s.contact_phone && <span style={{ color: '#64748B' }}>· {s.contact_phone}</span>}
                      </div>
                    )}
                    {s.notes && (
                      <div className="flex items-start gap-2 text-xs">
                        <FileText size={12} style={{ color: '#475569', marginTop: 1, flexShrink: 0 }} />
                        <span style={{ color: '#64748B' }}>{s.notes}</span>
                      </div>
                    )}
                    {s.completed_at && (
                      <div className="flex items-center gap-2 text-xs">
                        <CheckCircle size={12} style={{ color: '#10B981' }} />
                        <span style={{ color: '#10B981' }}>Completed: {fmtDate(s.completed_at)}</span>
                      </div>
                    )}
                    {s.assigned_to && (
                      <div className="flex items-center gap-2 text-xs">
                        <User size={12} style={{ color: '#3B82F6' }} />
                        <span style={{ color: '#3B82F6' }}>
                          Assigned: {s.assigned_to?.name ?? s.assigned_to} ({s.assigned_to?.role})
                        </span>
                      </div>
                    )}
                    {s.created_by && (
                      <div className="flex items-center gap-2 text-xs pt-1" style={{ borderTop: '1px solid rgba(30,48,88,0.4)' }}>
                        <span style={{ color: '#334155' }}>By:</span>
                        <span style={{ color: '#475569' }}>{s.created_by.name}</span>
                        <span className={`badge badge-${s.created_by.role}`}>{s.created_by.role}</span>
                      </div>
                    )}
                  </div>

                  {/* Col 2: Laptop */}
                  <div className="p-4 space-y-2.5">
                    <div className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: '#475569' }}>Laptop</div>
                    {inv ? (
                      <>
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)' }}>
                            <Monitor size={14} style={{ color: '#3B82F6' }} />
                          </div>
                          <div>
                            <div className="text-sm font-semibold" style={{ color: '#F1F5F9' }}>{inv.brand} {inv.model_no}</div>
                            <div className="text-xs font-mono" style={{ color: '#475569' }}>{inv.asset_code}</div>
                          </div>
                        </div>
                        {specs && <div className="text-xs" style={{ color: '#64748B' }}>{specs}</div>}
                        {inv.graphics && <div className="text-xs" style={{ color: '#64748B' }}>GPU: {inv.graphics}</div>}
                        <div className="flex items-center gap-1.5 text-xs">
                          <span style={{ color: '#475569' }}>Status:</span>
                          <span className={`badge badge-${inv.status}`}>{inv.status}</span>
                        </div>
                        {inv.serial_number && (
                          <div className="text-xs" style={{ color: '#475569' }}>S/N: {inv.serial_number}</div>
                        )}
                      </>
                    ) : (
                      <span className="text-xs" style={{ color: '#334155' }}>—</span>
                    )}
                  </div>

                  {/* Col 3: Client + Rental */}
                  <div className="p-4 space-y-2.5">
                    <div className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: '#475569' }}>Client & Rental</div>
                    {client && (
                      <div className="flex items-start gap-2 mb-3">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 font-bold text-sm"
                          style={{ background: 'linear-gradient(135deg,#14B8A6,#0D9488)', color: 'white' }}>
                          {client.name?.charAt(0)?.toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold truncate" style={{ color: '#F1F5F9' }}>{client.name}</div>
                          {client.company && <div className="text-xs truncate" style={{ color: '#475569' }}>{client.company}</div>}
                        </div>
                      </div>
                    )}
                    {client?.phone && (
                      <div className="flex items-center gap-2 text-xs">
                        <Phone size={11} style={{ color: '#475569' }} />
                        <span style={{ color: '#94A3B8' }}>{client.phone}</span>
                      </div>
                    )}
                    {client?.email && (
                      <div className="flex items-center gap-2 text-xs">
                        <Mail size={11} style={{ color: '#475569' }} />
                        <span style={{ color: '#94A3B8' }}>{client.email}</span>
                      </div>
                    )}
                    {client?.address && (
                      <div className="flex items-start gap-2 text-xs">
                        <MapPin size={11} style={{ color: '#475569', marginTop: 1, flexShrink: 0 }} />
                        <span style={{ color: '#64748B' }}>{client.address}</span>
                      </div>
                    )}
                    {s.rental && (
                      <div className="mt-2 pt-2 space-y-1" style={{ borderTop: '1px solid rgba(30,48,88,0.4)' }}>
                        <div className="flex items-center gap-2 text-xs">
                          <Hash size={11} style={{ color: '#475569' }} />
                          <Link href={`/rentals/${s.rental.id}`}
                            className="font-mono font-semibold hover:underline" style={{ color: '#3B82F6' }}>
                            {s.rental.rental_no}
                          </Link>
                          <span className={`badge badge-${s.rental.status}`}>{s.rental.status}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <Calendar size={11} style={{ color: '#475569' }} />
                          <span style={{ color: '#64748B' }}>Start: {fmtShort(s.rental.start_date)}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <span style={{ color: '#475569' }}>Monthly:</span>
                          <span className="font-semibold" style={{ color: '#10B981' }}>
                            ₹{Number(s.rental.monthly_rental || 0).toLocaleString('en-IN')}
                          </span>
                          <span style={{ color: '#475569' }}>Grand:</span>
                          <span className="font-semibold" style={{ color: '#10B981' }}>
                            ₹{Number(s.rental.grand_total || 0).toLocaleString('en-IN')}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {lastPage > 1 && (
        <div className="flex items-center justify-between mt-4 px-2">
          <span className="text-xs" style={{ color: '#475569' }}>Page {page} of {lastPage}</span>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Prev</Button>
            <Button variant="ghost" size="sm" disabled={page >= lastPage} onClick={() => setPage(p => p + 1)}>Next</Button>
          </div>
        </div>
      )}

      {/* Complete Modal */}
      <Modal open={!!completeModal} onClose={() => setCompleteModal(null)} title="Mark as Completed" width="max-w-sm">
        {completeModal && (
          <div className="p-3 rounded-xl mb-4 text-sm"
            style={{ background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.2)' }}>
            <div className="font-semibold capitalize" style={{ color: '#10B981' }}>{completeModal.type}</div>
            <div className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>{completeModal.address}</div>
            {completeModal.rental?.inventory && (
              <div className="text-xs mt-0.5" style={{ color: '#64748B' }}>
                {completeModal.rental.inventory.brand} {completeModal.rental.inventory.model_no}
              </div>
            )}
          </div>
        )}
        <FormField label="Completion Notes">
          <textarea className="inp resize-none" rows={3} value={completeNote}
            onChange={e => setCompleteNote(e.target.value)}
            placeholder="Delivered successfully, received by..." />
        </FormField>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="ghost" onClick={() => setCompleteModal(null)}>Cancel</Button>
          <Button icon={<CheckCircle size={14} />} loading={completing} onClick={handleComplete}>
            Mark Completed
          </Button>
        </div>
      </Modal>

      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </DashboardLayout>
  );
}
