'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Plus, Eye, Trash2, Search, CalendarDays, Receipt } from 'lucide-react';

const fmtDate = (d?: string) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
const fmtAmt = (n: any) =>
  Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function EventInvoicesPage() {
  const router = useRouter();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState('');
  const [deleting, setDeleting] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.eventInvoices.list({ per_page: '100' });
      const data = res.data?.data || res.data || [];
      setInvoices(Array.isArray(data) ? data : []);
    } catch { setInvoices([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = invoices.filter(inv => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      inv.invoice_record?.formatted_number?.toLowerCase().includes(q) ||
      inv.client?.name?.toLowerCase().includes(q) ||
      inv.client?.company?.toLowerCase().includes(q) ||
      inv.event_name?.toLowerCase().includes(q)
    );
  });

  async function handleDelete(id: number) {
    if (!confirm('Delete this event invoice?')) return;
    setDeleting(id);
    try {
      await api.eventInvoices.delete(id);
      setInvoices(prev => prev.filter(i => i.id !== id));
    } catch (e: any) {
      alert(e.message || 'Delete failed');
    } finally { setDeleting(null); }
  }

  return (
    <div style={{ padding: '24px 28px', fontFamily: 'Inter, sans-serif' }}>
      {/* Header */}
      <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:24 }}>
        <div>
          <h1 style={{ fontSize:22,fontWeight:800,color:'#0F172A',margin:0 }}>Event Invoices</h1>
          <p style={{ color:'#64748B',fontSize:13,marginTop:2 }}>One-time invoices not tied to rental billing cycles</p>
        </div>
        <button
          onClick={() => router.push('/invoices/event/new')}
          style={{ display:'flex',alignItems:'center',gap:7,background:'#3B82F6',color:'white',border:'none',borderRadius:10,padding:'10px 20px',fontSize:13,fontWeight:700,cursor:'pointer' }}>
          <Plus size={15} /> New Event Invoice
        </button>
      </div>

      {/* Search */}
      <div style={{ position:'relative',maxWidth:380,marginBottom:20 }}>
        <Search size={14} style={{ position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',color:'#94A3B8' }} />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by number, client, event..."
          style={{ width:'100%',paddingLeft:36,paddingRight:12,paddingTop:9,paddingBottom:9,border:'1px solid #E2E8F0',borderRadius:9,fontSize:13,color:'#0F172A',outline:'none',boxSizing:'border-box' }}
        />
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ padding:40,textAlign:'center',color:'#94A3B8',fontSize:14 }}>Loading...</div>
      ) : filtered.length === 0 ? (
        <div style={{ padding:60,textAlign:'center',color:'#94A3B8' }}>
          <Receipt size={40} style={{ marginBottom:12,opacity:0.3 }} />
          <div style={{ fontSize:15,fontWeight:600 }}>No event invoices found</div>
          <div style={{ fontSize:13,marginTop:4 }}>Create one using the button above</div>
        </div>
      ) : (
        <div style={{ background:'white',borderRadius:14,border:'1px solid #E2E8F0',overflow:'hidden' }}>
          <table style={{ width:'100%',borderCollapse:'collapse' }}>
            <thead>
              <tr style={{ background:'#F8FAFC',borderBottom:'1px solid #E2E8F0' }}>
                <th style={{ padding:'11px 16px',textAlign:'left',fontSize:12,fontWeight:700,color:'#64748B',textTransform:'uppercase',letterSpacing:'0.05em' }}>Invoice No</th>
                <th style={{ padding:'11px 16px',textAlign:'left',fontSize:12,fontWeight:700,color:'#64748B',textTransform:'uppercase',letterSpacing:'0.05em' }}>Client</th>
                <th style={{ padding:'11px 16px',textAlign:'left',fontSize:12,fontWeight:700,color:'#64748B',textTransform:'uppercase',letterSpacing:'0.05em' }}>Event</th>
                <th style={{ padding:'11px 16px',textAlign:'left',fontSize:12,fontWeight:700,color:'#64748B',textTransform:'uppercase',letterSpacing:'0.05em' }}>Date</th>
                <th style={{ padding:'11px 16px',textAlign:'right',fontSize:12,fontWeight:700,color:'#64748B',textTransform:'uppercase',letterSpacing:'0.05em' }}>Grand Total</th>
                <th style={{ padding:'11px 16px',textAlign:'center',fontSize:12,fontWeight:700,color:'#64748B',textTransform:'uppercase',letterSpacing:'0.05em' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((inv, idx) => (
                <tr key={inv.id} style={{ borderBottom: idx < filtered.length - 1 ? '1px solid #F1F5F9' : 'none', background: 'white' }}>
                  <td style={{ padding:'13px 16px' }}>
                    <span style={{ fontWeight:700,color:'#1E40AF',fontSize:13 }}>
                      {inv.invoice_record?.formatted_number || `EI-${inv.id}`}
                    </span>
                  </td>
                  <td style={{ padding:'13px 16px' }}>
                    <div style={{ fontWeight:600,fontSize:13,color:'#0F172A' }}>{inv.client?.company || inv.client?.name || '—'}</div>
                    {inv.client?.company && inv.client?.name && (
                      <div style={{ fontSize:11,color:'#94A3B8' }}>{inv.client.name}</div>
                    )}
                  </td>
                  <td style={{ padding:'13px 16px',fontSize:13,color:'#334155' }}>
                    {inv.event_name || <span style={{ color:'#CBD5E1' }}>—</span>}
                  </td>
                  <td style={{ padding:'13px 16px' }}>
                    <div style={{ display:'flex',alignItems:'center',gap:5,fontSize:12,color:'#64748B' }}>
                      <CalendarDays size={12} />
                      {fmtDate(inv.event_date)}
                    </div>
                  </td>
                  <td style={{ padding:'13px 16px',textAlign:'right',fontWeight:700,fontSize:13,color:'#0F172A' }}>
                    ₹{fmtAmt(inv.grand_total)}
                  </td>
                  <td style={{ padding:'13px 16px',textAlign:'center' }}>
                    <div style={{ display:'flex',alignItems:'center',justifyContent:'center',gap:8 }}>
                      <button
                        onClick={() => router.push(`/invoices/event/${inv.id}`)}
                        style={{ display:'flex',alignItems:'center',gap:5,background:'#EFF6FF',color:'#3B82F6',border:'none',borderRadius:7,padding:'6px 12px',fontSize:12,fontWeight:600,cursor:'pointer' }}>
                        <Eye size={13} /> View
                      </button>
                      <button
                        onClick={() => handleDelete(inv.id)}
                        disabled={deleting === inv.id}
                        style={{ display:'flex',alignItems:'center',gap:5,background:'#FEF2F2',color:'#EF4444',border:'none',borderRadius:7,padding:'6px 12px',fontSize:12,fontWeight:600,cursor:'pointer',opacity:deleting===inv.id?0.5:1 }}>
                        <Trash2 size={13} /> {deleting === inv.id ? '…' : 'Delete'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
