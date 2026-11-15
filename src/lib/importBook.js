// Turns an agent's existing spreadsheet (Excel .xlsx or .csv) into clients and policies.
import { blankPolicy, defaultGst } from './constants';
import { addDays, addYears, toISO } from './utils';

// Target fields, with the column headings agents commonly use for each.
export const IMPORT_FIELDS = [
  { key: 'name', label: 'Customer name', group: 'Client', required: true, match: ['customer name', 'client name', 'insured name', 'name of insured', 'proposer name', 'policy holder', 'policyholder', 'customer', 'client', 'insured', 'name'] },
  { key: 'phone', label: 'Mobile', group: 'Client', match: ['mobile', 'mobile no', 'mobile number', 'phone', 'phone no', 'contact', 'contact no', 'whatsapp', 'cell'] },
  { key: 'email', label: 'Email', group: 'Client', match: ['email', 'email id', 'e-mail', 'mail'] },
  { key: 'dob', label: 'Date of birth', group: 'Client', match: ['dob', 'date of birth', 'birth date', 'birthday'] },
  { key: 'city', label: 'City', group: 'Client', match: ['city', 'town', 'location'] },
  { key: 'address', label: 'Address', group: 'Client', match: ['address', 'full address', 'residential address'] },

  { key: 'category', label: 'Insurance type', group: 'Policy', match: ['type', 'policy type', 'insurance type', 'line', 'lob', 'line of business', 'segment', 'category', 'product type'] },
  { key: 'insurer', label: 'Insurer', group: 'Policy', match: ['insurer', 'insurance company', 'company', 'insurer name', 'insurance co'] },
  { key: 'policyNumber', label: 'Policy number', group: 'Policy', match: ['policy no', 'policy number', 'policy #', 'policy', 'certificate no'] },
  { key: 'product', label: 'Plan / product', group: 'Policy', match: ['plan', 'product', 'plan name', 'product name', 'scheme'] },
  { key: 'startDate', label: 'Start date', group: 'Policy', match: ['start date', 'policy start', 'start', 'from', 'from date', 'risk start', 'inception date', 'commencement date'] },
  { key: 'endDate', label: 'Expiry date', group: 'Policy', match: ['end date', 'expiry', 'expiry date', 'expiry dt', 'renewal date', 'due date', 'to', 'to date', 'policy end', 'valid till', 'maturity'] },
  { key: 'issueDate', label: 'Issue date', group: 'Policy', match: ['issue date', 'issued on', 'booking date', 'business date', 'sale date'] },
  { key: 'sumInsured', label: 'Sum insured', group: 'Policy', match: ['sum insured', 'sum assured', 'si', 'cover', 'cover amount'] },

  { key: 'regNo', label: 'Vehicle number', group: 'Motor', match: ['vehicle no', 'vehicle number', 'registration no', 'registration number', 'reg no', 'regn no', 'veh no', 'rto no'] },
  { key: 'make', label: 'Make', group: 'Motor', match: ['make', 'manufacturer', 'brand'] },
  { key: 'model', label: 'Model', group: 'Motor', match: ['model', 'variant', 'model variant', 'vehicle model'] },
  { key: 'engineNo', label: 'Engine number', group: 'Motor', match: ['engine no', 'engine number', 'engine'] },
  { key: 'chassisNo', label: 'Chassis number', group: 'Motor', match: ['chassis no', 'chassis number', 'chassis', 'vin'] },
  { key: 'mfgYear', label: 'Year of manufacture', group: 'Motor', match: ['mfg year', 'year of manufacture', 'manufacturing year', 'yom', 'year'] },
  { key: 'fuel', label: 'Fuel', group: 'Motor', match: ['fuel', 'fuel type'] },
  { key: 'coverType', label: 'Cover (Comp / TP / OD)', group: 'Motor', match: ['cover type', 'coverage', 'policy cover', 'package', 'comp tp od'] },
  { key: 'idv', label: 'IDV', group: 'Motor', match: ['idv', 'insured declared value'] },
  { key: 'ncb', label: 'NCB %', group: 'Motor', match: ['ncb', 'ncb %', 'no claim bonus'] },

  { key: 'odPremium', label: 'OD premium', group: 'Premium', match: ['od premium', 'own damage premium', 'od'] },
  { key: 'tpPremium', label: 'TP premium', group: 'Premium', match: ['tp premium', 'third party premium', 'tp', 'liability premium'] },
  { key: 'netPremium', label: 'Net premium', group: 'Premium', match: ['net premium', 'net', 'premium before gst', 'basic premium', 'premium'] },
  { key: 'gstRate', label: 'GST %', group: 'Premium', match: ['gst %', 'gst rate', 'tax %'] },
  { key: 'totalPremium', label: 'Total premium (with GST)', group: 'Premium', match: ['total premium', 'gross premium', 'total', 'premium with gst', 'final premium', 'amount'] },
  { key: 'commissionRate', label: 'Commission %', group: 'Premium', match: ['commission %', 'comm %', 'commission rate', 'brokerage %', 'payout %'] },
  { key: 'commissionAmount', label: 'Commission amount', group: 'Premium', match: ['commission', 'commission amount', 'comm', 'brokerage', 'payout', 'commission earned'] },
  { key: 'commissionStatus', label: 'Commission received?', group: 'Premium', match: ['commission status', 'comm status', 'received', 'payout status'] },
  { key: 'notes', label: 'Notes', group: 'Policy', match: ['notes', 'remarks', 'remark', 'comments'] },
];

