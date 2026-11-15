// Turns any calculator result into a branded PDF or a WhatsApp message.
// summary = { title, subtitle, highlight: { label, value }, sections: [{ heading, rows: [[label, value]] }], note }
import { fmtDate, todayISO } from './utils';

const BRAND = [116, 69, 209];
const INK = [11, 11, 18];
const MUTE = [74, 74, 90];
// The PDF's built-in font has no rupee glyph.
const pdfText = (s) => String(s ?? '').replace(/₹/g, 'Rs. ');

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

export async function buildCalcPdf(summary, profile, customerName) {
  const [{ jsPDF }, { default: autoTable }, logo] = await Promise.all([import('jspdf'), import('jspdf-autotable'), loadImage('/brand/logo-full.png')]);
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 40;

  if (logo) doc.addImage(logo.data, 'PNG', M, M - 10, (logo.w / logo.h) * 54, 54);
  doc.setFont('helvetica', 'bold').setFontSize(17).setTextColor(...INK).text(pdfText(summary.title), W - M, M + 10, { align: 'right' });
  doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(...MUTE).text(`Prepared on ${fmtDate(todayISO())}`, W - M, M + 26, { align: 'right' });
  doc.setDrawColor(...BRAND).setLineWidth(1.5).line(M, M + 52, W - M, M + 52);

  let y = M + 74;
  if (customerName) {
    doc.setFont('helvetica', 'bold').setFontSize(11).setTextColor(...INK).text(`Prepared for: ${pdfText(customerName)}`, M, y);
    y += 16;
  }
  if (summary.subtitle) {
    const lines = doc.splitTextToSize(pdfText(summary.subtitle), W - M * 2);
    doc.setFont('helvetica', 'normal').setFontSize(10).setTextColor(...MUTE).text(lines, M, y);
    y += lines.length * 12 + 4;
  }
  if (summary.highlight) {
    doc.setFillColor(241, 234, 255).setDrawColor(221, 205, 255).roundedRect(M, y, W - M * 2, 52, 8, 8, 'FD');
    doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(...MUTE).text(pdfText(summary.highlight.label), M + 16, y + 20);
    doc.setFont('helvetica', 'bold').setFontSize(18).setTextColor(...BRAND).text(pdfText(summary.highlight.value), M + 16, y + 41);
    y += 66;
  }

  summary.sections.forEach((s) => {
    if (y > H - 160) { doc.addPage(); y = M; }
    autoTable(doc, {
      startY: y,
      head: s.heading ? [[{ content: pdfText(s.heading), colSpan: 2 }]] : undefined,
      body: s.rows.map(([l, v]) => [pdfText(l), pdfText(v)]),
      margin: { left: M, right: M },
      styles: { font: 'helvetica', fontSize: 9.5, cellPadding: 6, textColor: INK, lineColor: [236, 230, 247], lineWidth: 0.6 },
      headStyles: { fillColor: BRAND, textColor: 255, fontStyle: 'bold' },
      columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
    });
    y = doc.lastAutoTable.finalY + 14;
  });

  if (summary.note) {
    const lines = doc.splitTextToSize(pdfText(summary.note), W - M * 2);
    doc.setFont('helvetica', 'normal').setFontSize(8.5).setTextColor(...MUTE).text(lines, M, Math.min(y + 4, H - 140));
  }

  const contact = [profile.name, profile.agency, profile.phone, profile.email].filter(Boolean).join('  |  ');
  doc.setFillColor(248, 245, 255).setDrawColor(236, 230, 247).roundedRect(M, H - 104, W - M * 2, 46, 6, 6, 'FD');
  doc.setFont('helvetica', 'bold').setFontSize(10).setTextColor(...INK).text('Your insurance advisor', M + 14, H - 84);
  doc.setFont('helvetica', 'normal').setFontSize(9.5).setTextColor(...MUTE).text(contact || '-', M + 14, H - 68);
  doc.setFontSize(7.5).setTextColor(138, 138, 154).text('Indicative figures for discussion. Final premiums and claim amounts are decided by the insurer as per the policy terms.', M, H - 38, { maxWidth: W - M * 2 });
  return doc;
}

export function calcText(summary, profile, customerName) {
  return [
    customerName ? `Dear ${customerName},` : null,
    customerName ? '' : null,
    `*${summary.title}*`,
    summary.subtitle || null,
    '',
    summary.highlight ? `${summary.highlight.label}: *${summary.highlight.value}*` : null,
    summary.highlight ? '' : null,
    ...summary.sections.flatMap((s) => [s.heading ? `_${s.heading}_` : null, ...s.rows.map(([l, v]) => `${l}: ${v}`), '']),
    summary.note || null,
    '',
    'Regards,',
    [profile.name, profile.agency].filter(Boolean).join(', '),
    profile.phone || null,
  ].filter((l) => l !== null).join('\n').replace(/\n{3,}/g, '\n\n');
}
