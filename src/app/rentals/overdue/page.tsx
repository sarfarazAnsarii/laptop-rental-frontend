'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button, PageHeader, EmptyState, Toast } from '@/components/ui';
import { api } from '@/lib/api';
import { Rental } from '@/types';
import { AlertCircle, CheckCircle, XCircle } from 'lucide-react';

const fmt = (n: number) => '₹' + new Intl.NumberFormat('en-IN').format(Number(n));
const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

function daysOverdue(endDate: string) {
  const diff = Math.floor((Date.now() - new Date(endDate).getTime()) / 86400000);
  return diff;
}

export default function OverduePage() {
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.rentals.overdue();
      setRentals(res.data || []);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  async function handleComplete(id: number) {
    try { await api.rentals.complete(id); showToast('Marked as completed'); load(); }
    catch (e: any) { showToast(e.message, 'error'); }
  }
  async function handleCancel(id: number) {
    try { await api.rentals.cancel(id); showToast('Rental cancelled'); load(); }
    catch (e: any) { showToast(e.message, 'error'); }
  }

  return (
    <DashboardLayout>
      <PageHeader title="Overdue Rentals" subtitle={`${rentals.length} overdue rental${rentals.length !== 1 ? 's' : ''} need attention`} />

      {/* Alert banner */}
      {rentals.length > 0 && (
        <div className="mb-6 px-5 py-4 rounded-xl flex items-center gap-3"
          style={{ background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.25)' }}>
          <AlertCircle size={18} style={{ color: '#F43F5E', flexShrink: 0 }} />
          <p className="text-sm" style={{ color: '#F43F5E' }}>
            <strong>{rentals.length} rental{rentals.length !== 1 ? 's' : ''}</strong> have passed their return date. Please contact clients and update the status.
          </p>
        </div>
      )}

      <div className="glass-card overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="skeleton h-16 rounded-xl" />)}</div>
        ) : rentals.length === 0 ? (
          <EmptyState icon={<AlertCircle size={22} />} title="No overdue rentals" desc="All rentals are within their return date. Great job!" />
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Rental No</th>
                  <th>Laptop</th>
                  <th className="hidden sm:table-cell">Client</th>
                  <th className="hidden md:table-cell">End Date</th>
                  <th>Days Overdue</th>
                  <th className="hidden sm:table-cell">Grand Total</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rentals.map(r => {
                  const overdue = daysOverdue(r.end_date ?? '');
                  return (
                    <tr key={r.id}>
                      <td><span className="font-mono text-xs font-medium" style={{ color: '#F43F5E' }}>{r.rental_no}</span></td>
                      <td>
                        <div className="text-sm" style={{ color: '#F1F5F9' }}>{r.inventory?.brand} {r.inventory?.model_no}</div>
                        <div className="text-xs font-mono" style={{ color: '#475569' }}>{r.inventory?.asset_code}</div>
                      </td>
                      <td className="hidden sm:table-cell">
                        <div className="text-sm" style={{ color: '#F1F5F9' }}>{r.client?.name || '—'}</div>
                        <div className="text-xs" style={{ color: '#475569' }}>{r.client?.email || ''}</div>
                      </td>
                      <td className="hidden md:table-cell" style={{ color: '#F43F5E' }}>{fmtDate(r.end_date ?? '')}</td>
                      <td><span className="badge badge-overdue">{overdue} day{overdue !== 1 ? 's' : ''}</span></td>
                      <td className="hidden sm:table-cell" style={{ color: '#10B981', fontWeight: 600 }}>{fmt(r.grand_total)}</td>
                      <td>
                        <div className="flex gap-1 flex-wrap">
                          <Button variant="success" size="sm" icon={<CheckCircle size={13} />} onClick={() => handleComplete(r.id)}>Complete</Button>
                          <Button variant="danger" size="sm" icon={<XCircle size={13} />} onClick={() => handleCancel(r.id)}>Cancel</Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </DashboardLayout>
  );
}
