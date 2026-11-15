import { useMemo, useState } from 'react';
import { Car, Bike, Check, Info } from 'lucide-react';
import { Card, CardHead, Field, Segmented, Select } from '../../components/ui';
import { CalcActions, Num, ResultCard, Rows } from '../../components/calc/kit';
import { ADDONS, NCB_LADDER, addonPrice } from '../../lib/motorRates';
import { cx, inr, num } from '../../lib/utils';

const POINT = { low: 'Lowest', mid: 'Typical', high: 'Highest' };

export default function Addons() {
  const [f, setF] = useState({ type: 'car', idv: 700000, ageYears: 1, od: 9000, ncb: 25, seats: 5, gst: 18 });
  const [picked, setPicked] = useState(['zd', 'ep', 'rsa', 'cons']);
  const [point, setPoint] = useState('mid');
  const set = (k) => (v) => setF((p) => ({ ...p, [k]: v }));

  const list = useMemo(
    () => ADDONS.filter((a) => a.types.includes(f.type)).map((a) => ({ ...a, price: addonPrice(a, f) })),
    [f],
  );
  const val = (p) => (point === 'low' ? p.low : point === 'high' ? p.high : Math.round((p.low + p.high) / 2));
  const chosen = list.filter((a) => picked.includes(a.id) && !a.price.unavailable);
  const net = chosen.reduce((t, a) => t + val(a.price), 0);
  const tax = Math.round((net * num(f.gst)) / 100);
  const toggle = (id) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const vehicle = `${f.type === 'car' ? 'Car' : 'Two-wheeler'}, ${f.ageYears} yr old, IDV ${inr(f.idv)}`;
  const summary = {
    title: 'Add-on Covers',
    subtitle: vehicle,
    highlight: { label: `${POINT[point]} estimate for ${chosen.length} add-ons (incl. GST)`, value: inr(net + tax) },
    sections: [
      { heading: 'Selected add-ons', rows: chosen.map((a) => [`${a.label} (${a.price.basis})`, inr(val(a.price))]) },
      { rows: [['Add-ons before GST', inr(net)], [`GST ${f.gst}%`, inr(tax)], ['Total', inr(net + tax)]] },
    ],
    note: 'Typical market prices for guidance. Each insurer prices add-ons differently; the exact amount comes with the formal quote.',
  };

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="space-y-4 lg:col-span-3">
        <Card className="p-5">
          <div className="grid grid-cols-2 gap-2">
            {[['car', 'Car', Car], ['bike', 'Two wheeler', Bike]].map(([id, label, Icon]) => (
              <button key={id} onClick={() => setF((p) => ({ ...p, type: id, idv: id === 'car' ? 700000 : 80000, seats: id === 'car' ? 5 : 1 }))}
                className={cx('flex items-center justify-center gap-2 rounded-xl border p-3 text-sm font-bold transition', f.type === id ? 'border-brand bg-brand-soft text-brand-strong ring-2 ring-brand/20' : 'border-line text-mute hover:bg-subtle')}>
                <Icon className="size-5" /> {label}
              </button>
            ))}
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <Num label="IDV" value={f.idv} onChange={set('idv')} />
            <Num label="Vehicle age (years)" value={f.ageYears} onChange={set('ageYears')} />
            <Num label="Seats (for passenger cover)" value={f.seats} onChange={set('seats')} />
            {f.type === 'car' && <Num label="OD premium (for NCB Protect)" value={f.od} onChange={set('od')} />}
            {f.type === 'car' && (
              <Field label="Current NCB">
                <Select value={f.ncb} onChange={(e) => set('ncb')(e.target.value)}>{NCB_LADDER.map((n) => <option key={n} value={n}>{n}%</option>)}</Select>
              </Field>
            )}
          </div>
        </Card>

        <Card>
          <CardHead title="Add-on price list" sub="Tap to add or remove" action={<Segmented value={point} onChange={setPoint} options={[{ id: 'low', label: 'Low' }, { id: 'mid', label: 'Typical' }, { id: 'high', label: 'High' }]} />} />
          <ul className="mt-3 divide-y divide-line border-t border-line">
            {list.map((a) => {
              const on = picked.includes(a.id);
              const off = a.price.unavailable;
              return (
                <li key={a.id}>
                  <button type="button" disabled={Boolean(off)} onClick={() => toggle(a.id)} className={cx('flex w-full items-center gap-3 px-5 py-3 text-left transition', off ? 'opacity-50' : 'hover:bg-subtle')}>
                    <span className={cx('grid size-5 shrink-0 place-items-center rounded-md border', on && !off ? 'border-brand bg-brand text-white' : 'border-line')}>{on && !off && <Check className="size-3.5" />}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-ink">{a.label}</span>
                      <span className="block text-[11px] text-mute">{off || `${a.note} · ${a.price.basis}`}</span>
                    </span>
                    {!off && (
                      <span className="text-right">
                        <span className="tnum block text-sm font-bold text-ink">{inr(val(a.price))}</span>
                        {a.price.low !== a.price.high && <span className="tnum block text-[11px] text-faint">{inr(a.price.low)} - {inr(a.price.high)}</span>}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>

      <div className="space-y-4 lg:col-span-2">
        <ResultCard label={`${POINT[point]} cost of ${chosen.length} add-ons (incl. GST)`} value={inr(net + tax)} sub={vehicle}>
          <Rows rows={[...chosen.map((a) => [a.label, inr(val(a.price))]), [`GST ${f.gst}%`, inr(tax)], ['Total', inr(net + tax), true]]} />
          <CalcActions
            summary={summary}
            lead={{ interest: 'motor', expectedPremium: net + tax, notes: `Add-ons discussed: ${chosen.map((a) => a.label).join(', ')}` }}
            quote={{ category: 'motor', title: vehicle, details: `Add-ons: ${chosen.map((a) => a.label).join(', ')}`, options: [{ insurer: '', plan: 'Comprehensive', cover: num(f.idv), premium: '', gstRate: num(f.gst), features: chosen.map((a) => a.label).join(', ') }] }}
          />
        </ResultCard>
        <p className="flex gap-2 rounded-xl bg-amber-500/12 p-3 text-xs text-amber-800 dark:text-amber-200">
          <Info className="mt-0.5 size-4 shrink-0" />
          Typical market prices for guidance. Each insurer sets its own add-on rates and age limits; confirm on the insurer portal before quoting.
        </p>
      </div>
    </div>
  );
}
