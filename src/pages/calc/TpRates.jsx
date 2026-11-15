import { useMemo, useState } from 'react';
import { Info } from 'lucide-react';
import { Card, CardHead, Field, Select } from '../../components/ui';
import { CalcActions, Num, ResultCard, Rows, Toggle } from '../../components/calc/kit';
import { TP_SOURCE, TP_TABLES } from '../../lib/motorRates';
import { cx, inr, num } from '../../lib/utils';

export default function TpRates() {
  const [kind, setKind] = useState('gcv');
  const [ev, setEv] = useState(false);
  const [slab, setSlab] = useState(0);
  const [passengers, setPassengers] = useState(4);
  const [gst, setGst] = useState(18);
  const table = TP_TABLES.find((t) => t.id === kind);
  const rows = ev && table.ev ? table.ev : table.rows;
  const row = rows[Math.min(slab, rows.length - 1)];

  const m = useMemo(() => {
    const basic = row[1];
    const perPax = row[2] ? row[2] * num(passengers) : 0;
    const net = basic + perPax;
    const tax = Math.round((net * num(gst)) / 100);
    return { basic, perPax, net, tax, total: net + tax };
  }, [row, passengers, gst]);

  const name = `${table.label}${ev && table.ev ? ' (electric)' : ''} · ${row[0]}`;
  const summary = {
    title: 'Third-Party Premium',
    subtitle: name,
    highlight: { label: 'Third-party premium for one year (incl. GST)', value: inr(m.total) },
    sections: [{
      rows: [
        ['Basic third-party premium', inr(m.basic)],
        ...(row[2] ? [[`Passengers: ${passengers} × ${inr(row[2])}`, inr(m.perPax)]] : []),
        ['Net premium', inr(m.net)], [`GST ${gst}%`, inr(m.tax)], ['Total payable', inr(m.total)],
      ],
    }],
    note: `${TP_SOURCE}. Third-party premium is the same with every insurer. Personal accident cover for the owner-driver is extra.`,
  };

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="space-y-4 lg:col-span-3">
        <Card className="p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Vehicle type">
              <Select value={kind} onChange={(e) => { setKind(e.target.value); setSlab(0); setEv(false); }}>
                {TP_TABLES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </Select>
            </Field>
            <Field label="Category">
              <Select value={Math.min(slab, rows.length - 1)} onChange={(e) => setSlab(Number(e.target.value))}>
                {rows.map((r, i) => <option key={r[0]} value={i}>{r[0]}</option>)}
              </Select>
            </Field>
            {table.perPassenger && <Num label="Licensed passengers (excluding driver)" value={passengers} onChange={setPassengers} />}
            <Num label="GST %" value={gst} onChange={setGst} />
          </div>
          {table.ev && <div className="mt-4"><Toggle label="Electric vehicle" hint="EVs get lower third-party rates" checked={ev} onChange={(v) => { setEv(v); setSlab(0); }} /></div>}
        </Card>

        <Card>
          <CardHead title={`${table.label} rate card`} sub={ev && table.ev ? 'Electric' : 'Petrol, diesel, CNG'} />
          <div className="overflow-x-auto p-5 pt-3">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] font-bold uppercase tracking-wider text-faint">
                  <th className="py-2">Category</th><th className="text-right">Basic</th>{table.perPassenger && <th className="text-right">Per passenger</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((r, i) => (
                  <tr key={r[0]} onClick={() => setSlab(i)} className={cx('cursor-pointer', i === slab && 'bg-brand-soft')}>
                    <td className="py-2.5 pl-1 font-semibold text-ink">{r[0]}</td>
                    <td className="tnum text-right text-ink">{inr(r[1])}</td>
                    {table.perPassenger && <td className="tnum pr-1 text-right text-mute">{r[2] ? inr(r[2]) : '-'}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
            {table.ev && !ev && (
              <p className="mt-3 text-xs text-mute">Electric version: {table.ev.map((r) => `${r[0]} ${inr(r[1])}`).join(' · ')}</p>
            )}
          </div>
        </Card>
      </div>

      <div className="space-y-4 lg:col-span-2">
        <ResultCard label="Third-party premium, 1 year (incl. GST)" value={inr(m.total)} sub={name}>
          <Rows rows={[
            ['Basic premium', inr(m.basic)],
            ...(row[2] ? [[`${passengers} passengers × ${inr(row[2])}`, inr(m.perPax)]] : []),
            [`GST ${gst}%`, inr(m.tax)],
            ['Total', inr(m.total), true],
          ]} />
          <CalcActions
            summary={summary}
            lead={{ interest: 'motor', expectedPremium: m.total, notes: `Third-party quote: ${name}` }}
            quote={{ category: 'motor', title: name, details: 'Third-party only', options: [{ insurer: '', plan: 'Third Party', cover: '', premium: m.net, gstRate: num(gst), features: 'Liability only' }] }}
          />
        </ResultCard>
        <p className="flex gap-2 rounded-xl bg-subtle p-3 text-xs text-mute">
          <Info className="mt-0.5 size-4 shrink-0 text-brand" />
          {TP_SOURCE}. Third-party rates are fixed by IRDAI, so they are the same with every insurer. New cars need 3-year and new two-wheelers 5-year cover; see the Long-term tool.
        </p>
      </div>
    </div>
  );
}
