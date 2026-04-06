/* ── AI helper ─────────────────────────────────────────────────────────── */

export interface InvoiceEmail {
  subject: string;
  body:    string;
}

async function callAI(prompt: string): Promise<string> {
  const res = await fetch('/api/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'AI generation failed');
  }
  const data = await res.json();
  return data.text as string;
}

/* ── Invoice email (single rental) ── */
export async function generateInvoiceEmail(rental: any): Promise<InvoiceEmail> {
  const fmtDate = (d?: string) =>
    d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

  const paymentType = rental.client?.payment_type || 'advance';
  const isAdvance   = paymentType === 'advance';

  const paymentContext = isAdvance
    ? `PAYMENT MODEL: ADVANCE
- This client pays in ADVANCE — payment is collected BEFORE the rental period begins.
- Billing starts from the Delivery Date and covers until the end of that month.
- The email should request upfront payment or confirm that advance payment is due/received.
- Tone: proactive, requesting payment before the period starts.`
    : `PAYMENT MODEL: POSTPAID
- This client is POSTPAID — payment is due AFTER the month is fully completed.
- The invoice covers the completed rental period from start to end date.
- The email should present this as an invoice for services already rendered.
- Tone: professional, requesting payment for the completed period.`;

  const prompt = `You are an email writer for a professional laptop rental company called "LaptopRent".
Generate a polished invoice email for the following rental.

CLIENT:
- Name: ${rental.client?.name || 'Valued Client'}
- Company: ${rental.client?.company || ''}
- Email: ${rental.client?.email || ''}

RENTAL:
- Rental No: ${rental.rental_no}
- Laptop: ${rental.inventory?.brand || ''} ${rental.inventory?.model_no || ''}
- Asset Code: ${rental.inventory?.asset_code || ''}
- Delivery Date: ${fmtDate(rental.delivery_date || rental.start_date)}
- Billing Period: ${fmtDate(rental.start_date)} to ${fmtDate(rental.end_date)}
- Duration: ${rental.duration_days || ''} days

BILLING:
- Monthly Rental: ₹${Number(rental.monthly_rental || 0).toLocaleString('en-IN')}
- Grand Total: ₹${Number(rental.grand_total || 0).toLocaleString('en-IN')}
- GST (${rental.gst_percent || 18}%): ₹${Number(rental.gst_amount || 0).toLocaleString('en-IN')}

${paymentContext}

INSTRUCTIONS:
- Write a concise, professional, and warm email
- Mention the invoice is attached
- Reference the rental number in the subject
- Clearly reflect the payment model (advance or postpaid) in the email tone and wording
- Do NOT use markdown formatting or bullet points in the body — plain text only
- Keep body to 3 short paragraphs: greeting+rental summary, billing highlight, closing with contact offer
- Sign off as "LaptopRent Team"

Respond ONLY with a valid JSON object, no extra text:
{"subject":"...","body":"..."}`;

  const raw = await callAI(prompt);

  // Parse JSON from response (handle possible markdown code fences)
  const jsonStr = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/, '').trim();
  const parsed: InvoiceEmail = JSON.parse(jsonStr);
  return parsed;
}

/* ── Invoice email (bulk rental) ── */
export async function generateBulkInvoiceEmail(rentals: any[]): Promise<InvoiceEmail> {
  const fmtDate  = (d?: string) =>
    d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
  const client   = rentals[0]?.client;
  const bulkId   = rentals[0]?.bulk_id || '';
  const grandSum = rentals.reduce((s, r) => s + Number(r.grand_total || 0), 0);
  const gstSum   = rentals.reduce((s, r) => s + Number(r.gst_amount  || 0), 0);

  const paymentType = client?.payment_type || 'advance';
  const isAdvance   = paymentType === 'advance';

  const paymentContext = isAdvance
    ? `PAYMENT MODEL: ADVANCE
- This client pays in ADVANCE — payment is collected BEFORE the rental period begins.
- Billing starts from the Delivery Date and covers until the end of that month.
- Request upfront payment for all laptops in this bulk order.
- Tone: proactive, requesting advance payment.`
    : `PAYMENT MODEL: POSTPAID
- This client is POSTPAID — payment is due AFTER the month is fully completed.
- The invoice covers the completed rental period for all laptops.
- Present this as an invoice for services already rendered.
- Tone: professional, requesting payment for the completed period.`;

  const laptopList = rentals
    .map(r => `• ${r.inventory?.brand || ''} ${r.inventory?.model_no || ''} (${r.rental_no}) — Period: ${fmtDate(r.start_date)} to ${fmtDate(r.end_date)}`)
    .join('\n');

  const prompt = `You are an email writer for a professional laptop rental company called "LaptopRent".
Generate a polished invoice email for a BULK laptop rental order.

CLIENT:
- Name: ${client?.name || 'Valued Client'}
- Company: ${client?.company || ''}
- Email: ${client?.email || ''}

BULK ORDER:
- Bulk ID: ${bulkId}
- Total Laptops: ${rentals.length}
- Laptops:
${laptopList}

BILLING:
- Grand Total: ₹${grandSum.toLocaleString('en-IN')}
- Total GST: ₹${gstSum.toLocaleString('en-IN')}

${paymentContext}

INSTRUCTIONS:
- Write a concise, professional, and warm email
- Mention the invoice is attached
- Reference the bulk order and number of laptops
- Clearly reflect the payment model (advance or postpaid) in the email tone and wording
- Do NOT use markdown formatting or bullet points in the body — plain text only
- Keep body to 3 short paragraphs: greeting+order summary, billing highlight, closing
- Sign off as "LaptopRent Team"

Respond ONLY with a valid JSON object, no extra text:
{"subject":"...","body":"..."}`;

  const raw = await callAI(prompt);
  const jsonStr = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/, '').trim();
  const parsed: InvoiceEmail = JSON.parse(jsonStr);
  return parsed;
}

/* ── Advance invoice email ── */
export async function generateAdvanceInvoiceEmail(rental: any, advanceDays: number): Promise<InvoiceEmail> {
  const fmtDate = (d?: string) =>
    d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

  const prompt = `You are an email writer for a professional laptop rental company called "LaptopRent".
Generate a polished ADVANCE INVOICE email — this is a reminder sent ${advanceDays} days before the next billing cycle.

CLIENT:
- Name: ${rental.client?.name || 'Valued Client'}
- Company: ${rental.client?.company || ''}

RENTAL:
- Rental No: ${rental.rental_no}
- Laptop: ${rental.inventory?.brand || ''} ${rental.inventory?.model_no || ''}
- End Date: ${fmtDate(rental.end_date)}

BILLING:
- Monthly Rental: ₹${Number(rental.monthly_rental || 0).toLocaleString('en-IN')}
- Grand Total: ₹${Number(rental.grand_total || 0).toLocaleString('en-IN')}

INSTRUCTIONS:
- This is an advance notice / proforma invoice — mention it clearly
- Mention the invoice is attached for their records
- Keep it short and friendly — 2-3 paragraphs
- Plain text only, no markdown
- Sign off as "LaptopRent Team"

Respond ONLY with a valid JSON object, no extra text:
{"subject":"...","body":"..."}`;

  const raw = await callAI(prompt);
  const jsonStr = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/, '').trim();
  const parsed: InvoiceEmail = JSON.parse(jsonStr);
  return parsed;
}
