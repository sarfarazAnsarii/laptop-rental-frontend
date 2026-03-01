'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button, Modal, PageHeader, FormField, EmptyState, Toast } from '@/components/ui';
import { api } from '@/lib/api';
import { Users, Plus, Mail, Phone, Building2 } from 'lucide-react';

const EMPTY = { name: '', email: '', password: '', password_confirmation: '', role: 'client', phone: '', company: '' };

export default function ClientsPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Fetch clients via rental list (get unique clients)
  const load = async () => {
    setLoading(true);
    try {
      const res = await api.rentals.list({ per_page: '100' });
      const rentals = res.data?.data || [];
      const map = new Map();
      rentals.forEach((r: any) => { if (r.client) map.set(r.client.id, r.client); });
      setUsers(Array.from(map.values()));
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  async function handleSave() {
    setSaving(true);
    try {
      await api.auth.register(form);
      showToast('User registered successfully');
      setShowModal(false);
      setForm({ ...EMPTY });
      load();
    } catch (e: any) { showToast(e.message || 'Failed', 'error'); }
    finally { setSaving(false); }
  }

  return (
    <DashboardLayout>
      <PageHeader
        title="Clients"
        subtitle="Manage client and staff accounts"
        action={<Button icon={<Plus size={15} />} onClick={() => setShowModal(true)}>Add User</Button>}
      />

      {loading ? (
        <div className="grid grid-cols-3 gap-4">{[...Array(6)].map((_, i) => <div key={i} className="skeleton h-36 rounded-2xl" />)}</div>
      ) : users.length === 0 ? (
        <div className="glass-card">
          <EmptyState icon={<Users size={22} />} title="No clients yet" desc="Clients appear here after you create rentals for them" />
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {users.map(u => (
            <div key={u.id} className="glass-card p-5 hover:border-blue-500/30 transition-all animate-fade-in">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm"
                  style={{ background: 'linear-gradient(135deg, #3B82F6, #14B8A6)', color: 'white' }}>
                  {u.name?.charAt(0)?.toUpperCase()}
                </div>
                <div>
                  <div className="font-semibold text-sm" style={{ color: '#F1F5F9' }}>{u.name}</div>
                  <span className={`badge badge-${u.role}`}>{u.role}</span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs" style={{ color: '#64748B' }}>
                  <Mail size={12} /><span>{u.email}</span>
                </div>
                {u.phone && <div className="flex items-center gap-2 text-xs" style={{ color: '#64748B' }}><Phone size={12} /><span>{u.phone}</span></div>}
                {u.company && <div className="flex items-center gap-2 text-xs" style={{ color: '#64748B' }}><Building2 size={12} /><span>{u.company}</span></div>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Register Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title="Register New User">
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Full Name" required><input className="inp" value={form.name} onChange={e => f('name', e.target.value)} placeholder="John Doe" /></FormField>
          <FormField label="Email" required><input className="inp" type="email" value={form.email} onChange={e => f('email', e.target.value)} placeholder="john@example.com" /></FormField>
          <FormField label="Password" required><input className="inp" type="password" value={form.password} onChange={e => f('password', e.target.value)} placeholder="Min 8 chars" /></FormField>
          <FormField label="Confirm Password" required><input className="inp" type="password" value={form.password_confirmation} onChange={e => f('password_confirmation', e.target.value)} /></FormField>
          <FormField label="Role">
            <select className="inp" value={form.role} onChange={e => f('role', e.target.value)}>
              <option value="client">Client</option>
              <option value="staff">Staff</option>
              <option value="admin">Admin</option>
            </select>
          </FormField>
          <FormField label="Phone"><input className="inp" value={form.phone} onChange={e => f('phone', e.target.value)} placeholder="9876543210" /></FormField>
          <div className="col-span-2">
            <FormField label="Company"><input className="inp" value={form.company} onChange={e => f('company', e.target.value)} placeholder="Company Name" /></FormField>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="ghost" onClick={() => setShowModal(false)}>Cancel</Button>
          <Button onClick={handleSave} loading={saving}>Register User</Button>
        </div>
      </Modal>

      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </DashboardLayout>
  );
}
