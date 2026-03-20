'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button, Modal, PageHeader, FormField, EmptyState, Toast } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import {
  Users, Plus, Mail, Phone, Building2, Search,
  Shield, UserCheck, Package, User, Trash2, Edit,
} from 'lucide-react';

const ROLE_OPTIONS = ['', 'admin', 'staff', 'vendor', 'client'];

const ROLE_GRADIENT: Record<string, string> = {
  admin:  'linear-gradient(135deg, #8B5CF6, #6D28D9)',
  staff:  'linear-gradient(135deg, #3B82F6, #1D4ED8)',
  vendor: 'linear-gradient(135deg, #F59E0B, #D97706)',
  client: 'linear-gradient(135deg, #14B8A6, #0D9488)',
};

const ROLE_ICON: Record<string, any> = {
  admin: Shield, staff: UserCheck, vendor: Package, client: User,
};

const EMPTY_FORM = {
  name: '', email: '', password: '', password_confirmation: '',
  role: 'staff', phone: '', company: '',
};

export default function UsersPage() {
  const { user: me } = useAuth();
  const router = useRouter();

  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);

  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);

  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  /* Admin-only guard */
  useEffect(() => {
    if (me && me.role !== 'admin') router.push('/dashboard');
  }, [me, router]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { per_page: '12', page: String(page) };
      if (search) params.search = search;
      if (roleFilter) params.role = roleFilter;
      const res = await api.users.list(params);
      setUsers(res.data?.data || res.data || []);
      setLastPage(res.data?.last_page || 1);
      setTotal(res.data?.total || (res.data?.data?.length ?? 0));
    } finally { setLoading(false); }
  }, [page, search, roleFilter]);

  useEffect(() => { load(); }, [load]);

  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  async function handleAdd() {
    setSaving(true);
    try {
      const res: any = await api.auth.register({
        name: form.name,
        email: form.email,
        password: form.password,
        password_confirmation: form.password_confirmation,
        role: form.role,
        phone: form.phone || undefined,
        company: form.company || undefined,
      });
      // If backend doesn't apply role via register, update silently in background
      const newUserId = res.data?.user?.id ?? res.data?.id;
      if (newUserId && form.role !== 'client') {
        api.users.update(newUserId, {
          role: form.role,
          phone: form.phone || undefined,
          company: form.company || undefined,
        }).catch(() => {});
      }
      showToast('User registered successfully');
      setShowAdd(false);
      setForm({ ...EMPTY_FORM });
      load();
    } catch (e: any) {
      showToast(e.message || 'Failed to register', 'error');
    } finally { setSaving(false); }
  }

  async function handleDelete(u: any) {
    if (!confirm(`Delete user "${u.name}"? This cannot be undone.`)) return;
    try {
      await api.users.delete(u.id);
      showToast('User deleted');
      load();
    } catch (e: any) {
      showToast(e.message || 'Failed to delete', 'error');
    }
  }

  if (me?.role !== 'admin') return null;

  return (
    <DashboardLayout>
      <PageHeader
        title="User Management"
        subtitle={`${me?.role} users`}
        action={<Button icon={<Plus size={15} />} onClick={() => setShowAdd(true)}>Add User</Button>}
      />

      {/* Filters */}
      <div className="glass-card p-4 mb-6 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#475569' }} />
          <input
            className="inp pl-8 w-full"
            placeholder="Search by name or email..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <select className="inp w-40" value={roleFilter} onChange={e => { setRoleFilter(e.target.value); setPage(1); }}>
          {ROLE_OPTIONS.map(r => <option key={r} value={r}>{r || 'All Roles'}</option>)}
        </select>
      </div>

      {/* User Cards */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <div key={i} className="skeleton h-44 rounded-2xl" />)}
        </div>
      ) : users.length === 0 ? (
        <div className="glass-card">
          <EmptyState icon={<Users size={22} />} title="No users found" desc="Try adjusting your search filters or add a new user" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {users.map((u: any) => {
            const RoleIcon = ROLE_ICON[u.role] ?? User;
            return (
              <div key={u.id} className="glass-card p-5 hover:border-blue-500/30 transition-all animate-fade-in">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center font-bold text-base flex-shrink-0"
                      style={{ background: ROLE_GRADIENT[u.role] ?? ROLE_GRADIENT.client, color: 'white' }}>
                      {u.name?.charAt(0)?.toUpperCase()}
                    </div>
                    <div>
                      <div className="font-semibold text-sm" style={{ color: '#F1F5F9' }}>{u.name}</div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <RoleIcon size={10} style={{ color: '#475569' }} />
                        <span className={`badge badge-${u.role}`}>{u.role}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {u.id !== me?.id && (
                      <button
                        onClick={() => handleDelete(u)}
                        className="p-1.5 rounded-lg transition-colors hover:bg-red-500/10"
                        style={{ color: '#475569' }}
                        title="Delete user"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs" style={{ color: '#64748B' }}>
                    <Mail size={11} /><span className="truncate">{u.email}</span>
                  </div>
                  {u.phone && (
                    <div className="flex items-center gap-2 text-xs" style={{ color: '#64748B' }}>
                      <Phone size={11} /><span>{u.phone}</span>
                    </div>
                  )}
                  {u.company && (
                    <div className="flex items-center gap-2 text-xs" style={{ color: '#64748B' }}>
                      <Building2 size={11} /><span className="truncate">{u.company}</span>
                    </div>
                  )}
                </div>

                <div className="mt-3 pt-3 flex items-center justify-between" style={{ borderTop: '1px solid #1E3058' }}>
                  <span className="text-xs font-mono" style={{ color: '#334155' }}>ID #{u.id}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {lastPage > 1 && (
        <div className="flex items-center justify-between mt-6 px-1">
          <span className="text-xs" style={{ color: '#475569' }}>Page {page} of {lastPage}</span>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Prev</Button>
            <Button variant="ghost" size="sm" disabled={page >= lastPage} onClick={() => setPage(p => p + 1)}>Next</Button>
          </div>
        </div>
      )}

      {/* Add User Modal */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Register New User">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Full Name" required>
            <input className="inp" value={form.name} onChange={e => f('name', e.target.value)} placeholder="John Doe" />
          </FormField>
          <FormField label="Email" required>
            <input className="inp" type="email" value={form.email} onChange={e => f('email', e.target.value)} placeholder="john@example.com" />
          </FormField>
          <FormField label="Password" required>
            <input className="inp" type="password" value={form.password} onChange={e => f('password', e.target.value)} placeholder="Min 8 chars" />
          </FormField>
          <FormField label="Confirm Password" required>
            <input className="inp" type="password" value={form.password_confirmation} onChange={e => f('password_confirmation', e.target.value)} />
          </FormField>
          <FormField label="Role">
            <select className="inp" value={form.role} onChange={e => f('role', e.target.value)}>
              <option value="staff">Staff</option>
              <option value="vendor">Vendor</option>
              <option value="admin">Admin</option>
            </select>
          </FormField>
          <FormField label="Phone">
            <input className="inp" value={form.phone} onChange={e => f('phone', e.target.value)} placeholder="9876543210" />
          </FormField>
          <div className="col-span-1 sm:col-span-2">
            <FormField label="Company">
              <input className="inp" value={form.company} onChange={e => f('company', e.target.value)} placeholder="Company Name" />
            </FormField>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="ghost" onClick={() => setShowAdd(false)}>Cancel</Button>
          <Button onClick={handleAdd} loading={saving}>Register User</Button>
        </div>
      </Modal>

      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </DashboardLayout>
  );
}
