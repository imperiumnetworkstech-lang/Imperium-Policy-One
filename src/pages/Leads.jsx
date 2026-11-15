import { useState } from 'react';
import { Plus, Target, Save, Trash2, CalendarClock, FileCheck2, Pencil } from 'lucide-react';
import { useData } from '../context/DataContext';
import { usePolicyForm } from '../components/PolicyForm';
import { ContactButtons } from '../components/policyShared';
import { Badge, Button, Card, Confirm, Empty, Field, IconButton, Input, Modal, PageHeader, Segmented, Select, Textarea, toneClass, useToast } from '../components/ui';
import { CAT_TONE, catIcon } from '../components/icons';
import { CATEGORIES, LEAD_SOURCES, LEAD_STAGES, catLabel } from '../lib/constants';
import { addDays, cx, daysUntil, fmtDate, inr, inrShort, num, todayISO } from '../lib/utils';

export default function Leads() {
  const { leads, save } = useData();
  const openForm = usePolicyForm();
  const toast = useToast();
  const [editing, setEditing] = useState(null);
  const [stage, setStage] = useState('new');

  const by = (id) => leads.filter((l) => (l.stage || 'new') === id).sort((a, b) => (a.followUp || '9').localeCompare(b.followUp || '9'));
  const open = leads.filter((l) => !['won', 'lost'].includes(l.stage));
  const pipeline = open.reduce((t, l) => t + num(l.expectedPremium), 0);
  const closed = leads.filter((l) => ['won', 'lost'].includes(l.stage));
  const winRate = closed.length ? Math.round((closed.filter((l) => l.stage === 'won').length / closed.length) * 100) : null;

  const move = async (l, next) => {
    await save('leads', l.id, { stage: next });
    toast(`Moved to ${LEAD_STAGES.find((s) => s.id === next).label}`);
  };
  const convert = (l) => openForm({ preset: { category: l.interest || 'motor' }, newClient: { name: l.name, phone: l.phone || '', email: l.email || '' }, lead: l });

  const card = (l) => {
    const d = l.followUp ? daysUntil(l.followUp) : null;
    const Icon = catIcon(l.interest);
    const closedLead = ['won', 'lost'].includes(l.stage);
    return (
      <div key={l.id} className="rounded-xl border border-line bg-surface p-3 shadow-card">
        <div className="flex items-start gap-2">
          <span className={cx('grid size-8 shrink-0 place-items-center rounded-lg', toneClass(CAT_TONE[l.interest] || 'gray'))}><Icon className="size-4" /></span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-ink">{l.name}</p>
            <p className="truncate text-xs text-mute">{catLabel(l.interest)}{l.source ? ` · ${l.source}` : ''}</p>
          </div>
          <IconButton icon={Pencil} label="Edit lead" className="-mr-1 -mt-1 size-7" onClick={() => setEditing(l)} />
        </div>
        {l.notes && <p className="mt-2 line-clamp-2 text-xs text-mute">{l.notes}</p>}
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {num(l.expectedPremium) > 0 && <Badge tone="brand">{inr(l.expectedPremium)}</Badge>}
          {d != null && !closedLead && (
            <Badge tone={d < 0 ? 'red' : d === 0 ? 'amber' : 'gray'}>
              <CalendarClock className="size-3" />
              {d < 0 ? `${Math.abs(d)}d overdue` : d === 0 ? 'Today' : fmtDate(l.followUp).slice(0, -5)}
            </Badge>
          )}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
          <ContactButtons client={l} message={`Hello ${l.name}, this is regarding your ${catLabel(l.interest).toLowerCase()} insurance enquiry.`} />
          <span className="flex-1" />
          {l.stage === 'won' ? (
            <Button size="sm" variant="soft" icon={FileCheck2} onClick={() => convert(l)}>Create policy</Button>
          ) : (
            <select value={l.stage || 'new'} onChange={(e) => move(l, e.target.value)} aria-label="Move stage" className="h-8 rounded-lg border border-line bg-surface px-2 text-xs font-semibold text-ink">
              {LEAD_STAGES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      <PageHeader title="Leads" sub={`${open.length} open · ${inrShort(pipeline)} expected premium${winRate != null ? ` · ${winRate}% win rate` : ''}`}>
        <Button icon={Plus} onClick={() => setEditing({})}>Add lead</Button>
      </PageHeader>

      {!leads.length ? (
        <Card><Empty icon={Target} title="No leads yet" text="Capture every enquiry with a follow-up date so nothing slips through.">
          <Button icon={Plus} onClick={() => setEditing({})}>Add lead</Button>
        </Empty></Card>
      ) : (
        <>
          {/* Phone: one stage at a time */}
          <div className="lg:hidden">
            <Segmented value={stage} onChange={setStage} options={LEAD_STAGES.map((s) => ({ ...s, count: by(s.id).length }))} className="mb-3" />
            <div className="space-y-3">
              {by(stage).map(card)}
              {!by(stage).length && <p className="py-10 text-center text-sm text-mute">No leads in this stage.</p>}
            </div>
          </div>

          {/* Desktop: board */}
          <div className="hidden grid-cols-5 gap-3 lg:grid">
            {LEAD_STAGES.map((s) => {
              const list = by(s.id);
              return (
                <div key={s.id} className="min-w-0 rounded-2xl bg-subtle p-2.5">
                  <div className="mb-2.5 flex items-center justify-between px-1.5 pt-1">
                    <span className="flex items-center gap-2 text-xs font-bold text-ink">
                      <i className={cx('size-2 rounded-full', { blue: 'bg-sky-500', violet: 'bg-violet-500', amber: 'bg-amber-500', green: 'bg-emerald-500', gray: 'bg-slate-400' }[s.tone])} />
                      {s.label}
                      <span className="tnum font-semibold text-mute">{list.length}</span>
                    </span>
                    <span className="tnum text-[11px] font-semibold text-mute">{inrShort(list.reduce((t, l) => t + num(l.expectedPremium), 0))}</span>
                  </div>
                  <div className="space-y-2.5">{list.map(card)}</div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {editing && <LeadForm lead={editing} onClose={() => setEditing(null)} />}
    </>
  );
}

function LeadForm({ lead, onClose }) {
  const { clients, add, save, del } = useData();
  const toast = useToast();
  const [f, setF] = useState({ name: '', phone: '', email: '', interest: 'motor', expectedPremium: '', source: '', referredBy: '', stage: 'new', followUp: addDays(todayISO(), 1), notes: '', ...lead });
  const [confirm, setConfirm] = useState(false);
  const on = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async () => {
    if (!f.name.trim()) return toast('Name is required', 'error');
    const row = { ...f, expectedPremium: num(f.expectedPremium) };
    if (lead.id) await save('leads', lead.id, row);
    else await add('leads', row);
    toast(lead.id ? 'Lead updated' : 'Lead added');
    onClose();
  };

  return (
    <>
      <Modal open onClose={onClose} title={lead.id ? 'Edit lead' : 'New lead'}
        footer={
          <>
            {lead.id && <Button variant="ghost" icon={Trash2} className="mr-auto text-rose-600 dark:text-rose-400" onClick={() => setConfirm(true)}>Delete</Button>}
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button icon={Save} onClick={submit}>Save lead</Button>
          </>
        }>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" required><Input value={f.name} onChange={on('name')} autoFocus /></Field>
          <Field label="Mobile"><Input type="tel" inputMode="numeric" value={f.phone} onChange={on('phone')} /></Field>
          <Field label="Interested in">
            <Select value={f.interest} onChange={on('interest')}>{CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</Select>
          </Field>
          <Field label="Expected premium"><Input type="number" inputMode="decimal" value={f.expectedPremium} onChange={on('expectedPremium')} /></Field>
          <Field label="Source">
            <Select value={f.source} onChange={on('source')}><option value="">Select</option>{LEAD_SOURCES.map((s) => <option key={s}>{s}</option>)}</Select>
          </Field>
          <Field label="Referred by" hint="Credit the client who sent this lead">
            <Select value={f.referredBy || ''} onChange={(e) => setF({ ...f, referredBy: e.target.value, source: e.target.value && !f.source ? 'Referral' : f.source })}>
              <option value="">Nobody</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
          <Field label="Stage">
            <Select value={f.stage} onChange={on('stage')}>{LEAD_STAGES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</Select>
          </Field>
          <Field label="Next follow-up"><Input type="date" value={f.followUp} onChange={on('followUp')} /></Field>
          <Field label="Email"><Input type="email" value={f.email} onChange={on('email')} /></Field>
          <Field label="Notes" className="sm:col-span-2"><Textarea value={f.notes} onChange={on('notes')} placeholder="Requirement, quotes shared, objections" /></Field>
        </div>
      </Modal>
      <Confirm open={confirm} onClose={() => setConfirm(false)} title="Delete this lead?" text="This cannot be undone."
        onConfirm={async () => { await del('leads', lead.id); toast('Lead deleted'); onClose(); }} />
    </>
  );
}
