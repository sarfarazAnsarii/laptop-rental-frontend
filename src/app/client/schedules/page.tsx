'use client';

import { useEffect, useState, useCallback } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { PageHeader, EmptyState, Toast } from '@/components/ui';
import { api } from '@/lib/api';
import { Truck, MapPin, Calendar, Contact, CheckCircle, Clock, XCircle, FileText } from 'lucide-react';

const fmtDate = (d: string) =>
  new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const STATUS_META: Record<string, { color: string; icon: any }> = {
  scheduled:  { color: '#F59E0B', icon: Clock       },
  completed:  { color: '#10B981', icon: CheckCircle },
  cancelled:  { color: '#64748B', icon: XCircle     },
};

export default function ClientSchedulesPage() {
  const [schedules, setSchedules] = useState<any[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [tab,       setTab]       = useState<'all' | 'pickup' | 'delivery'>('all');
  const [toast,     setToast]     = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { per_page: '50' };
      if (tab !== 'all') params.type = tab;
      const res = await api.client.mySchedules(params);
      setSchedules(res.data?.data || res.data || []);
    } catch (e: any) {
      showToast(e.message || 'Failed to load schedules', 'error');
    } finally { setLoading(false); }
  }, [tab]);

  useEffect(() => { load(); }, [load]);

  const pickupCount   = schedules.filter(s => s.type === 'pickup').length;
  const deliveryCount = schedules.filter(s => s.type === 'delivery').length;
  const pendingCount  = schedules.filter(s => s.status === 'scheduled').length;

  return (
    <DashboardLayout>
      <PageHeader title="My Schedules" subtitle="Pickup & delivery schedules for your rentals" />

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          { label: 'Pending',   value: pendingCount,  color: '#F59E0B', icon: <Clock size={16} /> },
          { label: 'Pickups',   value: pickupCount,   color: '#F97316', icon: <Truck size={16} /> },
          { label: 'Deliveries',value: deliveryCount, color: '#3B82F6', icon: <Truck size={16} /> },
        ].map(s => (
          <div key={s.label} className="glass-card px-4 py-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: `${s.color}14`, border: `1px solid ${s.color}25` }}>
              <span style={{ color: s.color }}>{s.icon}</span>
            </div>
            <div>
              <div className="text-xl font-bold" style={{ fontFamily: 'Syne, sans-serif', color: '#F1F5F9' }}>{s.value}</div>
              <div className="text-xs" style={{ color: '#64748B' }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="overflow-x-auto mb-5 pb-0.5">
        <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'rgba(30,48,88,0.3)', width: 'max-content' }}>
          {(['all', 'pickup', 'delivery'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all"
              style={{
                background: tab === t ? 'rgba(59,130,246,0.2)' : 'transparent',
                color:      tab === t ? '#3B82F6' : '#64748B',
                border:     tab === t ? '1px solid rgba(59,130,246,0.3)' : '1px solid transparent',
              }}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="glass-card overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-24 rounded-xl" />)}
          </div>
        ) : schedules.length === 0 ? (
          <EmptyState icon={<Truck size={22} />}
            title="No schedules"
            desc={tab === 'all' ? 'No pickups or deliveries scheduled yet' : `No ${tab} schedules found`} />
        ) : (
          <div className="divide-y" style={{ borderColor: 'rgba(30,48,88,0.4)' }}>
            {schedules.map(s => {
              const isPickup = s.type === 'pickup';
              const color    = isPickup ? '#F97316' : '#3B82F6';
              const meta     = STATUS_META[s.status] ?? STATUS_META.scheduled;
              const StatusIcon = meta.icon;
              return (
                <div key={s.id} className="p-4 animate-fade-in">
                  <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ background: `${color}14`, border: `1px solid ${color}25` }}>
                        <Truck size={14} style={{ color }} />
                      </div>
                      <div>
                        <div className="text-sm font-semibold capitalize" style={{ color }}>{s.type}</div>
                        {s.bulk_id && (
                          <div className="text-xs font-mono" style={{ color: '#8B5CF6' }}>{s.bulk_id}</div>
                        )}
                        {s.rental?.rental_no && !s.bulk_id && (
                          <div className="text-xs font-mono" style={{ color: '#475569' }}>{s.rental.rental_no}</div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs font-semibold"
                      style={{ color: meta.color }}>
                      <StatusIcon size={13} />
                      <span className="capitalize">{s.status}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div className="flex items-start gap-1.5">
                      <MapPin size={11} style={{ color: '#475569', marginTop: 2, flexShrink: 0 }} />
                      <span style={{ color: '#94A3B8' }}>{s.address}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Calendar size={11} style={{ color: '#475569' }} />
                      <span style={{ color: '#94A3B8' }}>{fmtDate(s.scheduled_at)}</span>
                    </div>
                    {s.contact_name && (
                      <div className="flex items-center gap-1.5">
                        <Contact size={11} style={{ color: '#475569' }} />
                        <span style={{ color: '#94A3B8' }}>{s.contact_name}{s.contact_phone ? ` · ${s.contact_phone}` : ''}</span>
                      </div>
                    )}
                    {s.notes && (
                      <div className="flex items-start gap-1.5 sm:col-span-2">
                        <FileText size={11} style={{ color: '#475569', marginTop: 2, flexShrink: 0 }} />
                        <span style={{ color: '#64748B' }}>{s.notes}</span>
                      </div>
                    )}
                    {s.completed_at && (
                      <div className="flex items-center gap-1.5 sm:col-span-2">
                        <CheckCircle size={11} style={{ color: '#10B981' }} />
                        <span style={{ color: '#10B981' }}>Completed: {fmtDate(s.completed_at)}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </DashboardLayout>
  );
}
