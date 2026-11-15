import { useMemo, useState } from 'react';
import { Car, Bike, Info, FilePlus2, TrendingDown } from 'lucide-react';
import { usePolicyForm } from '../../components/PolicyForm';
import { Button, Card, CardHead, Field, Input, Segmented, Select } from '../../components/ui';
import { CalcActions, Toggle } from '../../components/calc/kit';
import { NCB_SLABS } from '../../lib/constants';
import { DEPRECIATION, calcMotor, idvFromPrice } from '../../lib/premium';
import { cx, inr, num } from '../../lib/utils';

export default function MotorPremium() {
  const openForm = usePolicyForm();
  const [f, setF] = useState({
    type: 'car', cover: 'Comprehensive', idv: 600000, cc: 1197, ageYears: 2, zone: 'A', ncb: 20,
    odDiscount: 60, zeroDep: true, paCover: true, addonAmount: 0, gstRate: 18,
  });
  const [price, setPrice] = useState({ exShowroom: 800000, ageMonths: 20 });
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const r = useMemo(() => calcMotor(f), [f]);
  const dep = idvFromPrice(price.exShowroom, num(price.ageMonths));
  const hasOD = f.cover !== 'Third Party';
  const vehicle = f.type === 'car' ? 'Private car' : 'Two wheeler';

  const lines = [
    hasOD && ['Basic OD', `${r.rate}% of IDV`, r.basicOD],
    hasOD && num(f.odDiscount) > 0 && ['Insurer discount', `${f.odDiscount}% on OD`, -r.discount],
    hasOD && num(f.ncb) > 0 && ['No claim bonus', `${f.ncb}%`, -r.ncbAmount],
    hasOD && f.zeroDep && ['Zero depreciation', 'Add-on', r.zeroDepAmount],
    hasOD && r.addons > 0 && ['Other add-ons', '', r.addons],
    r.tpBasic > 0 && ['Third party', 'IRDAI rate', r.tpBasic],
    r.pa > 0 && ['PA owner-driver', '₹15 lakh cover', r.pa],
  ].filter(Boolean);

  const summary = {
    title: 'Motor Insurance Estimate',
    subtitle: `${vehicle}, ${f.cover}${hasOD ? `, IDV ${inr(f.idv)}` : ''}, ${f.cc} cc`,
    highlight: { label: 'Estimated total payable (incl. GST)', value: inr(r.total) },
    sections: [{
      heading: 'Premium breakup',
      rows: [
        ...lines.map(([l, note, v]) => [`${l}${note ? ` (${note})` : ''}`, `${v < 0 ? '- ' : ''}${inr(Math.abs(v))}`]),
        ['Net premium', inr(r.net)], [`GST ${f.gstRate}%`, inr(r.gst)], ['Total payable', inr(r.total)],
      ],
    }],
    note: 'Indicative estimate based on tariff own-damage rates and IRDAI third-party rates. Insurers file their own rates; the final premium depends on the insurer.',
  };

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="p-5 lg:col-span-3">
          <div className="grid grid-cols-2 gap-2">
            {[['car', 'Private car', Car], ['bike', 'Two wheeler', Bike]].map(([id, label, Icon]) => (
              <button key={id} onClick={() => setF((p) => ({ ...p, type: id, cc: id === 'car' ? 1197 : 125, idv: id === 'car' ? 600000 : 70000 }))}
                className={cx('flex items-center justify-center gap-2 rounded-xl border p-3 text-sm font-bold transition', f.type === id ? 'border-brand bg-brand-soft text-brand-strong ring-2 ring-brand/20' : 'border-line text-mute hover:bg-subtle')}>
                <Icon className="size-5" /> {label}
              </button>
            ))}
          </div>
          <div className="mt-5">
            <Segmented value={f.cover} onChange={(v) => set('cover', v)} options={['Comprehensive', 'Third Party', 'Standalone OD']} className="w-fit" />
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {hasOD && <Field label="IDV (insured declared value)"><Input type="number" inputMode="decimal" value={f.idv} onChange={(e) => set('idv', e.target.value)} /></Field>}
            <Field label="Engine capacity (cc)"><Input type="number" inputMode="decimal" value={f.cc} onChange={(e) => set('cc', e.target.value)} /></Field>
            {hasOD && (
              <>
                <Field label="Vehicle age (years)"><Input type="number" inputMode="decimal" min="0" value={f.ageYears} onChange={(e) => set('ageYears', e.target.value)} /></Field>
                <Field label="RTO zone" hint="Zone A: Ahmedabad, Bengaluru, Chennai, Hyderabad, Kolkata, Mumbai, New Delhi, Pune">
                  <Select value={f.zone} onChange={(e) => set('zone', e.target.value)}><option value="A">Zone A (metro)</option><option value="B">Zone B (rest of India)</option></Select>
                </Field>
                <Field label="No claim bonus">
                  <Select value={f.ncb} onChange={(e) => set('ncb', e.target.value)}>{NCB_SLABS.map((n) => <option key={n} value={n}>{n}%</option>)}</Select>
                </Field>
                <Field label="Insurer discount on OD %" hint="Most insurers discount the tariff rate heavily">
                  <Input type="number" inputMode="decimal" min="0" max="100" value={f.odDiscount} onChange={(e) => set('odDiscount', e.target.value)} />
                </Field>
                <Field label="Other add-ons (amount)"><Input type="number" inputMode="decimal" value={f.addonAmount} onChange={(e) => set('addonAmount', e.target.value)} /></Field>
              </>
            )}
            <Field label="GST %"><Input type="number" inputMode="decimal" value={f.gstRate} onChange={(e) => set('gstRate', e.target.value)} /></Field>
          </div>
          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
            {hasOD && <Toggle label="Zero depreciation" checked={f.zeroDep} onChange={(v) => set('zeroDep', v)} />}
            {f.cover !== 'Standalone OD' && <Toggle label="PA owner-driver cover" checked={f.paCover} onChange={(v) => set('paCover', v)} />}
          </div>
        </Card>

        <div className="space-y-4 lg:col-span-2">
          <Card className="overflow-hidden">
            <div className="bg-grad-deep p-5 text-white">
              <p className="text-xs font-semibold text-white/80">Estimated total payable</p>
              <p className="tnum mt-1 text-4xl font-bold tracking-tight">{inr(r.total)}</p>
              <p className="mt-1 text-xs text-white/75">Net {inr(r.net)} + GST {inr(r.gst)}</p>
            </div>
            <ul className="divide-y divide-line px-5">
              {lines.map(([label, note, value]) => (
                <li key={label} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <span className="text-ink">{label} {note && <span className="text-xs text-faint">· {note}</span>}</span>
                  <span className={cx('tnum font-bold', value < 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-ink')}>{value < 0 ? '- ' : ''}{inr(Math.abs(value))}</span>
                </li>
              ))}
            </ul>
            <div className="grid grid-cols-2 gap-px border-t border-line bg-line">
              <div className="bg-subtle px-5 py-3"><p className="text-[11px] font-semibold text-mute">OD premium</p><p className="tnum font-bold text-ink">{inr(r.od)}</p></div>
              <div className="bg-subtle px-5 py-3"><p className="text-[11px] font-semibold text-mute">TP premium</p><p className="tnum font-bold text-ink">{inr(r.tp)}</p></div>
            </div>
            <CalcActions
              summary={summary}
              lead={{ interest: 'motor', expectedPremium: r.total, notes: `${summary.subtitle}. Estimate ${inr(r.total)}.` }}
              quote={{ category: 'motor', details: summary.subtitle, options: [{ insurer: '', plan: f.cover, cover: hasOD ? num(f.idv) : '', premium: Math.round(r.net), gstRate: num(f.gstRate), features: f.zeroDep && hasOD ? 'Zero Depreciation' : '' }] }}
            />
            <div className="px-4 pb-4">
              <Button size="sm" variant="secondary" icon={FilePlus2} className="w-full"
                onClick={() => openForm({ preset: { category: 'motor', vehicleClass: f.type === 'car' ? 'Private Car' : 'Two Wheeler', coverType: f.cover, idv: hasOD ? num(f.idv) : '', cc: num(f.cc), ncb: String(f.ncb), odPremium: Math.round(r.od) || '', tpPremium: Math.round(r.tp) || '', netPremium: Math.round(r.net), gstRate: num(f.gstRate), addons: f.zeroDep && hasOD ? ['Zero Depreciation'] : [] } })}>
                Create policy from this estimate
              </Button>
            </div>
          </Card>
          <p className="flex gap-2 rounded-xl bg-amber-500/12 p-3 text-xs text-amber-800 dark:text-amber-200">
            <Info className="mt-0.5 size-4 shrink-0" />
            Indicative only. OD uses India Motor Tariff base rates and TP uses IRDAI notified rates for a one-year policy. Insurers file their own rates and add-on prices, so always confirm on the insurer portal.
          </p>
        </div>
      </div>

      <Card className="mt-4">
        <CardHead title="IDV estimator" icon={TrendingDown} sub="Ex-showroom price less standard depreciation" />
        <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Ex-showroom price"><Input type="number" inputMode="decimal" value={price.exShowroom} onChange={(e) => setPrice({ ...price, exShowroom: e.target.value })} /></Field>
          <Field label="Vehicle age (months)"><Input type="number" inputMode="decimal" value={price.ageMonths} onChange={(e) => setPrice({ ...price, ageMonths: e.target.value })} /></Field>
          <div className="flex items-center justify-between gap-3 rounded-xl bg-brand-soft p-4 sm:col-span-2">
            <div>
              <p className="text-[11px] font-semibold text-brand-strong">Estimated IDV at {dep.pct}% depreciation</p>
              <p className="tnum text-2xl font-bold text-brand-strong">{inr(dep.idv)}</p>
            </div>
            <Button size="sm" onClick={() => set('idv', dep.idv)}>Use this IDV</Button>
          </div>
          <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-mute sm:col-span-2 sm:grid-cols-3 lg:col-span-4">
            {DEPRECIATION.map((d) => <li key={d.label} className="flex justify-between"><span>{d.label}</span><b className="text-ink">{d.pct}%</b></li>)}
          </ul>
        </div>
      </Card>
    </>
  );
}
