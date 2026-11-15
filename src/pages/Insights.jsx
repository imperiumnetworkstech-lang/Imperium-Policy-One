import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Lightbulb, ChevronRight, MessageCircle, TrendingUp, Users, Layers, HandCoins } from 'lucide-react';
import { useData } from '../context/DataContext';
import { usePolicyForm } from '../components/PolicyForm';
import { Button, Card, Empty, IconTile, PageHeader, Segmented, toneDot } from '../components/ui';
import { catLabel, isLive, policyStatus } from '../lib/constants';
import { INSIGHT_GROUPS, buildInsights, retention } from '../lib/insights';
import { cx, inrShort, num, waLink } from '../lib/utils';

export default function Insights() {
  const { policies, clients, leads, clientById, profile } = useData();
  const openForm = usePolicyForm();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const group = params.get('group') || 'all';

  const all = useMemo(() => buildInsights({ policies, clients, leads }), [policies, clients, leads]);
  const counts = Object.fromEntries(INSIGHT_GROUPS.map((g) => [g.id, all.filter((i) => i.group === g.id).length]));
  const list = group === 'all' ? all : all.filter((i) => i.group === group);

  // Book health numbers
  const live = policies.filter(isLive);
  const activeClients = new Set(live.map((p) => p.clientId));
  const density = activeClients.size ? (live.length / activeClients.size).toFixed(1) : '-';
  const rate = retention(policies);
  const pending = policies.filter((p) => p.commissionStatus !== 'Received').reduce((t, p) => t + num(p.commissionAmount), 0);
  const lostReasons = Object.entries(
    policies.filter((p) => policyStatus(p) === 'lost').reduce((a, p) => ({ ...a, [p.lostReason || 'Not recorded']: (a[p.lostReason || 'Not recorded'] || 0) + 1 }), {}),
  ).sort((a, b) => b[1] - a[1]);

  const health = [
    { icon: TrendingUp, tone: 'violet', label: 'Retention rate', value: rate == null ? '-' : `${rate}%`, sub: 'Renewed out of all policies that came due' },
    { icon: Layers, tone: 'brand', label: 'Policies per client', value: density, sub: 'Above 2.0 means strong cross-selling' },
    { icon: Users, tone: 'blue', label: 'Single-line clients', value: clients.filter((c) => new Set(live.filter((p) => p.clientId === c.id).map((p) => p.category)).size === 1).length, sub: 'Easiest cross-sell targets' },
    { icon: HandCoins, tone: 'amber', label: 'Commission pending', value: inrShort(pending), sub: 'Earned but not yet received' },
  ];

  const pitchText = (c, line) =>
    `Hello ${c.name}, thank you for trusting me with your insurance. I noticed you do not have ${line === 'life' ? 'a term life plan' : `${catLabel(line).toLowerCase()} insurance`} with us yet. May I share a few good options? It will take 2 minutes.\n\n${profile.name || ''}`;

  return (
    <>
      <PageHeader title="Insights" sub="Gaps and opportunities found automatically in your book of business." />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {health.map((s) => (
          <Card key={s.label} className="p-4">
            <IconTile icon={s.icon} tone={s.tone} className="size-9" />
            <p className="tnum mt-3 text-2xl font-bold tracking-tight text-ink">{s.value}</p>
            <p className="text-xs font-bold text-ink">{s.label}</p>
            <p className="text-[11px] text-mute">{s.sub}</p>
          </Card>
        ))}
      </div>

      <Segmented
        value={group}
        onChange={(g) => setParams(g === 'all' ? {} : { group: g }, { replace: true })}
        className="mb-4"
        options={[{ id: 'all', label: 'All', count: all.length }, ...INSIGHT_GROUPS.filter((g) => counts[g.id]).map((g) => ({ id: g.id, label: g.label, count: counts[g.id] }))]}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="overflow-hidden lg:col-span-2">
          {!list.length ? (
            <Empty icon={Lightbulb} title="No gaps found here" text="As you add policies and clients, opportunities will show up automatically." />
          ) : (
            <ul className="divide-y divide-line">
              {list.map((i) => {
                const g = INSIGHT_GROUPS.find((x) => x.id === i.group);
                const c = i.clientId ? clientById(i.clientId) : null;
                const go = () =>
                  i.policyId ? navigate(`/policies?id=${i.policyId}`) : i.leadId ? navigate('/leads') : i.clientId ? navigate(`/clients?id=${i.clientId}`) : null;
                return (
                  <li key={i.key} className="flex flex-wrap items-center gap-3 px-4 py-3.5 sm:px-5">
                    <span className={cx('h-9 w-1 shrink-0 rounded-full', toneDot(g.tone))} />
                    <button onClick={go} className="min-w-0 flex-1 basis-56 text-left">
                      <p className="text-sm font-bold text-ink">{i.title}</p>
                      <p className="text-xs text-mute">{i.detail}</p>
                    </button>
                    <div className="flex items-center gap-2">
                      {i.value > 0 && <span className="tnum text-sm font-bold text-ink">{inrShort(i.value)}</span>}
                      {i.pitch && c?.phone && (
                        <Button as="a" href={waLink(c.phone, pitchText(c, i.pitch))} target="_blank" rel="noreferrer" size="sm" variant="whatsapp" icon={MessageCircle}>Pitch</Button>
                      )}
                      {i.pitch && <Button size="sm" variant="soft" onClick={() => openForm({ preset: { clientId: i.clientId, category: i.pitch } })}>Add policy</Button>}
                      {!i.pitch && <button onClick={go} aria-label="Open"><ChevronRight className="size-4 text-faint" /></button>}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <div className="space-y-4">
          <Card className="p-5">
            <h3 className="text-sm font-bold text-ink">Why renewals are lost</h3>
            <p className="text-xs text-mute">From the reason you record when marking a policy lost.</p>
            {lostReasons.length ? (
              <ul className="mt-4 space-y-3">
                {lostReasons.map(([reason, n]) => (
                  <li key={reason}>
                    <div className="flex justify-between text-xs"><span className="font-semibold text-ink">{reason}</span><span className="tnum text-mute">{n}</span></div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-subtle"><div className="h-full rounded-full bg-rose-500" style={{ width: `${(n / lostReasons[0][1]) * 100}%` }} /></div>
                  </li>
                ))}
              </ul>
            ) : <p className="mt-4 text-sm text-mute">No lost renewals recorded yet.</p>}
          </Card>

          <Card className="p-5">
            <h3 className="text-sm font-bold text-ink">How gaps are detected</h3>
            <ul className="mt-3 space-y-2 text-xs text-mute">
              {INSIGHT_GROUPS.map((g) => (
                <li key={g.id} className="flex gap-2"><span className={cx('mt-1 size-2 shrink-0 rounded-full', toneDot(g.tone))} /><span><b className="text-ink">{g.label}:</b> {g.blurb.toLowerCase()}.</span></li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}
