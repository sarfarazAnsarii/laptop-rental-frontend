'use client';

import { useEffect, useState, useCallback } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button, Modal, FormField, PageHeader, EmptyState, Toast } from '@/components/ui';
import { api } from '@/lib/api';
import { Inventory } from '@/types';
import {
  Monitor, Search, AlertTriangle, Package,
  Cpu, HardDrive, Database, CheckCircle,
  FileText, AlertCircle, RotateCcw, Zap,
} from 'lucide-react';

const STATUS_OPTIONS = ['', 'available', 'rented', 'maintenance', 'returned', 'sold'];
const SEVERITY_OPTIONS = ['low', 'medium', 'high', 'critical'];

const SEVERITY_META: Record<string, { color: string; label: string; desc: string }> = {
  low:      { color: '#10B981', label: 'Low',      desc: 'Minor issue, not urgent' },
  medium:   { color: '#F59E0B', label: 'Medium',   desc: 'Affects performance' },
  high:     { color: '#F97316', label: 'High',     desc: 'Serious issue, needs attention' },
  critical: { color: '#F43F5E', label: 'Critical', desc: 'Laptop is non-functional' },
};

const STATUS_ICON: Record<string, any> = {
  available:   CheckCircle,
  rented:      FileText,
  maintenance: AlertCircle,
  returned:    RotateCcw,
  sold:        Package,
};

