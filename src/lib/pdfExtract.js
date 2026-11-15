// Reads a policy PDF in the browser and pulls out the fields the policy form needs.
//
// How it works: the PDF's text is rebuilt into rows of "cells" using each word's position
// on the page. For every field we look for one of its known labels, then take the value
// from (a) the rest of the same cell, (b) the next cells on the same row, or (c) the cell
// directly below the label - which is how insurers' tables are laid out. Every candidate
// value is validated (a name must look like a name, a date like a date...) before use.
// Scanned (image-only) PDFs have no text layer and cannot be read this way.

const INSURER_KEYS = [
  ['icici lombard', 'ICICI Lombard'], ['hdfc ergo', 'HDFC ERGO'], ['bajaj allianz general', 'Bajaj Allianz General'],
  ['bajaj allianz life', 'Bajaj Allianz Life'], ['bajaj allianz', 'Bajaj Allianz General'], ['bajaj general', 'Bajaj Allianz General'],
  ['tata aig', 'Tata AIG General'], ['tata aia', 'Tata AIA Life'], ['new india assurance', 'New India Assurance'],
  ['united india', 'United India Insurance'], ['oriental insurance', 'Oriental Insurance'], ['national insurance', 'National Insurance'],
  ['reliance general', 'Reliance General'], ['sbi general', 'SBI General'], ['sbi life', 'SBI Life'], ['go digit', 'Digit General'],
  ['digit general', 'Digit General'], ['godigit', 'Digit General'], ['acko', 'Acko General'], ['iffco tokio', 'IFFCO Tokio'], ['iffco-tokio', 'IFFCO Tokio'],
  ['royal sundaram', 'Royal Sundaram'], ['cholamandalam', 'Cholamandalam MS'], ['chola ms', 'Cholamandalam MS'],
  ['future generali', 'Future Generali'], ['kotak mahindra general', 'Kotak General'], ['kotak general', 'Kotak General'],
  ['zurich kotak', 'Kotak General'], ['liberty general', 'Liberty General'], ['magma', 'Magma General'], ['shriram general', 'Shriram General'],
  ['universal sompo', 'Universal Sompo'], ['zuno', 'Zuno General'], ['star health', 'Star Health'], ['care health', 'Care Health'],
  ['niva bupa', 'Niva Bupa Health'], ['aditya birla health', 'Aditya Birla Health'], ['manipalcigna', 'ManipalCigna Health'],
  ['manipal cigna', 'ManipalCigna Health'], ['life insurance corporation', 'LIC of India'], ['hdfc life', 'HDFC Life'],
  ['icici prudential', 'ICICI Prudential Life'], ['max life', 'Axis Max Life'], ['kotak life', 'Kotak Life'],
  ['aditya birla sun life', 'Aditya Birla Sun Life'],
];

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const DATE = String.raw`(\d{1,2}\s*[\/\-.]\s*\d{1,2}\s*[\/\-.]\s*\d{2,4}|\d{1,2}(?:st|nd|rd|th)?[\s\-\/.,]*[A-Za-z]{3,9}[\s\-\/.,]*\d{2,4}|\d{4}-\d{2}-\d{2})`;
const DATE_RE = new RegExp(DATE);

