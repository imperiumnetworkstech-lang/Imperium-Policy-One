// Builds a branded PDF report of the agent's whole book. jsPDF is loaded only when needed.
import {
  APP_NAME, CLAIM_STATUSES, LEAD_STAGES, STATUS_META, catLabel, isLive, policyStatus, policyTitle, totalPremium,
} from './constants';
import { fmtDate, num, todayISO } from './utils';

// The PDF's built-in fonts have no rupee glyph, so amounts are written as "Rs. 1,23,456".
const rs = (n) => 'Rs. ' + Math.round(num(n)).toLocaleString('en-IN');
const BRAND = [116, 69, 209];
const INK = [11, 11, 18];
const MUTE = [74, 74, 90];

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

export async function buildBookPdf({ profile, clients, policies, leads, claims }) {
  const [{ jsPDF }, { default: autoTable }, logo] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
    loadImage('/brand/logo-full.png'),
  ]);
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 36;
  const clientName = (id) => clients.find((c) => c.id === id)?.name || '-';

  /* ---------- cover header ---------- */
  if (logo) {
    const lh = 58;
    doc.addImage(logo.data, 'PNG', M, M - 8, (logo.w / logo.h) * lh, lh);
  }
  doc.setFont('helvetica', 'bold').setFontSize(20).setTextColor(...INK);
  doc.text('Book of Business Report', W - M, M + 14, { align: 'right' });
  doc.setFont('helvetica', 'normal').setFontSize(10).setTextColor(...MUTE);
  const who = [profile.name, profile.agency].filter(Boolean).join(' | ');
  if (who) doc.text(who, W - M, M + 32, { align: 'right' });
  doc.text(`Generated on ${fmtDate(todayISO())}`, W - M, M + 46, { align: 'right' });
  doc.setDrawColor(...BRAND).setLineWidth(1.5).line(M, M + 62, W - M, M + 62);

  /* ---------- summary tiles ---------- */
  const live = policies.filter(isLive);
  const pendingComm = policies.filter((p) => p.commissionStatus !== 'Received').reduce((t, p) => t + num(p.commissionAmount), 0);
  const tiles = [
    ['Clients', String(clients.length)],
    ['Total policies', String(policies.length)],
    ['Active policies', String(live.length)],
    ['Total premium', rs(policies.reduce((t, p) => t + num(p.netPremium), 0))],
    ['Commission earned', rs(policies.reduce((t, p) => t + num(p.commissionAmount), 0))],
    ['Commission pending', rs(pendingComm)],
  ];
  const tw = (W - M * 2 - 10 * (tiles.length - 1)) / tiles.length;
  tiles.forEach(([label, value], i) => {
    const x = M + i * (tw + 10);
    const y = M + 78;
    doc.setFillColor(248, 245, 255).setDrawColor(236, 230, 247).roundedRect(x, y, tw, 48, 6, 6, 'FD');
    doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(...MUTE).text(label.toUpperCase(), x + 10, y + 17);
    doc.setFont('helvetica', 'bold').setFontSize(13).setTextColor(...INK).text(value, x + 10, y + 36);
  });

  const table = (title, head, body, opts = {}) => {
    let y = (doc.lastAutoTable?.finalY ?? M + 126) + 26;
    if (y > H - 110) {
      doc.addPage();
      y = M + 10;
    }
    doc.setFont('helvetica', 'bold').setFontSize(13).setTextColor(...INK).text(`${title} (${body.length})`, M, y);
    autoTable(doc, {
      startY: y + 8,
      head: [head],
      body: body.length ? body : [[{ content: 'No records', colSpan: head.length, styles: { halign: 'center', textColor: MUTE } }]],
      margin: { left: M, right: M, bottom: 40 },
      styles: { font: 'helvetica', fontSize: 8, cellPadding: 4, textColor: INK, lineColor: [236, 230, 247], lineWidth: 0.5, overflow: 'linebreak' },
      headStyles: { fillColor: BRAND, textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [250, 248, 255] },
      ...opts,
    });
  };

  /* ---------- policies ---------- */
  const sortedPolicies = [...policies].sort((a, b) => (a.endDate || '').localeCompare(b.endDate || ''));
  table(
    'Policies',
    ['Client', 'Type', 'Insurer', 'Policy no.', 'Vehicle / plan', 'Reg. no.', 'Start', 'Expiry', 'Net premium', 'Total', 'Commission', 'Comm. status', 'Status'],
    sortedPolicies.map((p) => [
      clientName(p.clientId), catLabel(p.category), p.insurer || '-', p.policyNumber || '-', policyTitle(p), p.regNo || '-',
      fmtDate(p.startDate), fmtDate(p.endDate), rs(p.netPremium), rs(totalPremium(p)), rs(p.commissionAmount),
      p.commissionStatus || '-', STATUS_META[policyStatus(p)]?.label || '-',
    ]),
    { columnStyles: { 8: { halign: 'right' }, 9: { halign: 'right' }, 10: { halign: 'right' } } },
  );

  /* ---------- clients ---------- */
  table(
    'Clients',
    ['Name', 'Mobile', 'Email', 'City', 'Date of birth', 'Active policies', 'Annual premium'],
    clients.map((c) => {
      const mine = live.filter((p) => p.clientId === c.id);
      return [c.name, c.phone || '-', c.email || '-', c.city || '-', c.dob ? fmtDate(c.dob) : '-', String(mine.length), rs(mine.reduce((t, p) => t + num(p.netPremium), 0))];
    }),
    { columnStyles: { 5: { halign: 'center' }, 6: { halign: 'right' } } },
  );

  /* ---------- leads ---------- */
  table(
    'Leads',
    ['Name', 'Mobile', 'Interested in', 'Expected premium', 'Source', 'Stage', 'Next follow-up', 'Notes'],
    leads.map((l) => [
      l.name, l.phone || '-', catLabel(l.interest), rs(l.expectedPremium), l.source || '-',
      LEAD_STAGES.find((s) => s.id === l.stage)?.label || 'New', l.followUp ? fmtDate(l.followUp) : '-', l.notes || '',
    ]),
    { columnStyles: { 3: { halign: 'right' }, 7: { cellWidth: 180 } } },
  );

  /* ---------- claims ---------- */
  table(
    'Claims',
    ['Client', 'Policy', 'Claim no.', 'Date of loss', 'Type', 'Claimed', 'Settled', 'Status'],
    claims.map((k) => {
      const p = policies.find((x) => x.id === k.policyId);
      return [clientName(k.clientId || p?.clientId), p ? policyTitle(p) : '-', k.claimNo || '-', fmtDate(k.lossDate), k.type || '-', rs(k.amountClaimed), num(k.amountSettled) ? rs(k.amountSettled) : '-', CLAIM_STATUSES.find((s) => s.id === k.status)?.label || '-'];
    }),
    { columnStyles: { 5: { halign: 'right' }, 6: { halign: 'right' } } },
  );

  /* ---------- footer on every page ---------- */
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(138, 138, 154);
    doc.text(`${APP_NAME} | Confidential client data`, M, H - 18);
    doc.text(`Page ${i} of ${pages}`, W - M, H - 18, { align: 'right' });
  }

  return doc;
}

export async function downloadBookPdf(book) {
  const doc = await buildBookPdf(book);
  doc.save(`imperium-policyone-report-${todayISO()}.pdf`);
}


