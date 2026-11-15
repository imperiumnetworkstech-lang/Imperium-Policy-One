export const cx = (...parts) => parts.filter(Boolean).join(' ');

export const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export const inr = (n) => '₹' + Math.round(num(n)).toLocaleString('en-IN');

export const inrShort = (n) => {
  n = num(n);
  const a = Math.abs(n);
  if (a >= 1e7) return '₹' + (n / 1e7).toFixed(2) + ' Cr';
  if (a >= 1e5) return '₹' + (n / 1e5).toFixed(2) + ' L';
  if (a >= 1e3) return '₹' + (n / 1e3).toFixed(1) + 'K';
  return inr(n);
};

/* ---------- dates (all stored as local yyyy-mm-dd strings) ---------- */
const pad = (n) => String(n).padStart(2, '0');
export const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayISO = () => toISO(new Date());
export const parseISO = (s) => {
  if (!s) return null;
  const [y, m, d] = String(s).slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
};
export const addDays = (iso, n) => {
  const d = parseISO(iso);
  if (!d) return '';
  d.setDate(d.getDate() + n);
  return toISO(d);
};
export const addYears = (iso, n) => {
  const d = parseISO(iso);
  if (!d) return '';
  d.setFullYear(d.getFullYear() + n);
  return toISO(d);
};
export const daysUntil = (iso) => {
  const d = parseISO(iso);
  if (!d) return null;
  const t = parseISO(todayISO());
  return Math.round((d - t) / 86400000);
};
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const fmtDate = (iso) => {
  const d = parseISO(iso);
  return d ? `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}` : '-';
};
export const monthLabel = (ym) => {
  const [y, m] = ym.split('-').map(Number);
  return `${MONTHS[m - 1]} ${String(y).slice(2)}`;
};
export const lastMonths = (n) => {
  const out = [];
  const d = new Date();
  d.setDate(1);
  for (let i = n - 1; i >= 0; i--) {
    const x = new Date(d.getFullYear(), d.getMonth() - i, 1);
    out.push(`${x.getFullYear()}-${pad(x.getMonth() + 1)}`);
  }
  return out;
};

// Indian financial year: 1 Apr - 31 Mar.
export const fyStartYear = (iso = todayISO()) => {
  const d = parseISO(iso);
  return d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
};
export const fyRange = (startYear) => ({ from: `${startYear}-04-01`, to: `${startYear + 1}-03-31` });
export const fyLabel = (startYear) => `FY ${startYear}-${String(startYear + 1).slice(2)}`;
export const monthRange = (iso = todayISO()) => {
  const d = parseISO(iso);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return { from: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`, to: toISO(last) };
};
export const inRange = (iso, { from, to }) => Boolean(iso) && (!from || iso >= from) && (!to || iso <= to);

// Next birthday / anniversary within N days.
export const daysToAnnual = (iso) => {
  const d = parseISO(iso);
  if (!d) return null;
  const t = parseISO(todayISO());
  let next = new Date(t.getFullYear(), d.getMonth(), d.getDate());
  if (next < t) next = new Date(t.getFullYear() + 1, d.getMonth(), d.getDate());
  return Math.round((next - t) / 86400000);
};

/* ---------- sharing / export ---------- */
export const phoneDigits = (phone) => {
  const d = String(phone || '').replace(/\D/g, '');
  return d.length === 10 ? '91' + d : d;
};
export const waLink = (phone, text) =>
  `https://wa.me/${phoneDigits(phone)}?text=${encodeURIComponent(text)}`;

export function downloadCSV(filename, rows) {
  if (!rows.length) return;
  const cols = Object.keys(rows[0]);
  const esc = (v) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

export const initials = (name) =>
  String(name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || '')
    .join('') || '?';
