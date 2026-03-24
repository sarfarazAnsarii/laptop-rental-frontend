'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { Printer, ArrowLeft } from 'lucide-react';

/* ── Company details — update these to match your business ── */
const COMPANY = {
  name:     'Shine IT Service',
  tagline:  'Laptop Rental Service',
  address:  'Kandapile Building, Plot No-299, Survey No. 386,\nOpp Kandapile Building, Panvel, Navi Mumbai, Raigad-410206',
  phone:    '+91 9833887134 | +91 9920073301',
  email:    'accounts@contact.laptoprentalservice.com',
  gst:      '27BLJPA1270R1ZT',
  hsn:      '997315',
  website:  'www.laptoprentalservice.com',
};

const TERMS = [
  'All equipments contains comprehensive warranty. Any claims regarding physical damage or quantity shortage must be informed within 24 hours of delivery. Further terms and conditions are according to the contract.',
  'I/We hereby certify that my/our registration certificate under Goods and Service Tax Act 2017 is in force on the date on which the sale of goods specified in this TAX Invoice is made by me/us and that the transaction of sale covered by TAX Invoice has been effected by m/us and it shall be accounted for in the turnover of Movable Rental Properties while filing of the returns and the due tax, if any payable on the sale has been paid or shall be paid.',
];

const fmtDate = (d?: string) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';

