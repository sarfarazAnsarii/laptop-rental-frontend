'use client';

import { useEffect, useState, useCallback } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button, Modal, FormField, PageHeader, EmptyState, Toast } from '@/components/ui';
import { api } from '@/lib/api';
import {
  AlertTriangle, Plus, Monitor, Clock, CheckCircle,
  AlertCircle, MessageSquare,
} from 'lucide-react';

const STATUS_TABS = ['all', 'open', 'acknowledged', 'in_progress', 'resolved', 'closed'] as const;
const SEVERITY_OPTIONS = ['low', 'medium', 'high', 'critical'];

const SEVERITY_META: Record<string, { color: string; label: string; desc: string }> = {
  low:      { color: '#10B981', label: 'Low',      desc: 'Minor issue, not urgent' },
  medium:   { color: '#F59E0B', label: 'Medium',   desc: 'Affects performance' },
  high:     { color: '#F97316', label: 'High',     desc: 'Serious issue, needs attention' },
  critical: { color: '#F43F5E', label: 'Critical', desc: 'Laptop is non-functional' },
};

const STATUS_META: Record<string, { color: string; label: string }> = {
  open:         { color: '#F43F5E', label: 'Open'         },
  acknowledged: { color: '#F59E0B', label: 'Acknowledged' },
  in_progress:  { color: '#3B82F6', label: 'In Progress'  },
  resolved:     { color: '#10B981', label: 'Resolved'     },
  closed:       { color: '#64748B', label: 'Closed'       },
};

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

