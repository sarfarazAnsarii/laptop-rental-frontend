'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Printer, ArrowLeft, FileText, Receipt, Calendar } from 'lucide-react';
import '../../../../invoice-print.css';

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

/** Compute the effective billing period and prorated amount for a rental within a given invoice month */
function computeRow(r: any, invoiceMonth: string) {
  const monthly   = Number(r.monthly_rental || 0);
  const qty       = Number(r.quantity || 1);
  const gstPct    = Number(r.gst_percent || 18);

  const [yr, mo]  = invoiceMonth.split('-').map(Number);
  const daysInMo  = new Date(yr, mo, 0).getDate();
  const monthStart = new Date(yr, mo - 1, 1);
  const monthEnd   = new Date(yr, mo - 1, daysInMo);

  const deliveryRaw = r.delivery_date || r.start_date || '';
  const deliveryCar = deliveryRaw ? new Date(deliveryRaw) : monthStart;

  const cancelRaw  = (r.status === 'cancelled' || r.status === 'completed') && r.end_date ? r.end_date : null;
  const cancelCar  = cancelRaw ? new Date(cancelRaw) : null;

  const effStart = deliveryCar > monthStart ? deliveryCar : monthStart;
  // Cancel day is not billed — use day before cancel date
  const effEnd   = cancelCar && cancelCar <= monthEnd
    ? new Date(cancelCar.getTime() - 86400000)
    : monthEnd;

  if (effStart > effEnd) {
    return { r, monthly, qty, gstPct, startDate: effStart, endDate: effEnd, days: 0, proAmt: 0, inv: r.inventory };
  }

  const days   = Math.round((effEnd.getTime() - effStart.getTime()) / 86400000) + 1;
  const proAmt = +(monthly * qty / daysInMo * days).toFixed(2);
  return { r, monthly, qty, gstPct, startDate: effStart, endDate: effEnd, days, proAmt, inv: r.inventory };
}

type Mode = 'estimate' | 'invoice';

