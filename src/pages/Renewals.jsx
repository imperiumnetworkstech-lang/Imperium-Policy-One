import { useState } from 'react';
import { CalendarCheck, RefreshCw, Ban, TrendingUp, AlertTriangle, Wallet } from 'lucide-react';
import { useData } from '../context/DataContext';
import { usePolicyForm } from '../components/PolicyForm';
import { ContactButtons, MarkLost, PolicyDetail, renewalMessage } from '../components/policyShared';
import { Badge, Button, Card, Empty, IconTile, PageHeader, Segmented } from '../components/ui';
import { CAT_TONE, catIcon } from '../components/icons';
import { policyStatus, policySub, policyTitle, totalPremium } from '../lib/constants';
import { renewalBuckets, retention } from '../lib/insights';
import { cx, fmtDate, inr, inrShort, num } from '../lib/utils';

const TABS = [
  { id: 'overdue', label: 'Overdue' },
  { id: 'week', label: 'Next 7 days' },
  { id: 'month', label: '8 - 30 days' },
  { id: 'sixty', label: '31 - 60 days' },
  { id: 'ninety', label: '61 - 90 days' },
];

export default function Renewals() {
  const { policies, clientById, profile } = useData();
  const openForm = usePolicyForm();
  const buckets = renewalBuckets(policies);
  const firstBusy = TABS.find((t) => buckets[t.id].length)?.id || 'week';
  const [tab, setTab] = useState(firstBusy);
  const [lost, setLost] = useState(null);
  const [openId, setOpenId] = useState(null);

  const list = [...buckets[tab]].sort((a, b) => a.d - b.d);
  const sum = (items, fn) => items.reduce((t, x) => t + fn(x.p), 0);
  const next30 = [...buckets.week, ...buckets.month];
  const rate = retention(policies);
  const lostCount = policies.filter((p) => policyStatus(p) === 'lost').length;

  const stats = [
    { icon: AlertTriangle, tone: 'red', label: 'Overdue, undecided', value: buckets.overdue.length, sub: `${inrShort(sum(buckets.overdue, totalPremium))} premium at risk` },
    { icon: CalendarCheck, tone: 'amber', label: 'Due in 30 days', value: next30.length, sub: `${inrShort(sum(next30, totalPremium))} to collect` },
    { icon: Wallet, tone: 'brand', label: 'Commission in next 30 days', value: inrShort(sum(next30, (p) => num(p.commissionAmount))), sub: 'If every renewal is retained' },
    { icon: TrendingUp, tone: 'violet', label: 'Retention rate', value: rate == null ? '-' : `${rate}%`, sub: `${lostCount} marked lost so far` },
  ];

  return (
    <>
      <PageHeader title="Renewals" sub="Every policy that needs a decision, sorted by urgency." />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="p-4">
            <IconTile icon={s.icon} tone={s.tone} className="size-9" />
            <p className="tnum mt-3 text-2xl font-bold tracking-tight text-ink">{s.value}</p>
            <p className="text-xs font-bold text-ink">{s.label}</p>
            <p className="text-[11px] text-mute">{s.sub}</p>
          </Card>
        ))}
      </div>

      <Segmented value={tab} onChange={setTab} options={TABS.map((t) => ({ ...t, count: buckets[t.id].length }))} className="mb-4 w-full sm:w-fit" />

      {!list.length ? (
        <Card><Empty icon={CalendarCheck} title="Nothing in this window" text="Renewals appear here automatically from each policy's end date." /></Card>
      ) : (
        <div className="grid gap-3 xl:grid-cols-2">
          {list.map(({ p, d }) => {
            const c = clientById(p.clientId);
            return (
              <Card key={p.id} className="p-4">
                <div className="flex items-start gap-3">
                  <IconTile icon={catIcon(p.category)} tone={CAT_TONE[p.category]} />
                  <button className="min-w-0 flex-1 text-left" onClick={() => setOpenId(p.id)}>
                    <p className="truncate text-sm font-bold text-ink">{c?.name || 'Unknown client'}</p>
                    <p className="truncate text-xs text-mute">{policyTitle(p)} · {policySub(p)}</p>
                    <p className="mt-0.5 truncate text-xs text-mute">{p.insurer}</p>
                  </button>
                  <div className="shrink-0 text-right">
                    <span className={cx('inline-block rounded-lg px-2 py-1 text-xs font-bold tnum', d < 0 ? 'bg-rose-500/12 text-rose-700 dark:text-rose-300' : d <= 7 ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300' : 'bg-subtle text-mute')}>
                      {d < 0 ? `${Math.abs(d)}d overdue` : d === 0 ? 'Today' : `${d}d left`}
                    </span>
                    <p className="mt-1 text-[11px] text-mute">{fmtDate(p.endDate)}</p>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                  <Badge tone="gray">Last premium {inr(totalPremium(p))}</Badge>
                  <Badge tone="brand">Commission {inr(p.commissionAmount)}</Badge>
                  {p.category === 'motor' && p.coverType !== 'Third Party' && (
                    <Badge tone={p.claimMade === 'Yes' ? 'red' : 'green'}>{p.claimMade === 'Yes' ? 'Claim made, NCB resets' : `NCB ${p.ncb || 0}%, no claim`}</Badge>
                  )}
                  {p.category === 'motor' && d < 0 && d >= -90 && p.coverType !== 'Third Party' && <Badge tone="amber">NCB lapses in {90 + d}d</Badge>}
                </div>

                <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
                  <ContactButtons client={c} message={renewalMessage(p, c, profile)} />
                  <span className="flex-1" />
                  <Button variant="ghost" size="sm" icon={Ban} onClick={() => setLost(p)}>Lost</Button>
                  <Button size="sm" icon={RefreshCw} onClick={() => openForm({ renewFrom: p })}>Renew</Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {lost && <MarkLost policy={lost} onClose={() => setLost(null)} />}
      {openId && <PolicyDetail policyId={openId} onClose={() => setOpenId(null)} />}
    </>
  );
}