const norm = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9%#]+/g, ' ').trim();

// Pick the best target field for each column heading; each field is used once.
export function autoMap(headers) {
  const used = new Set();
  const mapping = headers.map(() => '');
  // Exact matches first, then "heading contains synonym" matches.
  for (const pass of ['exact', 'contains']) {
    headers.forEach((h, i) => {
      if (mapping[i]) return;
      const n = norm(h);
      if (!n) return;
      let best = null;
      IMPORT_FIELDS.forEach((f) => {
        if (used.has(f.key)) return;
        f.match.forEach((m) => {
          const hit = pass === 'exact' ? n === m : n.includes(m) && m.length >= 3;
          if (hit && (!best || m.length > best.len)) best = { key: f.key, len: m.length };
        });
      });
      if (best) {
        mapping[i] = best.key;
        used.add(best.key);
      }
    });
  }
  return mapping;
}

/* ---------- reading files ---------- */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  const delim = (text.split('\n')[0].match(/;/g) || []).length > (text.split('\n')[0].match(/,/g) || []).length ? ';' : ',';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delim) { row.push(cell); cell = ''; }
    else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (ch !== '\r') cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

export async function readSpreadsheet(file) {
  let rows;
  if (/\.csv$/i.test(file.name) || file.type === 'text/csv') {
    rows = parseCsv((await file.text()).replace(/^﻿/, ''));
  } else if (/\.xlsx$/i.test(file.name)) {
    const { readSheet } = await import('read-excel-file/browser');
    rows = await readSheet(file);
  } else if (/\.xls$/i.test(file.name)) {
    throw new Error('Old .xls files are not supported. In Excel use File > Save As > "Excel Workbook (.xlsx)" or "CSV", then upload that.');
  } else {
    throw new Error('Please upload an Excel (.xlsx) or CSV file.');
  }
  rows = rows.map((r) => r.map((c) => (c == null ? '' : c)));
  // The heading row is the first one with at least three filled cells.
  const headerAt = rows.findIndex((r) => r.filter((c) => String(c).trim()).length >= 3);
  if (headerAt < 0) throw new Error('Could not find a heading row in this sheet.');
  const headers = rows[headerAt].map((h) => String(h).trim());
  const data = rows.slice(headerAt + 1).filter((r) => r.some((c) => String(c).trim()));
  return { headers, data };
}

