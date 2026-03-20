'use client';

import { useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/ui';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { User, Mail, Phone, Building2, Shield, Eye, EyeOff, KeyRound, CheckCircle2, AlertCircle } from 'lucide-react';

const ROLE_GRADIENT: Record<string, string> = {
  admin:  'linear-gradient(135deg, #8B5CF6, #6D28D9)',
  staff:  'linear-gradient(135deg, #3B82F6, #1D4ED8)',
  vendor: 'linear-gradient(135deg, #F59E0B, #D97706)',
  client: 'linear-gradient(135deg, #14B8A6, #0D9488)',
};

const EMPTY_PWD = { current_password: '', password: '', password_confirmation: '' };

const PWD_FIELDS = [
  { key: 'current_password'      as const, label: 'Current Password'   },
  { key: 'password'              as const, label: 'New Password'        },
  { key: 'password_confirmation' as const, label: 'Confirm New Password'},
];

export default function ProfilePage() {
  const { user } = useAuth();

  const [form, setForm]     = useState({ ...EMPTY_PWD });
  const [show, setShow]     = useState({ current_password: false, password: false, password_confirmation: false });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg]       = useState<{ text: string; ok: boolean } | null>(null);

  async function handleChangePwd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setMsg(null);
    try {
      await api.auth.changePassword(form);
      setMsg({ text: 'Password changed successfully!', ok: true });
      setForm({ ...EMPTY_PWD });
    } catch (err: any) {
      setMsg({ text: err.message || 'Failed to change password', ok: false });
    } finally { setSaving(false); }
  }

  if (!user) return null;

  return (
    <DashboardLayout>
      <PageHeader title="My Profile" subtitle="Account details and security settings" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Profile Card ── */}
        <div className="lg:col-span-1 glass-card p-6 flex flex-col items-center text-center">
          {/* Avatar */}
          <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-3xl font-bold mb-4"
            style={{ background: ROLE_GRADIENT[user.role] ?? ROLE_GRADIENT.admin, color: 'white', boxShadow: '0 8px 32px rgba(59,130,246,0.25)' }}>
            {user.name.charAt(0).toUpperCase()}
          </div>

          <h2 className="text-lg font-bold mb-1" style={{ fontFamily: 'Syne, sans-serif', color: '#F1F5F9' }}>{user.name}</h2>
          <span className={'badge badge-' + user.role + ' mb-4'}>{user.role}</span>

          {/* Info rows */}
          <div className="w-full space-y-3 text-left">
            <InfoRow icon={<Mail size={14} />}     label="Email"   value={user.email} />
            {user.phone   && <InfoRow icon={<Phone size={14} />}    label="Phone"   value={user.phone} />}
            {user.company && <InfoRow icon={<Building2 size={14} />} label="Company" value={user.company} />}
            <InfoRow icon={<Shield size={14} />}   label="Role"    value={user.role.charAt(0).toUpperCase() + user.role.slice(1)} accent />
          </div>
        </div>

        {/* ── Change Password ── */}
        <div className="lg:col-span-2 glass-card p-6">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.2)' }}>
              <KeyRound size={15} style={{ color: '#3B82F6' }} />
            </div>
            <div>
              <h3 className="font-bold text-sm" style={{ fontFamily: 'Syne, sans-serif', color: '#F1F5F9' }}>Change Password</h3>
              <p className="text-xs" style={{ color: '#64748B' }}>Update your account password</p>
            </div>
          </div>

          <form onSubmit={handleChangePwd} className="space-y-4 max-w-md">
            {PWD_FIELDS.map(({ key, label }) => (
              <div key={key}>
                <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: '#64748B' }}>
                  {label}
                </label>
                <div className="relative">
                  <input
                    className="inp pr-10"
                    type={show[key] ? 'text' : 'password'}
                    value={form[key]}
                    onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                    placeholder="••••••••"
                    required
                  />
                  <button type="button"
                    onClick={() => setShow(p => ({ ...p, [key]: !p[key] }))}
                    className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                    style={{ color: '#475569' }}>
                    {show[key] ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
            ))}

            {msg && (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm" style={{
                background: msg.ok ? 'rgba(16,185,129,0.08)' : 'rgba(244,63,94,0.08)',
                border: `1px solid ${msg.ok ? 'rgba(16,185,129,0.25)' : 'rgba(244,63,94,0.25)'}`,
                color: msg.ok ? '#10B981' : '#F43F5E',
              }}>
                {msg.ok ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                {msg.text}
              </div>
            )}

            <div className="pt-1">
              <button type="submit"
                disabled={saving || !form.current_password || !form.password || !form.password_confirmation}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
                style={{ background: '#3B82F6', color: 'white', boxShadow: '0 4px 16px rgba(59,130,246,0.25)' }}>
                {saving ? 'Updating...' : 'Update Password'}
              </button>
            </div>
          </form>
        </div>

      </div>
    </DashboardLayout>
  );
}

function InfoRow({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-start gap-2.5 py-2 px-3 rounded-xl" style={{ background: 'rgba(30,48,88,0.3)' }}>
      <span className="mt-0.5 flex-shrink-0" style={{ color: '#475569' }}>{icon}</span>
      <div className="min-w-0">
        <div className="text-xs mb-0.5" style={{ color: '#475569' }}>{label}</div>
        <div className="text-sm font-medium truncate" style={{ color: accent ? '#3B82F6' : '#F1F5F9' }}>{value}</div>
      </div>
    </div>
  );
}
