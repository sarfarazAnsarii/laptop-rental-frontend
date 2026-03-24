'use client';

import { useEffect, useState, useCallback } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button, Modal, PageHeader, FormField, EmptyState, Toast } from '@/components/ui';
import { api } from '@/lib/api';
import { Users, Plus, Mail, Phone, Building2, Search, Pencil, Trash2 } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

const EMPTY = { name: '', email: '', password: '', password_confirmation: '', role: 'client', phone: '', company: '' };

export default function ClientsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [users,      setUsers]      = useState<any[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState('');
  const [showModal,  setShowModal]  = useState(false);
  const [editUser,   setEditUser]   = useState<any | null>(null);
  const [delUser,    setDelUser]    = useState<any | null>(null);
  const [form,       setForm]       = useState({ ...EMPTY });
  const [saving,     setSaving]     = useState(false);
  const [deleting,   setDeleting]   = useState(false);
  const [toast,      setToast]      = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.users.list({ role: 'client', per_page: '200' });
      setUsers(res.data?.data || res.data || []);
    } catch (e: any) {
      showToast(e.message || 'Failed to load clients', 'error');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  function openAdd() {
    setEditUser(null);
    setForm({ ...EMPTY });
    setShowModal(true);
  }

  function openEdit(u: any) {
    setEditUser(u);
    setForm({ name: u.name || '', email: u.email || '', password: '', password_confirmation: '', role: u.role || 'client', phone: u.phone || '', company: u.company || '' });
    setShowModal(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      if (editUser) {
        const payload: any = { name: form.name, email: form.email, phone: form.phone, company: form.company, role: form.role };
        if (form.password) { payload.password = form.password; payload.password_confirmation = form.password_confirmation; }
        await api.users.update(editUser.id, payload);
        showToast('Client updated successfully');
      } else {
        await api.auth.register(form);
        showToast('Client registered successfully');
      }
      setShowModal(false);
      setForm({ ...EMPTY });
      load();
    } catch (e: any) { showToast(e.message || 'Failed to save', 'error'); }
    finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!delUser) return;
    setDeleting(true);
    try {
      await api.users.delete(delUser.id);
      showToast('Client deleted');
      setDelUser(null);
      load();
    } catch (e: any) { showToast(e.message || 'Failed to delete', 'error'); }
    finally { setDeleting(false); }
  }

  const filtered = users.filter(u =>
    !search ||
    u.name?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase()) ||
    u.company?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <DashboardLayout>
      <PageHeader
        title="Clients"
        subtitle={`${users.length} client${users.length !== 1 ? 's' : ''} registered`}
        action={isAdmin ? <Button icon={<Plus size={15} />} onClick={openAdd}>Add Client</Button> : undefined}
      />

      {/* Search */}
      <div className="mb-5 relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#475569' }} />
        <input
          className="inp pl-9 w-full sm:w-72"
          placeholder="Search by name, email or company…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <div key={i} className="skeleton h-40 rounded-2xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card">
          <EmptyState icon={<Users size={22} />}
            title={search ? 'No clients match your search' : 'No clients yet'}
            desc={search ? 'Try a different search term' : 'Add a client using the button above'} />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(u => (
            <div key={u.id} className="glass-card p-5 hover:border-blue-500/30 transition-all animate-fade-in flex flex-col gap-4">
              {/* Avatar + name */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0"
                    style={{ background: 'linear-gradient(135deg, #3B82F6, #14B8A6)', color: 'white' }}>
                    {u.name?.charAt(0)?.toUpperCase()}
                  </div>
                  <div>
                    <div className="font-semibold text-sm" style={{ color: '#F1F5F9' }}>{u.name}</div>
                    <span className={`badge badge-${u.role}`}>{u.role}</span>
                  </div>
                </div>
                {isAdmin && (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => openEdit(u)}
                      className="p-1.5 rounded-lg transition-colors hover:bg-blue-500/10"
                      style={{ color: '#475569' }} title="Edit">
                      <Pencil size={13} />
                    </button>
                    <button onClick={() => setDelUser(u)}
                      className="p-1.5 rounded-lg transition-colors hover:bg-red-500/10"
                      style={{ color: '#475569' }} title="Delete">
                      <Trash2 size={13} />
                    </button>
                  </div>
                )}
              </div>

              {/* Details */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-xs" style={{ color: '#64748B' }}>
                  <Mail size={12} style={{ flexShrink: 0 }} /><span className="truncate">{u.email}</span>
                </div>
                {u.phone && (
                  <div className="flex items-center gap-2 text-xs" style={{ color: '#64748B' }}>
                    <Phone size={12} style={{ flexShrink: 0 }} /><span>{u.phone}</span>
                  </div>
                )}
                {u.company && (
                  <div className="flex items-center gap-2 text-xs" style={{ color: '#64748B' }}>
                    <Building2 size={12} style={{ flexShrink: 0 }} /><span className="truncate">{u.company}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)}
        title={editUser ? 'Edit Client' : 'Register New Client'}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Full Name" required>
            <input className="inp" value={form.name} onChange={e => f('name', e.target.value)} placeholder="John Doe" />
          </FormField>
          <FormField label="Email" required>
            <input className="inp" type="email" value={form.email} onChange={e => f('email', e.target.value)} placeholder="john@example.com" />
          </FormField>
          <FormField label={editUser ? 'New Password (leave blank to keep)' : 'Password'} required={!editUser}>
            <input className="inp" type="password" value={form.password} onChange={e => f('password', e.target.value)} placeholder="Min 8 chars" />
          </FormField>
          <FormField label="Confirm Password" required={!editUser && !!form.password}>
            <input className="inp" type="password" value={form.password_confirmation} onChange={e => f('password_confirmation', e.target.value)} />
          </FormField>
          <FormField label="Phone">
            <input className="inp" value={form.phone} onChange={e => f('phone', e.target.value)} placeholder="9876543210" />
          </FormField>
          <FormField label="Role">
            <select className="inp" value={form.role} onChange={e => f('role', e.target.value)}>
              <option value="client">Client</option>
            </select>
          </FormField>
          <div className="sm:col-span-2">
            <FormField label="Company">
              <input className="inp" value={form.company} onChange={e => f('company', e.target.value)} placeholder="Company Name" />
            </FormField>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="ghost" onClick={() => setShowModal(false)}>Cancel</Button>
          <Button onClick={handleSave} loading={saving}>{editUser ? 'Save Changes' : 'Register Client'}</Button>
        </div>
      </Modal>

      {/* Delete Confirm Modal */}
      <Modal open={!!delUser} onClose={() => setDelUser(null)} title="Delete Client">
        <p className="text-sm mb-6" style={{ color: '#94A3B8' }}>
          Are you sure you want to delete <span style={{ color: '#F1F5F9', fontWeight: 600 }}>{delUser?.name}</span>? This cannot be undone.
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={() => setDelUser(null)}>Cancel</Button>
          <Button onClick={handleDelete} loading={deleting}
            style={{ background: '#F43F5E', borderColor: '#F43F5E' }}>
            Delete
          </Button>
        </div>
      </Modal>

      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </DashboardLayout>
  );
}
