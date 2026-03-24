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

const TERMS = [
  'All equipments contains comprehensive warranty. Any claims regarding physical damage or quantity shortage must be informed within 24 hours of delivery. Further terms and conditions are according to the contract.',
  'I/We hereby certify that my/our registration certificate under Goods and Service Tax Act 2017 is in force on the date on which the sale of goods specified in this TAX Invoice is made by me/us and that the transaction of sale covered by TAX Invoice has been effected by m/us and it shall be accounted for in the turnover of Movable Rental Properties while filing of the returns and the due tax, if any payable on the sale has been paid or shall be paid.',
];

const fmtDate = (d?: string) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';

const fmtAmt = (n: any) =>
  Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function BulkInvoicePage() {
  const params  = useParams();
  const bulkId  = decodeURIComponent(params.bulk_id as string);

  const [rentals, setRentals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await api.rentals.list({ bulk_id: bulkId, per_page: '100' });
      const all  = res.data?.data || res.data || [];
      setRentals(all.filter((r: any) => r.bulk_id === bulkId));
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [bulkId]);

  useEffect(() => { load(); }, [load]);

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

  const client   = rentals[0]?.client;
  const today    = new Date();

  // Per-row calculations
  const rows = rentals.map(r => {
    const monthly  = Number(r.monthly_rental || 0);
    const qty      = Number(r.quantity || 1);
    const gstPct   = Number(r.gst_percent || 18);
    const startDate = r.delivery_date ? new Date(r.delivery_date) : null;
    const days     = startDate
      ? Math.max(1, Math.ceil((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)))
      : (r.duration_days ?? 0);
    const prorated = Number(r.pro_rental || r.total || (monthly * qty));
    const total    = Number(r.total || (monthly * qty));
    const inv      = r.inventory;
    const product  = [inv?.brand, inv?.model_no].filter(Boolean).join(' ');
    const specs    = [inv?.cpu, inv?.generation ? `${inv.generation} Gen` : '', inv?.ram, inv?.ssd].filter(Boolean).join('-');
    return { r, monthly, qty, gstPct, days, prorated, total, inv, product, specs };
  });

  // Group by inventory type
  const laptopRows  = rows.filter(({ inv }) => (inv?.type || 'office') !== 'desktop');
  const desktopRows = rows.filter(({ inv }) => inv?.type === 'desktop');

  const grossTotal = rows.reduce((s, { total }) => s + total, 0);
  // Use gst_percent from first rental (assumed same for bulk)
  const gstPct     = Number(rentals[0]?.gst_percent || 18);
  const halfPct    = gstPct / 2;
  const gstAmt     = rows.reduce((s, r) => s + Number(r.r.gst_amount || (r.total * r.gstPct / 100)), 0);
  const sgst       = +(gstAmt / 2).toFixed(2);
  const cgst       = +(gstAmt / 2).toFixed(2);
  const grandTotal = rows.reduce((s, r) => s + Number(r.r.grand_total || (r.total + r.total * r.gstPct / 100)), 0);

  function ProductRows({ items }: { items: typeof rows }) {
    return (
      <>
        {items.map(({ r, monthly, qty, days, prorated, total, product, specs }) => (
          <tr key={r.id}>
            <td>
              <div style={{ fontWeight: 700 }}>{product}</div>
              {specs && <div style={{ fontSize: 11, color: '#555' }}>{specs}</div>}
              {r.inventory?.asset_code && <div style={{ fontSize: 10, color: '#888' }}>Code: {r.inventory.asset_code}</div>}
            </td>
            <td style={{ textAlign: 'center' }}>{qty}</td>
            <td style={{ textAlign: 'center' }}>{fmtDate(r.delivery_date)}</td>
            <td style={{ textAlign: 'center' }}>{days}</td>
            <td style={{ textAlign: 'right' }}>{fmtAmt(monthly)}</td>
            <td style={{ textAlign: 'right' }}>{fmtAmt(prorated)}</td>
            <td style={{ textAlign: 'right' }}>{fmtAmt(total)}</td>
          </tr>
        ))}
      </>
    );
  }

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
        .group-header td { background: #d9e1f2; font-weight: 700; font-size: 12px; }
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
        <span style={{ color: '#64748B', fontSize: 13 }}>{bulkId} — Bulk Invoice</span>
        <button onClick={() => window.print()}
          style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, background: '#3B82F6', color: 'white', border: 'none', borderRadius: 8, padding: '8px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
          <Printer size={15} /> Print / Save as PDF
        </button>
      </div>

      {/* Invoice */}
      <div className="page" style={{ background: 'white', maxWidth: 960, margin: '24px auto', padding: '32px 36px', boxShadow: '0 4px 24px rgba(0,0,0,0.1)' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 48, height: 48, borderRadius: 10, background: 'linear-gradient(135deg,#1e3a5f,#3B82F6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 900, fontSize: 14 }}>LR</div>
            <div style={{ fontWeight: 900, fontSize: 20, color: '#1e3a5f', lineHeight: 1.1 }}>
              Laptop<span style={{ color: '#3B82F6' }}>Rental</span>
            </div>
          </div>
          <div style={{ textAlign: 'center', flex: 1 }}>
            <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: 1 }}>Estimation</div>
          </div>
          <div style={{ textAlign: 'right', fontSize: 12 }}>
            <div>Est No:- {bulkId}</div>
            <div>Date: {fmtDate(today.toISOString())}</div>
          </div>
        </div>

        {/* To / From */}
        <table style={{ marginBottom: 20 }}>
          <tbody>
            <tr>
              <td style={{ width: '50%', verticalAlign: 'top', padding: 12 }}>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>To,</div>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{client?.company || client?.name || '—'}</div>
                {client?.company && client?.name && <div>{client.name}</div>}
                {client?.phone && <div>Contact Number- {client.phone}</div>}
                {client?.email && <div>Email: {client.email}</div>}
                {client?.address && <div>Address: {client.address}</div>}
              </td>
              <td style={{ width: '50%', verticalAlign: 'top', padding: 12 }}>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>From,</div>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{COMPANY.name}</div>
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
        <table style={{ marginBottom: 4 }}>
          <thead>
            <tr>
              <th rowSpan={2} style={{ textAlign: 'left', width: '32%' }}>Product</th>
              <th rowSpan={2} style={{ width: 40 }}>Qty</th>
              <th colSpan={2}>Duration</th>
              <th rowSpan={2} style={{ width: '13%' }}>Monthly Rental</th>
              <th rowSpan={2} style={{ width: '13%' }}>Prorated Rental</th>
              <th rowSpan={2} style={{ width: '13%' }}>Total</th>
            </tr>
            <tr>
              <th style={{ width: '10%' }}>Start Date</th>
              <th style={{ width: '7%' }}>Days</th>
            </tr>
          </thead>
          <tbody>
            {laptopRows.length > 0 && (
              <tr className="group-header"><td colSpan={7}>Laptop</td></tr>
            )}
            <ProductRows items={laptopRows} />
            {desktopRows.length > 0 && (
              <tr className="group-header"><td colSpan={7}>Desktop</td></tr>
            )}
            <ProductRows items={desktopRows} />
            {rentals[0]?.notes && (
              <tr>
                <td colSpan={7} style={{ fontSize: 11, color: '#555', fontStyle: 'italic', background: '#fafafa' }}>
                  Note: {rentals[0].notes}
                </td>
              </tr>
            )}
            <tr><td colSpan={7} style={{ border: 'none', height: 8 }} /></tr>
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={5} className="no-border" />
              <td className="right bold">Gross Total</td>
              <td className="right bold">{fmtAmt(grossTotal)}</td>
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

        {/* Terms */}
        <div style={{ marginTop: 20, marginBottom: 24 }}>
          <div style={{ fontWeight: 700, marginBottom: 6, fontSize: 12 }}>Terms and Conditions</div>
          {TERMS.map((t, i) => (
            <p key={i} style={{ fontSize: 11, color: '#333', marginBottom: 6, lineHeight: 1.6 }}>{t}</p>
          ))}
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
              <div style={{ fontSize: 11 }}>Authorized Signatory &amp; Stamp</div>
              <div style={{ fontSize: 11 }}>For {client?.company || client?.name || '—'}</div>
            </div>
          </div>
        </div>

        {/* Footer */}
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
