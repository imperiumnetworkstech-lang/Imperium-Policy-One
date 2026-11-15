// Indicative motor premium maths based on the India Motor Tariff (own damage) and the
// IRDAI notified third-party rates. Insurers file their own OD rates, so treat the
// result as a quick estimate, not a quote.

// Own-damage base rate (% of IDV) by [zone][ageBand][ccBand].
const OD_RATES = {
  car: {
    A: [[3.127, 3.283, 3.44], [3.283, 3.447, 3.612], [3.362, 3.529, 3.698]],
    B: [[3.039, 3.191, 3.343], [3.191, 3.351, 3.51], [3.268, 3.432, 3.596]],
  },
  bike: {
    A: [[1.708, 1.793, 1.879], [1.793, 1.883, 1.973], [1.836, 1.928, 2.02]],
    B: [[1.676, 1.76, 1.844], [1.76, 1.848, 1.936], [1.802, 1.892, 1.982]],
  },
};

// Annual third-party premium (private vehicles, 1 year renewal).
export const TP_RATES = {
  car: [
    { max: 1000, label: 'Up to 1000 cc', premium: 2094 },
    { max: 1500, label: '1000 - 1500 cc', premium: 3416 },
    { max: Infinity, label: 'Above 1500 cc', premium: 7897 },
  ],
  bike: [
    { max: 75, label: 'Up to 75 cc', premium: 538 },
    { max: 150, label: '75 - 150 cc', premium: 714 },
    { max: 350, label: '150 - 350 cc', premium: 1366 },
    { max: Infinity, label: 'Above 350 cc', premium: 2804 },
  ],
};

export const ZERO_DEP_RATE = { car: 0.5, bike: 0.4 }; // % of IDV, typical market loading
export const PA_OWNER_DRIVER = { car: 750, bike: 375 };

// Standard IDV depreciation schedule by vehicle age.
export const DEPRECIATION = [
  { maxMonths: 6, pct: 5, label: 'Up to 6 months' },
  { maxMonths: 12, pct: 15, label: '6 months - 1 year' },
  { maxMonths: 24, pct: 20, label: '1 - 2 years' },
  { maxMonths: 36, pct: 30, label: '2 - 3 years' },
  { maxMonths: 48, pct: 40, label: '3 - 4 years' },
  { maxMonths: 60, pct: 50, label: '4 - 5 years' },
];
export function idvFromPrice(exShowroom, ageMonths) {
  const band = DEPRECIATION.find((d) => ageMonths <= d.maxMonths);
  const pct = band ? band.pct : 50 + Math.min(Math.ceil((ageMonths - 60) / 12) * 5, 35);
  return { pct, idv: Math.round((Number(exShowroom) || 0) * (1 - pct / 100)) };
}

const ccBandOD = (type, cc) => (type === 'car' ? (cc <= 1000 ? 0 : cc <= 1500 ? 1 : 2) : cc <= 150 ? 0 : cc <= 350 ? 1 : 2);
const ageBand = (years) => (years < 5 ? 0 : years <= 10 ? 1 : 2);

export function calcMotor({
  type = 'car', cover = 'Comprehensive', idv = 0, cc = 1200, ageYears = 0, zone = 'A',
  ncb = 0, odDiscount = 0, zeroDep = false, paCover = true, addonAmount = 0, gstRate = 18,
}) {
  const n = (v) => Number(v) || 0;
  const hasOD = cover !== 'Third Party';
  const hasTP = cover !== 'Standalone OD';

  const rate = OD_RATES[type][zone][ageBand(n(ageYears))][ccBandOD(type, n(cc))];
  const basicOD = hasOD ? (n(idv) * rate) / 100 : 0;
  const discount = (basicOD * n(odDiscount)) / 100;
  const afterDiscount = basicOD - discount;
  const ncbAmount = (afterDiscount * n(ncb)) / 100;
  const zeroDepAmount = hasOD && zeroDep ? (n(idv) * ZERO_DEP_RATE[type]) / 100 : 0;
  const addons = hasOD ? n(addonAmount) : 0;
  const od = afterDiscount - ncbAmount + zeroDepAmount + addons;

  const tpBasic = hasTP ? TP_RATES[type].find((b) => n(cc) <= b.max).premium : 0;
  const pa = hasTP && paCover ? PA_OWNER_DRIVER[type] : 0;
  const tp = tpBasic + pa;

  const net = od + tp;
  const gst = (net * n(gstRate)) / 100;
  return {
    rate, basicOD, discount, ncbAmount, zeroDepAmount, addons, od, tpBasic, pa, tp, net, gst,
    total: net + gst,
  };
}
