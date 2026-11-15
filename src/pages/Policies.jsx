import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Download, FileText, ChevronRight } from 'lucide-react';
import { useData } from '../context/DataContext';
import { usePolicyForm } from '../components/PolicyForm';
import { PolicyDetail, StatusBadge, dueLabel } from '../components/policyShared';
import { Button, Card, Empty, IconTile, PageHeader, SearchInput, Segmented, Select } from '../components/ui';
import { CAT_TONE, catIcon } from '../components/icons';
import { CATEGORIES, STATUS_META, catLabel, policyStatus, policySub, policyTitle, saleDate, totalPremium } from '../lib/constants';
import { downloadCSV, fmtDate, inr, num, todayISO } from '../lib/utils';

export default function Policies() {
  const { policies, clientById } = useData();
  const openForm = usePolicyForm();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('all');
  const [status, setStatus] = useState('all');
  const [sort, setSort] = useState('recent');
  const openId = params.get('id');
  const setOpenId = (id) => setParams(id ? { id } : {}, { replace: true });

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    const list = policies.filter((p) => {
      if (cat !== 'all' && p.category !== cat) return false;
      if (status !== 'all' && policyStatus(p) !== status) return false;
      if (!term) return true;
      const c = clientById(p.clientId);
      return [c?.name, c?.phone, p.policyNumber, p.regNo, p.insurer, p.make, p.model, p.product, p.engineNo, p.chassisNo]
        .some((v) => String(v || '').toLowerCase().includes(term));
    });
    const by = {
      recent: (a, b) => saleDate(b).localeCompare(saleDate(a)),
      expiry: (a, b) => (a.endDate || '').localeCompare(b.endDate || ''),
      premium: (a, b) => num(b.netPremium) - num(a.netPremium),
    }[sort];
    return list.sort(by);
  }, [policies, q, cat, status, sort, clientById]);

  const totals = rows.reduce((t, p) => ({ premium: t.premium + num(p.netPremium), comm: t.comm + num(p.commissionAmount) }), { premium: 0, comm: 0 });

  const exportCsv = () =>
    downloadCSV(`policies-${todayISO()}.csv`, rows.map((p) => {
      const c = clientById(p.clientId) || {};
      return {
        Client: c.name, Mobile: c.phone, Type: catLabel(p.category), Insurer: p.insurer, 'Policy No': p.policyNumber,
        'Product / Vehicle': policyTitle(p), 'Vehicle No': p.regNo, 'Cover': p.coverType || p.planType,
        'Engine No': p.engineNo, 'Chassis No': p.chassisNo, 'IDV / Sum Insured': p.idv || p.sumInsured, 'NCB %': p.ncb,
        'Start Date': p.startDate, 'End Date': p.endDate, 'Issue Date': p.issueDate,
        'OD Premium': p.odPremium, 'TP Premium': p.tpPremium, 'Net Premium': p.netPremium, GST: p.gstAmount,
        'Total Premium': totalPremium(p), 'Commission %': p.commissionRate, Commission: p.commissionAmount,
        'Commission Status': p.commissionStatus, Status: STATUS_META[policyStatus(p)].label,
      };
    }));

  return (
    <>
      <PageHeader title="Policies" sub={`${rows.length} of ${policies.length} policies · ${inr(totals.premium)} premium · ${inr(totals.comm)} commission`}>
        <Button variant="secondary" icon={Download} onClick={exportCsv} disabled={!rows.length}>Export</Button>
        <Button icon={Plus} onClick={() => openForm()}>New policy</Button>
      </PageHeader>

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <SearchInput value={q} onChange={setQ} placeholder="Search client, vehicle no, policy no, insurer" className="lg:w-80" />
        <Segmented value={cat} onChange={setCat} options={[{ id: 'all', label: 'All' }, ...CATEGORIES.map((c) => ({ id: c.id, label: c.label, count: policies.filter((p) => p.category === c.id).length }))]} />
        <div className="flex gap-2 lg:ml-auto">
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="lg:w-40">
            <option value="all">All statuses</option>
            {Object.entries(STATUS_META).map(([id, m]) => <option key={id} value={id}>{m.label}</option>)}
          </Select>
          <Select value={sort} onChange={(e) => setSort(e.target.value)} className="lg:w-40">
            <option value="recent">Newest first</option>
            <option value="expiry">Expiry date</option>
            <option value="premium">Highest premium</option>
          </Select>
        </div>
      </div>

      <Card className="overflow-hidden">
        {!rows.length ? (
          <Empty icon={FileText} title={policies.length ? 'No policies match these filters' : 'No policies yet'} text={policies.length ? 'Try clearing the search or filters.' : 'Add your first policy to start tracking renewals and commission.'}>
            {!policies.length && <Button icon={Plus} onClick={() => openForm()}>Add policy</Button>}
          </Empty>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-line text-[11px] font-bold uppercase tracking-wider text-faint">
                    <th className="px-5 py-3">Policy</th>
                    <th className="px-3 py-3">Client</th>
                    <th className="px-3 py-3">Insurer</th>
                    <th className="px-3 py-3">Expiry</th>
                    <th className="px-3 py-3 text-right">Premium</th>
                    <th className="px-3 py-3 text-right">Commission</th>
                    <th className="px-5 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {rows.map((p) => {
                    const c = clientById(p.clientId);
                    return (
                      <tr key={p.id} onClick={() => setOpenId(p.id)} className="cursor-pointer transition hover:bg-subtle">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3">
                            <IconTile icon={catIcon(p.category)} tone={CAT_TONE[p.category]} className="size-9" />
                            <div className="min-w-0">
                              <p className="max-w-52 truncate font-bold text-ink">{policyTitle(p)}</p>
                              <p className="max-w-52 truncate text-xs text-mute">{policySub(p) || catLabel(p.category)}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3 font-semibold text-ink">{c?.name || '-'}</td>
                        <td className="px-3 py-3 text-mute">{p.insurer}</td>
                        <td className="px-3 py-3">
                          <p className="font-semibold text-ink">{fmtDate(p.endDate)}</p>
                          <p className="text-xs text-mute">{dueLabel(p.endDate)}</p>
                        </td>
                        <td className="tnum px-3 py-3 text-right font-bold text-ink">{inr(p.netPremium)}</td>
                        <td className="tnum px-3 py-3 text-right">
                          <p className="font-bold text-brand-strong">{inr(p.commissionAmount)}</p>
                          <p className="text-[11px] text-mute">{p.commissionStatus}</p>
                        </td>
                        <td className="px-5 py-3"><StatusBadge policy={p} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <ul className="divide-y divide-line md:hidden">
              {rows.map((p) => {
                const c = clientById(p.clientId);
                return (
                  <li key={p.id}>
                    <button onClick={() => setOpenId(p.id)} className="flex w-full items-center gap-3 px-4 py-3.5 text-left active:bg-subtle">
                      <IconTile icon={catIcon(p.category)} tone={CAT_TONE[p.category]} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-sm font-bold text-ink">{c?.name || policyTitle(p)}</p>
                          <p className="tnum shrink-0 text-sm font-bold text-ink">{inr(p.netPremium)}</p>
                        </div>
                        <p className="truncate text-xs text-mute">{policyTitle(p)}{p.regNo ? ` · ${p.regNo}` : ''}</p>
                        <div className="mt-1.5 flex items-center gap-2">
                          <StatusBadge policy={p} />
                          <span className="text-[11px] text-mute">{fmtDate(p.endDate)}</span>
                        </div>
                      </div>
                      <ChevronRight className="size-4 shrink-0 text-faint" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </Card>

      {openId && <PolicyDetail policyId={openId} onClose={() => setOpenId(null)} />}
    </>
  );
}
