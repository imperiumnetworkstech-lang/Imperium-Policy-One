// Motor reference data used by the calculators.
//
// Third-party (TP) premiums are fixed by IRDAI and have applied since 1 June 2022.
// Source checked Nov 2026: IRDAI motor TP premium tables as published by TVS Insurance Broking
// (tvsinsurance.in/MotorTariffCalculator). Update here if IRDAI notifies new rates.
export const TP_SOURCE = 'IRDAI third-party rates in force since June 2022 (checked Nov 2026)';

// rows: [label, premium] or [label, basic, perPassenger]
export const TP_TABLES = [
  {
    id: 'car', label: 'Private car', unit: 'cc',
    rows: [['Up to 1000 cc', 2094], ['1000 - 1500 cc', 3416], ['Above 1500 cc', 7897]],
    ev: [['Up to 30 kW', 1780], ['30 - 65 kW', 2904], ['Above 65 kW', 6712]],
  },
  {
    id: 'bike', label: 'Two wheeler', unit: 'cc',
    rows: [['Up to 75 cc', 538], ['75 - 150 cc', 714], ['150 - 350 cc', 1366], ['Above 350 cc', 2804]],
    ev: [['Up to 3 kW', 457], ['3 - 7 kW', 607], ['7 - 16 kW', 1161], ['Above 16 kW', 2383]],
  },
  {
    id: 'gcv', label: 'Goods vehicle (GCV)', unit: 'GVW',
    rows: [['GVW up to 7,500 kg', 16049], ['7,500 - 12,000 kg', 27186], ['12,000 - 20,000 kg', 35313], ['20,000 - 40,000 kg', 43950], ['Above 40,000 kg', 44242]],
    ev: [['GVW up to 7,500 kg', 13642], ['7,500 - 12,000 kg', 23108], ['12,000 - 20,000 kg', 30016], ['20,000 - 40,000 kg', 37357], ['Above 40,000 kg', 37606]],
  },
  {
    id: 'gcv3', label: 'Goods 3-wheeler / e-cart', unit: '',
    rows: [['3-wheeler, public carrier', 4492], ['3-wheeler, private carrier', 3922], ['E-cart, public carrier', 3139], ['E-cart, private carrier', 3211]],
  },
  {
    id: 'taxi', label: 'Taxi / cab (up to 6 passengers)', unit: 'cc', perPassenger: true,
    rows: [['Up to 1000 cc', 6040, 1162], ['1000 - 1500 cc', 7940, 978], ['Above 1500 cc', 10523, 1117]],
    ev: [['Up to 30 kW', 5134, 988], ['30 - 65 kW', 6749, 831], ['Above 65 kW', 8945, 949]],
  },
  {
    id: 'auto', label: 'Auto-rickshaw / e-rickshaw', unit: '', perPassenger: true,
    rows: [['Auto-rickshaw (up to 6 passengers)', 2539, 1214], ['E-rickshaw (up to 6 passengers)', 1648, 789], ['3-wheeler, 7 - 17 passengers', 6763, 1349], ['3-wheeler, above 17 passengers', 15502, 948]],
  },
  {
    id: 'bus', label: 'Bus (above 6 passengers)', unit: '', perPassenger: true,
    rows: [['School / educational institution bus', 12192, 745], ['Other bus', 14343, 877]],
    ev: [['School / educational institution bus', 10363, 633], ['Other bus', 12192, 745]],
  },
  {
    id: 'bike_taxi', label: 'Two-wheeler taxi', unit: 'cc', perPassenger: true,
    rows: [['Up to 350 cc', 861, 580], ['Above 350 cc', 2254, 580]],
    ev: [['Up to 16 kW', 732, 493], ['Above 16 kW', 1916, 493]],
  },
  {
    id: 'misc', label: 'Tractor and special vehicles', unit: '',
    rows: [['Agricultural tractor up to 6 HP', 910], ['Pedestrian-controlled tractor (up to 6 HP), hearse', 1645], ['Other tractors, cranes, misc. & special vehicles', 7267], ['Trailer (each)', 2485]],
  },
];