function toISO(raw) {
  if (!raw) return '';
  const s = raw.trim();
  let d, m, y;
  let hit = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (hit) [, y, m, d] = hit;
  else if ((hit = s.match(/^(\d{1,2})\s*[\/\-.]\s*(\d{1,2})\s*[\/\-.]\s*(\d{2,4})$/))) [, d, m, y] = hit;
  else {
    hit = s.match(/^(\d{1,2})(?:st|nd|rd|th)?[\s\-\/.,]*([A-Za-z]{3})[A-Za-z]*[\s\-\/.,]*(\d{2,4})$/);
    if (!hit) return '';
    d = hit[1];
    m = MONTHS[hit[2].toLowerCase()];
    y = hit[3];
  }
  d = Number(d); m = Number(m); y = Number(y);
  if (y < 100) y += 2000;
  if (!m || m > 12 || !d || d > 31 || y < 1940 || y > 2100) return '';
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/* ---------- validators: return the cleaned value, or '' when the text is not that kind of value ---------- */
const NEXT_LABEL = /\s+(?:policy|engine|chassis|model|make|variant|cubic|cc\b|year|fuel|mobile|phone|contact|e-?mail|address|period|premium|idv|ncb|seating|colou?r|body|rto|registration|regn|type of|gstin|pan\b|customer id|dob|date|age\b|gender|nominee|relationship|sum insured|plan|product|insured|proposer|intermediary|agent|branch)\b.*$/i;
const JUNK = /^(?:name|address|details?|insured|policy|na|n\/a|nil|none|no|number|of the|not applicable|same as above|-+|:+)$/i;

const vName = (t) => {
  let s = t.replace(/^(?:mrs|mr|ms|miss|dr|m\/s|shri|smt|kum|kumari|master)\.?\s+/i, '');
  s = s.replace(NEXT_LABEL, '').replace(/[\d(,;|].*$/, '').replace(/\s+/g, ' ').trim().replace(/[.\-:]+$/, '').trim();
  if (!/^[A-Za-z][A-Za-z .&'\-]{2,59}$/.test(s) || JUNK.test(s)) return '';
  if (/insurance|premium|schedule|certificate|registration|details|particulars|vehicle|period|policy|address|name\b|number/i.test(s)) return '';
  return s;
};
const vDate = (t) => {
  const m = t.replace(/^\s*\d{1,2}:\d{2}(?::\d{2})?\s*(?:hrs|hours|am|pm)?\s*(?:on|of)?\s*/i, '').match(DATE_RE);
  return m && m.index < 14 ? toISO(m[1]) : '';
};
const vMoney = (min = 1) => (t) => {
  const s = t.replace(/\d{1,2}(?:\.\d+)?\s*%/g, ' ');
  if (/^\D{0,6}\d{1,2}\s*[\/\-]\s*\d{1,2}\s*[\/\-]\s*\d{2,4}/.test(s)) return '';
  const m = s.match(/^[^\d\n]{0,28}?(\d[\d,]*(?:\.\d{1,2})?)(?!\s*(?:cc|kw|yrs?|years?|seats?)\b)/i);
  if (!m) return '';
  const n = Number(m[1].replace(/,/g, ''));
  return Number.isFinite(n) && n >= min ? Math.round(n) : '';
};
const vId = (min = 5) => (t) => {
  // Allows numbers printed in spaced groups, e.g. "2311 2034 5566 7700 000".
  const m = t.match(/^[A-Z0-9](?:[A-Z0-9\/\-_.]|\s(?=\d))*/i);
  const s = (m?.[0] || '').replace(/[\/\-_.\s]+$/, '');
  return s.length >= min && s.length <= 40 && /\d/.test(s) ? s.toUpperCase() : '';
};
const vAlnum = (min, max) => (t) => {
  const s = t.match(/^[A-Z0-9]+/i)?.[0] || '';
  return s.length >= min && s.length <= max && /\d/.test(s) ? s.toUpperCase() : '';
};
const REG = /\b([A-Z]{2})[\s\-]?(\d{1,2})[\s\-]?([A-Z]{1,3})[\s\-]?(\d{3,4})\b|\b(\d{2})[\s\-]?(BH)[\s\-]?(\d{4})[\s\-]?([A-Z]{1,2})\b/;
const vReg = (t) => {
  const m = t.toUpperCase().match(REG);
  return m && m.index < 4 ? m[0].replace(/[\s\-]/g, '') : '';
};
const vText = (max = 50) => (t) => {
  const s = t.replace(NEXT_LABEL, '').replace(/\s+/g, ' ').trim().replace(/[,;:\-]+$/, '').trim();
  return s.length >= 2 && s.length <= max && /[A-Za-z]/.test(s) && !JUNK.test(s) && !/^(?:model|variant|type|cc|year|number|no\.?|name|details?)\b/i.test(s) ? s : '';
};
const vNum = (lo, hi) => (t) => {
  const m = t.match(/^[^\d]{0,6}(\d{1,5})(?![\d\/\-.]\d)/);
  const n = m ? Number(m[1]) : NaN;
  return n >= lo && n <= hi ? n : '';
};
const vYear = (t) => t.slice(0, 20).match(/\b((?:19|20)\d{2})\b/)?.[1] || '';
const vNcb = (t) => {
  const m = t.slice(0, 25).match(/(\d{1,2})(?:\.0+)?\s*%?/);
  return m && [0, 20, 25, 35, 45, 50].includes(Number(m[1])) ? String(Number(m[1])) : '';
};
const vPhone = (t) => t.replace(/[\s\-]/g, '').match(/(?:\+?91|0)?([6-9]\d{9})(?!\d)/)?.[1] || '';
const INSURER_MAIL = /(?:care|support|service|customer|help|info|grievance|claims?|contact|noreply|no-reply)[\w.]*@|@[\w.-]*(?:insurance|lombard|ergo|allianz|digit|acko|tataaig|sbigeneral|starhealth|careinsurance|nivabupa|licindia|iffco|reliancegeneral|royalsundaram|cholams|kotak|hdfclife|iciciprulife|maxlife|bajaj)/i;
const vEmail = (t) => {
  const e = t.match(/[\w.+-]+@[\w-]+\.[\w.-]*[A-Za-z]/)?.[0] || '';
  return e && !INSURER_MAIL.test(e) ? e : '';
};
const FUELS = { petrol: 'Petrol', diesel: 'Diesel', cng: 'CNG', electric: 'Electric', ev: 'Electric', battery: 'Electric', hybrid: 'Hybrid', lpg: 'LPG' };
const vFuel = (t) => FUELS[(t.slice(0, 30).match(/petrol|diesel|cng|electric|battery|hybrid|lpg|\bev\b/i)?.[0] || '').toLowerCase()] || '';
const vFreq = (t) => {
  const s = t.slice(0, 25).toLowerCase();
  return /half/.test(s) ? 'Half-yearly' : /quarter/.test(s) ? 'Quarterly' : /month/.test(s) ? 'Monthly' : /single|one.?time/.test(s) ? 'Single' : /year|annual/.test(s) ? 'Yearly' : '';
};
const vAddress = (t) => {
  const s = t.replace(/\s+(?:mobile|phone|contact|e-?mail|policy|gstin|pan\b|customer id|period|dob|date of birth)\b.*$/i, '').replace(/\s+/g, ' ').trim().replace(/[,;:\-]+$/, '');
  return s.length >= 8 && s.length <= 160 && /[A-Za-z]{3}/.test(s) && !JUNK.test(s) ? s : '';
};
const has = (v) => v !== '' && v != null && v !== false;
// A table heading such as "Engine No." or "Mobile No." - never a value.
const LABELISH = /\b(?:no\.?|number|name|date|premium|model|make|engine|chassis|address|mobile|phone|e-?mail|fuel|year|capacity|idv|ncb|policy|period|registration|variant|sum insured|nominee|relationship|gst|total|details|type|plan|product|id)(?:\b|$)/i;
const isLabel = (s) => !/\d/.test(s) && s.length <= 32 && LABELISH.test(s);

/* ---------- layout: glyph runs -> rows of cells ---------- */
export function linesFromItems(items) {
  const rows = [];
  [...items]
    .filter((it) => it.s && it.s.trim())
    .sort((a, b) => a.page - b.page || b.y - a.y || a.x - b.x)
    .forEach((it) => {
      const row = rows[rows.length - 1];
      if (row && row.page === it.page && Math.abs(row.y - it.y) <= Math.max(2.5, (it.h || 10) * 0.35)) row.items.push(it);
      else rows.push({ page: it.page, y: it.y, items: [it] });
    });
  return rows
    .map((row) => {
      const cells = [];
      row.items.sort((a, b) => a.x - b.x).forEach((it) => {
        const last = cells[cells.length - 1];
        const gap = last ? it.x - last.x2 : Infinity;
        if (last && gap < Math.max(6, (it.h || 10) * 0.9)) {
          last.s += (gap > 0.8 && !/\s$/.test(last.s) && !/^\s/.test(it.s) ? ' ' : '') + it.s;
          last.x2 = Math.max(last.x2, it.x + it.w);
        } else cells.push({ s: it.s, x: it.x, x2: it.x + it.w });
      });
      cells.forEach((c) => { c.s = c.s.replace(/\s+/g, ' ').trim(); });
      return { page: row.page, y: row.y, cells: cells.filter((c) => c.s) };
    })
    .filter((r) => r.cells.length);
}

const strip = (s) => s.replace(/^[\s:\-–—.|=>]+/, '').trim();

// Find a label, then the first nearby value that passes the validator.
function near(L, labels, ok, { avoidBefore, avoidAfter, below = 3 } = {}) {
  for (const label of labels) {
    const re = new RegExp(label, 'i');
    for (let i = 0; i < L.length; i++) {
      const line = L[i];
      for (let c = 0; c < line.cells.length; c++) {
        const cell = line.cells[c];
        const m = cell.s.match(re);
        if (!m) continue;
        if (avoidBefore && avoidBefore.test(cell.s.slice(0, m.index))) continue;
        const rest = cell.s.slice(m.index + m[0].length);
        if (avoidAfter && avoidAfter.test(rest)) continue;

        // (a) rest of the same cell
        let v = strip(rest) ? ok(strip(rest)) : '';
        if (has(v)) return v;

        // (b) next cells on the same row
        for (let k = c + 1; k < Math.min(line.cells.length, c + 3); k++) {
          const t = strip(line.cells[k].s);
          if (!t) continue;
          if (isLabel(t)) break;
          v = ok(t);
          if (has(v)) return v;
        }

        // (c) the cell under the label, on the next few rows
        const mid = (cell.x + cell.x2) / 2;
        for (let j = i + 1; j <= i + below && j < L.length && L[j].page === line.page; j++) {
          let best = null;
          L[j].cells.forEach((b) => {
            const overlap = b.x <= cell.x2 + 6 && b.x2 >= cell.x - 6;
            const d = Math.abs((b.x + b.x2) / 2 - mid);
            if ((overlap || d < 45) && (!best || d < best.d)) best = { d, b };
          });
          if (best && !isLabel(strip(best.b.s))) {
            v = ok(strip(best.b.s));
            if (has(v)) return v;
          }
        }
      }
    }
  }
  return '';
}

export function parsePolicy(L) {
  const text = L.map((l) => l.cells.map((c) => c.s).join('  ')).join('\n');
  const low = text.toLowerCase();
  const f = {};
  const client = {};
  const find = (labels, ok, opts) => near(L, labels, ok, opts);
  const PREV = /(?:previous|prev\.?|old|expiring|earlier|last year'?s?)\s*(?:insurance\s*)?$/i;

  /* insurer: the company named earliest in the document */
  let best = null;
  INSURER_KEYS.forEach(([key, name]) => {
    const i = low.indexOf(key);
    if (i >= 0 && (!best || i < best.i)) best = { i, name };
  });
  if (best) f.insurer = best.name;

  /* identifiers */
  let engine = find(['engine\\s*(?:no\\.?|number|#|num)', '\\bengine\\b(?!\\s*(?:capacity|cc|protect|secure|guard|safe|and gear))'], vAlnum(5, 25), { avoidAfter: /^\s*(?:no\.?|number)?\s*(?:\/|&|,|and)\s*chassis/i });
  let chassis = find(['chassis\\s*(?:no\\.?|number|#|num)', '\\bvin\\b(?:\\s*(?:no\\.?|number))?', '\\bchassis\\b'], vAlnum(8, 25), { avoidAfter: /^\s*(?:no\.?|number)?\s*(?:\/|&|,|and)\s*engine/i });
  // "Engine No / Chassis No : ABC123 / MAT456"
  const pair = (first, second) =>
    find([`${first}\\s*(?:no\\.?|number)?\\s*(?:\\/|&|,|and)\\s*${second}\\s*(?:no\\.?|number)?`], (t) => {
      const parts = t.split(/\s*[\/,&]\s*|\s+/).filter(Boolean);
      const a = parts[0] && vAlnum(5, 25)(parts[0]);
      const b = parts[1] && vAlnum(5, 25)(parts[1]);
      return a && b ? [a, b] : '';
    });
  if (!engine || !chassis) {
    const ec = pair('engine', 'chassis');
    const ce = ec ? '' : pair('chassis', 'engine');
    if (ec) { engine = engine || ec[0]; chassis = chassis || ec[1]; }
    if (ce) { chassis = chassis || ce[0]; engine = engine || ce[1]; }
  }
  if (!chassis) chassis = text.match(/\b(?=[A-Z0-9]*\d)(?=[A-Z0-9]*[A-Z])[A-HJ-NPR-Z0-9]{17}\b/)?.[0] || '';
  const regLabelled = find(['(?:registration|regn\\.?|reg\\.?)\\s*(?:no\\.?|number|mark|num)', 'vehicle\\s*(?:no\\.?|number|registration)', 'registration'], vReg, { avoidAfter: /^\s*(?:date|authority|address|zone)/i });
  const motorWords = /(own damage|third party|motor|vehicle|chassis|\bidv\b|insured.?s declared value)/i.test(text);

  let category = 'non_motor';
  if ((engine || chassis || regLabelled) && motorWords) category = 'motor';
  else if (/(sum assured|life assured|death benefit|maturity)/i.test(text)) category = 'life';
  else if (/(health|mediclaim|hospitali[sz]ation|floater|critical illness|pre-?existing)/i.test(text)) category = 'health';
  else if (REG.test(text) && motorWords) category = 'motor';
  f.category = category;

  f.policyNumber = find(
    ['policy\\s*(?:no\\.?|number|#|num)(?:\\s*\\/\\s*certificate\\s*(?:no\\.?|number))?', 'policy\\s*\\/\\s*certificate\\s*(?:no\\.?|number)', 'certificate\\s*(?:no\\.?|number)', 'cover\\s*note\\s*(?:no\\.?|number)', 'policy\\s*id'],
    vId(5),
    { avoidBefore: PREV },
  );

  /* dates */
  const TIME = String.raw`(?:\d{1,2}[:.]\d{2}(?::\d{2})?\s*(?:hrs\.?|hours|am|pm)?\s*(?:on|of)?\s*)?`;
  const period =
    text.match(new RegExp(`(?:period of (?:insurance|cover)|policy period|insurance period|own damage (?:cover|period)|od (?:cover|period)|valid(?:ity)?)[^\\n]{0,50}?(?:from)?[^\\dA-Za-z]{0,8}${TIME}${DATE}[\\s\\S]{0,70}?(?:to|till|until|-|–)[^\\dA-Za-z]{0,8}(?:midnight\\s*(?:on|of)?\\s*)?${TIME}${DATE}`, 'i')) ||
    text.match(new RegExp(`\\bfrom\\b[^\\dA-Za-z]{0,8}${TIME}${DATE}[\\s\\S]{0,60}?\\b(?:to|till|until)\\b[^\\dA-Za-z]{0,8}(?:midnight\\s*(?:on|of)?\\s*)?${TIME}${DATE}`, 'i'));
  if (period) {
    f.startDate = toISO(period[1]);
    f.endDate = toISO(period[2]);
  }
  if (!f.startDate) f.startDate = find(['(?:od|own damage)\\s*(?:policy\\s*)?(?:start|from)\\s*(?:date)?', '(?:policy|risk|cover|insurance)?\\s*(?:start|commencement|inception|effective)\\s*(?:date|from)', 'date of commencement(?: of risk)?', 'risk (?:start|inception)', 'valid from', 'period of insurance\\s*:?\\s*from', '\\bfrom date\\b'], vDate);
  if (!f.endDate) f.endDate = find(['(?:od|own damage)\\s*(?:policy\\s*)?(?:end|expiry|to)\\s*(?:date)?', '(?:policy|risk|cover|insurance)?\\s*(?:end|expiry|expiration|expiring)\\s*(?:date|on)?', 'date of expiry', 'valid (?:till|upto|up to|until)', 'next (?:premium )?due(?:\\s*date)?', 'renewal (?:due )?date', '\\bto date\\b'], vDate, { avoidBefore: PREV });
  f.issueDate = find(['(?:policy\\s*)?issu(?:e|ed|ance)\\s*(?:date|on)', 'date of (?:issue|issuance)', 'issued on', '(?:receipt|proposal|transaction|invoice|booking)\\s*date', 'policy date'], vDate) || f.startDate || '';

  /* customer */
  client.name = find(
    ["insured(?:'s|s)?\\s*name", 'name of (?:the )?(?:insured|proposer|policy\\s*holder|customer|owner|life assured|registered owner)', "policy\\s*holder(?:'s)?(?:\\s*name)?", "proposer(?:'s)?(?:\\s*name)?", "customer(?:'s)?\\s*name", "(?:registered\\s*)?owner(?:'s)?\\s*name", 'insured person', 'life assured', '\\binsured\\b', '^name\\b'],
    vName,
    { avoidBefore: /(?:nominee|appointee|agent|intermediary|financier|bank|branch|insurer|company|plan|product|father|spouse)\s*(?:'s)?\s*$/i, avoidAfter: /^\s*(?:'?s?\s*declared|address|details|vehicle|value)/i },
  );
  if (!client.name) {
    // Address block that opens with a salutation: "Mr. Rajesh Sharma"
    for (const l of L) {
      const hit = l.cells.map((c) => c.s.match(/^(?:dear\s+)?(?:mrs|mr|ms|miss|dr|m\/s|shri|smt)\.?\s+([A-Za-z][A-Za-z .&']{2,50})/i)).find(Boolean);
      const v = hit && vName(hit[1]);
      if (v) { client.name = v; break; }
    }
  }
  client.phone = find(['mobile(?:\\s*(?:no\\.?|number|num))?', '(?:contact|phone|tel(?:ephone)?|cell)\\s*(?:no\\.?|number|num)?', '\\bmob\\b\\.?'], vPhone, { avoidBefore: /(?:toll.?free|customer care|helpline|agent|intermediary|branch|office)\s*$/i });
  client.email = find(['e-?mail(?:\\s*(?:id|address))?'], vEmail) || (text.match(/[\w.+-]+@[\w-]+\.[\w.-]*[A-Za-z]/g) || []).find((e) => !INSURER_MAIL.test(e)) || '';
  client.address = find(["(?:communication|correspondence|mailing|insured(?:'s)?|permanent|customer|proposer(?:'s)?)?\\s*address"], vAddress, { avoidBefore: /(?:e-?mail|web|website|office|branch|registered|regd\.?|corporate|ip|insurer|company)\s*$/i });
  client.dob = find(['date of birth', '\\bd\\.?o\\.?b\\b\\.?'], vDate);

  /* premium */
  const SKIP = /^\s*(?:before|excl|without|rate|%|term|paying|payment (?:term|mode|frequency)|frequency|mode|due)/i;
  const od = find(['total own damage premium(?:\\s*\\(a\\))?', 'total od premium', 'net own damage premium(?:\\s*\\(a\\))?', 'total own.?damage', 'net od premium', 'own damage premium', '\\bod premium', 'total od\\b', 'own damage\\s*\\(a\\)'], vMoney(50), { avoidAfter: SKIP });
  const tp = find(['total liability premium(?:\\s*\\(b\\))?', 'total act premium', 'total tp premium', 'net liability premium(?:\\s*\\(b\\))?', 'total third party premium', 'third party premium', '\\btp premium', 'liability premium', 'total tp\\b', 'total liability', 'third party\\s*\\(b\\)'], vMoney(100), { avoidAfter: SKIP });
  let net = find(['net premium(?:\\s*\\(a\\s*\\+\\s*b\\))?', 'total premium before (?:tax|gst)', 'premium before (?:taxes|tax|gst)', 'taxable (?:value|premium|amount)', 'total package premium', 'premium (?:excluding|excl\\.?) (?:gst|tax)', 'total annual premium', 'basic premium', 'base premium', 'premium \\(a\\s*\\+\\s*b\\)'], vMoney(50), { avoidAfter: /^\s*(?:rate|%|term|paying|frequency|mode|due)/i });
  const BEFORE_TAX = /(?:before|excluding|excl\.?|without|including|incl\.?|with|inclusive of|exclusive of)\s*$/i;
  let gst = find(['total (?:gst|tax(?:es)?)', '\\bigst\\b', '\\bgst\\b', 'goods (?:and|&) services? tax', 'service tax'], vMoney(1), { avoidBefore: BEFORE_TAX, avoidAfter: /^\s*(?:in\b|no\b|number|reg|invoice)/i });
  if (!gst) {
    const c = find(['\\bcgst\\b'], vMoney(1), { avoidBefore: BEFORE_TAX });
    const s = find(['\\b(?:sgst|ugst|utgst)\\b'], vMoney(1), { avoidBefore: BEFORE_TAX });
    if (c && s) gst = c + s;
  }
  const total = find(['total (?:premium )?(?:payable|paid)', 'final premium', 'gross premium', 'total policy premium', 'premium (?:inclusive of|including|incl\\.?) (?:gst|tax(?:es)?)', 'total premium(?: amount)?', 'total amount(?: payable| paid)?', 'amount (?:paid|payable|received)', 'premium (?:paid|amount|payable)', 'installment premium', '\\bpremium\\b'], vMoney(50), { avoidAfter: SKIP });
  if (!net && (od || tp)) net = (od || 0) + (tp || 0);
  if (!net && total) net = gst && gst < total ? total - gst : category === 'health' || category === 'life' ? total : Math.round(total / 1.18);
  if (od) f.odPremium = od;
  if (tp) f.tpPremium = tp;
  if (net) f.netPremium = net;
  if (net && gst && gst < net) f.gstRate = Math.round((gst / net) * 100);
  else if (net && total && total > net) f.gstRate = Math.round(((total - net) / net) * 100);

  if (category === 'motor') {
    const anyReg = text.toUpperCase().match(REG)?.[0];
    const r = regLabelled || (anyReg ? anyReg.replace(/[\s\-]/g, '') : '');
    if (r) f.regNo = r;
    if (engine) f.engineNo = engine;
    if (chassis) f.chassisNo = chassis;
    f.idv = find(['total idv', 'vehicle idv', 'idv of (?:the )?vehicle', 'total value of (?:the )?vehicle', "insured.?s? declared value(?:\\s*\\(idv\\))?", 'total sum insured', '\\bidv\\b'], vMoney(5000));
    f.ncb = find(['no claim bonus(?:\\s*\\(ncb\\))?', '\\bncb\\b(?:\\s*(?:discount|%|percentage))?'], vNcb, { avoidAfter: /^\s*(?:protect|declaration|certificate)/i });
    f.cc = find(['cubic capacity(?:\\s*\\(cc\\))?', 'engine capacity(?:\\s*\\(cc\\))?', '\\bcc\\s*\\/\\s*kw\\b', '\\bc\\.?c\\b\\.?'], vNum(49, 9000));
    f.mfgYear = Number(find(['year of (?:manufacture|mfg\\.?|manufacturing)', '(?:mfg|mfr|manufacturing|manufactured)\\.?\\s*(?:year|yr|date)', '\\byom\\b', 'month\\s*\\/\\s*year of (?:mfg|manufacture)'], vYear)) || '';
    f.regDate = find(['(?:date|dt\\.?) of registration', '(?:registration|regn\\.?|reg\\.?)\\s*date'], vDate);
    f.fuel = find(['fuel(?:\\s*type)?', 'type of fuel'], vFuel);

    let make = find(['\\bmake\\b(?!\\s*(?:\\/|&|,|-|and)\\s*model)', 'manufacturer(?:\\s*name)?', 'vehicle make'], vText(30));
    let model = find(['\\bmodel\\b(?:\\s*(?:\\/|&|-)\\s*variant)?(?:\\s*name)?', 'vehicle model', '\\bvariant\\b'], vText(45), { avoidBefore: /(?:make|manufacturer)\s*(?:\/|&|,|-|and)?\s*$/i });
    if (!make) {
      const mm = find(['make\\s*(?:\\/|&|,|-|and)\\s*model(?:\\s*(?:\\/|&|,|-|and)\\s*variant)?', 'vehicle (?:make\\s*(?:\\/|&)\\s*model|description|details)', 'make\\s+model'], vText(60));
      if (mm) {
        const parts = mm.split(/\s*[\/|]\s*|\s+-\s+/).filter(Boolean);
        const words = mm.split(' ');
        make = parts.length > 1 ? parts[0] : words[0];
        model = model || (parts.length > 1 ? parts.slice(1).join(' ') : words.slice(1).join(' '));
      }
    }
    if (make) f.make = make;
    if (model && model.toLowerCase() !== (make || '').toLowerCase()) f.model = model;

    if (/stand\s*-?\s*alone\s*(?:own damage|od)|\bsaod\b|own damage only/i.test(text)) f.coverType = 'Standalone OD';
    else if (/liability only|act only|third party (?:liability )?(?:only|policy)/i.test(text) || (tp && !od)) f.coverType = 'Third Party';
    else f.coverType = 'Comprehensive';

    if (/two\s*-?\s*wheeler|motor\s*cycle|motorcycle|scooter|\b2\s*w\b/i.test(text)) f.vehicleClass = 'Two Wheeler';
    else if (/goods carrying|\bgcv\b/i.test(text)) f.vehicleClass = 'Goods Carrying (GCV)';
    else if (/passenger carrying|\bpcv\b|\btaxi\b/i.test(text)) f.vehicleClass = 'Passenger Carrying (PCV)';
    else f.vehicleClass = 'Private Car';

    const addons = [
      ['Zero Depreciation', /zero dep|nil dep|depreciation (?:waiver|reimbursement|cover|shield)|bumper to bumper/i],
      ['Engine Protect', /engine (?:protect|secure|guard|and gear|safe)/i],
      ['Roadside Assistance', /road\s*side assist|\brsa\b/i],
      ['Return to Invoice', /return to invoice|invoice (?:cover|price)/i],
      ['Consumables', /consumable/i],
      ['Key Replacement', /key (?:replacement|protect|loss)|loss of key/i],
      ['Tyre Protect', /tyre (?:protect|secure|cover|safeguard)/i],
      ['NCB Protect', /ncb protect|no claim bonus protect/i],
      ['Personal Belongings', /personal belonging|loss of personal/i],
    ].filter(([, re]) => re.test(text)).map(([label]) => label);
    if (addons.length && f.coverType !== 'Third Party') f.addons = addons;

    const notNil = (t) => (/^(?:nil|no|na|none|n\/a|not applicable|-)\b/i.test(t) ? '' : vText(45)(t));
    f.financer = find(['hypothecat(?:ed|ion)(?:\\s*(?:to|with))?', 'financ(?:ier|er)(?:\\s*name)?', 'hire purchase(?:\\s*with)?', '\\bhpa\\b'], notNil);
    f.prevInsurer = find(['(?:previous|prev\\.?)\\s*insurer(?:\\s*name)?', 'previous insurance company'], vText(45));
    f.prevPolicyNo = find(['(?:previous|prev\\.?|old|expiring)\\s*policy\\s*(?:no\\.?|number)'], vId(5));
  } else {
    f.sumInsured = find(['(?:total |basic |base )?sum (?:insured|assured)(?:\\s*\\((?:rs\\.?|inr|si)\\))?', 'cover(?:age)? amount', 'basic sum', 'death benefit'], vMoney(10000));
    f.product = find(['(?:product|plan|policy)\\s*name', 'name of (?:the )?(?:product|plan)', 'plan opted', '\\bproduct\\b', '\\bplan\\b(?!\\s*type)'], vText(55), { avoidAfter: /^\s*(?:code|uin|type|id\b)/i });
    if (!f.product) {
      const title = text.match(/(?:policy schedule|schedule of (?:the )?policy|certificate of insurance)\s*[-–:]\s*([A-Za-z][A-Za-z0-9 &+\-]{2,40})/i)?.[1];
      if (title && !/insurance company|limited|ltd/i.test(title)) f.product = title.trim();
    }
    f.nominee = find(["nominee(?:'s)?\\s*name", 'name of (?:the )?nominee', '\\bnominee\\b'], vName, { avoidAfter: /^\s*(?:relationship|relation|age|dob|share|details|%)/i });
    if (category === 'health') {
      if (/floater/i.test(text)) f.planType = 'Family Floater';
      else if (/top.?up/i.test(text)) f.planType = 'Top-up / Super Top-up';
      else if (/critical illness/i.test(text)) f.planType = 'Critical Illness';
      else if (/personal accident/i.test(text)) f.planType = 'Personal Accident';
      else if (/senior/i.test(text)) f.planType = 'Senior Citizen';
      else f.planType = 'Individual';
      const members = (text.match(/\b(?:self|spouse|son|daughter|father|mother|husband|wife)\b/gi) || []).map((s) => s.toLowerCase());
      const covered = new Set(members.filter((x) => x !== 'spouse' || members.filter((y) => y === 'spouse').length > 0));
      if (covered.size > 1) f.membersCount = Math.min(covered.size, 8);
      const ped = find(['pre-?existing (?:disease|condition|illness)s?(?:\\s*\\(ped\\))?'], vText(80));
      if (ped) f.ped = ped;
    }
    if (category === 'life') {
      if (/\bterm (?:plan|insurance|assurance|life)|protect/i.test(text)) f.planType = 'Term';
      else if (/ulip|unit linked/i.test(text)) f.planType = 'ULIP';
      else if (/money back/i.test(text)) f.planType = 'Money Back';
      else if (/endowment/i.test(text)) f.planType = 'Endowment';
      else if (/pension|annuity/i.test(text)) f.planType = 'Pension / Annuity';
      f.policyTerm = find(['policy term', 'term of (?:the )?policy'], vNum(1, 100));
      f.payingTerm = find(['premium pay(?:ing|ment) term', '\\bppt\\b'], vNum(1, 100));
      f.frequency = find(['(?:premium )?(?:payment |paying )?(?:frequency|mode)', 'mode of (?:premium )?payment'], vFreq);
      f.maturityDate = find(['(?:date of )?maturity(?:\\s*date)?'], vDate);
      if (client.dob) f.lifeAssuredDob = client.dob;
    } else if (category === 'non_motor') {
      f.riskLocation = find(['risk location', 'location of (?:the )?risk', '(?:insured )?premises(?: address)?', 'property address'], vAddress);
      f.occupancy = find(['occupancy', 'nature of business', 'business(?: type| description)?', 'occupation'], vText(60));
    }
  }

  Object.keys(f).forEach((k) => (f[k] === '' || f[k] == null) && delete f[k]);
  Object.keys(client).forEach((k) => !client[k] && delete client[k]);

  // Tell the agent what could not be found, so they know exactly what to type.
  const want =
    category === 'motor'
      ? [['insurer', 'Insurer'], ['policyNumber', 'Policy number'], ['startDate', 'Start date'], ['endDate', 'End date'], ['regNo', 'Vehicle number'], ['make', 'Make'], ['model', 'Model'], ['engineNo', 'Engine number'], ['chassisNo', 'Chassis number'], ['idv', 'IDV'], ['ncb', 'NCB'], ['netPremium', 'Premium']]
      : [['insurer', 'Insurer'], ['policyNumber', 'Policy number'], ['startDate', 'Start date'], ['endDate', 'End date'], ['product', 'Plan name'], ['sumInsured', 'Sum insured'], ['netPremium', 'Premium']];
  let missing = want.filter(([k]) => f[k] == null).map(([, label]) => label);
  if (f.coverType === 'Third Party') missing = missing.filter((x) => x !== 'IDV' && x !== 'NCB');
  if (!client.name) missing.unshift('Customer name');

  return { fields: f, client, missing, text, count: Object.keys(f).length - 1 + Object.keys(client).length };
}

// Pulls every text run out of the PDF with its position.
export async function readPdfItems(file) {
  const pdfjs = await import('pdfjs-dist');
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const items = [];
  for (let n = 1; n <= Math.min(doc.numPages, 6); n++) {
    const page = await doc.getPage(n);
    const content = await page.getTextContent();
    content.items.forEach((it) => {
      if (it.str) items.push({ s: it.str, x: it.transform[4], y: it.transform[5], w: it.width || 0, h: it.height || Math.abs(it.transform[3]) || 10, page: n });
    });
  }
  return items;
}

export async function extractPolicy(file) {
  const lines = linesFromItems(await readPdfItems(file));
  if (lines.map((l) => l.cells.map((c) => c.s).join('')).join('').replace(/\s/g, '').length < 80)
    throw new Error('This PDF has no readable text (it looks like a scanned image). Please enter the details manually.');
  return parsePolicy(lines);
}

// Reads one insurer's quotation PDF into a column of the quote comparison.
// Quotes use the same labels as policy schedules (insurer, IDV / sum insured, premium, GST, add-ons).
export async function extractQuote(file) {
  const { fields: f, client, text } = await extractPolicy(file);
  const motor = f.category === 'motor';
  const features = [
    motor && f.coverType,
    ...(f.addons || []),
    motor && f.ncb ? `NCB ${f.ncb}%` : '',
    !motor && f.planType,
  ].filter(Boolean);
  const option = {
    insurer: f.insurer || '',
    plan: f.product || (motor ? [f.coverType, 'Package'].filter(Boolean).join(' ') : f.planType || ''),
    cover: f.idv || f.sumInsured || '',
    premium: f.netPremium || '',
    gstRate: f.gstRate ?? '',
    features: features.join(', '),
  };
  const missing = [!option.insurer && 'insurer', !option.premium && 'premium', !option.cover && (motor ? 'IDV' : 'sum insured')].filter(Boolean);
  return {
    option,
    category: f.category,
    customer: { name: client.name || '', phone: client.phone || '' },
    title: motor ? [[f.make, f.model].filter(Boolean).join(' '), f.regNo].filter(Boolean).join(', ') : f.product || '',
    missing,
    text,
  };
}
