import { useEffect, useMemo, useState } from 'react';
import { Trophy, Target, Pencil, Save, X, TrendingUp, TrendingDown, Building, Crown, CalendarRange, Medal } from 'lucide-react';
import { useData } from '../context/DataContext';
import { Avatar, Button, Card, CardHead, Empty, IconTile, Input, PageHeader, Progress, Segmented, useToast } from '../components/ui';
import { CAT_TONE, catIcon } from '../components/icons';
import { CATEGORIES, saleDate } from '../lib/constants';
import { cx, fyLabel, fyRange, fyStartYear, inRange, inr, inrShort, lastMonths, monthLabel, monthRange, num, parseISO, todayISO } from '../lib/utils';

const LINES = [{ id: 'total', label: 'All business' }, ...CATEGORIES];
const sum = (rows, fn) => rows.reduce((t, r) => t + num(fn(r)), 0);

// Share of the period already gone, so progress can be compared with where you should be by today.
function elapsed({ from, to }) {
  const a = parseISO(from);
  const b = parseISO(to);
  const t = parseISO(todayISO());
  return Math.min(1, Math.max(0, (t - a + 86400000) / (b - a + 86400000)));
}

export default function Goals() {
  const { policies, clients, profile, saveProfile } = useData();
  const toast = useToast();
  const [period, setPeriod] = useState('month');
  const [editing, setEditing] = useState(false);
  const goals = profile.goals || {};
  // Insurer targets are stored as a list so a removed insurer is really removed (maps are merged on save).
  const insurerMap = useMemo(() => Object.fromEntries((goals.insurerList || []).map((x) => [x.name, num(x.target)])), [goals.insurerList]);
  const fy = fyStartYear();
  const range = period === 'month' ? monthRange() : fyRange(fy);
  const t = goals[period] || {};
  // Older accounts stored one monthly premium target; use it until goals are set here.
  const target = (k) => num(t[k]) || (k === 'total' && period === 'month' ? num(profile.monthlyTarget) : 0);

  const m = useMemo(() => {
    const cur = policies.filter((p) => inRange(saleDate(p), range));
    const byLine = Object.fromEntries(LINES.map((l) => [l.id, l.id === 'total' ? cur : cur.filter((p) => p.category === l.id)]));
    const fyRows = policies.filter((p) => inRange(saleDate(p), fyRange(fy)));
    const insurerNames = [...new Set([...fyRows.map((p) => p.insurer).filter(Boolean), ...Object.keys(insurerMap)])];
    const insurers = insurerNames
      .map((name) => {
        const rows = fyRows.filter((p) => p.insurer === name);
        return {
          name,
          target: num(insurerMap[name]),
          earned: sum(rows, (p) => p.commissionAmount),
          received: sum(rows.filter((p) => p.commissionStatus === 'Received'), (p) => p.commissionAmount),
          premium: sum(rows, (p) => p.netPremium),
          count: rows.length,
        };
      })
      .sort((a, b) => b.earned - a.earned);
    const months = lastMonths(12).map((ym) => {
      const rows = policies.filter((p) => saleDate(p).startsWith(ym));
      return { ym, premium: sum(rows, (p) => p.netPremium), commission: sum(rows, (p) => p.commissionAmount), count: rows.length };
    });
    const topClients = clients
      .map((c) => {
        const rows = cur.filter((p) => p.clientId === c.id);
        return { c, premium: sum(rows, (p) => p.netPremium), count: rows.length };
      })
      .filter((x) => x.premium > 0)
      .sort((a, b) => b.premium - a.premium)
      .slice(0, 5);
    return {
      cur, byLine, insurers, topClients,
      bestMonths: [...months].filter((x) => x.premium > 0).sort((a, b) => b.premium - a.premium).slice(0, 3),
      commission: sum(cur, (p) => p.commissionAmount),
      pace: elapsed(range),
    };
  }, [policies, clients, range.from, range.to, insurerMap, fy]);

  const premiumOf = (id) => sum(m.byLine[id], (p) => p.netPremium);
  const anyTarget = LINES.some((l) => target(l.id)) || num(t.commission) || num(t.policies);

  return (
    <>
      <PageHeader title="Goals" sub={period === 'month' ? `${monthLabel(range.from.slice(0, 7))} · ${Math.round(m.pace * 100)}% of the month gone` : `${fyLabel(fy)} · ${Math.round(m.pace * 100)}% of the year gone`}>
        <Segmented value={period} onChange={(v) => { setPeriod(v); setEditing(false); }} options={[{ id: 'month', label: 'This month' }, { id: 'year', label: fyLabel(fy) }]} />
        {!editing && <Button icon={Pencil} variant="secondary" onClick={() => setEditing(true)}>Set targets</Button>}
      </PageHeader>

      {editing ? (
        <TargetEditor
          period={period}
          initial={{ ...t, total: target('total') || '' }}
          insurers={m.insurers.map((x) => x.name)}
          insurerTargets={insurerMap}
          onCancel={() => setEditing(false)}
          onSave={async (vals, ins) => {
            await saveProfile({ goals: { ...goals, [period]: vals, insurerList: Object.entries(ins).map(([name, target]) => ({ name, target })) }, ...(period === 'month' ? { monthlyTarget: num(vals.total) } : {}) });
            toast('Targets saved');
            setEditing(false);
          }}
        />
      ) : (
        <>
          {/* Premium targets by line */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            {LINES.map((l) => (
              <GoalCard
                key={l.id}
                icon={l.id === 'total' ? Target : catIcon(l.id)}
                tone={l.id === 'total' ? 'brand' : CAT_TONE[l.id]}
                label={l.label}
                done={premiumOf(l.id)}
                goal={target(l.id)}
                pace={m.pace}
                sub={`${m.byLine[l.id].length} ${m.byLine[l.id].length === 1 ? 'policy' : 'policies'}`}
                highlight={l.id === 'total'}
              />
            ))}
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <GoalCard icon={Trophy} tone="pink" label="Commission earned" done={m.commission} goal={num(t.commission)} pace={m.pace} sub="All insurers" />
            <GoalCard icon={CalendarRange} tone="periwinkle" label="Policies sold" done={m.cur.length} goal={num(t.policies)} pace={m.pace} count sub="New and renewal" />
          </div>

          {!anyTarget && (
            <Card className="mt-4">
              <Empty icon={Target} title="No targets set yet" text="Set premium targets per line of business, a commission target and insurer-wise targets to see your progress and pace here.">
                <Button icon={Pencil} onClick={() => setEditing(true)}>Set targets</Button>
              </Empty>
            </Card>
          )}
        </>
      )}

      {/* Insurer-wise commission */}
      <Card className="mt-4 overflow-hidden">
        <CardHead title="Insurer-wise commission" icon={Building} sub={`${fyLabel(fy)} · target, earned and received`} />
        {!m.insurers.length ? (
          <Empty title="No business this financial year yet" />
        ) : (
          <ul className="mt-3 divide-y divide-line border-t border-line">
            {m.insurers.map((x, i) => {
              const pct = x.target ? Math.round((x.earned / x.target) * 100) : null;
              return (
                <li key={x.name} className="px-4 py-3 sm:px-5">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                    <span className={cx('grid size-6 place-items-center rounded-full text-[11px] font-bold tnum', i < 3 ? 'bg-grad text-white' : 'bg-subtle text-mute')}>{i + 1}</span>
                    <span className="min-w-0 flex-1 truncate text-sm font-bold text-ink">{x.name}</span>
                    <span className="tnum text-xs text-mute">{x.count} {x.count === 1 ? 'policy' : 'policies'} · {inrShort(x.premium)} premium</span>
                    <span className="tnum w-36 text-right text-sm font-bold text-ink">{inr(x.earned)}{x.target ? <span className="font-normal text-mute"> / {inrShort(x.target)}</span> : ''}</span>
                  </div>
                  <div className="mt-2 flex items-center gap-3 pl-10">
                    <Progress value={x.target ? pct : x.earned ? 100 : 0} className="h-1.5 flex-1" tone={!x.target ? 'bg-line' : pct >= 100 ? 'bg-emerald-500' : 'bg-brand'} />
                    <span className="tnum w-40 text-right text-[11px] text-mute">
                      {x.target ? `${pct}%` : 'No target'} · {inrShort(x.received)} received
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {/* Leaderboards */}
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHead title="Line leaderboard" icon={Medal} sub={period === 'month' ? 'This month' : fyLabel(fy)} />
          <ul className="space-y-3 p-5 pt-4">
            {CATEGORIES.map((c) => ({ c, v: premiumOf(c.id) })).sort((a, b) => b.v - a.v).map(({ c, v }, i, arr) => (
              <li key={c.id}>
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2 font-bold text-ink"><span className="tnum w-4 text-faint">{i + 1}</span>{c.label}</span>
                  <span className="tnum font-semibold text-mute">{inrShort(v)}</span>
                </div>
                <Progress value={(v / (arr[0].v || 1)) * 100} className="mt-1.5 h-1.5" />
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardHead title="Your best months" icon={Crown} sub="Last 12 months, by premium" />
          {m.bestMonths.length ? (
            <ul className="space-y-2 p-5 pt-4">
              {m.bestMonths.map((x, i) => (
                <li key={x.ym} className="flex items-center gap-3 rounded-xl bg-subtle p-3">
                  <span className={cx('grid size-8 place-items-center rounded-full text-xs font-bold', ['bg-amber-400 text-amber-950', 'bg-slate-300 text-slate-800', 'bg-orange-300 text-orange-950'][i])}>{i + 1}</span>
                  <span className="flex-1 text-sm font-bold text-ink">{monthLabel(x.ym)}</span>
                  <span className="text-right">
                    <span className="tnum block text-sm font-bold text-ink">{inrShort(x.premium)}</span>
                    <span className="tnum block text-[11px] text-mute">{x.count} {x.count === 1 ? 'policy' : 'policies'}</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : <Empty title="No sales yet" />}
        </Card>
        <Card>
          <CardHead title="Top clients" icon={Trophy} sub={period === 'month' ? 'This month' : fyLabel(fy)} />
          {m.topClients.length ? (
            <ul className="space-y-2.5 p-5 pt-4">
              {m.topClients.map(({ c, premium, count }) => (
                <li key={c.id} className="flex items-center gap-3">
                  <Avatar name={c.name} className="size-8 text-[10px]" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-ink">{c.name}</span>
                    <span className="block text-[11px] text-mute">{count} {count === 1 ? 'policy' : 'policies'}</span>
                  </span>
                  <span className="tnum text-sm font-bold text-ink">{inrShort(premium)}</span>
                </li>
              ))}
            </ul>
          ) : <Empty title="No sales in this period" />}
        </Card>
      </div>
    </>
  );
}

function GoalCard({ icon, tone, label, done, goal, pace, sub, highlight, count }) {
  const pct = goal ? Math.round((done / goal) * 100) : 0;
  const expected = goal * pace;
  const gap = done - expected;
  const fmt = (v) => (count ? Math.round(v).toLocaleString('en-IN') : inrShort(v));
  return (
    <Card className={cx('p-4', highlight && 'border-brand/40 ring-2 ring-brand/10')}>
      <div className="flex items-center justify-between">
        <IconTile icon={icon} tone={tone} className="size-9" />
        {goal > 0 && (
          <span className={cx('flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold', pct >= 100 ? 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300' : gap >= 0 ? 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300' : 'bg-amber-500/15 text-amber-700 dark:text-amber-300')}>
            {pct >= 100 ? 'Achieved' : gap >= 0 ? <><TrendingUp className="size-3" /> On pace</> : <><TrendingDown className="size-3" /> Behind</>}
          </span>
        )}
      </div>
      <p className="mt-3 text-xs font-bold text-ink">{label}</p>
      <p className="tnum mt-0.5 text-xl font-bold text-ink">
        {fmt(done)}
        <span className="text-sm font-semibold text-mute"> / {goal ? fmt(goal) : 'no target'}</span>
      </p>
      <Progress value={goal ? pct : 0} className="mt-2.5" tone={pct >= 100 ? 'bg-emerald-500' : 'bg-brand'} />
      <p className="mt-2 text-[11px] text-mute">
        {!goal ? sub : pct >= 100 ? `${pct}% of target · ${sub}` : `${pct}% · ${fmt(goal - done)} to go${gap < 0 ? ` · ${fmt(-gap)} behind pace` : ''}`}
      </p>
    </Card>
  );
}

function TargetEditor({ period, initial, insurers, insurerTargets, onCancel, onSave }) {
  const [vals, setVals] = useState({ total: '', motor: '', health: '', life: '', non_motor: '', commission: '', policies: '', ...initial });
  const [ins, setIns] = useState({ ...insurerTargets });
  const [newInsurer, setNewInsurer] = useState('');
  const [busy, setBusy] = useState(false);
  const lineSum = CATEGORIES.reduce((t, c) => t + num(vals[c.id]), 0);
  useEffect(() => setVals((v) => ({ ...v, ...initial })), [period]); // eslint-disable-line react-hooks/exhaustive-deps

  const field = (k, label, hint) => (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-mute">{label}</span>
      <Input type="number" inputMode="decimal" min="0" value={vals[k] ?? ''} onChange={(e) => setVals({ ...vals, [k]: e.target.value })} />
      {hint && <span className="mt-1 block text-[11px] text-faint">{hint}</span>}
    </label>
  );

  const clean = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, num(v)]));
  const insurerList = [...new Set([...insurers, ...Object.keys(ins)])];

  return (
    <Card className="p-5">
      <p className="font-display text-lg font-bold text-ink">{period === 'month' ? 'Monthly targets' : 'Financial year targets'}</p>
      <p className="text-xs text-mute">Premium is counted before GST, on the policy issue date. Leave a box empty for no target.</p>
      <div className="mt-5 grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {field('total', 'All business premium', lineSum ? `Lines add up to ${inrShort(lineSum)}` : undefined)}
        {CATEGORIES.map((c) => <div key={c.id}>{field(c.id, `${c.label} premium`)}</div>)}
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {field('commission', 'Commission earned')}
        {field('policies', 'Number of policies')}
      </div>

      <h3 className="mb-2 mt-6 text-[11px] font-bold uppercase tracking-wider text-faint">Insurer-wise commission targets (financial year)</h3>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {insurerList.map((name) => (
          <div key={name} className="flex items-center gap-2 rounded-xl border border-line p-2 pl-3">
            <span className="min-w-0 flex-1 truncate text-xs font-semibold text-ink">{name}</span>
            <Input type="number" inputMode="decimal" min="0" className="h-9 w-32" value={ins[name] ?? ''} onChange={(e) => setIns({ ...ins, [name]: e.target.value })} placeholder="Target" />
            <button type="button" className="text-faint hover:text-rose-600" title="Remove target" onClick={() => setIns(Object.fromEntries(Object.entries(ins).filter(([k]) => k !== name)))}><X className="size-4" /></button>
          </div>
        ))}
        <div className="flex items-center gap-2 rounded-xl border border-dashed border-line p-2">
          <Input className="h-9 flex-1" value={newInsurer} onChange={(e) => setNewInsurer(e.target.value)} placeholder="Add another insurer" />
          <Button size="sm" variant="soft" onClick={() => { if (newInsurer.trim()) { setIns({ ...ins, [newInsurer.trim()]: '' }); setNewInsurer(''); } }}>Add</Button>
        </div>
      </div>

      <div className="mt-6 flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button icon={Save} loading={busy} onClick={async () => { setBusy(true); try { await onSave(clean(vals), Object.fromEntries(Object.entries(ins).filter(([, v]) => num(v) > 0).map(([k, v]) => [k, num(v)]))); } finally { setBusy(false); } }}>Save targets</Button>
      </div>
    </Card>
  );
}
