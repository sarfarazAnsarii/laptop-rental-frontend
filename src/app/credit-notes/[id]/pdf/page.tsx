'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { Printer, ArrowLeft } from 'lucide-react';

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

const fmtDate = (d?: string) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
const fmtAmt = (n: any) =>
  Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const RESOLUTION_LABEL: Record<string, string> = {
  pending: 'Pending',
  refund: 'Refund',
  adjust_next_invoice: 'Adjust Next Invoice',
  resolved: 'Resolved',
};

export default function CreditNotePdfPage() {
  const params = useParams();
  const id = Number(params.id);

  const [cn, setCn]           = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await api.creditNotes.get(id);
      setCn(res.data);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <div style={{ padding: 40, textAlign: 'center', fontFamily: 'Arial, sans-serif', color: '#666' }}>
      Loading credit note...
    </div>
  );

  if (!cn) return (
    <div style={{ padding: 40, textAlign: 'center', fontFamily: 'Arial, sans-serif', color: '#666' }}>
      Credit note not found.
    </div>
  );

  const client   = cn.rental?.client || cn.client;
  const rental   = cn.rental;
  const inv      = rental?.inventory;
  const today    = new Date();
  const gstPct   = Number(cn.gst_percent || 18);
  const halfPct  = gstPct / 2;
  const proBase  = Number(cn.pro_rated_base || 0);
  const proGst   = Number(cn.pro_rated_gst  || 0);
  const proTotal = Number(cn.pro_rated_total || proBase + proGst);
  const advPaid  = Number(cn.advance_paid   || 0);
  const credit   = Number(cn.credit_amount  || Math.max(0, advPaid - proTotal));
  const sgst     = +(proGst / 2).toFixed(2);
  const cgst     = +(proGst / 2).toFixed(2);

  return (
    <>
      <style>{`
        * { box-sizing: border-box; }
        body { margin: 0; background: #f0f4f8; font-family: Arial, sans-serif; }
        @media print {
          .no-print { display: none !important; }
          body { background: white; }
          .page { box-shadow: none !important; margin: 0 !important; max-width: 100% !important; }
        }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #bbb; padding: 6px 8px; font-size: 12px; }
        th { background: #d9e1f2; font-weight: bold; text-align: center; }
        .no-border { border: none !important; }
        .right { text-align: right; }
        .bold { font-weight: bold; }
        .total-row td { background: #d9e1f2; font-weight: bold; }
        .credit-row td { background: #d4edda; font-weight: bold; color: #155724; }
      `}</style>

      {/* Toolbar */}
      <div className="no-print" style={{
        background: '#0B1628', padding: '10px 24px',
        display: 'flex', alignItems: 'center', gap: 12,
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <button onClick={() => window.history.back()}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.08)', color: '#94A3B8', border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 13, cursor: 'pointer' }}>
          <ArrowLeft size={14} /> Back
        </button>
        <span style={{ color: '#64748B', fontSize: 13 }}>{cn.credit_note_no} — Credit Note PDF</span>
        <button onClick={() => window.print()}
          style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, background: '#3B82F6', color: 'white', border: 'none', borderRadius: 8, padding: '8px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
          <Printer size={15} /> Print / Save as PDF
        </button>
      </div>

      {/* Document */}
      <div className="page" style={{ background: 'white', maxWidth: 900, margin: '24px auto', padding: '32px 36px', boxShadow: '0 4px 24px rgba(0,0,0,0.1)' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 48, height: 48, borderRadius: 10, background: 'linear-gradient(135deg,#1e3a5f,#3B82F6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 900, fontSize: 14 }}>LR</div>
            <div style={{ fontWeight: 900, fontSize: 20, color: '#1e3a5f', lineHeight: 1.1 }}>
              Laptop<span style={{ color: '#3B82F6' }}>Rental</span>
            </div>
          </div>
          <div style={{ textAlign: 'center', flex: 1 }}>
            <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: 1, color: '#7C3AED' }}>Credit Note</div>
          </div>
          <div style={{ textAlign: 'right', fontSize: 12 }}>
            <div><strong>CN No:</strong> {cn.credit_note_no}</div>
            <div><strong>Date:</strong> {fmtDate(cn.created_at || today.toISOString())}</div>
            <div><strong>Ref Rental:</strong> {rental?.rental_no || '—'}</div>
          </div>
        </div>

        {/* To / From */}
        <table style={{ marginBottom: 20 }}>
          <tbody>
            <tr>
              <td style={{ width: '50%', verticalAlign: 'top', padding: 12 }}>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>Credit To,</div>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{client?.company || client?.name || '—'}</div>
                {client?.company && client?.name && <div>{client.name}</div>}
                {client?.phone && <div>Contact: {client.phone}</div>}
                {client?.email && <div>Email: {client.email}</div>}
                {client?.gst_number && <div>GST No: {client.gst_number}</div>}
              </td>
              <td style={{ width: '50%', verticalAlign: 'top', padding: 12 }}>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>From,</div>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{COMPANY.name}</div>
                {COMPANY.address.split('\n').map((line, i) => <div key={i}>{line}</div>)}
                <div>Contact: {COMPANY.phone}</div>
                <div>Email: {COMPANY.email}</div>
                <div>GST No: {COMPANY.gst}</div>
                <div>HSN Code: {COMPANY.hsn}</div>
              </td>
            </tr>
          </tbody>
        </table>

        {/* Rental Details */}
        {inv && (
          <table style={{ marginBottom: 16 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>Laptop / Product</th>
                <th>Asset Code</th>
                <th>Rental Start</th>
                <th>Return Date</th>
                <th>Days Used</th>
                <th>Days in Month</th>
                <th>Monthly Rental</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><div style={{ fontWeight: 700 }}>{inv.brand} {inv.model_no}</div>
                  <div style={{ fontSize: 11, color: '#555' }}>{[inv.cpu, inv.ram, inv.ssd].filter(Boolean).join(' · ')}</div>
                </td>
                <td style={{ textAlign: 'center', fontFamily: 'monospace' }}>{inv.asset_code}</td>
                <td style={{ textAlign: 'center' }}>{fmtDate(rental?.start_date)}</td>
                <td style={{ textAlign: 'center' }}>{fmtDate(rental?.end_date || cn.created_at)}</td>
                <td style={{ textAlign: 'center', fontWeight: 700 }}>{cn.days_used}</td>
                <td style={{ textAlign: 'center' }}>{cn.days_in_month}</td>
                <td style={{ textAlign: 'right' }}>₹{fmtAmt(rental?.monthly_rental)}</td>
              </tr>
            </tbody>
          </table>
        )}

        {/* Credit Breakdown */}
        <table style={{ marginBottom: 20 }}>
          <tbody>
            <tr>
              <td colSpan={2} style={{ background: '#d9e1f2', fontWeight: 700, fontSize: 13 }}>Credit Note Breakdown</td>
            </tr>
            <tr>
              <td style={{ width: '70%' }}>Advance Amount Paid by Client</td>
              <td className="right bold">₹{fmtAmt(advPaid)}</td>
            </tr>
            <tr>
              <td style={{ paddingLeft: 24, color: '#555' }}>
                Pro-rated Rental ({cn.days_used} / {cn.days_in_month} days used)
              </td>
              <td className="right" style={{ color: '#555' }}>₹{fmtAmt(proBase)}</td>
            </tr>
            <tr>
              <td style={{ paddingLeft: 24, color: '#555' }}>SGST ({halfPct}%) on pro-rated</td>
              <td className="right" style={{ color: '#555' }}>₹{fmtAmt(sgst)}</td>
            </tr>
            <tr>
              <td style={{ paddingLeft: 24, color: '#555' }}>CGST ({halfPct}%) on pro-rated</td>
              <td className="right" style={{ color: '#555' }}>₹{fmtAmt(cgst)}</td>
            </tr>
            <tr className="total-row">
              <td>Amount Owed for Actual Usage (Pro-rated + GST)</td>
              <td className="right">₹{fmtAmt(proTotal)}</td>
            </tr>
            <tr className="credit-row">
              <td style={{ fontSize: 14 }}>Credit Amount (Advance Paid − Amount Owed)</td>
              <td className="right" style={{ fontSize: 14 }}>₹{fmtAmt(credit)}</td>
            </tr>
            <tr>
              <td>Resolution</td>
              <td className="right" style={{ color: '#7C3AED', fontWeight: 700 }}>
                {RESOLUTION_LABEL[cn.resolution] || cn.resolution}
              </td>
            </tr>
          </tbody>
        </table>

        {cn.notes && (
          <div style={{ marginBottom: 16, padding: '10px 14px', background: '#fafafa', border: '1px solid #ddd', borderRadius: 4, fontSize: 12, color: '#555' }}>
            <strong>Notes:</strong> {cn.notes}
          </div>
        )}

        {/* Resolution Note */}
        <div style={{ marginBottom: 24, padding: '10px 14px', background: cn.resolution === 'refund' ? '#e8f4fd' : '#f3f0ff', border: `1px solid ${cn.resolution === 'refund' ? '#bee3f8' : '#c4b5fd'}`, borderRadius: 4, fontSize: 12 }}>
          <strong>Resolution:</strong>{' '}
          {cn.resolution === 'refund'
            ? `A refund of ₹${fmtAmt(credit)} will be processed to the client within the agreed timeframe.`
            : cn.resolution === 'adjust_next_invoice'
            ? `₹${fmtAmt(credit)} will be adjusted/deducted from the client's next invoice.`
            : `This credit note is ${RESOLUTION_LABEL[cn.resolution] || cn.resolution}.`}
        </div>

        {/* Signatures */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 48 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 2 }}>For {COMPANY.name}</div>
            <div style={{ height: 40 }} />
            <div style={{ borderTop: '1px solid #333', paddingTop: 4, width: 180 }}>
              <div style={{ fontSize: 11 }}>Authorized Signatory</div>
              <div style={{ fontSize: 11 }}>For {COMPANY.name}</div>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ height: 60 }} />
            <div style={{ borderTop: '1px solid #333', paddingTop: 4, width: 220 }}>
              <div style={{ fontSize: 11 }}>Acknowledged By</div>
              <div style={{ fontSize: 11 }}>{client?.company || client?.name || '—'}</div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ borderTop: '2px dashed #aaa', paddingTop: 12, textAlign: 'center', marginTop: 32 }}>
          <div style={{ fontSize: 12, fontWeight: 700 }}>{COMPANY.name} ({COMPANY.tagline})</div>
          <div style={{ fontSize: 11, color: '#555' }}>Mumbai | Thane | Navi Mumbai</div>
          <div style={{ fontSize: 11, color: '#555' }}>Contact: {COMPANY.phone}</div>
          <div style={{ fontSize: 11, color: '#3B82F6', textDecoration: 'underline' }}>{COMPANY.website}</div>
        </div>
      </div>
    </>
  );
}