/* ---------- value parsing ---------- */
const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
export function parseDate(v) {
  if (v instanceof Date && !isNaN(v)) return toISO(new Date(v.getFullYear(), v.getMonth(), v.getDate()));
  if (typeof v === 'number' && v > 20000 && v < 80000) {
    // Excel serial day number
    const d = new Date(Math.round((v - 25569) * 86400000));
    return toISO(new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  }
  const s = String(v || '').trim();
  if (!s) return '';
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  let d, mo, y;
  if (m) [, y, mo, d] = m;
  else if ((m = s.match(/^(\d{1,2})[-/. ](\d{1,2})[-/. ](\d{2,4})$/))) [, d, mo, y] = m; // Indian order: day first
  else if ((m = s.match(/^(\d{1,2})[-/. ]?([A-Za-z]{3})[A-Za-z]*[-/., ]*(\d{2,4})$/))) { d = m[1]; mo = MONTHS[m[2].toLowerCase()]; y = m[3]; }
  else if ((m = s.match(/^([A-Za-z]{3})[A-Za-z]*[ -](\d{1,2}),?[ -](\d{4})$/))) { mo = MONTHS[m[1].toLowerCase()]; d = m[2]; y = m[3]; }
  else return '';
  d = Number(d); mo = Number(mo); y = Number(y);
  if (y < 100) y += 2000;
  if (!d || !mo || mo > 12 || d > 31 || y < 1930 || y > 2100) return '';
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
const money = (v) => {
  if (typeof v === 'number') return v;
  const n = Number(String(v || '').replace(/rs\.?|inr|₹|,|\s/gi, ''));
  return Number.isFinite(n) ? n : 0;
};
const pct = (v) => {
  if (typeof v === 'number') return v > 0 && v < 1 ? +(v * 100).toFixed(2) : v; // Excel stores 15% as 0.15
  const n = Number(String(v || '').replace(/[%\s]/g, ''));
  return Number.isFinite(n) ? n : 0;
};
const text = (v) => (v instanceof Date ? toISO(v) : String(v ?? '').trim());
const digits = (s) => String(s || '').replace(/\D/g, '').slice(-10);

export function categoryOf(value, row) {
  const s = norm(value);
  if (/motor|car|bike|two wheeler|2w|4w|vehicle|private car|commercial|gcv|pcv|tw|pvt car/.test(s)) return 'motor';
  if (/health|mediclaim|medical|floater|critical|hospital/.test(s)) return 'health';
  if (/life|term|endowment|ulip|money back|pension|lic|annuity/.test(s)) return 'life';
  if (/fire|shop|home|marine|travel|burglary|liability|wc|workmen|cyber|engineering|package|sme|property|accident|pa|non motor|misc|general/.test(s)) return 'non_motor';
  if (row.regNo || row.engineNo || row.chassisNo) return 'motor';
  return '';
}
const coverOf = (v) => {
  const s = norm(v);
  if (!s) return '';
  if (/standalone|saod|^od$|own damage only/.test(s)) return 'Standalone OD';
  if (/tp|third|liability|act only/.test(s) && !/comp|package/.test(s)) return 'Third Party';
  return 'Comprehensive';
};
const FUELS = { petrol: 'Petrol', diesel: 'Diesel', cng: 'CNG', electric: 'Electric', ev: 'Electric', hybrid: 'Hybrid', lpg: 'LPG' };

/* ---------- building records ---------- */
export function buildImport({ data, mapping, defaultCategory, clients, policies }) {
  const out = { clients: [], policies: [], skipped: [], matchedClients: 0 };
  const known = clients.map((c) => ({ id: c.id, name: (c.name || '').trim().toLowerCase(), phone: digits(c.phone) }));
  const newClients = new Map(); // key -> temp client
  const existingNumbers = new Set(policies.map((p) => norm(p.policyNumber)).filter(Boolean));
  const seenNumbers = new Set();

  data.forEach((cells, i) => {
    const line = i + 2;
    const r = {};
    mapping.forEach((key, col) => {
      if (key && cells[col] !== undefined && cells[col] !== '') r[key] = cells[col];
    });
    const name = text(r.name);
    if (!name) {
      if (Object.keys(r).length) out.skipped.push({ line, reason: 'No customer name' });
      return;
    }

    // Client: reuse an existing one (same mobile, or same name) or create one per person.
    const phone = digits(r.phone);
    const lower = name.toLowerCase();
    const existing = known.find((c) => (phone && c.phone === phone) || c.name === lower);
    const key = phone || lower;
    let clientRef;
    if (existing) {
      clientRef = { existingId: existing.id };
      out.matchedClients += 1;
    } else {
      if (!newClients.has(key)) {
        const c = { tempKey: key, name, phone: text(r.phone), email: text(r.email), dob: parseDate(r.dob), city: text(r.city), address: text(r.address), source: 'Imported' };
        newClients.set(key, c);
        out.clients.push(c);
      }
      clientRef = { tempKey: key };
    }

    // A row with only client details is fine: it just adds the client.
    const hasPolicy = ['insurer', 'policyNumber', 'endDate', 'startDate', 'netPremium', 'totalPremium', 'regNo', 'product'].some((k) => r[k] !== undefined);
    if (!hasPolicy) return;

    const category = categoryOf(r.category, r) || defaultCategory;
    const policyNumber = text(r.policyNumber);
    const pn = norm(policyNumber);
    if (pn && (existingNumbers.has(pn) || seenNumbers.has(pn))) {
      out.skipped.push({ line, reason: `Policy ${policyNumber} already exists` });
      return;
    }
    if (pn) seenNumbers.add(pn);

    const p = { ...blankPolicy(category), businessType: 'Imported' };
    p.insurer = text(r.insurer);
    p.policyNumber = policyNumber;
    if (r.product) p.product = text(r.product);
    p.startDate = parseDate(r.startDate) || '';
    p.endDate = parseDate(r.endDate) || (p.startDate ? addDays(addYears(p.startDate, 1), -1) : '');
    if (!p.startDate && p.endDate) p.startDate = addDays(addYears(p.endDate, -1), 1);
    p.issueDate = parseDate(r.issueDate) || p.startDate;
    if (!p.endDate) {
      out.skipped.push({ line, reason: 'No start or expiry date' });
      return;
    }
    if (r.sumInsured !== undefined) p.sumInsured = money(r.sumInsured);
    if (r.notes) p.notes = text(r.notes);

    if (category === 'motor') {
      p.regNo = text(r.regNo).replace(/[\s-]/g, '').toUpperCase();
      p.make = text(r.make);
      p.model = text(r.model);
      p.engineNo = text(r.engineNo).toUpperCase();
      p.chassisNo = text(r.chassisNo).toUpperCase();
      if (r.mfgYear) p.mfgYear = Number(String(r.mfgYear).match(/\d{4}/)?.[0]) || '';
      if (r.fuel) p.fuel = FUELS[norm(r.fuel)] || text(r.fuel);
      p.coverType = coverOf(r.coverType) || (r.tpPremium && !r.odPremium ? 'Third Party' : 'Comprehensive');
      if (r.idv !== undefined) p.idv = money(r.idv);
      if (r.ncb !== undefined) p.ncb = String(pct(r.ncb));
      p.odPremium = money(r.odPremium);
      p.tpPremium = money(r.tpPremium);
    }

    p.gstRate = r.gstRate !== undefined ? pct(r.gstRate) : defaultGst(category);
    let net = money(r.netPremium) || (p.odPremium || 0) + (p.tpPremium || 0);
    const total = money(r.totalPremium);
    if (!net && total) net = Math.round(total / (1 + p.gstRate / 100));
    p.netPremium = Math.round(net);
    p.gstAmount = total && net && total > net ? Math.round(total - net) : Math.round((net * p.gstRate) / 100);
    p.totalPremium = total || p.netPremium + p.gstAmount;

    const rate = r.commissionRate !== undefined ? pct(r.commissionRate) : 0;
    const amount = r.commissionAmount !== undefined ? money(r.commissionAmount) : 0;
    p.commissionRate = rate || (amount && net ? +((amount / net) * 100).toFixed(2) : 0);
    p.commissionAmount = Math.round(amount || (net * rate) / 100);
    p.commissionStatus = /^(y|yes|received|paid|done|credited|1|true)$/i.test(text(r.commissionStatus)) ? 'Received' : 'Pending';

    p.clientRef = clientRef;
    out.policies.push(p);
  });

  return out;
}

export function downloadTemplate() {
  const head = ['Customer Name', 'Mobile', 'Email', 'City', 'Date of Birth', 'Insurance Type', 'Insurer', 'Policy No', 'Plan', 'Vehicle No', 'Make', 'Model', 'Engine No', 'Chassis No', 'Mfg Year', 'Cover Type', 'IDV', 'NCB %', 'Sum Insured', 'Start Date', 'Expiry Date', 'OD Premium', 'TP Premium', 'Net Premium', 'GST %', 'Total Premium', 'Commission %', 'Commission Amount', 'Commission Received', 'Notes'];
  const rows = [
    ['Rajesh Sharma', '9820012345', 'rajesh@example.com', 'Pune', '12/03/1984', 'Motor', 'ICICI Lombard', '3001/2451/7781', '', 'MH12RT4521', 'Hyundai', 'Creta SX', 'G4FLNU512877', 'MALPC813LNM114562', '2023', 'Comprehensive', '1150000', '25', '', '18/11/2025', '17/11/2026', '14200', '3416', '17616', '18', '20787', '15', '', 'Yes', ''],
    ['Priya Nair', '9833344556', '', 'Mumbai', '', 'Health', 'Star Health', 'P/151/2025/00871', 'Family Health Optima', '', '', '', '', '', '', '', '', '', '1000000', '01/04/2026', '31/03/2027', '', '', '28400', '0', '28400', '15', '', 'No', 'Family floater, 4 members'],
  ];
  const esc = (v) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const csv = [head, ...rows].map((r) => r.map(esc).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' }));
  a.download = 'imperium-policyone-import-template.csv';
  a.click();
  URL.revokeObjectURL(a.href);
}

