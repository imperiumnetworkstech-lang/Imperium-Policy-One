import { useState } from 'react';
import { Pencil, RefreshCw, Trash2, MessageCircle, Phone, ExternalLink, BadgeCheck, Ban } from 'lucide-react';
import { useData } from '../context/DataContext';
import { usePolicyForm } from './PolicyForm';
import { Badge, Button, Confirm, Field, IconTile, Modal, Select, Textarea, useToast } from './ui';
import { CAT_TONE, catIcon } from './icons';
import {
  FIELDS, STATUS_META, catLabel, isRenewable, policyStatus, policySub, policyTitle, totalPremium,
} from '../lib/constants';
import { daysUntil, fmtDate, inr, num, waLink } from '../lib/utils';

export function StatusBadge({ policy }) {
  const meta = STATUS_META[policyStatus(policy)];
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

export function dueLabel(endDate) {
  const d = daysUntil(endDate);
  if (d == null) return '';
  if (d < 0) return `${Math.abs(d)}d overdue`;
  if (d === 0) return 'Expires today';
  return `${d}d left`;
}

export function renewalMessage(policy, client, profile) {
  const d = daysUntil(policy.endDate);
  const what = policy.category === 'motor'
    ? `motor insurance for ${[policy.make, policy.model].filter(Boolean).join(' ')}${policy.regNo ? ` (${policy.regNo})` : ''}`
    : `${catLabel(policy.category).toLowerCase()} insurance policy${policy.product ? ` "${policy.product}"` : ''}`;
  const when = d < 0 ? `expired on ${fmtDate(policy.endDate)}` : `is due for renewal on ${fmtDate(policy.endDate)}`;
  return [
    `Dear ${client?.name || 'Customer'},`,
    '',
    `Your ${what} with ${policy.insurer || 'the insurer'} ${when}.`,
    policy.policyNumber ? `Policy no: ${policy.policyNumber}` : null,
    '',
    d < 0
      ? 'Please renew at the earliest to stay covered and protect your renewal benefits.'
      : 'Renew before the due date to continue your cover without a break.',
    'Reply here and I will share the best renewal quote.',
    '',
    `Regards,`,
    [profile?.name, profile?.agency].filter(Boolean).join(', '),
    profile?.phone || null,
  ].filter((l) => l !== null).join('\n');
}

export function ContactButtons({ client, message, size = 'sm' }) {
  if (!client?.phone) return null;
  return (
    <>
      <Button as="a" href={`tel:${client.phone}`} variant="secondary" size={size} icon={Phone}>Call</Button>
      <Button as="a" href={waLink(client.phone, message || `Hello ${client.name},`)} target="_blank" rel="noreferrer" variant="whatsapp" size={size} icon={MessageCircle}>WhatsApp</Button>
    </>
  );
}

export function MarkLost({ policy, onClose }) {
  const { save } = useData();
  const toast = useToast();
  const [reason, setReason] = useState('Price too high');
  const [note, setNote] = useState('');
  if (!policy) return null;
  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title="Mark renewal as lost"
      sub="Recording the reason shows you where you lose business."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            variant="danger"
            onClick={async () => {
              await save('policies', policy.id, { renewalStatus: 'lost', lostReason: reason, lostNote: note });
              toast('Marked as lost');
              onClose();
            }}
          >
            Mark lost
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Reason">
          <Select value={reason} onChange={(e) => setReason(e.target.value)}>
            {['Price too high', 'Renewed with another agent', 'Renewed online directly', 'Vehicle sold', 'Not reachable', 'Service issue / claim experience', 'Policy not required', 'Other'].map((r) => <option key={r}>{r}</option>)}
          </Select>
        </Field>
        <Field label="Note"><Textarea value={note} onChange={(e) => setNote(e.target.value)} /></Field>
      </div>
    </Modal>
  );
}

