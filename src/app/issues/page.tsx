'use client';

import { useEffect, useState, useCallback } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button, Modal, FormField, PageHeader, EmptyState, Toast } from '@/components/ui';
import { api } from '@/lib/api';
import { Issue } from '@/types';
import {
  Wrench, AlertCircle, CheckCircle, Clock, Eye,
  Monitor, User, MessageSquare, AlertTriangle, X,
} from 'lucide-react';

const STATUS_TABS = ['all', 'open', 'acknowledged', 'in_progress', 'resolved', 'closed'] as const;
const SEVERITY_FILTERS = ['', 'low', 'medium', 'high', 'critical'];

const SEVERITY_META: Record<string, { color: string; label: string }> = {
  low:      { color: '#10B981', label: 'Low'      },
  medium:   { color: '#F59E0B', label: 'Medium'   },
  high:     { color: '#F97316', label: 'High'     },
  critical: { color: '#F43F5E', label: 'Critical' },
};

const STATUS_META: Record<string, { color: string; label: string; next?: string[] }> = {
  open:         { color: '#F43F5E', label: 'Open',         next: ['acknowledged', 'in_progress'] },
  acknowledged: { color: '#F59E0B', label: 'Acknowledged', next: ['in_progress'] },
  in_progress:  { color: '#3B82F6', label: 'In Progress',  next: ['resolved'] },
  resolved:     { color: '#10B981', label: 'Resolved',     next: ['closed'] },
  closed:       { color: '#64748B', label: 'Closed',       next: [] },
};

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

