import { useMemo, useState } from 'react';
import { Car, Bike, Info } from 'lucide-react';
import { Card, CardHead, Field, Select } from '../../components/ui';
import { CalcActions, Num, ResultCard, Rows, Toggle } from '../../components/calc/kit';
import { NCB_LADDER, claimPayout, compulsoryDeductible, metalDep, ncbLoss } from '../../lib/motorRates';
import { cx, inr, num } from '../../lib/utils';

export default function ClaimTool() {
  const [f, setF] = useState({
    type: 'car', cc: 1197, ageMonths: 30,
    metal: 18000, plastic: 9000, fibre: 0, glass: 0, paint: 7000, labour: 6000, consumables: 1500,
    zeroDep: false, consumablesCover: false, ncbProtect: false, voluntary: 0,
    ncb: 25, od: 9000, years: 3,
  });
  const set = (k) => (v) => setF((p) => ({ ...p, [k]: v }));

  const m = useMemo(() => {
    const deductible = compulsoryDeductible(f.type, f.cc) + num(f.voluntary);
    const base = num(f.ncb) >= 100 ? 0 : num(f.od) / (1 - num(f.ncb) / 100);
    const args = { ...f, deductible };
    const pay = claimPayout(args);
    const withZd = claimPayout({ ...args, zeroDep: true, consumablesCover: true });
    const loss = f.ncbProtect ? { total: 0, rows: [] } : ncbLoss(num(f.ncb), base, num(f.years));
    const net = pay.payout - loss.total;
    return { deductible, pay, withZd, loss, net, claim: net > 0 };
  }, [f]);

  const verdict = m.claim
    ? `Claim. After the NCB loss you are still ${inr(m.net)} better off.`
    : m.pay.payout <= 0
      ? 'Do not claim. The insurer would pay nothing after the deductible.'
      : `Pay yourself. Claiming would cost ${inr(-m.net)} more in lost NCB than it pays.`;

  const summary = {
    title: 'Should You Claim?',
    subtitle: `${f.type === 'car' ? 'Car' : 'Two-wheeler'}, ${Math.floor(num(f.ageMonths) / 12)} yr ${num(f.ageMonths) % 12} m old, repair estimate ${inr(m.pay.bill)}${f.zeroDep ? ', with Zero Dep' : ''}`,
    highlight: { label: m.claim ? 'Recommendation: claim' : 'Recommendation: pay yourself', value: m.claim ? `${inr(m.net)} better off` : inr(m.pay.bill) + ' from pocket' },
    sections: [
      { heading: 'Insurer would pay', rows: [...m.pay.lines.filter((l) => l.bill).map((l) => [`${l.label}${l.dep ? ` (${l.dep}% deducted)` : ''}`, inr(l.paid)]), ['Deductible', `- ${inr(m.deductible)}`], ['Claim payout', inr(m.pay.payout)]] },
      { heading: 'Cost of claiming', rows: [['Paid from your pocket even after the claim', inr(m.pay.fromPocket)], [`NCB lost over ${f.years} years${f.ncbProtect ? ' (NCB Protect)' : ''}`, inr(m.loss.total)], ['Net benefit of claiming', inr(m.net)]] },
      ...(!f.zeroDep ? [{ heading: 'With Zero Dep and Consumables cover', rows: [['Claim payout would be', inr(m.withZd.payout)], ['Extra money in hand', inr(m.withZd.payout - m.pay.payout)]] }] : []),
    ],
    note: verdict,
  };

  const part = (k, label) => <Num label={label} value={f[k]} onChange={set(k)} />;

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="space-y-4 lg:col-span-3">
        <Card className="p-5">
          <div className="grid grid-cols-2 gap-2">
            {[['car', 'Car', Car], ['bike', 'Two wheeler', Bike]].map(([id, label, Icon]) => (
              <button key={id} onClick={() => set('type')(id)} className={cx('flex items-center justify-center gap-2 rounded-xl border p-3 text-sm font-bold transition', f.type === id ? 'border-brand bg-brand-soft text-brand-strong ring-2 ring-brand/20' : 'border-line text-mute hover:bg-subtle')}>
                <Icon className="size-5" /> {label}
              </button>
            ))}
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <Num label="Vehicle age (months)" hint={`${metalDep(f.ageMonths)}% off metal parts`} value={f.ageMonths} onChange={set('ageMonths')} />
            {f.type === 'car' && <Num label="Engine cc" hint="Sets the deductible" value={f.cc} onChange={set('cc')} />}
            <Num label="Voluntary deductible" value={f.voluntary} onChange={set('voluntary')} />
          </div>
        </Card>

        <Card>
          <CardHead title="Repair estimate from the garage" sub="Enter what is on the estimate; leave others at 0" />
          <div className="grid gap-4 p-5 pt-4 sm:grid-cols-3">
            {part('metal', 'Metal parts')}
            {part('plastic', 'Plastic, rubber, tyres, battery')}
            {part('fibre', 'Fibreglass parts')}
            {part('glass', 'Glass')}
            {part('paint', 'Painting')}
            {part('labour', 'Labour')}
            {part('consumables', 'Consumables (oil, nuts, coolant)')}
          </div>
        </Card>

        <Card className="p-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Current NCB">
              <Select value={f.ncb} onChange={(e) => set('ncb')(e.target.value)}>{NCB_LADDER.map((n) => <option key={n} value={n}>{n}%</option>)}</Select>
            </Field>
            <Num label="Own-damage premium (after NCB)" value={f.od} onChange={set('od')} />
            <Field label="Count NCB loss for">
              <Select value={f.years} onChange={(e) => set('years')(e.target.value)}><option value={3}>3 years</option><option value={5}>5 years</option></Select>
            </Field>
          </div>
          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-3">
            <Toggle label="Zero Depreciation" hint="No depreciation on parts" checked={f.zeroDep} onChange={set('zeroDep')} />
            <Toggle label="Consumables cover" checked={f.consumablesCover} onChange={set('consumablesCover')} />
            <Toggle label="NCB Protect" hint="Claim without losing NCB" checked={f.ncbProtect} onChange={set('ncbProtect')} />
          </div>
        </Card>
      </div>

      <div className="space-y-4 lg:col-span-2">
        <ResultCard tone={m.claim ? 'good' : 'bad'} label={m.claim ? 'Recommendation: claim' : 'Recommendation: pay yourself'} value={m.claim ? `+${inr(m.net)}` : inr(m.pay.bill)} sub={verdict}>
          <Rows rows={[
            ['Repair bill', inr(m.pay.bill)],
            ['Insurer pays', inr(m.pay.payout), true],
            ['Still from your pocket', inr(m.pay.fromPocket)],
            [`NCB lost (${f.years} years)`, f.ncbProtect ? 'Protected' : `- ${inr(m.loss.total)}`],
            ['Net benefit of claiming', inr(m.net), true],
          ]} />
          <CalcActions
            summary={summary}
            lead={!f.zeroDep ? { interest: 'motor', notes: `Zero Dep would have paid ${inr(m.withZd.payout - m.pay.payout)} more on a ${inr(m.pay.bill)} repair.` } : undefined}
          />
        </ResultCard>

        {!f.zeroDep && m.withZd.payout > m.pay.payout && (
          <Card className="p-4">
            <p className="text-sm font-bold text-ink">With Zero Dep + Consumables</p>
            <p className="mt-1 text-xs text-mute">The insurer would pay <b className="tnum text-ink">{inr(m.withZd.payout)}</b>, which is <b className="tnum text-emerald-700 dark:text-emerald-300">{inr(m.withZd.payout - m.pay.payout)} more</b>. A strong reason to add it at the next renewal.</p>
          </Card>
        )}

        <Card>
          <CardHead title="How the claim is worked out" />
          <ul className="divide-y divide-line px-5 pb-2 pt-2 text-xs">
            {m.pay.lines.filter((l) => l.bill).map((l) => (
              <li key={l.label} className="flex justify-between gap-2 py-2">
                <span className="text-mute">{l.label}{l.dep ? <span className="text-faint"> · {l.dep}% deducted</span> : ''}</span>
                <span className="tnum font-semibold text-ink">{inr(l.paid)} <span className="font-normal text-faint">of {inr(l.bill)}</span></span>
              </li>
            ))}
            <li className="flex justify-between py-2"><span className="text-mute">Deductible</span><span className="tnum font-semibold text-ink">- {inr(m.deductible)}</span></li>
          </ul>
          <p className="flex gap-1.5 px-5 pb-4 text-[11px] text-faint"><Info className="mt-0.5 size-3.5 shrink-0" /> Depreciation as per the India Motor Tariff. Insurers' surveyors decide the final amount.</p>
        </Card>
      </div>
    </div>
  );
}