export function PolicyDetail({ policyId, onClose }) {
  const { policies, clientById, profile, save, del } = useData();
  const openForm = usePolicyForm();
  const toast = useToast();
  const [confirm, setConfirm] = useState(false);
  const [lost, setLost] = useState(false);
  const p = policies.find((x) => x.id === policyId);
  if (!p) return null;
  const client = clientById(p.clientId);
  const Icon = catIcon(p.category);
  const renewable = isRenewable(p);

  const rows = FIELDS[p.category]
    .filter((d) => !d.hide?.(p))
    .map((d) => {
      let v = p[d.name];
      if (Array.isArray(v)) v = v.join(', ');
      if (v === '' || v == null) return null;
      if (d.type === 'date') v = fmtDate(v);
      else if (d.money) v = inr(v);
      else if (d.name === 'ncb') v = `${v}%`;
      return [d.label, v];
    })
    .filter(Boolean);

  const act = (fn) => () => { onClose(); fn(); };

  return (
    <>
      <Modal
        open={!lost}
        onClose={onClose}
        size="lg"
        title={policyTitle(p)}
        sub={[client?.name, p.insurer].filter(Boolean).join(' · ')}
        footer={
          <>
            <Button variant="ghost" icon={Trash2} className="mr-auto text-rose-600 dark:text-rose-400" onClick={() => setConfirm(true)}>Delete</Button>
            {renewable && <Button variant="secondary" icon={Ban} onClick={() => setLost(true)}>Lost</Button>}
            <Button variant="secondary" icon={Pencil} onClick={act(() => openForm({ policy: p }))}>Edit</Button>
            {renewable && <Button icon={RefreshCw} onClick={act(() => openForm({ renewFrom: p }))}>Renew</Button>}
          </>
        }
      >
        <div className="flex flex-wrap items-center gap-3">
          <IconTile icon={Icon} tone={CAT_TONE[p.category]} className="size-12" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={CAT_TONE[p.category]}>{catLabel(p.category)}</Badge>
              <StatusBadge policy={p} />
              <Badge>{p.businessType}</Badge>
            </div>
            <p className="mt-1 text-xs text-mute">{policySub(p) || 'No policy number'}</p>
          </div>
          <div className="flex gap-2"><ContactButtons client={client} message={renewalMessage(p, client, profile)} /></div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-4">
          {[
            ['Net premium', inr(p.netPremium)],
            ['Total with GST', inr(totalPremium(p))],
            ['Commission', inr(p.commissionAmount)],
            ['Expiry', fmtDate(p.endDate)],
          ].map(([l, v]) => (
            <div key={l} className="bg-surface px-4 py-3">
              <p className="text-[11px] font-semibold text-mute">{l}</p>
              <p className="tnum text-sm font-bold text-ink">{v}</p>
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-subtle px-4 py-3">
          <div className="text-xs text-mute">
            Commission {num(p.commissionRate)}% {p.category === 'motor' && p.commissionBase === 'od' ? 'on OD' : 'on net'} ·{' '}
            <span className={p.commissionStatus === 'Received' ? 'font-bold text-emerald-600 dark:text-emerald-400' : 'font-bold text-amber-600 dark:text-amber-400'}>{p.commissionStatus}</span>
          </div>
          {p.commissionStatus !== 'Received' && num(p.commissionAmount) > 0 && (
            <Button size="sm" variant="soft" icon={BadgeCheck} onClick={async () => { await save('policies', p.id, { commissionStatus: 'Received' }); toast('Commission marked received'); }}>
              Mark received
            </Button>
          )}
        </div>

        <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
          {[
            ['Policy number', p.policyNumber || '-'],
            ['Start date', fmtDate(p.startDate)],
            ['Issue date', fmtDate(p.issueDate)],
            p.category === 'motor' && ['OD premium', inr(p.odPremium)],
            p.category === 'motor' && ['TP premium', inr(p.tpPremium)],
            ['GST', `${inr(p.gstAmount)} (${num(p.gstRate)}%)`],
            ['Payment mode', p.paymentMode || '-'],
            ...rows,
            p.lostReason && ['Lost reason', p.lostReason],
          ].filter(Boolean).map(([l, v]) => (
            <div key={l} className="min-w-0">
              <dt className="text-[11px] font-semibold text-faint">{l}</dt>
              <dd className="break-words text-sm font-semibold text-ink">{v}</dd>
            </div>
          ))}
        </dl>

        {p.notes && <p className="mt-5 whitespace-pre-wrap rounded-xl bg-subtle p-4 text-sm text-mute">{p.notes}</p>}
        {p.docLink && (
          <a href={p.docLink} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-brand-strong hover:underline">
            <ExternalLink className="size-4" /> Open policy document
          </a>
        )}
      </Modal>

      {lost && <MarkLost policy={p} onClose={() => { setLost(false); onClose(); }} />}
      <Confirm
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Delete this policy?"
        text="This removes the policy and its commission from your records. It cannot be undone."
        onConfirm={async () => { await del('policies', p.id); toast('Policy deleted'); onClose(); }}
      />
    </>
  );
}
