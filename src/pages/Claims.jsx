import { useState } from 'react';
import { Plus, LifeBuoy, Save, Trash2 } from 'lucide-react';
import { useData } from '../context/DataContext';
import { Badge, Button, Card, Confirm, Empty, Field, IconTile, Input, Modal, PageHeader, Segmented, Select, Textarea, useToast } from '../components/ui';
import { CAT_TONE, catIcon } from '../components/icons';
import { CLAIM_STATUSES, policyTitle } from '../lib/constants';
import { fmtDate, inr, inrShort, num, todayISO } from '../lib/utils';

const OPEN = ['intimated', 'documents', 'survey', 'approved'];

export default function Claims() {
  const { claims, policies, clientById } = useData();
  const [editing, setEditing] = useState(null);
  const [view, setView] = useState('open');

  const isOpen = (c) => OPEN.includes(c.status);
  const rows = claims.filter((c) => (view === 'all' ? true : view === 'open' ? isOpen(c) : !isOpen(c))).sort((a, b) => (b.lossDate || '').localeCompare(a.lossDate || ''));
  const settled = claims.filter((c) => c.status === 'settled');

  return (
    <>
      <PageHeader title="Claims" sub={`${claims.filter(isOpen).length} open · ${inrShort(settled.reduce((t, c) => t + num(c.amountSettled), 0))} settled for your clients`}>
        <Button icon={Plus} onClick={() => setEditing({})} disabled={!policies.length}>Log claim</Button>
      </PageHeader>

      <Segmented value={view} onChange={setView} className="mb-4 w-fit" options={[{ id: 'open', label: 'Open', count: claims.filter(isOpen).length }, { id: 'closed', label: 'Closed' }, { id: 'all', label: 'All' }]} />

      {!rows.length ? (
        <Card><Empty icon={LifeBuoy} title={claims.length ? 'No claims in this view' : 'No claims logged'} text="Being there at claim time is what earns renewals and referrals. Track each claim to closure here." /></Card>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {rows.map((c) => {
            const p = policies.find((x) => x.id === c.policyId);
            const client = clientById(c.clientId || p?.clientId);
            const st = CLAIM_STATUSES.find((s) => s.id === c.status) || CLAIM_STATUSES[0];
            const step = CLAIM_STATUSES.findIndex((s) => s.id === c.status);
            return (
              <Card key={c.id} className="cursor-pointer p-4 transition hover:border-brand/40" onClick={() => setEditing(c)}>
                <div className="flex items-start gap-3">
                  <IconTile icon={catIcon(p?.category)} tone={CAT_TONE[p?.category] || 'gray'} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-ink">{client?.name || 'Unknown client'}</p>
                    <p className="truncate text-xs text-mute">{p ? policyTitle(p) : 'Policy removed'} · {p?.insurer}</p>
                    <p className="truncate text-xs text-mute">{c.type} · {c.claimNo || 'No claim number'} · {fmtDate(c.lossDate)}</p>
                  </div>
                  <Badge tone={st.tone}>{st.label}</Badge>
                </div>
                {c.status !== 'rejected' && (
                  <div className="mt-3 flex gap-1">
                    {CLAIM_STATUSES.slice(0, 5).map((s, i) => <span key={s.id} className={`h-1.5 flex-1 rounded-full ${i <= step ? 'bg-brand' : 'bg-subtle'}`} />)}
                  </div>
                )}
                <div className="mt-3 flex justify-between text-xs">
                  <span className="text-mute">Claimed <b className="tnum text-ink">{inr(c.amountClaimed)}</b></span>
                  <span className="text-mute">Settled <b className="tnum text-ink">{num(c.amountSettled) ? inr(c.amountSettled) : '-'}</b></span>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {editing && <ClaimForm claim={editing} onClose={() => setEditing(null)} />}
    </>
  );
}

function ClaimForm({ claim, onClose }) {
  const { policies, clientById, add, save, del } = useData();
  const toast = useToast();
  const [f, setF] = useState({ policyId: '', claimNo: '', lossDate: todayISO(), type: 'Own damage', amountClaimed: '', amountSettled: '', status: 'intimated', notes: '', ...claim });
  const [confirm, setConfirm] = useState(false);
  const on = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async () => {
    if (!f.policyId) return toast('Select the policy', 'error');
    const p = policies.find((x) => x.id === f.policyId);
    const row = { ...f, clientId: p?.clientId || '', amountClaimed: num(f.amountClaimed), amountSettled: num(f.amountSettled) };
    if (claim.id) await save('claims', claim.id, row);
    else await add('claims', row);
    // A motor claim resets NCB at the next renewal.
    if (p?.category === 'motor' && p.claimMade !== 'Yes' && f.status !== 'rejected') await save('policies', p.id, { claimMade: 'Yes' });
    toast(claim.id ? 'Claim updated' : 'Claim logged');
    onClose();
  };

  return (
    <>
      <Modal open onClose={onClose} title={claim.id ? 'Update claim' : 'Log a claim'}
        footer={
          <>
            {claim.id && <Button variant="ghost" icon={Trash2} className="mr-auto text-rose-600 dark:text-rose-400" onClick={() => setConfirm(true)}>Delete</Button>}
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button icon={Save} onClick={submit}>Save claim</Button>
          </>
        }>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Policy" required className="sm:col-span-2">
            <Select value={f.policyId} onChange={on('policyId')}>
              <option value="">Select policy</option>
              {policies.map((p) => <option key={p.id} value={p.id}>{clientById(p.clientId)?.name || 'Client'} - {policyTitle(p)}{p.regNo ? ` (${p.regNo})` : ''}</option>)}
            </Select>
          </Field>
          <Field label="Claim number"><Input value={f.claimNo} onChange={on('claimNo')} /></Field>
          <Field label="Date of loss / admission"><Input type="date" value={f.lossDate} onChange={on('lossDate')} /></Field>
          <Field label="Claim type">
            <Select value={f.type} onChange={on('type')}>
              {['Own damage', 'Theft', 'Third party', 'Cashless hospitalisation', 'Reimbursement', 'Death / maturity', 'Property damage', 'Other'].map((t) => <option key={t}>{t}</option>)}
            </Select>
          </Field>
          <Field label="Status">
            <Select value={f.status} onChange={on('status')}>{CLAIM_STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</Select>
          </Field>
          <Field label="Amount claimed"><Input type="number" inputMode="decimal" value={f.amountClaimed} onChange={on('amountClaimed')} /></Field>
          <Field label="Amount settled"><Input type="number" inputMode="decimal" value={f.amountSettled} onChange={on('amountSettled')} /></Field>
          <Field label="Notes" className="sm:col-span-2"><Textarea value={f.notes} onChange={on('notes')} placeholder="Surveyor name, garage / hospital, documents pending" /></Field>
        </div>
      </Modal>
      <Confirm open={confirm} onClose={() => setConfirm(false)} title="Delete this claim?" text="This cannot be undone."
        onConfirm={async () => { await del('claims', claim.id); toast('Claim deleted'); onClose(); }} />
    </>
  );
}
