'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Printer, ArrowLeft, Pencil } from 'lucide-react';
import '../../../invoice-print.css';

const COMPANY = {
  name:    'Shine IT Service',
  tagline: 'Laptop Rental Service',
  address: 'Kandapile Building, Plot No-299, Survey No. 386,\nOpp Kandapile Building, Panvel, Navi Mumbai, Raigad-410206',
  phone:   '+91 9833887134 | +91 9920073301',
  email:   'accounts@contact.laptoprentalservice.com',
  gst:     '27BLJPA1270R1ZT',
  hsn:     '997315',
  website: 'www.laptoprentalservice.com',
};

const LOGO_URL = '/latop-rental-logo.png';

const TERMS = [
  'All equipments contains comprehensive warranty. Any claims regarding physical damage or quantity shortage must be informed within 24 hours of delivery. Further terms and conditions are according to the contract.',
  'I/We hereby certify that my/our registration certificate under Goods and Service Tax Act 2017 is in force on the date on which the sale of goods specified in this TAX Invoice is made by me/us and that the transaction of sale covered by TAX Invoice has been effected by m/us and it shall be accounted for in the turnover of Movable Rental Properties while filing of the returns and the due tax, if any payable on the sale has been paid or shall be paid.',
];

const fmtDate = (d?: string) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
const fmtAmt = (n: any) =>
  Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function EventInvoiceViewPage() {
  const params  = useParams();
  const router  = useRouter();
  const id      = Number(params.id);

  const [invoice, setInvoice] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await api.eventInvoices.get(id);
      setInvoice(res.data);
    } catch { router.push('/invoices/event'); }
    finally { setLoading(false); }
  }, [id, router]);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <div style={{ padding: 40, textAlign: 'center', fontFamily: 'Arial, sans-serif', color: '#666' }}>
      Loading invoice...
    </div>
  );
  if (!invoice) return null;

  const client   = invoice.client;
  const items    = invoice.items || [];
  const gstPct   = Number(invoice.gst_percent || 18);
  const halfPct  = gstPct / 2;
  const subTotal = Number(invoice.sub_total  || 0);
  const gstAmt   = Number(invoice.gst_amount || 0);
  const grandTotal = Number(invoice.grand_total || 0);
  const sgst     = +(gstAmt / 2).toFixed(2);
  const cgst     = +(gstAmt / 2).toFixed(2);
  const docNo    = invoice.invoice_record?.formatted_number || `EI-${invoice.id}`;

  return (
    <>
      {/* Toolbar */}
      <div className="no-print" style={{
        background: '#0B1628', padding: '10px 24px',
        display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <button onClick={() => router.push('/invoices/event')}
          style={{ display:'flex',alignItems:'center',gap:6,background:'rgba(255,255,255,0.08)',color:'#94A3B8',border:'none',borderRadius:8,padding:'7px 14px',fontSize:13,cursor:'pointer' }}>
          <ArrowLeft size={14} /> Event Invoices
        </button>
        <span style={{ color:'#64748B',fontSize:13 }}>
          {docNo} — {client?.company || client?.name}
        </span>
        <button onClick={() => router.push(`/invoices/event/${id}/edit`)}
          style={{ display:'flex',alignItems:'center',gap:6,background:'rgba(255,255,255,0.08)',color:'#94A3B8',border:'none',borderRadius:8,padding:'7px 14px',fontSize:13,cursor:'pointer' }}>
          <Pencil size={13} /> Edit
        </button>
        <button onClick={() => window.print()}
          style={{ marginLeft:'auto',display:'flex',alignItems:'center',gap:6,background:'#3B82F6',color:'white',border:'none',borderRadius:8,padding:'8px 18px',fontSize:13,fontWeight:700,cursor:'pointer' }}>
          <Printer size={15} /> Print / Save as PDF
        </button>
      </div>

      {/* Invoice page */}
      <div className="page" style={{ background:'white',maxWidth:900,margin:'24px auto',padding:'32px 36px',boxShadow:'0 4px 24px rgba(0,0,0,0.1)' }}>

        {/* Header */}
        <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:20 }}>
          <div style={{ display:'flex',alignItems:'center',gap:10 }}>
            <img src={LOGO_URL} alt="Laptop Rental" style={{ height:56,width:'auto',maxWidth:180,objectFit:'contain' }} />
          </div>
          <div style={{ textAlign:'center',flex:1 }}>
            <div style={{ fontSize:26,fontWeight:900,letterSpacing:1 }}>TAX INVOICE</div>
            <div style={{ fontSize:11,color:'#555',marginTop:2 }}>Original for Recipient</div>
          </div>
          <div style={{ textAlign:'right',fontSize:12 }}>
            <div>Invoice No:- {docNo}</div>
            <div>Date: {fmtDate(invoice.event_date)}</div>
          </div>
        </div>

        {/* Event name banner if present */}
        {invoice.event_name && (
          <div style={{ background:'#EFF6FF',border:'1px solid #BFDBFE',borderRadius:8,padding:'8px 14px',marginBottom:16,fontSize:13,fontWeight:600,color:'#1E40AF',textAlign:'center' }}>
            {invoice.event_name}
          </div>
        )}

        {/* To / From */}
        <table style={{ marginBottom:20 }}>
          <tbody>
            <tr>
              <td style={{ width:'50%',verticalAlign:'top',padding:12 }}>
                <div style={{ fontWeight:700,marginBottom:4 }}>To,</div>
                <div style={{ fontWeight:700,fontSize:13 }}>{client?.company || client?.name || '—'}</div>
                {client?.company && client?.name && <div>{client.name}</div>}
                {client?.phone   && <div>Contact Number- {client.phone}</div>}
                {client?.email   && <div>Email: {client.email}</div>}
              </td>
              <td style={{ width:'50%',verticalAlign:'top',padding:12 }}>
                <div style={{ fontWeight:700,marginBottom:4 }}>From,</div>
                <div style={{ fontWeight:700,fontSize:13 }}>{COMPANY.name}</div>
                {COMPANY.address.split('\n').map((line, i) => <div key={i}>{line}</div>)}
                <div>Contact Number- {COMPANY.phone}</div>
                <div>Email ID: {COMPANY.email}</div>
                <div>GST No: {COMPANY.gst}</div>
                <div>HSN Code : {COMPANY.hsn}</div>
              </td>
            </tr>
          </tbody>
        </table>

        {/* Line Items Table */}
        <table style={{ marginBottom:4 }}>
          <thead>
            <tr>
              <th style={{ textAlign:'left' }}>Description</th>
              <th style={{ width:70,textAlign:'center' }}>Qty</th>
              <th style={{ width:'15%',textAlign:'right' }}>Rate</th>
              <th style={{ width:'15%',textAlign:'right' }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={4} style={{ background:'#d9e1f2',fontWeight:700 }}>Services</td>
            </tr>
            {items.map((item: any, idx: number) => (
              <tr key={idx}>
                <td>{item.description}</td>
                <td style={{ textAlign:'center' }}>{item.qty}</td>
                <td style={{ textAlign:'right' }}>{fmtAmt(item.rate)}</td>
                <td style={{ textAlign:'right' }}>{fmtAmt(item.amount)}</td>
              </tr>
            ))}
            {invoice.notes && (
              <tr>
                <td colSpan={4} style={{ fontSize:11,color:'#555',fontStyle:'italic',background:'#fafafa' }}>
                  Note: {invoice.notes}
                </td>
              </tr>
            )}
            <tr><td colSpan={4} className="no-border" style={{ height:8 }} /></tr>
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={2} className="no-border" />
              <td className="right bold">Sub Total</td>
              <td className="right bold">{fmtAmt(subTotal)}</td>
            </tr>
            <tr>
              <td colSpan={2} className="no-border" />
              <td className="right">SGST-{halfPct}%</td>
              <td className="right">{fmtAmt(sgst)}</td>
            </tr>
            <tr>
              <td colSpan={2} className="no-border" />
              <td className="right">CGST-{halfPct}%</td>
              <td className="right">{fmtAmt(cgst)}</td>
            </tr>
            <tr className="total-row">
              <td colSpan={2} className="no-border" />
              <td className="right bold" style={{ border:'1px solid #bbb' }}>Grand Total</td>
              <td className="right bold" style={{ border:'1px solid #bbb' }}>{fmtAmt(grandTotal)}</td>
            </tr>
          </tfoot>
        </table>

        {/* Terms */}
        <div style={{ marginTop:20,marginBottom:24 }}>
          <div style={{ fontWeight:700,marginBottom:6,fontSize:12 }}>Terms and Conditions</div>
          {TERMS.map((t, i) => (
            <p key={i} style={{ fontSize:11,color:'#333',marginBottom:6,lineHeight:1.6 }}>{t}</p>
          ))}
        </div>

        {/* Signatures */}
        <div style={{ display:'flex',justifyContent:'space-between',marginTop:48 }}>
          <div>
            <div style={{ fontSize:11,fontWeight:700,marginBottom:2 }}>For {COMPANY.name}</div>
            <div style={{ height:40 }} />
            <div style={{ borderTop:'1px solid #333',paddingTop:4,width:180 }}>
              <div style={{ fontSize:11 }}>Authorized Signatory</div>
              <div style={{ fontSize:11 }}>For {COMPANY.name}</div>
            </div>
          </div>
          <div style={{ textAlign:'right' }}>
            <div style={{ height:60 }} />
            <div style={{ borderTop:'1px solid #333',paddingTop:4,width:220 }}>
              <div style={{ fontSize:11 }}>Authorized Signatory &amp; Stamp</div>
              <div style={{ fontSize:11 }}>For {client?.company || client?.name || '—'}</div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ borderTop:'2px dashed #aaa',paddingTop:12,textAlign:'center',marginTop:32 }}>
          <div style={{ fontSize:12,fontWeight:700 }}>{COMPANY.name} ({COMPANY.tagline})</div>
          <div style={{ fontSize:11,color:'#555' }}>Mumbai | Thane | Navi Mumbai</div>
          <div style={{ fontSize:11,color:'#555' }}>Contact Number: {COMPANY.phone}</div>
          <div style={{ fontSize:11,color:'#3B82F6',textDecoration:'underline' }}>{COMPANY.website}</div>
        </div>
      </div>
    </>
  );
}