// Long-term TP for new vehicles (mandatory since 2018): 3 years for cars, 5 years for two-wheelers.
export const LONG_TERM_TP = {
  car: { years: 3, rows: [['Up to 1000 cc', 6521], ['1000 - 1500 cc', 10640], ['Above 1500 cc', 24596]], ev: [['Up to 30 kW', 5543], ['30 - 65 kW', 9044], ['Above 65 kW', 20907]] },
  bike: { years: 5, rows: [['Up to 75 cc', 2901], ['75 - 150 cc', 3851], ['150 - 350 cc', 7365], ['Above 350 cc', 15117]], ev: [['Up to 3 kW', 2466], ['3 - 7 kW', 3273], ['7 - 16 kW', 6260], ['Above 16 kW', 12849]] },
};

// Index of the slab for an engine size (cc) or motor power (kW).
export function slabIndex(type, ev, size) {
  const s = Number(size) || 0;
  const limits = {
    car: ev ? [30, 65] : [1000, 1500],
    bike: ev ? [3, 7, 16] : [75, 150, 350],
    taxi: ev ? [30, 65] : [1000, 1500],
    bike_taxi: ev ? [16] : [350],
  }[type] || [];
  const i = limits.findIndex((l) => s <= l);
  return i < 0 ? limits.length : i;
}

/* ---------- No Claim Bonus ---------- */
export const NCB_LADDER = [0, 20, 25, 35, 45, 50];
export const nextNcbAfter = (ncb, claimed) => (claimed ? 0 : NCB_LADDER[Math.min(NCB_LADDER.indexOf(Number(ncb)) + 1 || 1, NCB_LADDER.length - 1)]);

// NCB percentages for the next `years` renewals, with or without a claim in the current year.
export function ncbPath(currentNcb, years, claimNow) {
  const out = [];
  let n = Number(currentNcb) || 0;
  for (let y = 0; y < years; y++) {
    n = nextNcbAfter(n, y === 0 && claimNow);
    out.push(n);
  }
  return out;
}

// Rupee value of the NCB lost by claiming now, over the next `years` renewals.
// odBase = own-damage premium before NCB (assumed steady; it falls slowly as IDV depreciates).
export function ncbLoss(currentNcb, odBase, years = 3) {
  const keep = ncbPath(currentNcb, years, false);
  const lose = ncbPath(currentNcb, years, true);
  const rows = keep.map((k, i) => ({
    year: i + 1, keep: k, lose: lose[i],
    keepSaving: Math.round((odBase * k) / 100),
    loseSaving: Math.round((odBase * lose[i]) / 100),
  }));
  return { rows, total: rows.reduce((t, r) => t + r.keepSaving - r.loseSaving, 0) };
}

/* ---------- Claim settlement ---------- */
// Depreciation on metal parts by vehicle age (India Motor Tariff, GR 8).
export const METAL_DEP = [
  { maxMonths: 6, pct: 0 }, { maxMonths: 12, pct: 5 }, { maxMonths: 24, pct: 10 }, { maxMonths: 36, pct: 15 },
  { maxMonths: 48, pct: 25 }, { maxMonths: 60, pct: 35 }, { maxMonths: 120, pct: 40 }, { maxMonths: Infinity, pct: 50 },
];
export const metalDep = (months) => METAL_DEP.find((d) => Number(months) <= d.maxMonths).pct;
export const PLASTIC_DEP = 50; // rubber, nylon, plastic, tyres, tubes, batteries, airbags
export const FIBRE_DEP = 30; // fibreglass
export const PAINT_DEP = 12.5; // 50% on paint material, taken as 25% of the paint bill
// Compulsory deductible per claim.
export const compulsoryDeductible = (type, cc) => (type === 'bike' ? 100 : Number(cc) > 1500 ? 2000 : 1000);

