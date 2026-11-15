import { useMemo, useState } from 'react';
import { Car, Bike, Info, Trophy } from 'lucide-react';
import { Card, CardHead, Field, Select } from '../../components/ui';
import { CalcActions, Num, ResultCard, Toggle } from '../../components/calc/kit';
import { LONG_TERM_TP, TP_TABLES, slabIndex } from '../../lib/motorRates';
import { calcMotor } from '../../lib/premium';
import { cx, inr, num } from '../../lib/utils';

// IDV of a new vehicle in each policy year (standard depreciation schedule).
const IDV_FACTOR = [0.95, 0.85, 0.8, 0.7, 0.6];
const NCB_IF_NO_CLAIM = [0, 20, 25, 35, 45];

export default function LongTerm() {
  const [f, setF] = useState({ type: 'car', ev: false, size: 1197, price: 900000, zone: 'A', odDiscount: 50, ltDiscount: 10, tpHike: 0, gst: 18 });
  const set = (k) => (v) => setF((p) => ({ ...p, [k]: v }));
  const lt = LONG_TERM_TP[f.type];
  const years = lt.years;

  const m = useMemo(() => {
    const slab = slabIndex(f.type, f.ev, f.size);
    const annualTable = TP_TABLES.find((t) => t.id === f.type);
    const tpAnnual = (f.ev ? annualTable.ev : annualTable.rows)[slab];
    const tpLong = (f.ev ? lt.ev : lt.rows)[slab];
    // OD is rated on cc; for EVs use the middle band as an approximation.
    const cc = f.ev ? (f.type === 'car' ? 1200 : 125) : num(f.size);
    const rows = Array.from({ length: years }, (_, y) => {
      const idv = Math.round(num(f.price) * IDV_FACTOR[y]);
      const od = calcMotor({ type: f.type, cover: 'Standalone OD', idv, cc, ageYears: y, zone: f.zone, ncb: NCB_IF_NO_CLAIM[y], odDiscount: f.odDiscount, paCover: false }).od;
      const odNoNcb = calcMotor({ type: f.type, cover: 'Standalone OD', idv, cc, ageYears: y, zone: f.zone, ncb: 0, odDiscount: f.odDiscount, paCover: false }).od;
      const tpYear = Math.round(tpAnnual[1] * (1 + num(f.tpHike) / 100) ** y);
      return { year: y + 1, idv, ncb: NCB_IF_NO_CLAIM[y], od: Math.round(od), odNoNcb: Math.round(odNoNcb), tpYear };
    });
    const sumOd = rows.reduce((t, r) => t + r.od, 0);
    const sumOdFlat = rows.reduce((t, r) => t + r.odNoNcb, 0);
    const withGst = (x) => Math.round(x * (1 + num(f.gst) / 100));
    const options = [
      {
        id: 'bundled', title: `${years}-year TP + 1-year OD, renewed yearly`, sub: 'The legal minimum for a new vehicle. NCB builds up every renewal.',
        upfront: withGst(tpLong[1] + rows[0].od), total: withGst(tpLong[1] + sumOd),
      },
      {
        id: 'package', title: `${years}-year TP + ${years}-year OD, paid upfront`, sub: `Price locked for ${years} years, no renewal hassle. No NCB benefit during the term.`,
        upfront: withGst(tpLong[1] + sumOdFlat * (1 - num(f.ltDiscount) / 100)), total: withGst(tpLong[1] + sumOdFlat * (1 - num(f.ltDiscount) / 100)),
      },
      {
        id: 'yearly', title: 'Everything renewed yearly (for comparison)', sub: 'Not allowed for new vehicles; shows what the long-term TP saves.',
        upfront: withGst(rows[0].tpYear + rows[0].od), total: withGst(rows.reduce((t, r) => t + r.tpYear, 0) + sumOd),
      },
    ];
    const best = options.slice(0, 2).reduce((a, b) => (b.total < a.total ? b : a));
    return { rows, tpAnnual, tpLong, options, best, tpSaving: withGst(rows.reduce((t, r) => t + r.tpYear, 0) - tpLong[1]) };
  }, [f, lt, years]);

  const vehicle = `New ${f.type === 'car' ? 'car' : 'two-wheeler'}${f.ev ? ' (electric)' : ''}, ${m.tpLong[0]}, ex-showroom ${inr(f.price)}`;
  const summary = {
    title: `${years}-Year Insurance Plan Comparison`,
    subtitle: vehicle,
    highlight: { label: `Lower ${years}-year cost: ${m.best.title}`, value: inr(m.best.total) },
    sections: [
      ...m.options.map((o) => ({ heading: o.title, rows: [['Pay now', inr(o.upfront)], [`Total over ${years} years`, inr(o.total)]] })),
      { heading: 'Year by year (own damage, no claims)', rows: m.rows.map((r) => [`Year ${r.year}: IDV ${inr(r.idv)}, NCB ${r.ncb}%`, inr(r.od)]) },
      { rows: [[`Long-term TP saves versus yearly TP`, inr(m.tpSaving)]] },
    ],
    note: 'All amounts include GST. Own-damage premium is estimated from tariff rates and your discount; insurers price their own. Long-term TP rates are fixed by IRDAI.',
  };

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="space-y-4 lg:col-span-3">
        <Card className="p-5">
          <div className="grid grid-cols-2 gap-2">
            {[['car', 'New car (3 years)', Car], ['bike', 'New two-wheeler (5 years)', Bike]].map(([id, label, Icon]) => (
              <button key={id} onClick={() => setF((p) => ({ ...p, type: id, size: id === 'car' ? (p.ev ? 40 : 1197) : p.ev ? 3 : 125, price: id === 'car' ? 900000 : 110000 }))}
                className={cx('flex items-center justify-center gap-2 rounded-xl border p-3 text-sm font-bold transition', f.type === id ? 'border-brand bg-brand-soft text-brand-strong ring-2 ring-brand/20' : 'border-line text-mute hover:bg-subtle')}>
                <Icon className="size-5" /> {label}
              </button>
            ))}
          </div>
          <div className="mt-4"><Toggle label="Electric vehicle" checked={f.ev} onChange={(v) => setF((p) => ({ ...p, ev: v, size: v ? (p.type === 'car' ? 40 : 3) : p.type === 'car' ? 1197 : 125 }))} /></div>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <Num label="Ex-showroom price" value={f.price} onChange={set('price')} />
            <Num label={f.ev ? 'Motor power (kW)' : 'Engine (cc)'} value={f.size} onChange={set('size')} />
            <Field label="RTO zone">
              <Select value={f.zone} onChange={(e) => set('zone')(e.target.value)}><option value="A">Zone A (metro)</option><option value="B">Zone B</option></Select>
            </Field>
            <Num label="Insurer discount on OD %" value={f.odDiscount} onChange={set('odDiscount')} />
            <Num label={`Extra discount on ${years}-year OD %`} hint="Typical multi-year discount" value={f.ltDiscount} onChange={set('ltDiscount')} />
            <Num label="Expected yearly TP increase %" hint="Unchanged since June 2022" value={f.tpHike} onChange={set('tpHike')} />
          </div>
        </Card>

        <Card>
          <CardHead title="Year by year" sub="Own damage assuming no claims, so NCB grows each year" />
          <div className="overflow-x-auto p-5 pt-3">
            <table className="w-full min-w-[460px] text-sm">
              <thead>
                <tr className="text-left text-[11px] font-bold uppercase tracking-wider text-faint">
                  <th className="py-2">Year</th><th className="text-right">IDV</th><th className="text-right">NCB</th><th className="text-right">OD (yearly)</th><th className="text-right">Yearly TP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {m.rows.map((r) => (
                  <tr key={r.year}>
                    <td className="py-2.5 font-semibold text-ink">Year {r.year}</td>
                    <td className="tnum text-right text-mute">{inr(r.idv)}</td>
                    <td className="tnum text-right text-mute">{r.ncb}%</td>
                    <td className="tnum text-right font-semibold text-ink">{inr(r.od)}</td>
                    <td className="tnum text-right text-mute">{inr(r.tpYear)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-xs text-mute">{years}-year TP single premium: <b className="tnum text-ink">{inr(m.tpLong[1])}</b> versus {inr(m.tpAnnual[1])} a year. Amounts in this table are before GST.</p>
          </div>
        </Card>
      </div>

      <div className="space-y-4 lg:col-span-2">
        <ResultCard label={`Lowest ${years}-year cost (incl. GST)`} value={inr(m.best.total)} sub={m.best.title}>
          <div className="space-y-2 p-4">
            {m.options.map((o) => (
              <div key={o.id} className={cx('rounded-xl border p-3', o === m.best ? 'border-brand bg-brand-soft/50' : 'border-line')}>
                <p className="flex items-center gap-1.5 text-sm font-bold text-ink">{o === m.best && <Trophy className="size-4 text-brand" />}{o.title}</p>
                <p className="text-[11px] text-mute">{o.sub}</p>
                <div className="mt-2 flex justify-between text-xs">
                  <span className="text-mute">Pay now <b className="tnum text-ink">{inr(o.upfront)}</b></span>
                  <span className="text-mute">{years} years <b className="tnum text-ink">{inr(o.total)}</b></span>
                </div>
              </div>
            ))}
          </div>
          <CalcActions
            summary={summary}
            lead={{ interest: 'motor', expectedPremium: m.options[0].upfront, notes: vehicle }}
            quote={{
              category: 'motor', title: vehicle, details: `Comparison of ${years}-year plans`,
              options: [
                { insurer: '', plan: `${years}Y TP + 1Y OD`, cover: Math.round(num(f.price) * 0.95), premium: Math.round(m.tpLong[1] + m.rows[0].od), gstRate: num(f.gst), features: `${years}-year third party, own damage renewed yearly` },
                { insurer: '', plan: `${years}Y TP + ${years}Y OD`, cover: Math.round(num(f.price) * 0.95), premium: Math.round(m.options[1].upfront / (1 + num(f.gst) / 100)), gstRate: num(f.gst), features: `Price locked for ${years} years` },
              ],
            }}
          />
        </ResultCard>
        <p className="flex gap-2 rounded-xl bg-subtle p-3 text-xs text-mute">
          <Info className="mt-0.5 size-4 shrink-0 text-brand" />
          New cars must carry 3-year and new two-wheelers 5-year third-party cover. Own damage can be bought for 1 year or for the full term.
        </p>
      </div>
    </div>
  );
}