export default function BulkInvoicePage() {
  const params       = useParams();
  const searchParams = useSearchParams();
  const router       = useRouter();
  const bulkId       = decodeURIComponent(params.bulk_id as string);
  const mode: Mode   = (searchParams.get('mode') as Mode) || 'estimate';

  const [rentals,       setRentals]       = useState<any[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [docNumber,     setDocNumber]     = useState<string>('');
  const [numberLoading, setNumberLoading] = useState(false);
  const [invoiceMonth,  setInvoiceMonth]  = useState(() => new Date().toISOString().slice(0, 7));

  const load = useCallback(async () => {
    try {
      const res = await api.rentals.list({ bulk_id: bulkId, per_page: '100' });
      const all = res.data?.data || res.data || [];
      setRentals(all.filter((r: any) => r.bulk_id === bulkId));
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [bulkId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (rentals.length === 0) return;
    setNumberLoading(true);
    api.invoiceRecords.assign({ type: mode, bulk_id: bulkId })
      .then(res => setDocNumber(res.data?.formatted_number ?? ''))
      .catch(() => setDocNumber(''))
      .finally(() => setNumberLoading(false));
  }, [rentals, mode, bulkId]);

  function switchMode(m: Mode) {
    router.replace(`/rentals/bulk/${encodeURIComponent(bulkId)}/invoice?mode=${m}`);
  }

  if (loading) return (
    <div style={{ padding: 40, textAlign: 'center', fontFamily: 'Arial, sans-serif', color: '#666' }}>
      Loading invoice...
    </div>
  );
  if (rentals.length === 0) return (
    <div style={{ padding: 40, textAlign: 'center', fontFamily: 'Arial, sans-serif', color: '#666' }}>
      Bulk rental not found.
    </div>
  );

  const client = rentals[0]?.client;

  // Per-row calculations using invoice_month period
  const rows = rentals.map(r => {
    const computed = computeRow(r, invoiceMonth);
    const inv      = r.inventory;
    const product  = [inv?.brand, inv?.model_no].filter(Boolean).join(' ');
    const specs    = [inv?.cpu, inv?.generation ? `${inv.generation} Gen` : '', inv?.ram, inv?.ssd].filter(Boolean).join('-');
    return { ...computed, product, specs };
  });

  const laptopRows  = rows.filter(({ inv }) => (inv?.type || 'laptop') !== 'desktop');
  const desktopRows = rows.filter(({ inv }) => inv?.type === 'desktop');

  const gstPct     = Number(rentals[0]?.gst_percent || 18);
  const halfPct    = gstPct / 2;
  const grossTotal = rows.reduce((s, { proAmt }) => s + proAmt, 0);
  const sgst       = +(grossTotal * halfPct / 100).toFixed(2);
  const cgst       = +(grossTotal * halfPct / 100).toFixed(2);
  const grandTotal = +(grossTotal + sgst + cgst).toFixed(2);

  const isInvoice = mode === 'invoice';
  const title     = isInvoice ? 'TAX INVOICE' : 'ESTIMATION';
  const numLabel  = isInvoice ? 'Invoice No' : 'Est No';
  const docNo     = numberLoading ? '…' : (docNumber || bulkId);
  const docDate   = fmtDate(new Date().toISOString().split('T')[0]);

  // Invoice month display
  const [imYr, imMo] = invoiceMonth.split('-').map(Number);
  const invoiceMonthLabel = new Date(imYr, imMo - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  function ProductRows({ items }: { items: typeof rows }) {
    return (
      <>
        {items.map(({ r, monthly, qty, startDate, endDate, days, proAmt, product, specs }) => (
          <tr key={r.id} style={r.status === 'cancelled' ? { background: '#fff5f5' } : {}}>
            <td>
              <div style={{ fontWeight: 700 }}>{product}</div>
              {specs && <div style={{ fontSize: 11, color: '#555' }}>{specs}</div>}
              {r.inventory?.asset_code && <div style={{ fontSize: 10, color: '#888' }}>Code: {r.inventory.asset_code}</div>}
              {r.status === 'cancelled' && (
                <div style={{ display:'inline-block',background:'#ef4444',color:'#fff',fontSize:9,fontWeight:700,padding:'1px 5px',borderRadius:3,marginTop:2 }}>CANCELLED</div>
              )}
            </td>
            <td style={{ textAlign: 'center' }}>{qty}</td>
            <td style={{ textAlign: 'center' }}>{days > 0 ? fmtDate(startDate.toISOString().split('T')[0]) : '—'}</td>
            <td style={{ textAlign: 'center' }}>{days > 0 ? fmtDate(endDate.toISOString().split('T')[0]) : '—'}</td>
            <td style={{ textAlign: 'center' }}>{days > 0 ? days : '—'}</td>
            <td style={{ textAlign: 'right', color: r.status === 'cancelled' ? '#999' : undefined,
              textDecoration: r.status === 'cancelled' ? 'line-through' : undefined }}>{fmtAmt(monthly)}</td>
            <td style={{ textAlign: 'right' }}>{days > 0 ? fmtAmt(proAmt) : '—'}</td>
            <td style={{ textAlign: 'right', color: (r.status === 'cancelled' && days > 0) ? '#ef4444' : undefined,
              fontWeight: (r.status === 'cancelled' && days > 0) ? 700 : undefined }}>{days > 0 ? fmtAmt(proAmt) : '—'}</td>
          </tr>
        ))}
      </>
    );
  }

  return (
    <>
      {/* Toolbar */}
      <div className="no-print" style={{
        background: '#0B1628', padding: '10px 24px',
        display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <button onClick={() => window.history.back()}
          style={{ display:'flex',alignItems:'center',gap:6,background:'rgba(255,255,255,0.08)',color:'#94A3B8',border:'none',borderRadius:8,padding:'7px 14px',fontSize:13,cursor:'pointer' }}>
          <ArrowLeft size={14} /> Back
        </button>
        <span style={{ color: '#64748B', fontSize: 13 }}>{bulkId}</span>

        {/* Mode toggle */}
        <div style={{ display:'flex',gap:4,padding:'3px',background:'rgba(255,255,255,0.06)',borderRadius:10,marginLeft:8 }}>
          <button onClick={() => switchMode('estimate')}
            style={{ display:'flex',alignItems:'center',gap:5,padding:'5px 12px',borderRadius:7,border:'none',fontSize:12,fontWeight:600,cursor:'pointer',
              background: !isInvoice ? '#3B82F6' : 'transparent',
              color:      !isInvoice ? 'white'  : '#64748B' }}>
            <FileText size={12} /> Estimation
          </button>
          <button onClick={() => switchMode('invoice')}
            style={{ display:'flex',alignItems:'center',gap:5,padding:'5px 12px',borderRadius:7,border:'none',fontSize:12,fontWeight:600,cursor:'pointer',
              background: isInvoice ? '#10B981' : 'transparent',
              color:      isInvoice ? 'white'   : '#64748B' }}>
            <Receipt size={12} /> Tax Invoice
          </button>
        </div>

        {/* Invoice Month picker */}
        <div style={{ display:'flex',alignItems:'center',gap:8,marginLeft:8,background:'rgba(255,255,255,0.06)',borderRadius:8,padding:'4px 10px' }}>
          <Calendar size={13} style={{ color:'#94A3B8' }} />
          <span style={{ fontSize:12,color:'#94A3B8',fontWeight:600 }}>Month:</span>
          <input
            type="month"
            value={invoiceMonth}
            onChange={e => setInvoiceMonth(e.target.value)}
            style={{ background:'transparent',border:'none',color:'#E2E8F0',fontSize:13,fontWeight:600,outline:'none',cursor:'pointer' }}
          />
        </div>

        <button onClick={() => window.print()}
          style={{ marginLeft:'auto',display:'flex',alignItems:'center',gap:6,background:'#3B82F6',color:'white',border:'none',borderRadius:8,padding:'8px 18px',fontSize:13,fontWeight:700,cursor:'pointer' }}>
          <Printer size={15} /> Print / Save as PDF
        </button>
      </div>

      {/* Invoice */}
      <div className="page" style={{ background:'white',maxWidth:960,margin:'24px auto',padding:'32px 36px',boxShadow:'0 4px 24px rgba(0,0,0,0.1)' }}>

        {/* Header */}
        <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:20 }}>
          <div style={{ display:'flex',alignItems:'center',gap:10 }}>
            <img src={LOGO_URL} alt="Laptop Rental" style={{ height:56,width:'auto',maxWidth:180,objectFit:'contain' }} />
          </div>
          <div style={{ textAlign:'center',flex:1 }}>
            <div style={{ fontSize:26,fontWeight:900,letterSpacing:1 }}>{title}</div>
            <div style={{ fontSize:13,color:'#555',marginTop:3,fontWeight:600 }}>{invoiceMonthLabel}</div>
            {isInvoice && (
              <div style={{ fontSize:11,color:'#555',marginTop:2 }}>Original for Recipient</div>
            )}
          </div>
          <div style={{ textAlign:'right',fontSize:12 }}>
            <div>{numLabel}:- {docNo}</div>
            <div>Date: {docDate}</div>
          </div>
        </div>

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
                {client?.address && <div>Address: {client.address}</div>}
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

        {/* Product Table */}
        <table style={{ marginBottom:4 }}>
          <thead>
            <tr>
              <th rowSpan={2} style={{ textAlign:'left',width:'30%' }}>Product</th>
              <th rowSpan={2} style={{ width:40 }}>Qty</th>
              <th colSpan={3}>Duration</th>
              <th rowSpan={2} style={{ width:'12%' }}>Monthly Rental</th>
              <th rowSpan={2} style={{ width:'12%' }}>Prorated Rental</th>
              <th rowSpan={2} style={{ width:'12%' }}>Total</th>
            </tr>
            <tr>
              <th style={{ width:'9%' }}>Start Date</th>
              <th style={{ width:'9%' }}>End Date</th>
              <th style={{ width:'6%' }}>Days</th>
            </tr>
          </thead>
          <tbody>
            {laptopRows.length > 0 && (
              <tr><td colSpan={8} style={{ background:'#d9e1f2',fontWeight:700 }}>Laptop</td></tr>
            )}
            <ProductRows items={laptopRows} />
            {desktopRows.length > 0 && (
              <tr><td colSpan={8} style={{ background:'#d9e1f2',fontWeight:700 }}>Desktop</td></tr>
            )}
            <ProductRows items={desktopRows} />
            {rentals[0]?.notes && (
              <tr>
                <td colSpan={8} style={{ fontSize:11,color:'#555',fontStyle:'italic',background:'#fafafa' }}>
                  Note: {rentals[0].notes}
                </td>
              </tr>
            )}
            <tr><td colSpan={8} className="no-border" style={{ height:8 }} /></tr>
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={6} className="no-border" />
              <td className="right bold">Gross Total</td>
              <td className="right bold">{fmtAmt(grossTotal)}</td>
            </tr>
            <tr>
              <td colSpan={6} className="no-border" />
              <td className="right">SGST-{halfPct}%</td>
              <td className="right">{fmtAmt(sgst)}</td>
            </tr>
            <tr>
              <td colSpan={6} className="no-border" />
              <td className="right">CGST-{halfPct}%</td>
              <td className="right">{fmtAmt(cgst)}</td>
            </tr>
            <tr className="total-row">
              <td colSpan={6} className="no-border" />
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
