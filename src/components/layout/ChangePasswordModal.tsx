'use client';

import { useState } from 'react';
import { KeyRound, Eye, EyeOff, X } from 'lucide-react';
import { api } from '@/lib/api';

interface Props {
  onClose: () => void;
}

const FIELDS = [
  { key: 'current_password',      label: 'Current Password',      showKey: 'current' },
  { key: 'password',              label: 'New Password',           showKey: 'next'    },
  { key: 'password_confirmation', label: 'Confirm New Password',   showKey: 'confirm' },
] as const;

export default function ChangePasswordModal({ onClose }: Props) {
  const [form, setForm]     = useState({ current_password: '', password: '', password_confirmation: '' });
  const [show, setShow]     = useState({ current: false, next: false, confirm: false });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg]       = useState<{ text: string; ok: boolean } | null>(null);

  async function handleSubmit() {
    setSaving(true); setMsg(null);
    try {
      await api.auth.changePassword(form);
      setMsg({ text: 'Password changed successfully!', ok: true });
      setForm({ current_password: '', password: '', password_confirmation: '' });
    } catch (e: any) {
      setMsg({ text: e.message || 'Failed to change password', ok: false });
    } finally { setSaving(false); }
  }

  const disabled = saving || !form.current_password || !form.password || !form.password_confirmation;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm sm:rounded-2xl rounded-t-2xl shadow-2xl animate-fade-in"
        style={{ background: '#111827', border: '1px solid #1E3058', maxHeight: '92vh' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #1E3058' }}>
          <h2 className="font-bold text-base flex items-center gap-2"
            style={{ fontFamily: 'Syne, sans-serif', color: '#F1F5F9' }}>
            <KeyRound size={15} style={{ color: '#3B82F6' }} /> Change Password
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors" style={{ color: '#64748B' }}>
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {FIELDS.map(({ key, label, showKey }) => (
            <div key={key}>
              <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: '#64748B' }}>
                {label}
              </label>
              <div className="relative">
                <input
                  className="inp pr-10"
                  type={show[showKey] ? 'text' : 'password'}
                  value={form[key]}
                  onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                  placeholder="••••••••"
                />
                <button type="button"
                  onClick={() => setShow(p => ({ ...p, [showKey]: !p[showKey] }))}
                  className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: '#475569' }}>
                  {show[showKey] ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
          ))}

          {msg && (
            <div className="px-3 py-2 rounded-xl text-sm" style={{
              background: msg.ok ? 'rgba(16,185,129,0.08)' : 'rgba(244,63,94,0.08)',
              border: `1px solid ${msg.ok ? 'rgba(16,185,129,0.25)' : 'rgba(244,63,94,0.25)'}`,
              color: msg.ok ? '#10B981' : '#F43F5E',
            }}>{msg.text}</div>
          )}

          <div className="flex justify-end gap-3 pt-1">
            <button onClick={onClose}
              className="px-4 py-2 rounded-xl text-sm font-semibold transition-all bg-white/5 hover:bg-white/10 border border-white/10"
              style={{ color: '#94A3B8' }}>
              Cancel
            </button>
            <button onClick={handleSubmit} disabled={disabled}
              className="px-4 py-2 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
              style={{ background: '#3B82F6', color: 'white' }}>
              {saving ? 'Saving...' : 'Update Password'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
