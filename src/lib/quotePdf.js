// Branded side-by-side quote comparison, as a PDF and as WhatsApp text.
import { catLabel } from './constants';
import { fmtDate, inr, num, todayISO } from './utils';

const rs = (n) => 'Rs. ' + Math.round(num(n)).toLocaleString('en-IN');
const BRAND = [116, 69, 209];
const INK = [11, 11, 18];
const MUTE = [74, 74, 90];

export const coverLabel = (category) => (category === 'motor' ? 'IDV' : category === 'life' ? 'Sum assured' : 'Sum insured');
export const optionTotal = (o) => num(o.premium) + Math.round((num(o.premium) * num(o.gstRate)) / 100);
export const cheapest = (options) => options.reduce((best, o) => (num(o.premium) > 0 && (!best || optionTotal(o) < optionTotal(best)) ? o : best), null);

function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      c.getContext('2d').drawImage(img, 0, 0);
      resolve({ data: c.toDataURL('image/png'), w: img.naturalWidth, h: img.naturalHeight });
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

export async function buildQuotePdf(quote, customer, profile) {
  const [{ jsPDF }, { default: autoTable }, logo] = await Promise.all([import('jspdf'), import('jspdf-autotable'), loadImage('/brand/logo-full.png')]);
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 40;
  const options = quote.options.filter((o) => o.insurer);
  const best = options.find((o) => o.recommended) || cheapest(options);

  if (logo) doc.addImage(logo.data, 'PNG', M, M - 10, (logo.w / logo.h) * 54, 54);
  doc.setFont('helvetica', 'bold').setFontSize(18).setTextColor(...INK).text('Insurance Quote Comparison', W - M, M + 10, { align: 'right' });
  doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(...MUTE);
  doc.text(`Prepared on ${fmtDate(quote.date || todayISO())}${quote.validTill ? `  |  Valid till ${fmtDate(quote.validTill)}` : ''}`, W - M, M + 26, { align: 'right' });
  doc.setDrawColor(...BRAND).setLineWidth(1.5).line(M, M + 52, W - M, M + 52);

  // Customer and requirement
  let y = M + 76;
  doc.setFont('helvetica', 'bold').setFontSize(11).setTextColor(...INK).text(`Prepared for: ${customer.name || 'Customer'}`, M, y);
  doc.setFont('helvetica', 'normal').setFontSize(10).setTextColor(...MUTE);
  y += 16;
  doc.text(`${catLabel(quote.category)} insurance${quote.title ? ` - ${quote.title}` : ''}`, M, y);
  if (quote.details) {
    const lines = doc.splitTextToSize(quote.details, W - M * 2);
    y += 14;
    doc.text(lines, M, y);
    y += (lines.length - 1) * 12;
  }

  const head = ['', ...options.map((o) => (o === best ? `${o.insurer}\n(Recommended)` : o.insurer))];
  const row = (label, fn) => [label, ...options.map(fn)];
  autoTable(doc, {
    startY: y + 18,
    head: [head],
    body: [
      row('Plan', (o) => o.plan || '-'),
      row(coverLabel(quote.category), (o) => (num(o.cover) ? rs(o.cover) : '-')),
      row('Premium (before GST)', (o) => rs(o.premium)),
      row('GST', (o) => `${num(o.gstRate)}%  (${rs(optionTotal(o) - num(o.premium))})`),
      row('Total payable', (o) => rs(optionTotal(o))),
      row('Key benefits', (o) => o.features || '-'),
    ],
    margin: { left: M, right: M },
    styles: { font: 'helvetica', fontSize: 9, cellPadding: 6, textColor: INK, lineColor: [236, 230, 247], lineWidth: 0.6, valign: 'top' },
    headStyles: { fillColor: BRAND, textColor: 255, fontStyle: 'bold', halign: 'center', valign: 'middle' },
    columnStyles: { 0: { fontStyle: 'bold', fillColor: [248, 245, 255], cellWidth: 110 } },
    didParseCell: (data) => {
      const o = options[data.column.index - 1];
      if (data.section === 'body' && o === best) {
        data.cell.styles.fillColor = [241, 234, 255];
        if (data.row.index === 4) data.cell.styles.textColor = BRAND;
      }
      if (data.section === 'body' && data.row.index === 4) data.cell.styles.fontStyle = 'bold';
      if (data.section === 'body' && data.column.index > 0 && data.row.index < 5) data.cell.styles.halign = 'center';
    },
  });

  y = doc.lastAutoTable.finalY + 22;
  if (quote.notes) {
    doc.setFont('helvetica', 'bold').setFontSize(10).setTextColor(...INK).text('Advisor note', M, y);
    const lines = doc.splitTextToSize(quote.notes, W - M * 2);
    doc.setFont('helvetica', 'normal').setFontSize(9.5).setTextColor(...MUTE).text(lines, M, y + 14);
    y += 14 + lines.length * 12 + 8;
  }

  // Advisor contact
  const contact = [profile.name, profile.agency, profile.phone, profile.email].filter(Boolean).join('  |  ');
  doc.setFillColor(248, 245, 255).setDrawColor(236, 230, 247).roundedRect(M, H - 108, W - M * 2, 46, 6, 6, 'FD');
  doc.setFont('helvetica', 'bold').setFontSize(10).setTextColor(...INK).text('Your insurance advisor', M + 14, H - 88);
  doc.setFont('helvetica', 'normal').setFontSize(9.5).setTextColor(...MUTE).text(contact || '-', M + 14, H - 72);
  doc.setFontSize(7.5).setTextColor(138, 138, 154).text(
    'Premiums are as quoted by the insurers on the date above and may change at issuance. Please read the policy wordings for full terms, conditions and exclusions.',
    M, H - 40, { maxWidth: W - M * 2 },
  );
  return doc;
}

export function quoteText(quote, customer, profile) {
  const options = quote.options.filter((o) => o.insurer);
  const best = options.find((o) => o.recommended) || cheapest(options);
  const lines = [
    `Dear ${customer.name || 'Sir/Madam'},`,
    '',
    `Here is the comparison for your ${catLabel(quote.category).toLowerCase()} insurance${quote.title ? ` (${quote.title})` : ''}:`,
    '',
    ...options.flatMap((o, i) => [
      `*${i + 1}. ${o.insurer}*${o === best ? ' (Recommended)' : ''}`,
      o.plan ? `Plan: ${o.plan}` : null,
      num(o.cover) ? `${coverLabel(quote.category)}: ${inr(o.cover)}` : null,
      `Total payable: *${inr(optionTotal(o))}*${num(o.gstRate) ? ` (incl. ${num(o.gstRate)}% GST)` : ''}`,
      o.features ? `Benefits: ${o.features}` : null,
      '',
    ]),
    quote.notes || null,
    quote.validTill ? `Rates valid till ${fmtDate(quote.validTill)}.` : null,
    'Reply with the option you prefer and I will arrange the policy.',
    '',
    'Regards,',
    [profile.name, profile.agency].filter(Boolean).join(', '),
    profile.phone || null,
  ];
  return lines.filter((l) => l !== null).join('\n');
}
