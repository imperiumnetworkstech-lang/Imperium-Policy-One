// Shared building blocks for the calculator tools.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageCircle, FileDown, Share2, Target, Scale, Copy } from 'lucide-react';
import { useData } from '../../context/DataContext';
import { Button, Card, Field, Input, Modal, Select, Textarea, useToast } from '../ui';
import { CATEGORIES } from '../../lib/constants';
import { buildCalcPdf, calcText } from '../../lib/calcShare';
import { addDays, cx, num, todayISO, waLink } from '../../lib/utils';

export function Toggle({ label, checked, onChange, hint }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="flex items-center gap-2.5 text-left text-sm font-semibold text-ink">
      <span className={cx('relative h-6 w-10 shrink-0 rounded-full transition', checked ? 'bg-brand' : 'bg-line')}>
        <span className={cx('absolute top-0.5 size-5 rounded-full bg-white shadow transition-all', checked ? 'left-[18px]' : 'left-0.5')} />
      </span>
      <span>
        {label}
        {hint && <span className="block text-[11px] font-normal text-faint">{hint}</span>}
      </span>
    </button>
  );
}

export const Num = ({ label, value, onChange, hint, ...rest }) => (
  <Field label={label} hint={hint}>
    <Input type="number" inputMode="decimal" min="0" value={value} onChange={(e) => onChange(e.target.value)} {...rest} />
  </Field>
);

export function ResultCard({ label, value, sub, tone = 'deep', children }) {
  return (
    <Card className="overflow-hidden">
      <div className={cx('p-5 text-white', tone === 'good' ? 'bg-gradient-to-br from-emerald-600 to-teal-600' : tone === 'bad' ? 'bg-gradient-to-br from-rose-600 to-fuchsia-700' : 'bg-grad-deep')}>
        <p className="text-xs font-semibold text-white/80">{label}</p>
        <p className="tnum mt-1 text-3xl font-bold tracking-tight sm:text-4xl">{value}</p>
        {sub && <p className="mt-1 text-xs text-white/80">{sub}</p>}
      </div>
      {children}
    </Card>
  );
}

export const Rows = ({ rows }) => (
  <ul className="divide-y divide-line px-5">
    {rows.map(([label, value, strong]) => (
      <li key={label} className="flex items-center justify-between gap-3 py-2.5 text-sm">
        <span className="text-mute">{label}</span>
        <span className={cx('tnum text-right', strong ? 'font-bold text-ink' : 'font-semibold text-ink')}>{value}</span>
      </li>
    ))}
  </ul>
);

/* ---------- Share / lead / quote ---------- */
// summary: see lib/calcShare.js. lead: { interest, expectedPremium, notes }. quote: prefill for the Quotes page.
export function CalcActions({ summary, lead, quote }) {
  const { profile, clients } = useData();
  const toast = useToast();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState('');
  const [busy, setBusy] = useState(false);
  const [leadOpen, setLeadOpen] = useState(false);
  const client = clients.find((c) => c.id === customer);
  const name = client?.name || '';

  const pdf = async () => {
    setBusy(true);
    try {
      const doc = await buildCalcPdf(summary, profile, name);
      const file = new File([doc.output('blob')], `${summary.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.pdf`, { type: 'application/pdf' });
      if (navigator.canShare?.({ files: [file] })) {
        try { await navigator.share({ files: [file], title: summary.title }); return; } catch (e) { if (e?.name === 'AbortError') return; }
      }
      doc.save(file.name);
      toast('PDF downloaded');
    } catch (e) {
      toast(e.message || 'Could not create the PDF', 'error');
    } finally {
      setBusy(false);
    }
  };
  const text = calcText(summary, profile, name);
  const wa = client?.phone ? waLink(client.phone, text) : `https://wa.me/?text=${encodeURIComponent(text)}`;

  return (
    <div className="space-y-3 border-t border-line p-4">
      <Select value={customer} onChange={(e) => setCustomer(e.target.value)} className="h-9 text-xs">
        <option value="">Share without a customer name</option>
        {clients.map((c) => <option key={c.id} value={c.id}>For {c.name}</option>)}
      </Select>
      <div className="flex flex-wrap gap-2">
        <Button as="a" href={wa} target="_blank" rel="noreferrer" variant="whatsapp" size="sm" icon={MessageCircle}>WhatsApp</Button>
        <Button variant="secondary" size="sm" icon={navigator.canShare ? Share2 : FileDown} loading={busy} onClick={pdf}>PDF</Button>
        <Button variant="ghost" size="sm" icon={Copy} onClick={() => navigator.clipboard?.writeText(text).then(() => toast('Copied'))}>Copy</Button>
        <span className="flex-1" />
        {lead && <Button variant="soft" size="sm" icon={Target} onClick={() => setLeadOpen(true)}>Create lead</Button>}
        {quote && <Button size="sm" icon={Scale} onClick={() => navigate('/quotes', { state: { prefill: { ...quote, clientId: customer || '' } } })}>Create quote</Button>}
      </div>
      {leadOpen && <LeadFromCalc lead={lead} summary={summary} client={client} onClose={() => setLeadOpen(false)} />}
    </div>
  );
}

function LeadFromCalc({ lead, summary, client, onClose }) {
  const { add } = useData();
  const toast = useToast();
  const navigate = useNavigate();
  const [f, setF] = useState({
    name: client?.name || '', phone: client?.phone || '', interest: lead.interest || 'motor',
    expectedPremium: Math.round(num(lead.expectedPremium)) || '', followUp: addDays(todayISO(), 1),
    notes: lead.notes || summary.title,
  });
  const on = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <Modal open onClose={onClose} title="Create lead" sub="From this calculation"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={async () => {
            if (!f.name.trim()) return toast('Enter the customer name', 'error');
            await add('leads', { ...f, expectedPremium: num(f.expectedPremium), stage: 'new', source: client ? 'Existing client' : '', referredBy: '' });
            toast('Lead created');
            onClose();
            navigate('/leads');
          }}>Save lead</Button>
        </>
      }>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" required><Input value={f.name} onChange={on('name')} autoFocus /></Field>
        <Field label="Mobile"><Input type="tel" inputMode="numeric" value={f.phone} onChange={on('phone')} /></Field>
        <Field label="Interested in">
          <Select value={f.interest} onChange={on('interest')}>{CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</Select>
        </Field>
        <Field label="Expected premium"><Input type="number" inputMode="decimal" value={f.expectedPremium} onChange={on('expectedPremium')} /></Field>
        <Field label="Follow up on"><Input type="date" value={f.followUp} onChange={on('followUp')} /></Field>
        <Field label="Notes" className="sm:col-span-2"><Textarea value={f.notes} onChange={on('notes')} /></Field>
      </div>
    </Modal>
  );
}
