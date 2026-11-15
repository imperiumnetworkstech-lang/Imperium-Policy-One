import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Download, BadgeCheck, ChartColumn } from 'lucide-react';
import { useData } from '../context/DataContext';
import { Badge, Button, Card, CardHead, Empty, Field, Input, PageHeader, Segmented, Select, useToast } from '../components/ui';
import { CATEGORIES, catLabel, policyTitle, saleDate, totalPremium } from '../lib/constants';
import { downloadCSV, fmtDate, fyLabel, fyRange, fyStartYear, inRange, inr, inrShort, monthLabel, monthRange, num, todayISO } from '../lib/utils';

export default function Reports() {
  const { policies, clientById, save } = useData();
  const toast = useToast();
  const fy = fyStartYear();
  const [preset, setPreset] = useState('fy');
  const [custom, setCustom] = useState({ from: fyRange(fy).from, to: todayISO() });
  const [groupBy, setGroupBy] = useState('insurer');

  const range = preset === 'month' ? monthRange() : preset === 'fy' ? fyRange(fy) : preset === 'lastfy' ? fyRange(fy - 1) : custom;

  const r = useMemo(() => {
    const rows = policies.filter((p) => inRange(saleDate(p), range));
    const sum = (list, k) => list.reduce((t, p) => t + num(p[k]), 0);
    const keyOf = {
      insurer: (p) => p.insurer || 'Unknown',
      category: (p) => catLabel(p.category),
      business: (p) => p.businessType || 'New',
      month: (p) => saleDate(p).slice(0, 7),
    }[groupBy];
    const groups = Object.values(
      rows.reduce((acc, p) => {
        const k = keyOf(p);
        acc[k] = acc[k] || { key: k, count: 0, premium: 0, commission: 0, received: 0 };
        acc[k].count += 1;
        acc[k].premium += num(p.netPremium);
        acc[k].commission += num(p.commissionAmount);
        if (p.commissionStatus === 'Received') acc[k].received += num(p.commissionAmount);
        return acc;
      }, {}),
    ).sort((a, b) => (groupBy === 'month' ? a.key.localeCompare(b.key) : b.premium - a.premium));
    const commission = sum(rows, 'commissionAmount');
    const received = sum(rows.filter((p) => p.commissionStatus === 'Received'), 'commissionAmount');
    return {
      rows, groups, premium: sum(rows, 'netPremium'), gst: sum(rows, 'gstAmount'), commission, received,
      pendingRows: rows.filter((p) => p.commissionStatus !== 'Received' && num(p.commissionAmount) > 0).sort((a, b) => saleDate(a).localeCompare(saleDate(b))),
    };
  }, [policies, range.from, range.to, groupBy]);

  const label = (k) => (groupBy === 'month' ? monthLabel(k) : k);

  const exportCsv = () =>
    downloadCSV(`business-report-${range.from}-to-${range.to}.csv`, r.rows.map((p) => ({
      'Issue Date': saleDate(p), Client: clientById(p.clientId)?.name, Type: catLabel(p.category), Insurer: p.insurer,
      'Policy No': p.policyNumber, Particulars: policyTitle(p), 'Business Type': p.businessType,
      'Net Premium': p.netPremium, GST: p.gstAmount, 'Total Premium': totalPremium(p),
      'Commission %': p.commissionRate, Commission: p.commissionAmount, 'Commission Status': p.commissionStatus,
    })));

  return (
    <>
      <PageHeader title="Reports" sub={`${fmtDate(range.from)} to ${fmtDate(range.to)}`}>
        <Button variant="secondary" icon={Download} onClick={exportCsv} disabled={!r.rows.length}>Export CSV</Button>
      </PageHeader>

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end">
        <Segmented value={preset} onChange={setPreset} options={[{ id: 'month', label: 'This month' }, { id: 'fy', label: fyLabel(fy) }, { id: 'lastfy', label: fyLabel(fy - 1) }, { id: 'custom', label: 'Custom' }]} />
        {preset === 'custom' && (
          <div className="flex gap-2">
            <Field label="From"><Input type="date" value={custom.from} onChange={(e) => setCustom({ ...custom, from: e.target.value })} /></Field>
            <Field label="To"><Input type="date" value={custom.to} onChange={(e) => setCustom({ ...custom, to: e.target.value })} /></Field>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[
          ['Policies sold', r.rows.length],
          ['Net premium', inr(r.premium)],
          ['GST collected', inr(r.gst)],
          ['Commission earned', inr(r.commission)],
          ['Commission received', inr(r.received)],
        ].map(([l, v], i) => (
          <Card key={l} className={`p-4 ${i === 4 ? 'col-span-2 lg:col-span-1' : ''}`}>
            <p className="text-[11px] font-semibold text-mute">{l}</p>
            <p className="tnum mt-1 text-xl font-bold tracking-tight text-ink">{v}</p>
            {i === 4 && r.commission > 0 && <p className="text-[11px] text-mute">{inr(r.commission - r.received)} still pending</p>}
          </Card>
        ))}
      </div>

      <Card className="mt-4 overflow-hidden">
        <CardHead
          title="Business breakdown"
          icon={ChartColumn}
          action={
            <Select value={groupBy} onChange={(e) => setGroupBy(e.target.value)} className="h-9 w-44">
              <option value="insurer">By insurer</option>
              <option value="category">By line of business</option>
              <option value="business">New vs renewal</option>
              <option value="month">By month</option>
            </Select>
          }
        />
        {!r.groups.length ? <Empty title="No business in this period" /> : (
          <>
            <div className="h-56 px-2 pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={r.groups.slice(0, 12).map((g) => ({ ...g, name: label(g.key) }))} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="var(--line)" strokeDasharray="3 4" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: 'var(--faint)', fontSize: 11 }} axisLine={false} tickLine={false} interval={0} tickFormatter={(v) => (v.length > 11 ? v.slice(0, 10) + '…' : v)} />
                  <YAxis tick={{ fill: 'var(--faint)', fontSize: 11 }} axisLine={false} tickLine={false} width={48} tickFormatter={(v) => inrShort(v).replace('₹', '')} />
                  <Tooltip cursor={{ fill: 'var(--subtle)' }} formatter={(v) => inr(v)} contentStyle={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 12, fontSize: 12 }} labelStyle={{ color: 'var(--ink)', fontWeight: 700 }} />
                  <Bar dataKey="premium" name="Premium" fill="var(--brand)" radius={[6, 6, 0, 0]} maxBarSize={36} />
                  <Bar dataKey="commission" name="Commission" fill="#ff4fd8" radius={[6, 6, 0, 0]} maxBarSize={36} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead>
                  <tr className="border-y border-line text-[11px] font-bold uppercase tracking-wider text-faint">
                    <th className="px-5 py-2.5">{groupBy === 'month' ? 'Month' : 'Name'}</th>
                    <th className="px-3 py-2.5 text-right">Policies</th>
                    <th className="px-3 py-2.5 text-right">Premium</th>
                    <th className="px-3 py-2.5 text-right">Commission</th>
                    <th className="px-3 py-2.5 text-right">Avg %</th>
                    <th className="px-5 py-2.5 text-right">Pending</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {r.groups.map((g) => (
                    <tr key={g.key}>
                      <td className="px-5 py-2.5 font-bold text-ink">{label(g.key)}</td>
                      <td className="tnum px-3 py-2.5 text-right text-mute">{g.count}</td>
                      <td className="tnum px-3 py-2.5 text-right font-semibold text-ink">{inr(g.premium)}</td>
                      <td className="tnum px-3 py-2.5 text-right font-bold text-brand-strong">{inr(g.commission)}</td>
                      <td className="tnum px-3 py-2.5 text-right text-mute">{g.premium ? ((g.commission / g.premium) * 100).toFixed(1) : '0.0'}%</td>
                      <td className="tnum px-5 py-2.5 text-right text-amber-600 dark:text-amber-400">{g.commission - g.received ? inr(g.commission - g.received) : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>

      <Card className="mt-4 overflow-hidden">
        <CardHead title="Commission reconciliation" sub="Tick off each payout as the insurer credits it" action={<Badge tone="amber">{r.pendingRows.length} pending</Badge>} />
        {!r.pendingRows.length ? <Empty icon={BadgeCheck} title="All commission received" text="Nothing is pending for this period." /> : (
          <ul className="mt-3 divide-y divide-line border-t border-line">
            {r.pendingRows.map((p) => (
              <li key={p.id} className="flex items-center gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-ink">{clientById(p.clientId)?.name || '-'} <span className="font-normal text-mute">· {policyTitle(p)}</span></p>
                  <p className="truncate text-xs text-mute">{p.insurer} · issued {fmtDate(saleDate(p))} · {CATEGORIES.find((c) => c.id === p.category)?.label}</p>
                </div>
                <span className="tnum text-sm font-bold text-ink">{inr(p.commissionAmount)}</span>
                <Button size="sm" variant="soft" icon={BadgeCheck} onClick={async () => { await save('policies', p.id, { commissionStatus: 'Received', commissionReceivedOn: todayISO() }); toast('Marked received'); }}>
                  <span className="hidden sm:inline">Received</span>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
