import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Area, Bar, CartesianGrid, Cell, ComposedChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import {
  Plus, IndianRupee, Wallet, ShieldCheck, CalendarClock, ArrowUpRight, ArrowDownRight, Target, Lightbulb,
  ChevronRight, Cake, PhoneCall, Sparkles, HandCoins,
} from 'lucide-react';
import { useData } from '../context/DataContext';
import { usePolicyForm } from '../components/PolicyForm';
import { PolicyDetail, renewalMessage } from '../components/policyShared';
import { Badge, Button, Card, CardHead, Empty, IconTile, PageHeader, Progress, Segmented, toneClass } from '../components/ui';
import { CAT_TONE, catIcon } from '../components/icons';
import { CATEGORIES, isLive, policyTitle, saleDate, totalPremium } from '../lib/constants';
import { INSIGHT_GROUPS, buildInsights, renewalBuckets } from '../lib/insights';
import {
  cx, daysToAnnual, daysUntil, fmtDate, fyLabel, fyRange, fyStartYear, inRange, inr, inrShort, lastMonths,
  monthLabel, monthRange, num, addDays, todayISO, waLink,
} from '../lib/utils';

const sumBy = (rows, fn) => rows.reduce((t, r) => t + num(fn(r)), 0);

export default function Dashboard() {
  const { policies, clients, leads, profile, clientById, syncing } = useData();
  const openForm = usePolicyForm();
  const [period, setPeriod] = useState('fy');
  const [openId, setOpenId] = useState(null);

  const m = useMemo(() => {
    const fy = fyStartYear();
    const ranges = {
      month: [monthRange(), monthRange(addDays(monthRange().from, -1))],
      fy: [fyRange(fy), fyRange(fy - 1)],
      all: [{}, null],
    }[period];
    const inP = (r) => (p) => inRange(saleDate(p), r);
    const cur = policies.filter(inP(ranges[0]));
    const prev = ranges[1] ? policies.filter(inP(ranges[1])) : [];
    const change = (a, b) => (ranges[1] && b > 0 ? Math.round(((a - b) / b) * 100) : null);

    const premium = sumBy(cur, (p) => p.netPremium);
    const commission = sumBy(cur, (p) => p.commissionAmount);
    const live = policies.filter(isLive);
    const buckets = renewalBuckets(policies);
    const due30 = [...buckets.overdue, ...buckets.week, ...buckets.month];

    const months = lastMonths(12).map((ym) => {
      const rows = policies.filter((p) => saleDate(p).startsWith(ym));
      return { ym, label: monthLabel(ym), premium: sumBy(rows, (p) => p.netPremium), commission: sumBy(rows, (p) => p.commissionAmount) };
    });

    const mix = CATEGORIES.map((c) => {
      const rows = cur.filter((p) => p.category === c.id);
      return { ...c, value: sumBy(rows, (p) => p.netPremium), count: rows.length };
    }).filter((x) => x.value > 0);

    const insurers = Object.entries(
      cur.reduce((acc, p) => {
        const k = p.insurer || 'Unknown';
        acc[k] = acc[k] || { premium: 0, commission: 0, count: 0 };
        acc[k].premium += num(p.netPremium);
        acc[k].commission += num(p.commissionAmount);
        acc[k].count += 1;
        return acc;
      }, {}),
    ).map(([name, v]) => ({ name, ...v })).sort((a, b) => b.premium - a.premium).slice(0, 5);

    const mRange = monthRange();
    const monthPremium = sumBy(policies.filter(inP(mRange)), (p) => p.netPremium);
    const pendingComm = sumBy(policies.filter((p) => p.commissionStatus !== 'Received'), (p) => p.commissionAmount);

    const agenda = [
      ...leads.filter((l) => !['won', 'lost'].includes(l.stage) && l.followUp && daysUntil(l.followUp) <= 0)
        .map((l) => ({ key: 'l' + l.id, icon: PhoneCall, tone: 'blue', title: `Follow up with ${l.name}`, sub: daysUntil(l.followUp) < 0 ? `Overdue since ${fmtDate(l.followUp)}` : 'Due today', to: '/leads' })),
      ...clients.filter((c) => { const d = daysToAnnual(c.dob); return d != null && d <= 7; })
        .map((c) => ({ key: 'b' + c.id, icon: Cake, tone: 'violet', title: `${c.name}'s birthday`, sub: daysToAnnual(c.dob) === 0 ? 'Today' : `In ${daysToAnnual(c.dob)} days`, href: c.phone ? waLink(c.phone, `Happy Birthday ${c.name}! Wishing you good health and a wonderful year ahead.\n\n${profile.name || ''}`) : null, to: '/clients' })),
    ];

    return {
      premium, commission, premiumChange: change(premium, sumBy(prev, (p) => p.netPremium)),
      commissionChange: change(commission, sumBy(prev, (p) => p.commissionAmount)),
      count: cur.length, live, due30, months, mix, insurers, monthPremium, pendingComm, agenda,
      upcoming: [...buckets.overdue, ...buckets.week, ...buckets.month, ...buckets.sixty].sort((a, b) => a.d - b.d).slice(0, 6),
      insights: buildInsights({ policies, clients, leads }),
      liveCover: sumBy(live, (p) => p.sumInsured || p.idv),
    };
  }, [policies, clients, leads, period, profile.name]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const first = (profile.name || '').split(' ')[0];
  const target = num(profile.goals?.month?.total) || num(profile.monthlyTarget);
  const targetPct = target ? Math.round((m.monthPremium / target) * 100) : 0;

  if (!policies.length && !clients.length)
    return (
      <>
        <PageHeader title={`${greeting}${first ? ', ' + first : ''}`} sub="Your book is empty. Let's change that." />
        {syncing ? (
          <Card className="p-10 text-center text-sm font-medium text-mute">Syncing your data...</Card>
        ) : (
        <Card>
          <Empty icon={Sparkles} title="Add your first policy" text="Enter a policy and the dashboard, renewal calendar, commission tracker and insights fill in automatically.">
            <Button icon={Plus} onClick={() => openForm()}>Add a policy</Button>
          </Empty>
        </Card>
        )}
      </>
    );

  const kpis = [
    { icon: IndianRupee, tone: 'brand', label: 'Premium sold', value: inrShort(m.premium), full: inr(m.premium), change: m.premiumChange, sub: `${m.count} ${m.count === 1 ? 'policy' : 'policies'}` },
    { icon: Wallet, tone: 'amber', label: 'Commission earned', value: inrShort(m.commission), full: inr(m.commission), change: m.commissionChange, sub: m.premium ? `${((m.commission / m.premium) * 100).toFixed(1)}% of premium` : 'No sales yet' },
    { icon: ShieldCheck, tone: 'violet', label: 'Active policies', value: m.live.length, sub: `${clients.length} clients · ${inrShort(m.liveCover)} cover`, to: '/policies' },
    { icon: CalendarClock, tone: 'red', label: 'Renewals due in 30 days', value: m.due30.length, sub: `${inrShort(sumBy(m.due30, (x) => totalPremium(x.p)))} to retain`, to: '/renewals' },
  ];

  return (
    <>
      <PageHeader title={`${greeting}${first ? ', ' + first : ''}`} sub={fmtDate(todayISO()) + (profile.agency ? ` · ${profile.agency}` : '')}>
        <Segmented value={period} onChange={setPeriod} options={[{ id: 'month', label: 'This month' }, { id: 'fy', label: fyLabel(fyStartYear()) }, { id: 'all', label: 'All time' }]} />
        <Button icon={Plus} onClick={() => openForm()}>New policy</Button>
      </PageHeader>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        {kpis.map((k) => {
          const body = (
            <Card className={cx('h-full p-4 lg:p-5', k.to && 'transition hover:-translate-y-0.5 hover:border-brand/40')}>
              <div className="flex items-start justify-between">
                <IconTile icon={k.icon} tone={k.tone} />
                {k.change != null && (
                  <span className={cx('flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-bold', toneClass(k.change >= 0 ? 'green' : 'red'))}>
                    {k.change >= 0 ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
                    {Math.abs(k.change) > 999 ? '999%+' : `${Math.abs(k.change)}%`}
                  </span>
                )}
                {k.to && <ChevronRight className="size-4 text-faint" />}
              </div>
              <p className="tnum mt-4 text-2xl font-bold tracking-tight text-ink lg:text-[28px]" title={k.full}>{k.value}</p>
              <p className="mt-0.5 text-xs font-bold text-ink">{k.label}</p>
              <p className="truncate text-[11px] text-mute">{k.sub}</p>
            </Card>
          );
          return k.to ? <Link key={k.label} to={k.to}>{body}</Link> : <div key={k.label}>{body}</div>;
        })}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {/* Sales trend */}
        <Card className="lg:col-span-2">
          <CardHead title="Sales and commission" sub="Last 12 months, by issue date" />
          <div className="mt-1 flex gap-4 px-5 text-[11px] font-semibold text-mute">
            <span className="flex items-center gap-1.5"><i className="size-2.5 rounded-sm bg-brand" /> Premium</span>
            <span className="flex items-center gap-1.5"><i className="size-2.5 rounded-sm bg-fuchsia-500" /> Commission</span>
          </div>
          <div className="h-64 px-2 pb-3 pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={m.months} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="commFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ff4fd8" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#ff4fd8" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--line)" strokeDasharray="3 4" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: 'var(--faint)', fontSize: 11 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fill: 'var(--faint)', fontSize: 11 }} axisLine={false} tickLine={false} width={48} tickFormatter={(v) => inrShort(v).replace('₹', '')} />
                <Tooltip cursor={{ fill: 'var(--subtle)' }} content={<ChartTip />} />
                <Bar dataKey="premium" name="Premium" fill="var(--brand)" radius={[6, 6, 0, 0]} maxBarSize={28} />
                <Area dataKey="commission" name="Commission" type="monotone" stroke="#f03ccb" strokeWidth={2.5} fill="url(#commFill)" dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Mix */}
        <Card>
          <CardHead title="Business mix" sub="Premium by line" />
          {m.mix.length ? (
            <div className="p-5 pt-2">
              <div className="relative mx-auto h-44 w-44">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={m.mix} dataKey="value" innerRadius={58} outerRadius={82} paddingAngle={3} stroke="none" cornerRadius={6}>
                      {m.mix.map((x) => <Cell key={x.id} fill={x.color} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
                  <div>
                    <p className="tnum text-lg font-bold text-ink">{inrShort(m.premium)}</p>
                    <p className="text-[11px] text-mute">total</p>
                  </div>
                </div>
              </div>
              <ul className="mt-3 space-y-2">
                {m.mix.map((x) => (
                  <li key={x.id} className="flex items-center gap-2 text-xs">
                    <i className="size-2.5 rounded-sm" style={{ background: x.color }} />
                    <span className="flex-1 font-semibold text-ink">{x.label} <span className="font-normal text-mute">({x.count})</span></span>
                    <span className="tnum font-bold text-ink">{Math.round((x.value / m.premium) * 100)}%</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : <Empty title="No sales in this period" />}
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {/* Upcoming renewals */}
        <Card className="lg:col-span-2">
          <CardHead title="Renewals needing attention" icon={CalendarClock} action={<Link to="/renewals" className="text-xs font-bold text-brand-strong hover:underline">View all</Link>} />
          {m.upcoming.length ? (
            <ul className="mt-2 divide-y divide-line">
              {m.upcoming.map(({ p, d }) => {
                const c = clientById(p.clientId);
                return (
                  <li key={p.id} className="flex items-center gap-3 px-5 py-3">
                    <IconTile icon={catIcon(p.category)} tone={CAT_TONE[p.category]} className="size-9" />
                    <button className="min-w-0 flex-1 text-left" onClick={() => setOpenId(p.id)}>
                      <p className="truncate text-sm font-bold text-ink">{c?.name || '-'}</p>
                      <p className="truncate text-xs text-mute">{policyTitle(p)}{p.regNo ? ` · ${p.regNo}` : ''}</p>
                    </button>
                    <span className="tnum hidden text-sm font-bold text-ink sm:block">{inr(totalPremium(p))}</span>
                    <Badge tone={d < 0 ? 'red' : d <= 7 ? 'amber' : 'gray'}>{d < 0 ? `${Math.abs(d)}d overdue` : d === 0 ? 'Today' : `${d}d`}</Badge>
                    {c?.phone && (
                      <a href={waLink(c.phone, renewalMessage(p, c, profile))} target="_blank" rel="noreferrer" className="hidden text-xs font-bold text-emerald-600 hover:underline sm:block dark:text-emerald-400">Remind</a>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : <Empty title="No renewals in the next 60 days" />}
        </Card>

        <div className="space-y-4">
          {/* Target */}
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-bold text-ink"><Target className="size-4 text-brand" /> Monthly target</div>
              <Link to="/goals" className="text-xs font-bold text-brand-strong hover:underline">{target ? 'All goals' : 'Set'}</Link>
            </div>
            <p className="tnum mt-3 text-2xl font-bold text-ink">{inrShort(m.monthPremium)} <span className="text-sm font-semibold text-mute">/ {target ? inrShort(target) : 'no target'}</span></p>
            <Progress value={targetPct} className="mt-3" tone={targetPct >= 100 ? 'bg-emerald-500' : 'bg-brand'} />
            <p className="mt-2 text-xs text-mute">
              {!target ? 'Set a monthly premium target to track your pace.' : targetPct >= 100 ? 'Target achieved. Excellent month.' : `${targetPct}% done, ${inrShort(target - m.monthPremium)} to go this month.`}
            </p>
          </Card>

          {/* Pending commission */}
          <Card className="flex items-center gap-4 p-5">
            <IconTile icon={HandCoins} tone="amber" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-ink">Commission yet to receive</p>
              <p className="tnum text-xl font-bold text-ink">{inr(m.pendingComm)}</p>
            </div>
            <Link to="/reports" className="text-xs font-bold text-brand-strong hover:underline">Reconcile</Link>
          </Card>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {/* Insights */}
        <Card className="lg:col-span-2">
          <CardHead title="Gaps in your book" icon={Lightbulb} sub={`${m.insights.length} opportunities found`} action={<Link to="/insights" className="text-xs font-bold text-brand-strong hover:underline">Open insights</Link>} />
          <div className="grid gap-2 p-5 pt-3 sm:grid-cols-2">
            {INSIGHT_GROUPS.map((g) => ({ g, n: m.insights.filter((i) => i.group === g.id).length })).filter((x) => x.n).slice(0, 6).map(({ g, n }) => (
              <Link key={g.id} to={`/insights?group=${g.id}`} className="flex items-center gap-3 rounded-xl border border-line p-3 transition hover:bg-subtle">
                <span className={cx('grid size-9 shrink-0 place-items-center rounded-lg text-sm font-bold tnum', toneClass(g.tone))}>{n}</span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold text-ink">{g.label}</span>
                  <span className="block truncate text-xs text-mute">{g.blurb}</span>
                </span>
              </Link>
            ))}
            {!m.insights.length && <p className="text-sm text-mute">No gaps found. Your book is in great shape.</p>}
          </div>
        </Card>

        {/* Agenda + insurers */}
        <Card>
          <CardHead title={m.agenda.length ? "Today's agenda" : 'Top insurers'} sub={m.agenda.length ? 'Follow-ups and client moments' : 'By premium in this period'} />
          {m.agenda.length ? (
            <ul className="mt-2 divide-y divide-line">
              {m.agenda.slice(0, 5).map((a) => (
                <li key={a.key} className="flex items-center gap-3 px-5 py-3">
                  <IconTile icon={a.icon} tone={a.tone} className="size-9" />
                  <Link to={a.to} className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-ink">{a.title}</p>
                    <p className="truncate text-xs text-mute">{a.sub}</p>
                  </Link>
                  {a.href && <a href={a.href} target="_blank" rel="noreferrer" className="text-xs font-bold text-emerald-600 hover:underline dark:text-emerald-400">Wish</a>}
                </li>
              ))}
            </ul>
          ) : (
            <ul className="space-y-3 p-5 pt-3">
              {m.insurers.map((x) => (
                <li key={x.name}>
                  <div className="flex justify-between text-xs">
                    <span className="truncate font-bold text-ink">{x.name}</span>
                    <span className="tnum font-semibold text-mute">{inrShort(x.premium)}</span>
                  </div>
                  <Progress value={(x.premium / (m.insurers[0]?.premium || 1)) * 100} className="mt-1.5 h-1.5" />
                </li>
              ))}
              {!m.insurers.length && <p className="text-sm text-mute">No sales in this period.</p>}
            </ul>
          )}
        </Card>
      </div>

      {openId && <PolicyDetail policyId={openId} onClose={() => setOpenId(null)} />}
    </>
  );
}

function ChartTip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-2 text-xs shadow-pop">
      <p className="mb-1 font-bold text-ink">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="flex items-center justify-between gap-4 text-mute">
          <span>{p.name}</span>
          <span className="tnum font-bold text-ink">{inr(p.value)}</span>
        </p>
      ))}
    </div>
  );
}