export default function VendorStockPage() {
  const [items,   setItems]   = useState<Inventory[]>([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState('');
  const [status,  setStatus]  = useState('');
  const [page,    setPage]    = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total,   setTotal]   = useState(0);

  // report issue modal
  const [showReport,   setShowReport]   = useState(false);
  const [reportTarget, setReportTarget] = useState<Inventory | null>(null);
  const [issueForm,    setIssueForm]    = useState({
    title: '', description: '', severity: 'medium',
    reporter_name: '', reporter_address: '', reporter_contact: '',
  });
  const [submitting,   setSubmitting]   = useState(false);

  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { per_page: '12', page: String(page) };
      if (search) params.search = search;
      if (status) params.status = status;
      const res = await api.vendor.stock(params);
      console.log(res, "res");
      setItems(res.data?.data || []);
      setLastPage(res.data?.last_page || 1);
      setTotal(res.data?.total || 0);
    } finally { setLoading(false); }
  }, [page, search, status]);

  useEffect(() => { load(); }, [load]);

  function openReport(item: Inventory) {
    setReportTarget(item);
    setIssueForm({ title: '', description: '', severity: 'medium', reporter_name: '', reporter_address: '', reporter_contact: '' });
    setShowReport(true);
  }

  async function handleSubmitIssue() {
    if (!reportTarget) return;
    if (!issueForm.reporter_name.trim() || !issueForm.reporter_contact.trim() || !issueForm.title.trim() || !issueForm.description.trim()) {
      showToast('Name, contact, title and description are required', 'error');
      return;
    }
    setSubmitting(true);
    try {
      await api.issues.create({
        inventory_id:     reportTarget.id,
        title:            issueForm.title,
        description:      issueForm.description,
        severity:         issueForm.severity,
        reporter_name:    issueForm.reporter_name,
        reporter_address: issueForm.reporter_address,
        reporter_contact: issueForm.reporter_contact,
      });
      showToast('Issue reported successfully');
      setShowReport(false);
    } catch (e: any) {
      showToast(e.message || 'Failed to report issue', 'error');
    } finally { setSubmitting(false); }
  }

  /* ── stat counts ── */
  const counts = {
    total:       total,
    available:   items.filter(i => i.status === 'available').length,
    maintenance: items.filter(i => i.status === 'maintenance').length,
    rented:      items.filter(i => i.status === 'rented').length,
  };

  return (
    <DashboardLayout>
      <PageHeader
        title="My Stock"
        subtitle={`${total} laptop${total !== 1 ? 's' : ''} assigned to you`}
        action={
          <Button icon={<AlertTriangle size={15} />} variant="danger" onClick={() => {
            setReportTarget(null);
            setIssueForm({ title: '', description: '', severity: 'high', reporter_name: '', reporter_address: '', reporter_contact: '' });
            setShowReport(true);
          }}>
            Report Issue
          </Button>
        }
      />

      {/* Quick stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Total Assigned', value: counts.total,       color: '#3B82F6', icon: <Package size={16} /> },
          { label: 'Available',      value: counts.available,   color: '#10B981', icon: <CheckCircle size={16} /> },
          { label: 'Currently Rented',value: counts.rented,     color: '#14B8A6', icon: <FileText size={16} /> },
          { label: 'Under Maintenance',value: counts.maintenance,color: '#F59E0B', icon: <AlertCircle size={16} /> },
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
      <div className="glass-card p-4 mb-5 flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#475569' }} />
          <input className="inp pl-9" placeholder="Search asset code, brand, model..."
            value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <select className="inp w-44" value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}>
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s || 'All Status'}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            {[...Array(6)].map((_, i) => <div key={i} className="skeleton h-14 rounded-xl" />)}
          </div>
        ) : items.length === 0 ? (
          <EmptyState icon={<Monitor size={22} />} title="No laptops found"
            desc="No laptops are currently assigned to your vendor account" />
        ) : (
          <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Asset Code</th>
                <th>Brand / Model</th>
                <th className="hidden md:table-cell">Specs</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => {
                const SIcon = STATUS_ICON[item.status] || Package;
                const statusColors: Record<string, string> = {
                  available: '#10B981', rented: '#3B82F6', maintenance: '#F59E0B',
                  returned: '#A78BFA', sold: '#94A3B8',
                };
                const sc = statusColors[item.status] || '#94A3B8';
                return (
                  <tr key={item.id} className="animate-fade-in">
                    <td>
                      <span className="font-mono text-xs font-semibold px-2 py-1 rounded-lg"
                        style={{ background: 'rgba(59,130,246,0.1)', color: '#3B82F6', border: '1px solid rgba(59,130,246,0.2)' }}>
                        {item.asset_code}
                      </span>
                    </td>
                    <td>
                      <div className="font-medium text-sm" style={{ color: '#F1F5F9' }}>{item.brand}</div>
                      <div className="text-xs" style={{ color: '#475569' }}>{item.model_no}</div>
                    </td>
                    <td className="hidden md:table-cell">
                      <div className="text-xs space-y-0.5">
                        <div className="flex items-center gap-1">
                          <Cpu size={11} style={{ color: '#475569' }} />
                          <span style={{ color: '#94A3B8' }}>{item.cpu}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="flex items-center gap-1">
                            <Database size={11} style={{ color: '#475569' }} />
                            <span style={{ color: '#64748B' }}>{item.ram}</span>
                          </span>
                          <span className="flex items-center gap-1">
                            <HardDrive size={11} style={{ color: '#475569' }} />
                            <span style={{ color: '#64748B' }}>{item.ssd}</span>
                          </span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center gap-1.5">
                        <SIcon size={13} style={{ color: sc }} />
                        <span className={'badge badge-' + item.status}>{item.status}</span>
                      </div>
                    </td>
                    <td>
                      <Button
                        variant="danger"
                        size="sm"
                        icon={<AlertTriangle size={12} />}
                        onClick={() => openReport(item)}
                      >
                        Report Issue
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
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
      <Modal open={showReport} onClose={() => setShowReport(false)} title="Report an Issue" width="max-w-xl">

        {/* laptop selector or selected laptop */}
        {reportTarget ? (
          <div className="mb-4 flex items-center gap-3 px-4 py-3 rounded-xl"
            style={{ background: 'rgba(59,130,246,0.07)', border: '1px solid rgba(59,130,246,0.2)' }}>
            <Monitor size={15} style={{ color: '#3B82F6' }} />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold" style={{ color: '#F1F5F9' }}>
                {reportTarget.brand} {reportTarget.model_no}
              </div>
              <div className="text-xs font-mono" style={{ color: '#475569' }}>{reportTarget.asset_code}</div>
            </div>
            <button onClick={() => setReportTarget(null)}
              className="text-xs px-2 py-1 rounded-lg transition-colors hover:bg-white/10"
              style={{ color: '#64748B' }}>
              Change
            </button>
          </div>
        ) : (
          <FormField label="Select Laptop" required>
            <select className="inp mb-4" value="" onChange={e => {
              const found = items.find(i => String(i.id) === e.target.value);
              if (found) setReportTarget(found);
            }}>
              <option value="">— Pick a laptop —</option>
              {items.map(i => (
                <option key={i.id} value={i.id}>
                  {i.asset_code} — {i.brand} {i.model_no}
                </option>
              ))}
            </select>
          </FormField>
        )}

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Your Name" required>
              <input className="inp" placeholder="Full name"
                value={issueForm.reporter_name} onChange={e => setIssueForm(p => ({ ...p, reporter_name: e.target.value }))} />
            </FormField>
            <FormField label="Contact Number" required>
              <input className="inp" placeholder="9876543210"
                value={issueForm.reporter_contact} onChange={e => setIssueForm(p => ({ ...p, reporter_contact: e.target.value }))} />
            </FormField>
          </div>
          <FormField label="Address">
            <input className="inp" placeholder="Street, City, State"
              value={issueForm.reporter_address} onChange={e => setIssueForm(p => ({ ...p, reporter_address: e.target.value }))} />
          </FormField>

          <FormField label="Issue Title" required>
            <input className="inp" placeholder="e.g. Screen flickering, Battery draining fast..."
              value={issueForm.title} onChange={e => setIssueForm(p => ({ ...p, title: e.target.value }))} />
          </FormField>

          <FormField label="Severity" required>
            <div className="grid grid-cols-4 gap-2">
              {SEVERITY_OPTIONS.map(sev => {
                const m = SEVERITY_META[sev];
                const active = issueForm.severity === sev;
                return (
                  <button key={sev} type="button"
                    onClick={() => setIssueForm(p => ({ ...p, severity: sev }))}
                    className="py-2 px-2 rounded-xl text-xs font-semibold transition-all text-center"
                    style={{
                      background: active ? `${m.color}18` : 'rgba(30,48,88,0.4)',
                      border:     active ? `2px solid ${m.color}60` : '1px solid rgba(30,48,88,0.7)',
                      color:      active ? m.color : '#475569',
                    }}>
                    {m.label}
                  </button>
                );
              })}
            </div>
            <p className="mt-1.5 text-xs" style={{ color: '#475569' }}>
              {SEVERITY_META[issueForm.severity]?.desc}
            </p>
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
          <Button variant="danger" onClick={handleSubmitIssue} loading={submitting}
            icon={<AlertTriangle size={14} />}>
            Submit Report
          </Button>
        </div>
      </Modal>

      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </DashboardLayout>
  );
}