const fmtAmt = (n: any) =>
  Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function InvoicePage() {
  const params = useParams();
  const id = Number(params.id);
  const [rental, setRental] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await api.rentals.get(id);
      setRental(res.data);
    } catch { /* redirect handled by parent */ }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <div style={{ padding: 40, textAlign: 'center', fontFamily: 'Arial, sans-serif', color: '#666' }}>
      Loading invoice...
    </div>
  );

  if (!rental) return (
    <div style={{ padding: 40, textAlign: 'center', fontFamily: 'Arial, sans-serif', color: '#666' }}>
      Rental not found.
    </div>
  );

  const monthly    = Number(rental.monthly_rental  || 0);
  const qty        = Number(rental.quantity         || 1);
  const gstPct     = Number(rental.gst_percent      || 18);
  const total      = Number(rental.total            || (monthly * qty));
  const gstAmt     = Number(rental.gst_amount       || (total * gstPct / 100));
  const grandTotal = Number(rental.grand_total      || (total + gstAmt));
  const sgst       = +(gstAmt / 2).toFixed(2);
  const cgst       = +(gstAmt / 2).toFixed(2);
  const halfPct    = gstPct / 2;

  const inv    = rental.inventory;
  const client = rental.client;

  const startDate  = rental.delivery_date ? new Date(rental.delivery_date) : null;
  const today      = new Date();
  const daysActive = startDate
    ? Math.max(1, Math.ceil((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)))
    : (rental.duration_days ?? '—');

  const product = [inv?.brand, inv?.model_no].filter(Boolean).join(' ');
  const specs   = [inv?.cpu, inv?.generation ? `${inv.generation} Gen` : '', inv?.ram, inv?.ssd]
    .filter(Boolean).join('-');

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
        .center { text-align: center; }
        .bold { font-weight: bold; }
        .total-row td { background: #d9e1f2; font-weight: bold; }
      `}</style>

      {/* Toolbar — hidden when printing */}
      <div className="no-print" style={{
        background: '#0B1628', padding: '10px 24px',
        display: 'flex', alignItems: 'center', gap: 12,
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <button
          onClick={() => window.history.back()}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.08)', color: '#94A3B8', border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 13, cursor: 'pointer' }}>
          <ArrowLeft size={14} /> Back
        </button>
        <span style={{ color: '#64748B', fontSize: 13 }}>{rental.rental_no} — Invoice</span>
        <button
          onClick={() => window.print()}
          style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, background: '#3B82F6', color: 'white', border: 'none', borderRadius: 8, padding: '8px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
          <Printer size={15} /> Print / Save as PDF
        </button>
      </div>

      {/* Invoice page */}
      <div className="page" style={{
        background: 'white', maxWidth: 900, margin: '24px auto',
        padding: '32px 36px', boxShadow: '0 4px 24px rgba(0,0,0,0.1)',
      }}>

        {/* ── Header ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 48, height: 48, borderRadius: 10,
              background: 'linear-gradient(135deg, #1e3a5f, #3B82F6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'white', fontWeight: 900, fontSize: 14, letterSpacing: -0.5,
            }}>LR</div>
            <div>
              <div style={{ fontWeight: 900, fontSize: 20, color: '#1e3a5f', lineHeight: 1.1 }}>
                Laptop<span style={{ color: '#3B82F6' }}>Rental</span>
              </div>
            </div>
          </div>

          {/* Title */}
          <div style={{ textAlign: 'center', flex: 1 }}>
            <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: 1 }}>Estimation</div>
          </div>

          {/* Est No + Date */}
          <div style={{ textAlign: 'right', fontSize: 12 }}>
            <div>Est No:- {rental.rental_no}</div>
            <div>Date: {fmtDate(rental.delivery_date || rental.created_at)}</div>
          </div>
        </div>

        {/* ── To / From ── */}
        <table style={{ marginBottom: 20 }}>
          <tbody>
            <tr>
              <td style={{ width: '50%', verticalAlign: 'top', padding: 12 }}>
                <div className="bold" style={{ marginBottom: 4 }}>To,</div>
                <div className="bold" style={{ fontSize: 13 }}>{client?.company || client?.name || '—'}</div>
                {client?.company && client?.name && <div>{client.name}</div>}
                {client?.phone   && <div>Contact Number- {client.phone}</div>}
                {client?.email   && <div>Email: {client.email}</div>}
              </td>
              <td style={{ width: '50%', verticalAlign: 'top', padding: 12 }}>
                <div className="bold" style={{ marginBottom: 4 }}>From,</div>
                <div className="bold" style={{ fontSize: 13 }}>{COMPANY.name}</div>
                {COMPANY.address.split('\n').map((line, i) => <div key={i}>{line}</div>)}
                <div>Contact Number- {COMPANY.phone}</div>
                <div>Email ID: {COMPANY.email}</div>
                <div>GST No: {COMPANY.gst}</div>
                <div>HSN Code : {COMPANY.hsn}</div>
              </td>
            </tr>
          </tbody>
        </table>

        {/* ── Product Table ── */}
        <table style={{ marginBottom: 4 }}>
          <thead>
            <tr>
              <th rowSpan={2} style={{ textAlign: 'left', width: '38%' }}>Product</th>
              <th rowSpan={2} style={{ width: 42 }}>Qty</th>
              <th colSpan={2}>Duration</th>
              <th rowSpan={2} style={{ width: '14%' }}>Monthly Rental</th>
              <th rowSpan={2} style={{ width: '14%' }}>Prorated Rental</th>
              <th rowSpan={2} style={{ width: '14%' }}>Total</th>
            </tr>
            <tr>
              <th>Start Date</th>
              <th>Days</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={7} style={{ background: '#d9e1f2', fontWeight: 700 }}>Laptop</td>
            </tr>
            <tr>
              <td>
                <div className="bold">{product}</div>
                {specs && <div style={{ fontSize: 11, color: '#555' }}>{specs}</div>}
                {inv?.asset_code && <div style={{ fontSize: 10, color: '#888' }}>Code: {inv.asset_code}</div>}
              </td>
              <td className="center">{qty}</td>
              <td className="center">{fmtDate(rental.delivery_date)}</td>
              <td className="center">{daysActive}</td>
              <td className="right">{fmtAmt(monthly)}</td>
              <td className="right">{fmtAmt(rental.pro_rental ?? monthly)}</td>
              <td className="right">{fmtAmt(total)}</td>
            </tr>
            {rental.notes && (
              <tr>
                <td colSpan={7} style={{ fontSize: 11, color: '#555', fontStyle: 'italic', background: '#fafafa' }}>
                  Note: {rental.notes}
                </td>
              </tr>
            )}
            <tr>
              <td colSpan={7} className="no-border" style={{ height: 8 }} />
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={5} className="no-border" />
              <td className="right bold">Gross Total</td>
              <td className="right bold">{fmtAmt(total)}</td>
            </tr>
            <tr>
              <td colSpan={5} className="no-border" />
              <td className="right">SGST-{halfPct}%</td>
              <td className="right">{fmtAmt(sgst)}</td>
            </tr>
            <tr>
              <td colSpan={5} className="no-border" />
              <td className="right">CGST-{halfPct}%</td>
              <td className="right">{fmtAmt(cgst)}</td>
            </tr>
            <tr className="total-row">
              <td colSpan={5} className="no-border" />
              <td className="right bold" style={{ border: '1px solid #bbb' }}>Grand Total</td>
              <td className="right bold" style={{ border: '1px solid #bbb' }}>{fmtAmt(grandTotal)}</td>
            </tr>
          </tfoot>
        </table>

        {/* ── Terms & Conditions ── */}
        <div style={{ marginTop: 20, marginBottom: 24 }}>
          <div className="bold" style={{ marginBottom: 6, fontSize: 12 }}>Terms and Conditions</div>
          {TERMS.map((t, i) => (
            <p key={i} style={{ fontSize: 11, color: '#333', marginBottom: 6, lineHeight: 1.6 }}>{t}</p>
          ))}
        </div>

        {/* ── Signatures ── */}
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
              <div style={{ fontSize: 11 }}>Authorized Signatory &amp; Stamp</div>
              <div style={{ fontSize: 11 }}>For {client?.company || client?.name || '—'}</div>
            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        <div style={{ borderTop: '2px dashed #aaa', paddingTop: 12, textAlign: 'center', marginTop: 32 }}>
          <div style={{ fontSize: 12, fontWeight: 700 }}>{COMPANY.name} ({COMPANY.tagline})</div>
          <div style={{ fontSize: 11, color: '#555' }}>Mumbai | Thane | Navi Mumbai</div>
          <div style={{ fontSize: 11, color: '#555' }}>Contact Number: {COMPANY.phone}</div>
          <div style={{ fontSize: 11, color: '#3B82F6', textDecoration: 'underline' }}>{COMPANY.website}</div>
        </div>

      </div>
    </>
  );
}