export function claimPayout({ ageMonths, metal = 0, plastic = 0, fibre = 0, glass = 0, paint = 0, labour = 0, consumables = 0, zeroDep, consumablesCover, deductible = 0 }) {
  const n = (v) => Number(v) || 0;
  const md = zeroDep ? 0 : metalDep(ageMonths);
  const lines = [
    { label: 'Metal parts', bill: n(metal), dep: md },
    { label: 'Plastic, rubber, tyres, battery', bill: n(plastic), dep: zeroDep ? 0 : PLASTIC_DEP },
    { label: 'Fibreglass parts', bill: n(fibre), dep: zeroDep ? 0 : FIBRE_DEP },
    { label: 'Glass', bill: n(glass), dep: 0 },
    { label: 'Painting', bill: n(paint), dep: zeroDep ? 0 : PAINT_DEP },
    { label: 'Labour', bill: n(labour), dep: 0 },
    { label: 'Consumables (oil, nuts, coolant)', bill: n(consumables), dep: consumablesCover ? 0 : 100 },
  ].map((l) => ({ ...l, paid: Math.round(l.bill * (1 - l.dep / 100)) }));
  const bill = lines.reduce((t, l) => t + l.bill, 0);
  const assessed = lines.reduce((t, l) => t + l.paid, 0);
  const payout = Math.max(0, assessed - n(deductible));
  return { lines, bill, assessed, deductible: n(deductible), payout, fromPocket: bill - payout };
}

/* ---------- Add-on covers: typical market prices ---------- */
// Insurers price add-ons themselves; these are typical ranges seen in the market, for conversations
// before a formal quote. pct = % of IDV per year; flat = rupees; odPct = % of OD premium.
export const ADDONS = [
  { id: 'zd', label: 'Zero Depreciation', pct: [0.3, 0.5], pctOld: [0.5, 0.8], maxAge: 5, note: 'Usually up to 5 years old; often 2 claims a year', types: ['car', 'bike'] },
  { id: 'ep', label: 'Engine Protect', pct: [0.1, 0.2], note: 'Water ingress and gearbox damage', types: ['car', 'bike'] },
  { id: 'rti', label: 'Return to Invoice', pct: [0.2, 0.4], maxAge: 3, note: 'Pays invoice value on total loss or theft', types: ['car', 'bike'] },
  { id: 'cons', label: 'Consumables', pct: [0.1, 0.2], note: 'Oil, coolant, nuts and bolts in a claim', types: ['car', 'bike'] },
  { id: 'tyre', label: 'Tyre Protect', pct: [0.05, 0.15], note: 'Tyre damage without an accident', types: ['car'] },
  { id: 'ncbp', label: 'NCB Protect', odPct: [10, 15], minNcb: 25, note: 'Keeps NCB after one claim a year', types: ['car'] },
  { id: 'key', label: 'Key Replacement', flat: [400, 1000], note: 'Lost or stolen keys and locks', types: ['car'] },
  { id: 'rsa', label: 'Roadside Assistance', flat: [150, 500], note: 'Towing, flat tyre, battery jump-start', types: ['car', 'bike'] },
  { id: 'pb', label: 'Personal Belongings', flat: [250, 500], note: 'Belongings stolen from the vehicle', types: ['car'] },
  { id: 'pax', label: 'Unnamed passenger PA (Rs 1 lakh each)', perSeat: 50, note: 'Per seat, Rs 1 lakh cover each', types: ['car', 'bike'] },
  { id: 'lld', label: 'Legal liability to paid driver', flat: [50, 50], note: 'Fixed by tariff', types: ['car'] },
];

export function addonPrice(a, { idv, ageYears, od, seats, ncb }) {
  const n = (v) => Number(v) || 0;
  if (a.maxAge != null && n(ageYears) > a.maxAge) return { unavailable: `Usually not offered after ${a.maxAge} years` };
  if (a.minNcb != null && n(ncb) < a.minNcb) return { unavailable: `Needs ${a.minNcb}% NCB or more` };
  if (a.pct) {
    const r = a.pctOld && n(ageYears) > 2 ? a.pctOld : a.pct;
    return { low: Math.round((n(idv) * r[0]) / 100), high: Math.round((n(idv) * r[1]) / 100), basis: `${r[0]} - ${r[1]}% of IDV` };
  }
  if (a.odPct) return { low: Math.round((n(od) * a.odPct[0]) / 100), high: Math.round((n(od) * a.odPct[1]) / 100), basis: `${a.odPct[0]} - ${a.odPct[1]}% of OD premium` };
  if (a.perSeat) return { low: a.perSeat * n(seats), high: a.perSeat * n(seats), basis: `Rs ${a.perSeat} per seat` };
  return { low: a.flat[0], high: a.flat[1], basis: a.flat[0] === a.flat[1] ? 'Fixed' : 'Flat price' };
}
