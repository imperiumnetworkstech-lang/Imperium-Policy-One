import { useMemo, useState } from 'react';
import { Info, ShieldCheck } from 'lucide-react';
import { Card, CardHead, Field, Segmented, Select } from '../../components/ui';
import { CalcActions, Num, ResultCard, Rows } from '../../components/calc/kit';
import { NCB_LADDER, ncbLoss, nextNcbAfter } from '../../lib/motorRates';
import { cx, inr, num } from '../../lib/utils';

export default function NcbTool() {
  const [f, setF] = useState({ od: 9000, ncb: 25, years: 3, deductible: 1000 });
  const set = (k) => (v) => setF((p) => ({ ...p, [k]: v }));
  const ncb = num(f.ncb);
  // The policy shows OD after NCB; the discount is worked out on the OD before NCB.
  const base = ncb >= 100 ? 0 : num(f.od) / (1 - ncb / 100);

  const m = useMemo(() => {
    const loss = ncbLoss(ncb, base, num(f.years));
    const next = nextNcbAfter(ncb, false);
    return {
      loss,
      next,
      saveNow: Math.round((base * ncb) / 100),
      saveNext: Math.round((base * next) / 100),
      breakEven: loss.total + num(f.deductible),
    };
  }, [ncb, base, f.years, f.deductible]);

  const summary = {
    title: 'No Claim Bonus Value',
    subtitle: `Current NCB ${ncb}%, own-damage premium ${inr(f.od)} after NCB`,
    highlight: { label: `NCB you would lose by claiming now (next ${f.years} years)`, value: inr(m.loss.total) },
    sections: [
      { heading: 'Your NCB', rows: [['NCB saving on this policy', inr(m.saveNow)], ['NCB next year if no claim', `${m.next}% (${inr(m.saveNext)})`], ['NCB next year after a claim', '0%']] },
      { heading: 'Year by year', rows: m.loss.rows.map((r) => [`Renewal ${r.year}: ${r.keep}% vs ${r.lose}%`, `${inr(r.keepSaving - r.loseSaving)} more without a claim`]) },
      { heading: 'Rule of thumb', rows: [['Pay small damages yourself if the claim would pay less than', inr(m.breakEven)]] },
    ],
    note: 'Assumes the own-damage premium stays about the same each year. NCB is lost if the policy is renewed more than 90 days after expiry.',
  };

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="space-y-4 lg:col-span-3">
        <Card className="p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Num label="Own-damage premium on the policy" hint="The OD amount after the NCB discount" value={f.od} onChange={set('od')} />
            <Field label="Current NCB">
              <Select value={f.ncb} onChange={(e) => set('ncb')(e.target.value)}>{NCB_LADDER.map((n) => <option key={n} value={n}>{n}%</option>)}</Select>
            </Field>
            <Num label="Deductible per claim" hint="₹1,000 for cars up to 1500 cc, ₹2,000 above; ₹100 for two-wheelers" value={f.deductible} onChange={set('deductible')} />
            <Field label="Look ahead">
              <Segmented value={Number(f.years)} onChange={set('years')} options={[{ id: 3, label: '3 years' }, { id: 5, label: '5 years' }]} className="w-fit" />
            </Field>
          </div>
        </Card>

        <Card>
          <CardHead title="NCB ladder" sub="No claim versus a claim this year" />
          <div className="overflow-x-auto p-5 pt-3">
            <table className="w-full min-w-[420px] text-sm">
              <thead>
                <tr className="text-left text-[11px] font-bold uppercase tracking-wider text-faint">
                  <th className="py-2">Renewal</th><th>No claim</th><th>Claim now</th><th className="text-right">Difference</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {m.loss.rows.map((r) => (
                  <tr key={r.year}>
                    <td className="py-2.5 font-semibold text-ink">Year {r.year}</td>
                    <td className="tnum text-emerald-700 dark:text-emerald-300">{r.keep}% · {inr(r.keepSaving)}</td>
                    <td className="tnum text-rose-700 dark:text-rose-300">{r.lose}% · {inr(r.loseSaving)}</td>
                    <td className="tnum text-right font-bold text-ink">{inr(r.keepSaving - r.loseSaving)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {NCB_LADDER.slice(1).map((n, i) => (
                <span key={n} className={cx('rounded-full px-2.5 py-1 text-[11px] font-semibold', n === ncb ? 'bg-brand text-white' : 'bg-subtle text-mute')}>
                  {i + 1} claim-free year{i ? 's' : ''}: {n}%
                </span>
              ))}
            </div>
          </div>
        </Card>
      </div>

      <div className="space-y-4 lg:col-span-2">
        <ResultCard label={`NCB at stake if you claim now (next ${f.years} years)`} value={inr(m.loss.total)} sub={`Today's NCB is saving ${inr(m.saveNow)} on this policy`}>
          <Rows rows={[
            ['NCB next year, no claim', `${m.next}% · ${inr(m.saveNext)}`, true],
            ['NCB next year, after a claim', '0%'],
            ['Own-damage before NCB', inr(base)],
            ['Claim only if it pays more than', inr(m.breakEven), true],
          ]} />
          <CalcActions summary={summary} lead={{ interest: 'motor', notes: `NCB ${ncb}%, OD ${inr(f.od)}. NCB at stake ${inr(m.loss.total)}.` }} />
        </ResultCard>
        <Card className="space-y-2 p-4 text-xs text-mute">
          <p className="flex items-center gap-2 font-bold text-ink"><ShieldCheck className="size-4 text-brand" /> NCB facts to tell customers</p>
          <p>NCB belongs to the owner, not the car. On selling, get an NCB retention letter and use it on the next vehicle within 3 years.</p>
          <p>Renewing more than 90 days after expiry resets NCB to 0%.</p>
          <p>NCB applies only to the own-damage premium, never to third-party.</p>
          <p>The NCB Protect add-on keeps the NCB after one claim a year.</p>
          <p className="flex gap-1.5 pt-1 text-faint"><Info className="mt-0.5 size-3.5 shrink-0" /> Assumes the own-damage premium stays about the same each year.</p>
        </Card>
      </div>
    </div>
  );
}