export default function IssuesPage() {
  const [issues,   setIssues]   = useState<Issue[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [tab,      setTab]      = useState('all');
  const [severity, setSeverity] = useState('');
  const [page,     setPage]     = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total,    setTotal]    = useState(0);

  // detail / update modal
  const [selected,   setSelected]   = useState<Issue | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [updating,   setUpdating]   = useState(false);

  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { per_page: '15', page: String(page) };
      if (tab !== 'all') params.status = tab;
      if (severity)      params.severity = severity;
      const res = await api.issues.list(params);
      setIssues(res.data?.data || []);
      setLastPage(res.data?.last_page || 1);
      setTotal(res.data?.total || 0);
    } finally { setLoading(false); }
  }, [page, tab, severity]);

  useEffect(() => { load(); }, [load]);

  function openDetail(issue: Issue) {
    setSelected(issue);
    setAdminNotes(issue.admin_notes || '');
  }

  async function handleUpdateStatus(newStatus: string) {
    if (!selected) return;
    setUpdating(true);
    try {
      if (newStatus === 'resolved') {
        await api.issues.resolve(selected.id, adminNotes || undefined);
      } else if (newStatus === 'closed') {
        await api.issues.close(selected.id);
      } else {
        await api.issues.update(selected.id, { status: newStatus, admin_notes: adminNotes || undefined });
      }
      showToast(`Issue marked as ${newStatus}`);
      setSelected(null);
      load();
    } catch (e: any) {
      showToast(e.message || 'Failed to update', 'error');
    } finally { setUpdating(false); }
  }

  async function handleSaveNotes() {
    if (!selected) return;
    setUpdating(true);
    try {
      await api.issues.update(selected.id, { admin_notes: adminNotes });
      showToast('Notes saved');
      load();
    } catch (e: any) {
      showToast(e.message || 'Failed to save notes', 'error');
    } finally { setUpdating(false); }
  }

  /* ── summary counts ── */
  const counts = {
    open:       issues.filter(i => i.status === 'open').length,
    inProgress: issues.filter(i => i.status === 'in_progress' || i.status === 'acknowledged').length,
    resolved:   issues.filter(i => i.status === 'resolved' || i.status === 'closed').length,
    critical:   issues.filter(i => i.severity === 'critical').length,
  };

  const sm = selected ? (STATUS_META[selected.status] ?? STATUS_META.open) : null;

  return (
    <DashboardLayout>
      <PageHeader
        title="Issue Reports"
        subtitle={`${total} issue${total !== 1 ? 's' : ''} reported by vendors`}
      />

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {[
          { label: 'Open Issues',    value: counts.open,       color: '#F43F5E', icon: <AlertCircle size={16} /> },
          { label: 'In Progress',    value: counts.inProgress, color: '#F59E0B', icon: <Clock size={16} /> },
          { label: 'Resolved',       value: counts.resolved,   color: '#10B981', icon: <CheckCircle size={16} /> },
          { label: 'Critical',       value: counts.critical,   color: '#F43F5E', icon: <AlertTriangle size={16} /> },
        ].map(s => (
          <div key={s.label} className="glass-card px-4 py-3.5 flex items-center gap-3 animate-fade-in">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
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

      {/* Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-5">
        {/* Status tabs */}
        <div className="flex-1 overflow-auto whitespace-nowrap min-w-full max-w-[300px] pb-0.5">
          <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'rgba(30,48,88,0.3)', width: 'max-content' }}>
            {STATUS_TABS.map(t => (
              <button key={t} onClick={() => { setTab(t); setPage(1); }}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all whitespace-nowrap"
                style={{
                  background: tab === t ? 'rgba(59,130,246,0.2)' : 'transparent',
                  color:      tab === t ? '#3B82F6' : '#64748B',
                  border:     tab === t ? '1px solid rgba(59,130,246,0.3)' : '1px solid transparent',
                }}>
                {t === 'in_progress' ? 'In Progress' : t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Severity filter */}
        <select className="inp sm:w-40 sm:flex-none" value={severity} onChange={e => { setSeverity(e.target.value); setPage(1); }}>
          {SEVERITY_FILTERS.map(s => <option key={s} value={s}>{s || 'All Severity'}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            {[...Array(6)].map((_, i) => <div key={i} className="skeleton h-14 rounded-xl" />)}
          </div>
        ) : issues.length === 0 ? (
          <EmptyState icon={<Wrench size={22} />}
            title={tab === 'all' ? 'No issues reported' : `No ${tab.replace('_', ' ')} issues`}
            desc="Issue reports from vendors will appear here" />
        ) : (
          <>
            {/* Mobile card list */}
            <div className="sm:hidden divide-y" style={{ borderColor: 'rgba(30,48,88,0.4)' }}>
              {issues.map(issue => {
                const isUrgent = issue.severity === 'critical' || issue.severity === 'high';
                return (
                  <div key={issue.id} className="p-4 space-y-2 animate-fade-in"
                    style={issue.status === 'open' && isUrgent ? { background: 'rgba(244,63,94,0.02)' } : {}}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={'badge badge-' + issue.severity}>{issue.severity}</span>
                      <span className={'badge badge-' + issue.status}>{STATUS_META[issue.status]?.label ?? issue.status}</span>
                      <span className="text-xs ml-auto" style={{ color: '#64748B' }}>{fmtDate(issue.created_at)}</span>
                    </div>
                    <div>
                      <div className="text-sm font-medium" style={{ color: '#F1F5F9' }}>{issue.title}</div>
                      {issue.admin_notes && (
                        <div className="flex items-center gap-1 mt-0.5">
                          <MessageSquare size={11} style={{ color: '#10B981' }} />
                          <span className="text-xs" style={{ color: '#64748B' }}>Responded</span>
                        </div>
                      )}
                    </div>
                    {issue.inventory ? (
                      <div className="flex items-center gap-1.5">
                        <Monitor size={12} style={{ color: '#475569' }} />
                        <span className="text-xs" style={{ color: '#94A3B8' }}>{issue.inventory.brand} {issue.inventory.model_no}</span>
                        <span className="text-xs font-mono" style={{ color: '#475569' }}>· {issue.inventory.asset_code}</span>
                      </div>
                    ) : (
                      <div className="text-xs font-mono" style={{ color: '#475569' }}>#{issue.inventory_id}</div>
                    )}
                    {issue.reporter && (
                      <div className="flex items-center gap-1.5">
                        <User size={12} style={{ color: '#475569' }} />
                        <span className="text-xs" style={{ color: '#64748B' }}>{issue.reporter.name}{issue.reporter.company ? ` · ${issue.reporter.company}` : ''}</span>
                      </div>
                    )}
                    <div className="flex justify-end pt-1">
                      <Button variant="ghost" size="sm" icon={<Eye size={13} />} onClick={() => openDetail(issue)}>Manage</Button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Laptop</th>
                    <th>Reported By</th>
                    <th>Issue</th>
                    <th>Severity</th>
                    <th>Status</th>
                    <th className="hidden md:table-cell">Reported</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {issues.map(issue => {
                    const isUrgent = issue.severity === 'critical' || issue.severity === 'high';
                    return (
                      <tr key={issue.id} className="animate-fade-in" style={
                        issue.status === 'open' && isUrgent ? { background: 'rgba(244,63,94,0.02)' } : {}
                      }>
                        <td>
                          {issue.inventory ? (
                            <>
                              <div className="flex items-center gap-1.5">
                                <Monitor size={13} style={{ color: '#475569' }} />
                                <span className="text-sm font-medium" style={{ color: '#F1F5F9' }}>
                                  {issue.inventory.brand} {issue.inventory.model_no}
                                </span>
                              </div>
                              <div className="text-xs font-mono ml-5" style={{ color: '#475569' }}>
                                {issue.inventory.asset_code}
                              </div>
                            </>
                          ) : (
                            <span className="text-xs font-mono" style={{ color: '#475569' }}>#{issue.inventory_id}</span>
                          )}
                        </td>
                        <td>
                          {issue.reporter ? (
                            <>
                              <div className="flex items-center gap-1.5">
                                <User size={12} style={{ color: '#475569' }} />
                                <span className="text-sm" style={{ color: '#F1F5F9' }}>{issue.reporter.name}</span>
                              </div>
                              {issue.reporter.company && (
                                <div className="text-xs ml-4.5" style={{ color: '#475569' }}>{issue.reporter.company}</div>
                              )}
                            </>
                          ) : (
                            <span className="text-xs" style={{ color: '#475569' }}>Vendor #{issue.reported_by}</span>
                          )}
                        </td>
                        <td>
                          <div className="text-sm font-medium" style={{ color: '#F1F5F9', maxWidth: 200 }}>
                            {issue.title}
                          </div>
                          {issue.admin_notes && (
                            <div className="flex items-center gap-1 mt-0.5">
                              <MessageSquare size={11} style={{ color: '#10B981' }} />
                              <span className="text-xs" style={{ color: '#64748B' }}>Responded</span>
                            </div>
                          )}
                        </td>
                        <td><span className={'badge badge-' + issue.severity}>{issue.severity}</span></td>
                        <td>
                          <span className={'badge badge-' + issue.status}>
                            {STATUS_META[issue.status]?.label ?? issue.status}
                          </span>
                        </td>
                        <td className="hidden md:table-cell text-xs" style={{ color: '#64748B' }}>
                          {fmtDate(issue.created_at)}
                        </td>
                        <td>
                          <Button variant="ghost" size="sm" icon={<Eye size={13} />} onClick={() => openDetail(issue)}>
                            Manage
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

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

      {/* ── Issue Detail / Management Modal ── */}
      {selected && sm && (
        <Modal open={!!selected} onClose={() => setSelected(null)}
          title="Manage Issue" width="max-w-xl">

          {/* Laptop info */}
          {selected.inventory && (
            <div className="flex items-center gap-3 p-3 rounded-xl mb-4"
              style={{ background: 'rgba(30,48,88,0.4)', border: '1px solid rgba(30,48,88,0.7)' }}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(59,130,246,0.12)' }}>
                <Monitor size={16} style={{ color: '#3B82F6' }} />
              </div>
              <div>
                <div className="text-sm font-semibold" style={{ color: '#F1F5F9' }}>
                  {selected.inventory.brand} {selected.inventory.model_no}
                </div>
                <div className="text-xs font-mono" style={{ color: '#475569' }}>
                  {selected.inventory.asset_code}
                </div>
              </div>
              <div className="ml-auto flex gap-2 flex-wrap justify-end">
                <span className={'badge badge-' + selected.severity}>{selected.severity}</span>
                <span className={'badge badge-' + selected.status}>{sm.label}</span>
              </div>
            </div>
          )}

          {/* Reporter */}
          {selected.reporter && (
            <div className="flex items-center gap-2 mb-4 text-sm" style={{ color: '#64748B' }}>
              <User size={13} />
              <span>Reported by <strong style={{ color: '#94A3B8' }}>{selected.reporter.name}</strong>
                {selected.reporter.company && ` (${selected.reporter.company})`}
              </span>
              <span className="ml-auto text-xs">{fmtDate(selected.created_at)}</span>
            </div>
          )}

          {/* Title + description */}
          <div className="mb-4">
            <h3 className="text-base font-semibold mb-2" style={{ color: '#F1F5F9' }}>{selected.title}</h3>
            <p className="text-sm leading-relaxed p-3 rounded-xl"
              style={{ color: '#94A3B8', background: 'rgba(30,48,88,0.35)', border: '1px solid rgba(30,48,88,0.6)' }}>
              {selected.description}
            </p>
          </div>

          {/* Admin notes */}
          <div className="mb-5">
            <FormField label="Admin Response / Notes">
              <textarea className="inp resize-none" rows={3}
                placeholder="Add a note or resolution details for the vendor..."
                value={adminNotes}
                onChange={e => setAdminNotes(e.target.value)} />
            </FormField>
            <div className="flex justify-end mt-2">
              <Button variant="ghost" size="sm" onClick={handleSaveNotes} loading={updating}>
                Save Notes
              </Button>
            </div>
          </div>

          {/* Status actions */}
          {sm.next && sm.next.length > 0 && (
            <div style={{ borderTop: '1px solid #1E3058', paddingTop: '1rem' }}>
              <div className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: '#475569' }}>
                Update Status
              </div>
              <div className="flex gap-2 flex-wrap">
                {sm.next.map(nextStatus => {
                  const nm = STATUS_META[nextStatus];
                  return (
                    <Button key={nextStatus}
                      variant={nextStatus === 'resolved' ? 'success' : nextStatus === 'closed' ? 'ghost' : 'outline'}
                      size="sm"
                      loading={updating}
                      onClick={() => handleUpdateStatus(nextStatus)}>
                      Mark as {nm?.label ?? nextStatus}
                    </Button>
                  );
                })}
              </div>
            </div>
          )}

          {selected.status === 'resolved' && selected.resolved_at && (
            <div className="mt-4 text-xs" style={{ color: '#334155' }}>
              Resolved on {fmtDate(selected.resolved_at)}
            </div>
          )}

          <div className="flex justify-end mt-5">
            <Button variant="ghost" onClick={() => setSelected(null)}>Close</Button>
          </div>
        </Modal>
      )}

      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </DashboardLayout>
  );
}