export default function ClientIssuesPage() {
  const [issues,   setIssues]   = useState<any[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [tab,      setTab]      = useState<string>('all');
  const [page,     setPage]     = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total,    setTotal]    = useState(0);

  // rentals for laptop dropdown
  const [myRentals,  setMyRentals]  = useState<any[]>([]);
  const [showReport, setShowReport] = useState(false);
  const [issueForm,  setIssueForm]  = useState({
    inventory_id: '', title: '', description: '', severity: 'medium',
  });
  const [submitting, setSubmitting] = useState(false);
  const [viewIssue,  setViewIssue]  = useState<any | null>(null);

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
      const res = await api.client.myIssues(params);
      setIssues(res.data?.data || res.data || []);
      setLastPage(res.data?.last_page || 1);
      setTotal(res.data?.total || 0);
    } finally { setLoading(false); }
  }, [page, tab]);

  useEffect(() => { load(); }, [load]);

  async function openReport() {
    if (myRentals.length === 0) {
      try {
        const res = await api.client.myRentals({ per_page: '100', status: 'active' });
        setMyRentals(res.data?.data || res.data || []);
      } catch {}
    }
    setIssueForm({ inventory_id: '', title: '', description: '', severity: 'medium' });
    setShowReport(true);
  }

  async function handleSubmit() {
    if (!issueForm.inventory_id) { showToast('Please select a laptop', 'error'); return; }
    if (!issueForm.title.trim())  { showToast('Title is required', 'error'); return; }
    if (!issueForm.description.trim()) { showToast('Description is required', 'error'); return; }
    setSubmitting(true);
    try {
      await api.issues.create({
        inventory_id: Number(issueForm.inventory_id),
        title:        issueForm.title,
        description:  issueForm.description,
        severity:     issueForm.severity,
      });
      showToast('Issue reported successfully');
      setShowReport(false);
      load();
    } catch (e: any) {
      showToast(e.message || 'Failed to submit report', 'error');
    } finally { setSubmitting(false); }
  }

  const openCount = issues.filter(i => i.status === 'open').length;
  const ackCount  = issues.filter(i => i.status === 'acknowledged' || i.status === 'in_progress').length;
  const doneCount = issues.filter(i => i.status === 'resolved' || i.status === 'closed').length;

  return (
    <DashboardLayout>
      <PageHeader
        title="My Issues"
        subtitle={`${total} issue${total !== 1 ? 's' : ''} reported`}
        action={<Button icon={<Plus size={15} />} onClick={openReport}>Report Issue</Button>}
      />

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          { label: 'Open',        value: openCount, color: '#F43F5E', icon: <AlertCircle size={16} /> },
          { label: 'In Progress', value: ackCount,  color: '#F59E0B', icon: <Clock size={16} /> },
          { label: 'Resolved',    value: doneCount, color: '#10B981', icon: <CheckCircle size={16} /> },
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

      {/* Status tabs */}
      <div className="overflow-x-auto mb-5 pb-0.5">
        <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'rgba(30,48,88,0.3)', width: 'max-content' }}>
          {STATUS_TABS.map(t => (
            <button key={t} onClick={() => { setTab(t); setPage(1); }}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all"
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

      {/* List */}
      <div className="glass-card overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            {[...Array(5)].map((_, i) => <div key={i} className="skeleton h-16 rounded-xl" />)}
          </div>
        ) : issues.length === 0 ? (
          <EmptyState icon={<AlertTriangle size={22} />}
            title={tab === 'all' ? 'No issues reported' : `No ${tab} issues`}
            desc={tab === 'all' ? 'Click "Report Issue" to flag a problem with your laptop' : undefined} />
        ) : (
          <>
            <div className="sm:hidden divide-y" style={{ borderColor: 'rgba(30,48,88,0.4)' }}>
              {issues.map(issue => {
                const sm = STATUS_META[issue.status] ?? STATUS_META.open;
                return (
                  <div key={issue.id} className="p-4 space-y-2 animate-fade-in">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={'badge badge-' + issue.severity}>{issue.severity}</span>
                      <span className={'badge badge-' + issue.status} style={{ color: sm.color }}>{sm.label}</span>
                      <span className="text-xs ml-auto" style={{ color: '#64748B' }}>{fmtDate(issue.created_at)}</span>
                    </div>
                    <div className="text-sm font-medium" style={{ color: '#F1F5F9' }}>{issue.title}</div>
                    {issue.inventory && (
                      <div className="text-xs" style={{ color: '#475569' }}>
                        {issue.inventory.brand} {issue.inventory.model_no} · {issue.inventory.asset_code}
                      </div>
                    )}
                    {issue.admin_notes && (
                      <div className="flex items-start gap-1.5 pt-1">
                        <MessageSquare size={11} style={{ color: '#10B981', flexShrink: 0, marginTop: 1 }} />
                        <span className="text-xs line-clamp-2" style={{ color: '#94A3B8' }}>{issue.admin_notes}</span>
                      </div>
                    )}
                    <div className="flex justify-end pt-1">
                      <Button variant="ghost" size="sm" onClick={() => setViewIssue(issue)}>View</Button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="hidden sm:block overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Laptop</th>
                    <th>Issue</th>
                    <th>Severity</th>
                    <th>Status</th>
                    <th>Reported</th>
                    <th>Admin Notes</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {issues.map(issue => {
                    const sm = STATUS_META[issue.status] ?? STATUS_META.open;
                    return (
                      <tr key={issue.id} className="animate-fade-in">
                        <td>
                          {issue.inventory ? (
                            <>
                              <div className="text-sm font-medium" style={{ color: '#F1F5F9' }}>
                                {issue.inventory.brand} {issue.inventory.model_no}
                              </div>
                              <div className="text-xs font-mono" style={{ color: '#475569' }}>{issue.inventory.asset_code}</div>
                            </>
                          ) : (
                            <span className="text-xs font-mono" style={{ color: '#475569' }}>ID #{issue.inventory_id}</span>
                          )}
                        </td>
                        <td>
                          <div className="text-sm font-medium" style={{ color: '#F1F5F9', maxWidth: 200 }}>{issue.title}</div>
                        </td>
                        <td><span className={'badge badge-' + issue.severity}>{issue.severity}</span></td>
                        <td><span className={'badge badge-' + issue.status} style={{ color: sm.color }}>{sm.label}</span></td>
                        <td className="text-xs" style={{ color: '#64748B' }}>{fmtDate(issue.created_at)}</td>
                        <td>
                          {issue.admin_notes ? (
                            <div className="flex items-start gap-1.5 max-w-xs">
                              <MessageSquare size={12} style={{ color: '#10B981', flexShrink: 0, marginTop: 2 }} />
                              <span className="text-xs line-clamp-2" style={{ color: '#94A3B8' }}>{issue.admin_notes}</span>
                            </div>
                          ) : <span className="text-xs" style={{ color: '#334155' }}>—</span>}
                        </td>
                        <td>
                          <Button variant="ghost" size="sm" onClick={() => setViewIssue(issue)}>View</Button>
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

      {/* Report Issue Modal */}
      <Modal open={showReport} onClose={() => setShowReport(false)} title="Report an Issue" width="max-w-lg">
        <div className="space-y-4">
          <FormField label="Laptop" required>
            <select className="inp" value={issueForm.inventory_id}
              onChange={e => setIssueForm(p => ({ ...p, inventory_id: e.target.value }))}>
              <option value="">— Select your laptop —</option>
              {myRentals.map((r: any) => (
                <option key={r.inventory_id} value={r.inventory_id}>
                  {r.inventory?.asset_code} — {r.inventory?.brand} {r.inventory?.model_no}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Issue Title" required>
            <input className="inp" placeholder="e.g. Screen flickering, Battery drains quickly..."
              value={issueForm.title}
              onChange={e => setIssueForm(p => ({ ...p, title: e.target.value }))} />
          </FormField>

          <FormField label="Severity" required>
            <div className="grid grid-cols-4 gap-2">
              {SEVERITY_OPTIONS.map(sev => {
                const m  = SEVERITY_META[sev];
                const on = issueForm.severity === sev;
                return (
                  <button key={sev} type="button"
                    onClick={() => setIssueForm(p => ({ ...p, severity: sev }))}
                    className="py-2 rounded-xl text-xs font-semibold transition-all"
                    style={{
                      background: on ? `${m.color}18` : 'rgba(30,48,88,0.4)',
                      border:     on ? `2px solid ${m.color}60` : '1px solid rgba(30,48,88,0.7)',
                      color:      on ? m.color : '#475569',
                    }}>
                    {m.label}
                  </button>
                );
              })}
            </div>
            <p className="mt-1.5 text-xs" style={{ color: '#475569' }}>{SEVERITY_META[issueForm.severity]?.desc}</p>
          </FormField>

          <FormField label="Description" required>
            <textarea className="inp resize-none" rows={4}
              placeholder="Describe the issue in detail — when it happens, how often, any error messages..."
              value={issueForm.description}
              onChange={e => setIssueForm(p => ({ ...p, description: e.target.value }))} />
          </FormField>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="ghost" onClick={() => setShowReport(false)}>Cancel</Button>
          <Button variant="danger" onClick={handleSubmit} loading={submitting} icon={<AlertTriangle size={14} />}>
            Submit Report
          </Button>
        </div>
      </Modal>

      {/* View Issue Modal */}
      {viewIssue && (
        <Modal open={!!viewIssue} onClose={() => setViewIssue(null)} title="Issue Detail" width="max-w-lg">
          <div className="space-y-4">
            {viewIssue.inventory && (
              <div className="flex items-center gap-3 p-3 rounded-xl"
                style={{ background: 'rgba(30,48,88,0.4)', border: '1px solid rgba(30,48,88,0.7)' }}>
                <Monitor size={15} style={{ color: '#3B82F6' }} />
                <div>
                  <div className="text-sm font-semibold" style={{ color: '#F1F5F9' }}>
                    {viewIssue.inventory.brand} {viewIssue.inventory.model_no}
                  </div>
                  <div className="text-xs font-mono" style={{ color: '#475569' }}>{viewIssue.inventory.asset_code}</div>
                </div>
              </div>
            )}
            <div>
              <h3 className="text-base font-semibold mb-2" style={{ color: '#F1F5F9' }}>{viewIssue.title}</h3>
              <div className="flex gap-2">
                <span className={'badge badge-' + viewIssue.severity}>{viewIssue.severity}</span>
                <span className={'badge badge-' + viewIssue.status}>
                  {STATUS_META[viewIssue.status]?.label ?? viewIssue.status}
                </span>
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: '#475569' }}>Description</div>
              <p className="text-sm leading-relaxed" style={{ color: '#94A3B8' }}>{viewIssue.description}</p>
            </div>
            {viewIssue.admin_notes && (
              <div className="p-3.5 rounded-xl"
                style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)' }}>
                <div className="text-xs font-semibold uppercase tracking-wide mb-1.5 flex items-center gap-1.5"
                  style={{ color: '#10B981' }}>
                  <MessageSquare size={12} /> Admin Response
                </div>
                <p className="text-sm leading-relaxed" style={{ color: '#94A3B8' }}>{viewIssue.admin_notes}</p>
              </div>
            )}
            <div className="text-xs" style={{ color: '#334155' }}>
              Reported on {fmtDate(viewIssue.created_at)}
              {viewIssue.resolved_at && ` · Resolved on ${fmtDate(viewIssue.resolved_at)}`}
            </div>
          </div>
          <div className="flex justify-end mt-6">
            <Button variant="ghost" onClick={() => setViewIssue(null)}>Close</Button>
          </div>
        </Modal>
      )}

      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </DashboardLayout>
  );
}
