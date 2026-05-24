'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button, Modal, FormField, PageHeader, EmptyState, Toast } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import {
  Truck, MapPin, Calendar, CheckCircle, Clock, XCircle,
  FileText, User, Layers, Monitor, Phone, Mail,
  Hash, Contact,
} from 'lucide-react';

const fmtDate = (d?: string) =>
  d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

const fmtShort = (d?: string) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const STATUS_META: Record<string, { color: string; bg: string; border: string; icon: any }> = {
  scheduled: { color: '#B45309', bg: '#FFFBEB', border: '#FDE68A', icon: Clock       },
  completed: { color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0', icon: CheckCircle },
  cancelled: { color: '#64748B', bg: '#F8FAFC', border: '#E2E8F0', icon: XCircle    },
};

export default function SchedulesPage() {
  const { user } = useAuth();
  const isStaff  = user?.role === 'staff';

  const [schedules, setSchedules] = useState<any[]>([]);
  const [loading,   setLoading]   = useState(true);
  type ScheduleType = 'pickup' | 'delivery' | 'replacement_delivery' | 'replacement_receive' | 'event_delivery' | 'event_return';

  // Staff sees only their 4 action types; admin sees all 6
  const STAFF_TYPES = ['delivery', 'replacement_delivery', 'replacement_receive', 'pickup'] as const;
  const ADMIN_TYPES = ['pickup', 'delivery', 'replacement_delivery', 'replacement_receive', 'event_delivery', 'event_return'] as const;

  const TYPE_LABELS: Record<string, string> = {
    all: 'All',
    pickup:               'Return',
    delivery:             'New Delivery',
    replacement_delivery: 'Replacement Delivery',
    replacement_receive:  'Replacement Receive',
    event_delivery:       'Event Delivery',
    event_return:         'Event Return',
  };
  const TYPE_COLOR: Record<string, string> = {
    pickup:               '#F59E0B',
    delivery:             '#3B82F6',
    replacement_delivery: '#8B5CF6',
    replacement_receive:  '#0D9488',
    event_delivery:       '#6366F1',
    event_return:         '#F43F5E',
  };
  const [typeTab,   setTypeTab]   = useState<'all' | ScheduleType>('all');
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
    if (!user) return;
    setLoading(true);
    try {
      const params: Record<string, string> = { per_page: '20', page: String(page) };
      if (typeTab   !== 'all') params.type   = typeTab;
      if (statusTab !== 'all') params.status = statusTab;
      // Staff: only see schedules assigned to them
      if (isStaff) params.assigned_to = String(user.id);
      const res = await api.schedules.list(params);
      setSchedules(res.data?.data || res.data || []);
      setLastPage(res.data?.last_page || 1);
      setTotal(res.data?.total || 0);
    } catch (e: any) {
      showToast(e.message || 'Failed to load schedules', 'error');
    } finally { setLoading(false); }
  }, [typeTab, statusTab, page, isStaff, user]);

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

  const pending      = schedules.filter(s => s.status === 'scheduled').length;
  const deliveries   = schedules.filter(s => s.type === 'delivery').length;
  const replDeliv    = schedules.filter(s => s.type === 'replacement_delivery').length;
  const replReceive  = schedules.filter(s => s.type === 'replacement_receive').length;
  const returns      = schedules.filter(s => s.type === 'pickup').length;
  const events       = schedules.filter(s => s.type === 'event_delivery' || s.type === 'event_return').length;

  return (
    <DashboardLayout>
      <PageHeader
        title={isStaff ? 'My Schedules' : 'Schedules'}
        subtitle={isStaff ? `${total} schedule${total !== 1 ? 's' : ''} assigned to you` : `${total} total schedule${total !== 1 ? 's' : ''}`}
      />

      {/* Summary */}
      <div className={`grid gap-3 mb-5 ${isStaff ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2 sm:grid-cols-6'}`}>
        {isStaff ? [
          { label: 'Total',                value: total,       color: '#3B82F6' },
          { label: 'Pending',              value: pending,     color: '#F59E0B' },
          { label: 'New Deliveries',        value: deliveries,  color: '#3B82F6' },
          { label: 'Repl. Deliveries',     value: replDeliv,   color: '#8B5CF6' },
          { label: 'Repl. Receives',       value: replReceive, color: '#0D9488' },
          { label: 'Returns',              value: returns,     color: '#F59E0B' },
        ].map(s => (
          <div key={s.label} className="glass-card px-4 py-3">
            <div className="text-2xl font-bold" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', color: s.color }}>{s.value}</div>
            <div className="text-xs mt-0.5" style={{ color: '#64748B' }}>{s.label}</div>
          </div>
        )) : [
          { label: 'Total',        value: total,       color: '#3B82F6' },
          { label: 'Pending',      value: pending,     color: '#F59E0B' },
          { label: 'New Delivery', value: deliveries,  color: '#3B82F6' },
          { label: 'Repl. Deliv', value: replDeliv,   color: '#8B5CF6' },
          { label: 'Repl. Recv',  value: replReceive, color: '#0D9488' },
          { label: 'Returns',      value: returns,     color: '#F59E0B' },
        ].map(s => (
          <div key={s.label} className="glass-card px-4 py-3">
            <div className="text-2xl font-bold" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', color: s.color }}>{s.value}</div>
            <div className="text-xs mt-0.5" style={{ color: '#64748B' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="flex flex-wrap gap-1 p-1 rounded-xl" style={{ background: '#F1F5F9' }}>
          {(['all', ...(isStaff ? STAFF_TYPES : ADMIN_TYPES)] as const).map(t => (
            <button key={t} onClick={() => setTypeTab(t as 'all' | ScheduleType)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={{
                background: typeTab === t ? '#FFFFFF' : 'transparent',
                color:      typeTab === t ? (t === 'all' ? '#2563EB' : TYPE_COLOR[t]) : '#64748B',
                border:     typeTab === t ? `1px solid ${t === 'all' ? '#BFDBFE' : `${TYPE_COLOR[t]}40`}` : '1px solid transparent',
                boxShadow:  typeTab === t ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
              }}>
              {TYPE_LABELS[t]}
            </button>
          ))}
        </div>
        <div className="flex gap-1 p-1 rounded-xl" style={{ background: '#F1F5F9' }}>
          {(['all', 'scheduled', 'completed', 'cancelled'] as const).map(t => (
            <button key={t} onClick={() => setStatusTab(t)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all"
              style={{
                background: statusTab === t ? '#FFFFFF' : 'transparent',
                color:      statusTab === t ? '#2563EB' : '#64748B',
                border:     statusTab === t ? '1px solid #BFDBFE' : '1px solid transparent',
                boxShadow:  statusTab === t ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
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
            const typeColor  = TYPE_COLOR[s.type] ?? '#3B82F6';
            const typeBg     = `${typeColor}14`;
            const meta       = STATUS_META[s.status] ?? STATUS_META.scheduled;
            const StatusIcon = meta.icon;
            const inv        = s.rental?.inventory ?? s.inventoryItem ?? null;
            const client     = s.rental?.client    ?? s.clientUser    ?? null;
            const specs      = [inv?.cpu, inv?.generation ? `${inv.generation} Gen` : '', inv?.ram, inv?.ssd].filter(Boolean).join(' · ');

            return (
              <div key={s.id} className="glass-card overflow-hidden animate-fade-in">

                {/* Header bar */}
                <div className="flex items-center justify-between px-5 py-3 flex-wrap gap-3"
                  style={{ background: typeBg, borderBottom: '1px solid #E2E8F0' }}>
                  <div className="flex items-center gap-3">
                    {/* Type */}
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-bold"
                      style={{ background: `${typeColor}18`, color: typeColor, border: `1px solid ${typeColor}30` }}>
                      <Truck size={13} />
                      <span>{TYPE_LABELS[s.type] ?? s.type}</span>
                    </div>
                    {/* Status */}
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold"
                      style={{ background: meta.bg, color: meta.color, border: `1px solid ${meta.border}` }}>
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
                <div className="grid grid-cols-1 md:grid-cols-3 gap-0 divide-y md:divide-y-0 md:divide-x divide-slate-100">

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
                        <Contact size={12} style={{ color: '#475569' }} />
                        <span style={{ color: '#64748B' }}>IT:</span>
                        <span style={{ color: '#94A3B8' }}>{s.contact_name}</span>
                        {s.contact_phone && <span style={{ color: '#94A3B8' }}>· {s.contact_phone}</span>}
                      </div>
                    )}
                    {s.employee_name && (
                      <div className="flex items-center gap-2 text-xs">
                        <User size={12} style={{ color: '#475569' }} />
                        <span style={{ color: '#64748B' }}>Emp:</span>
                        <span style={{ color: '#94A3B8' }}>{s.employee_name}</span>
                        {s.employee_number && <span style={{ color: '#94A3B8' }}>({s.employee_number})</span>}
                      </div>
                    )}
                    {s.employee_address && (
                      <div className="flex items-start gap-2 text-xs">
                        <MapPin size={12} style={{ color: '#475569', marginTop: 1, flexShrink: 0 }} />
                        <span style={{ color: '#64748B' }}>{s.employee_address}</span>
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
                      <div className="flex items-center gap-2 text-xs pt-1" style={{ borderTop: '1px solid #E2E8F0' }}>
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
                            <div className="text-sm font-semibold" style={{ color: '#0F172A' }}>{inv.brand} {inv.model_no}</div>
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
                          style={{ background: '#EFF6FF', color: '#2563EB', border: '1px solid #BFDBFE' }}>
                          {client.name?.charAt(0)?.toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold truncate" style={{ color: '#0F172A' }}>{client.name}</div>
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
                      <div className="mt-2 pt-2 space-y-1" style={{ borderTop: '1px solid #E2E8F0' }}>
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
                          <span className="font-semibold" style={{ color: '#16A34A' }}>
                            ₹{Number(s.rental.monthly_rental || 0).toLocaleString('en-IN')}
                          </span>
                          <span style={{ color: '#475569' }}>Grand:</span>
                          <span className="font-semibold" style={{ color: '#16A34A' }}>
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
            style={{ background: '#F0FDF4', border: '1px solid #BBF7D0' }}>
            <div className="font-semibold capitalize" style={{ color: '#16A34A' }}>{completeModal.type}</div>
            <div className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>{completeModal.address}</div>
            {(completeModal.rental?.inventory ?? completeModal.inventoryItem) && (
              <div className="text-xs mt-0.5" style={{ color: '#64748B' }}>
                {(completeModal.rental?.inventory ?? completeModal.inventoryItem).brand}{' '}
                {(completeModal.rental?.inventory ?? completeModal.inventoryItem).model_no}
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
