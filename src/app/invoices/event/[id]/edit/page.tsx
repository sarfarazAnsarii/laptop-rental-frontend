'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Plus, Trash2, ArrowLeft, Save } from 'lucide-react';

interface LineItem {
  description: string;
  qty: string;
  rate: string;
}

export default function EditEventInvoicePage() {
  const params  = useParams();
  const router  = useRouter();
  const id      = Number(params.id);

  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState('');

  const [eventName, setEventName] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [gstPct,    setGstPct]    = useState('18');
  const [notes,     setNotes]     = useState('');
  const [items,     setItems]     = useState<LineItem[]>([{ description: '', qty: '1', rate: '' }]);
  const [docNo,     setDocNo]     = useState('');
  const [clientName, setClientName] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await api.eventInvoices.get(id);
      const inv = res.data;
      setEventName(inv.event_name || '');
      setEventDate(inv.event_date?.slice(0, 10) || '');
      setGstPct(String(inv.gst_percent ?? 18));
      setNotes(inv.notes || '');
      setItems((inv.items || []).map((it: any) => ({
        description: it.description,
        qty:  String(it.qty),
        rate: String(it.rate),
      })));
      setDocNo(inv.invoice_record?.formatted_number || `EI-${inv.id}`);
      setClientName(inv.client?.company || inv.client?.name || '');
    } catch { router.push('/invoices/event'); }
    finally  { setLoading(false); }
  }, [id, router]);

  useEffect(() => { load(); }, [load]);

  function updateItem(idx: number, field: keyof LineItem, value: string) {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it));
  }
  function addItem()          { setItems(prev => [...prev, { description: '', qty: '1', rate: '' }]); }
  function removeItem(idx: number) { setItems(prev => prev.filter((_, i) => i !== idx)); }

  const parsedItems = items.map(it => ({
    description: it.description,
    qty:  parseFloat(it.qty)  || 0,
    rate: parseFloat(it.rate) || 0,
  }));
  const subTotal   = parsedItems.reduce((s, it) => s + it.qty * it.rate, 0);
  const gst        = parseFloat(gstPct) || 0;
  const halfPct    = gst / 2;
  const gstAmt     = +(subTotal * gst / 100).toFixed(2);
  const grandTotal = +(subTotal + gstAmt).toFixed(2);

  const fmtAmt = (n: number) =>
    n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const hasValid = parsedItems.some(it => it.description && it.qty > 0 && it.rate > 0);
    if (!hasValid) { setError('Add at least one valid line item.'); return; }

    setSaving(true);
    try {
      await api.eventInvoices.update(id, {
        event_name:  eventName || undefined,
        event_date:  eventDate || undefined,
        gst_percent: gst,
        notes:       notes || undefined,
        items:       parsedItems.filter(it => it.description && it.qty > 0 && it.rate > 0),
      });
      router.push(`/invoices/event/${id}`);
    } catch (e: any) {
      setError(e.message || 'Failed to update invoice');
      setSaving(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '9px 12px', border: '1px solid #E2E8F0',
    borderRadius: 8, fontSize: 13, color: '#0F172A', outline: 'none', boxSizing: 'border-box',
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#94A3B8' }}>Loading...</div>;

  return (
    <div style={{ padding: '24px 28px', maxWidth: 860, fontFamily: 'Inter, sans-serif' }}>
      <div style={{ display:'flex',alignItems:'center',gap:14,marginBottom:28 }}>
        <button onClick={() => router.push(`/invoices/event/${id}`)}
          style={{ display:'flex',alignItems:'center',gap:6,background:'#F1F5F9',color:'#64748B',border:'none',borderRadius:9,padding:'8px 14px',fontSize:13,cursor:'pointer' }}>
          <ArrowLeft size={14} /> Back
        </button>
        <div>
          <h1 style={{ fontSize:20,fontWeight:800,color:'#0F172A',margin:0 }}>Edit Event Invoice</h1>
          <p style={{ color:'#64748B',fontSize:13,marginTop:2 }}>{docNo} — {clientName}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:20,marginBottom:20 }}>
          <div>
            <label style={{ fontSize:12,fontWeight:600,color:'#374151',display:'block',marginBottom:6 }}>Event Date</label>
            <input type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={{ fontSize:12,fontWeight:600,color:'#374151',display:'block',marginBottom:6 }}>GST %</label>
            <input
              type="number" min="0" max="100" step="0.01"
              value={gstPct} onChange={e => setGstPct(e.target.value)}
              style={inputStyle}
            />
          </div>
          <div style={{ gridColumn:'1 / -1' }}>
            <label style={{ fontSize:12,fontWeight:600,color:'#374151',display:'block',marginBottom:6 }}>Event Name</label>
            <input
              type="text" value={eventName} onChange={e => setEventName(e.target.value)}
              placeholder="e.g. Annual Conference..."
              style={inputStyle}
            />
          </div>
        </div>

        {/* Line Items */}
        <div style={{ marginBottom:20 }}>
          <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10 }}>
            <label style={{ fontSize:13,fontWeight:700,color:'#0F172A' }}>Line Items</label>
            <button type="button" onClick={addItem}
              style={{ display:'flex',alignItems:'center',gap:5,background:'#EFF6FF',color:'#3B82F6',border:'none',borderRadius:7,padding:'6px 12px',fontSize:12,fontWeight:600,cursor:'pointer' }}>
              <Plus size={13} /> Add Row
            </button>
          </div>
          <div style={{ background:'white',border:'1px solid #E2E8F0',borderRadius:10,overflow:'hidden' }}>
            <table style={{ width:'100%',borderCollapse:'collapse' }}>
              <thead>
                <tr style={{ background:'#F8FAFC',borderBottom:'1px solid #E2E8F0' }}>
                  <th style={{ padding:'9px 14px',textAlign:'left',fontSize:12,fontWeight:600,color:'#64748B' }}>Description</th>
                  <th style={{ padding:'9px 14px',textAlign:'center',fontSize:12,fontWeight:600,color:'#64748B',width:80 }}>Qty</th>
                  <th style={{ padding:'9px 14px',textAlign:'right',fontSize:12,fontWeight:600,color:'#64748B',width:130 }}>Rate (₹)</th>
                  <th style={{ padding:'9px 14px',textAlign:'right',fontSize:12,fontWeight:600,color:'#64748B',width:130 }}>Amount (₹)</th>
                  <th style={{ width:44 }}></th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, idx) => {
                  const amt = (parseFloat(it.qty) || 0) * (parseFloat(it.rate) || 0);
                  return (
                    <tr key={idx} style={{ borderBottom: idx < items.length - 1 ? '1px solid #F1F5F9' : 'none' }}>
                      <td style={{ padding:'8px 14px' }}>
                        <input
                          type="text" value={it.description}
                          onChange={e => updateItem(idx, 'description', e.target.value)}
                          placeholder="Service description..."
                          style={{ ...inputStyle, border:'1px solid #E2E8F0' }}
                        />
                      </td>
                      <td style={{ padding:'8px 14px' }}>
                        <input
                          type="number" min="0" step="0.01" value={it.qty}
                          onChange={e => updateItem(idx, 'qty', e.target.value)}
                          style={{ ...inputStyle, textAlign:'center', border:'1px solid #E2E8F0' }}
                        />
                      </td>
                      <td style={{ padding:'8px 14px' }}>
                        <input
                          type="number" min="0" step="0.01" value={it.rate}
                          onChange={e => updateItem(idx, 'rate', e.target.value)}
                          placeholder="0.00"
                          style={{ ...inputStyle, textAlign:'right', border:'1px solid #E2E8F0' }}
                        />
                      </td>
                      <td style={{ padding:'8px 14px', textAlign:'right', fontWeight:600, fontSize:13, color:'#0F172A' }}>
                        {fmtAmt(amt)}
                      </td>
                      <td style={{ padding:'8px 10px' }}>
                        {items.length > 1 && (
                          <button type="button" onClick={() => removeItem(idx)}
                            style={{ background:'none',border:'none',cursor:'pointer',color:'#EF4444',padding:4,display:'flex',alignItems:'center' }}>
                            <Trash2 size={14} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Totals */}
        <div style={{ display:'flex',justifyContent:'flex-end',marginBottom:20 }}>
          <div style={{ background:'#F8FAFC',border:'1px solid #E2E8F0',borderRadius:10,padding:'16px 20px',minWidth:260 }}>
            <div style={{ display:'flex',justifyContent:'space-between',fontSize:13,color:'#64748B',marginBottom:8 }}>
              <span>Sub Total</span>
              <span style={{ fontWeight:600,color:'#0F172A' }}>₹{fmtAmt(subTotal)}</span>
            </div>
            <div style={{ display:'flex',justifyContent:'space-between',fontSize:13,color:'#64748B',marginBottom:8 }}>
              <span>SGST ({halfPct}%)</span>
              <span>₹{fmtAmt(gstAmt / 2)}</span>
            </div>
            <div style={{ display:'flex',justifyContent:'space-between',fontSize:13,color:'#64748B',marginBottom:12 }}>
              <span>CGST ({halfPct}%)</span>
              <span>₹{fmtAmt(gstAmt / 2)}</span>
            </div>
            <div style={{ borderTop:'1px solid #E2E8F0',paddingTop:10,display:'flex',justifyContent:'space-between' }}>
              <span style={{ fontWeight:800,fontSize:14,color:'#0F172A' }}>Grand Total</span>
              <span style={{ fontWeight:800,fontSize:16,color:'#1E40AF' }}>₹{fmtAmt(grandTotal)}</span>
            </div>
          </div>
        </div>

        <div style={{ marginBottom:24 }}>
          <label style={{ fontSize:12,fontWeight:600,color:'#374151',display:'block',marginBottom:6 }}>Notes</label>
          <textarea
            value={notes} onChange={e => setNotes(e.target.value)}
            rows={3} placeholder="Any additional notes..."
            style={{ ...inputStyle, resize:'vertical', fontFamily:'inherit' }}
          />
        </div>

        {error && (
          <div style={{ background:'#FEF2F2',color:'#DC2626',border:'1px solid #FECACA',borderRadius:8,padding:'10px 14px',fontSize:13,marginBottom:16 }}>
            {error}
          </div>
        )}

        <div style={{ display:'flex',justifyContent:'flex-end',gap:12 }}>
          <button type="button" onClick={() => router.push(`/invoices/event/${id}`)}
            style={{ background:'#F1F5F9',color:'#64748B',border:'none',borderRadius:9,padding:'10px 20px',fontSize:13,fontWeight:600,cursor:'pointer' }}>
            Cancel
          </button>
          <button type="submit" disabled={saving}
            style={{ display:'flex',alignItems:'center',gap:7,background:'#3B82F6',color:'white',border:'none',borderRadius:9,padding:'10px 22px',fontSize:13,fontWeight:700,cursor:'pointer',opacity:saving?0.7:1 }}>
            <Save size={14} /> {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}
