'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button, Modal, PageHeader, FormField, EmptyState, Toast } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import {
  Users, Plus, Mail, Phone, Building2, Search,
  Shield, UserCheck, Package, User, Trash2, MapPin, Edit,
  CreditCard, Clock,
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
  role: 'staff', phone: '', company: '', address: '', payment_type: 'advance',
  gst_number: '', hsn_code: '',
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

  const [editUser, setEditUser] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({ name: '', phone: '', company: '', address: '', role: '', payment_type: 'advance', gst_number: '', hsn_code: '' });
  const [updating, setUpdating] = useState(false);

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
        address: form.address || undefined,
        payment_type: form.role === 'client' ? form.payment_type : undefined,
        gst_number:   form.role === 'client' ? form.gst_number  || undefined : undefined,
        hsn_code:     form.role === 'client' ? form.hsn_code    || undefined : undefined,
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

  function openEdit(u: any) {
    setEditUser(u);
    setEditForm({ name: u.name || '', phone: u.phone || '', company: u.company || '', address: u.address || '', role: u.role || 'staff', payment_type: u.payment_type || 'advance', gst_number: u.gst_number || '', hsn_code: u.hsn_code || '' });
  }

  async function handleUpdate() {
    if (!editUser) return;
    setUpdating(true);
    try {
      await api.users.update(editUser.id, {
        name:         editForm.name         || undefined,
        phone:        editForm.phone        || undefined,
        company:      editForm.company      || undefined,
        address:      editForm.address      || undefined,
        role:         editForm.role         || undefined,
        payment_type: editForm.role === 'client' ? editForm.payment_type : undefined,
        gst_number:   editForm.role === 'client' ? editForm.gst_number  || undefined : undefined,
        hsn_code:     editForm.role === 'client' ? editForm.hsn_code    || undefined : undefined,
      });
      showToast('User updated successfully');
      setEditUser(null);
      load();
    } catch (e: any) {
      showToast(e.message || 'Failed to update', 'error');
    } finally { setUpdating(false); }
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
                    <button
                      onClick={() => openEdit(u)}
                      className="p-1.5 rounded-lg transition-colors hover:bg-blue-500/10"
                      style={{ color: '#475569' }}
                      title="Edit user"
                    >
                      <Edit size={13} />
                    </button>
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
                  {u.address && (
                    <div className="flex items-center gap-2 text-xs" style={{ color: '#64748B' }}>
                      <MapPin size={11} /><span className="truncate">{u.address}</span>
                    </div>
                  )}
                  {u.role === 'client' && u.gst_number && (
                    <div className="flex items-center gap-2 text-xs" style={{ color: '#64748B' }}>
                      <span className="font-mono text-[10px] px-1.5 py-0.5 rounded font-semibold" style={{ background: 'rgba(59,130,246,0.08)', color: '#3B82F6' }}>GST</span>
                      <span className="font-mono">{u.gst_number}</span>
                      {u.hsn_code && <><span style={{ color: '#1E3058' }}>·</span><span className="font-mono text-[10px] px-1.5 py-0.5 rounded font-semibold" style={{ background: 'rgba(139,92,246,0.08)', color: '#A78BFA' }}>HSN</span><span className="font-mono">{u.hsn_code}</span></>}
                    </div>
                  )}
                </div>

                <div className="mt-3 pt-3 flex items-center justify-between" style={{ borderTop: '1px solid #1E3058' }}>
                  <span className="text-xs font-mono" style={{ color: '#334155' }}>ID #{u.id}</span>
                  {u.role === 'client' && (
                    <span className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-lg"
                      style={u.payment_type === 'postpaid'
                        ? { background: 'rgba(245,158,11,0.1)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.25)' }
                        : { background: 'rgba(16,185,129,0.1)', color: '#10B981', border: '1px solid rgba(16,185,129,0.25)' }}>
                      {u.payment_type === 'postpaid' ? <><Clock size={10} /> Postpaid</> : <><CreditCard size={10} /> Advance</>}
                    </span>
                  )}
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
              <option value="client">Client</option>
              <option value="admin">Admin</option>
            </select>
          </FormField>
          <FormField label="Phone">
            <input className="inp" value={form.phone} onChange={e => f('phone', e.target.value)} placeholder="9876543210" />
          </FormField>
          {form.role === 'client' && (
            <div className="col-span-1 sm:col-span-2">
              <div className="text-xs font-semibold mb-2" style={{ color: '#64748B' }}>Payment Type <span style={{ color: '#F43F5E' }}>*</span></div>
              <div className="grid grid-cols-2 gap-3">
                {([
                  { value: 'advance',  label: 'Advance',  sub: 'Pays before the month starts', Icon: CreditCard, active: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.4)', text: '#10B981' },
                  { value: 'postpaid', label: 'Postpaid', sub: 'Pays after month completes',    Icon: Clock,       active: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.4)', text: '#F59E0B' },
                ] as const).map(opt => {
                  const selected = form.payment_type === opt.value;
                  return (
                    <button key={opt.value} type="button" onClick={() => f('payment_type', opt.value)}
                      className="flex items-start gap-3 p-3 rounded-xl text-left transition-all"
                      style={{
                        background: selected ? opt.active : 'rgba(30,48,88,0.25)',
                        border: `2px solid ${selected ? opt.border : 'rgba(30,48,88,0.6)'}`,
                      }}>
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                        style={{ background: selected ? opt.active : 'rgba(30,48,88,0.5)' }}>
                        <opt.Icon size={15} style={{ color: selected ? opt.text : '#475569' }} />
                      </div>
                      <div>
                        <div className="text-sm font-semibold" style={{ color: selected ? opt.text : '#F1F5F9' }}>{opt.label}</div>
                        <div className="text-xs mt-0.5" style={{ color: '#475569' }}>{opt.sub}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {form.role === 'client' && (
            <>
              <FormField label="GST Number">
                <input className="inp" value={form.gst_number} onChange={e => f('gst_number', e.target.value)} placeholder="22AAAAA0000A1Z5" style={{ textTransform: 'uppercase' }} />
              </FormField>
              <FormField label="HSN Code">
                <input className="inp" value={form.hsn_code} onChange={e => f('hsn_code', e.target.value)} placeholder="8471" />
              </FormField>
            </>
          )}
          <div className="col-span-1 sm:col-span-2">
            <FormField label="Company">
              <input className="inp" value={form.company} onChange={e => f('company', e.target.value)} placeholder="Company Name" />
            </FormField>
          </div>
          <div className="col-span-1 sm:col-span-2">
            <FormField label="Address">
              <textarea
                className="inp resize-none"
                rows={3}
                value={form.address}
                onChange={e => f('address', e.target.value)}
                placeholder="Street, Area, City, State, Pincode"
              />
            </FormField>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="ghost" onClick={() => setShowAdd(false)}>Cancel</Button>
          <Button onClick={handleAdd} loading={saving}>Register User</Button>
        </div>
      </Modal>

      {/* Edit User Modal */}
      <Modal open={!!editUser} onClose={() => setEditUser(null)} title={`Edit — ${editUser?.name}`}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Full Name" required>
            <input className="inp" value={editForm.name} onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))} placeholder="John Doe" />
          </FormField>
          <FormField label="Phone">
            <input className="inp" value={editForm.phone} onChange={e => setEditForm(p => ({ ...p, phone: e.target.value }))} placeholder="9876543210" />
          </FormField>
          <FormField label="Role">
            <select className="inp" value={editForm.role} onChange={e => setEditForm(p => ({ ...p, role: e.target.value }))}>
              <option value="staff">Staff</option>
              <option value="vendor">Vendor</option>
              <option value="client">Client</option>
              <option value="admin">Admin</option>
            </select>
          </FormField>
          <FormField label="Company">
            <input className="inp" value={editForm.company} onChange={e => setEditForm(p => ({ ...p, company: e.target.value }))} placeholder="Company Name" />
          </FormField>
          {editForm.role === 'client' && (
            <div className="col-span-1 sm:col-span-2">
              <div className="text-xs font-semibold mb-2" style={{ color: '#64748B' }}>Payment Type</div>
              <div className="grid grid-cols-2 gap-3">
                {([
                  { value: 'advance',  label: 'Advance',  sub: 'Pays before the month starts', Icon: CreditCard, active: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.4)', text: '#10B981' },
                  { value: 'postpaid', label: 'Postpaid', sub: 'Pays after month completes',    Icon: Clock,       active: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.4)', text: '#F59E0B' },
                ] as const).map(opt => {
                  const selected = editForm.payment_type === opt.value;
                  return (
                    <button key={opt.value} type="button"
                      onClick={() => setEditForm(p => ({ ...p, payment_type: opt.value }))}
                      className="flex items-start gap-3 p-3 rounded-xl text-left transition-all"
                      style={{
                        background: selected ? opt.active : 'rgba(30,48,88,0.25)',
                        border: `2px solid ${selected ? opt.border : 'rgba(30,48,88,0.6)'}`,
                      }}>
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                        style={{ background: selected ? opt.active : 'rgba(30,48,88,0.5)' }}>
                        <opt.Icon size={15} style={{ color: selected ? opt.text : '#475569' }} />
                      </div>
                      <div>
                        <div className="text-sm font-semibold" style={{ color: selected ? opt.text : '#F1F5F9' }}>{opt.label}</div>
                        <div className="text-xs mt-0.5" style={{ color: '#475569' }}>{opt.sub}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {editForm.role === 'client' && (
            <>
              <FormField label="GST Number">
                <input className="inp" value={editForm.gst_number} onChange={e => setEditForm(p => ({ ...p, gst_number: e.target.value }))} placeholder="22AAAAA0000A1Z5" style={{ textTransform: 'uppercase' }} />
              </FormField>
              <FormField label="HSN Code">
                <input className="inp" value={editForm.hsn_code} onChange={e => setEditForm(p => ({ ...p, hsn_code: e.target.value }))} placeholder="8471" />
              </FormField>
            </>
          )}
          <div className="col-span-1 sm:col-span-2">
            <FormField label="Address">
              <textarea className="inp resize-none" rows={3} value={editForm.address} onChange={e => setEditForm(p => ({ ...p, address: e.target.value }))} placeholder="Street, Area, City, State, Pincode" />
            </FormField>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="ghost" onClick={() => setEditUser(null)}>Cancel</Button>
          <Button onClick={handleUpdate} loading={updating}>Save Changes</Button>
        </div>
      </Modal>

      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </DashboardLayout>
  );
}
