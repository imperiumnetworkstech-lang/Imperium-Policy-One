import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Users, Pencil, Trash2, Save, Check, Minus, MapPin, Mail, Phone, Cake } from 'lucide-react';
import { useData } from '../context/DataContext';
import { usePolicyForm } from '../components/PolicyForm';
import { ContactButtons, PolicyDetail, StatusBadge } from '../components/policyShared';
import { Avatar, Button, Card, Confirm, Empty, Field, IconTile, Input, Modal, PageHeader, SearchInput, Select, Textarea, useToast } from '../components/ui';
import { CAT_ICON, CAT_TONE, catIcon } from '../components/icons';
import { CATEGORIES, LEAD_SOURCES, isLive, policyTitle } from '../lib/constants';
import { cx, fmtDate, inr, inrShort, num } from '../lib/utils';

export default function Clients() {
  const { clients, policies } = useData();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('all');
  const [editing, setEditing] = useState(null);
  const openId = params.get('id');
  const setOpenId = (id) => setParams(id ? { id } : {}, { replace: true });

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return clients
      .map((c) => {
        const all = policies.filter((p) => p.clientId === c.id);
        const live = all.filter(isLive);
        return { c, all, live, cats: new Set(live.map((p) => p.category)), premium: live.reduce((t, p) => t + num(p.netPremium), 0) };
      })
      .filter(({ c, live, cats }) => {
        if (term && ![c.name, c.phone, c.email, c.city].some((v) => String(v || '').toLowerCase().includes(term))) return false;
        if (filter === 'single') return cats.size === 1;
        if (filter === 'multi') return cats.size > 1;
        if (filter === 'inactive') return live.length === 0;
        return true;
      });
  }, [clients, policies, q, filter]);

  return (
    <>
      <PageHeader title="Clients" sub={`${clients.length} clients in your book`}>
        <Button icon={Plus} onClick={() => setEditing({})}>Add client</Button>
      </PageHeader>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <SearchInput value={q} onChange={setQ} placeholder="Search name, mobile, email, city" className="sm:w-80" />
        <Select value={filter} onChange={(e) => setFilter(e.target.value)} className="sm:w-56">
          <option value="all">All clients</option>
          <option value="single">Only one line of cover</option>
          <option value="multi">Multiple lines of cover</option>
          <option value="inactive">No active policy</option>
        </Select>
      </div>

      {!rows.length ? (
        <Card><Empty icon={Users} title={clients.length ? 'No clients match' : 'No clients yet'} text="Clients are created automatically when you add a policy, or add one here.">
          {!clients.length && <Button icon={Plus} onClick={() => setEditing({})}>Add client</Button>}
        </Empty></Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map(({ c, live, cats, premium }) => (
            <Card key={c.id} className="cursor-pointer p-4 transition hover:-translate-y-0.5 hover:border-brand/40" onClick={() => setOpenId(c.id)}>
              <div className="flex items-center gap-3">
                <Avatar name={c.name} className="size-11" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-ink">{c.name}</p>
                  <p className="truncate text-xs text-mute">{[c.phone, c.city].filter(Boolean).join(' · ') || 'No contact details'}</p>
                </div>
                <div className="text-right">
                  <p className="tnum text-sm font-bold text-ink">{inrShort(premium)}</p>
                  <p className="text-[11px] text-mute">{live.length} active</p>
                </div>
              </div>
              <CoverStrip cats={cats} />
            </Card>
          ))}
        </div>
      )}

      {editing && <ClientForm client={editing} onClose={() => setEditing(null)} />}
      {openId && <ClientDetail clientId={openId} onClose={() => setOpenId(null)} onEdit={(c) => { setOpenId(null); setEditing(c); }} />}
    </>
  );
}

// Which of the four lines this client holds: the fastest way to spot a cross-sell.
function CoverStrip({ cats }) {
  return (
    <div className="mt-3 grid grid-cols-4 gap-1.5">
      {CATEGORIES.map((c) => {
        const Icon = CAT_ICON[c.id];
        const has = cats.has(c.id);
        return (
          <div key={c.id} title={has ? `Has ${c.label}` : `No ${c.label} cover`} className={cx('flex items-center justify-center gap-1 rounded-lg py-1.5 text-[10px] font-bold', has ? 'bg-brand-soft text-brand-strong' : 'border border-dashed border-line text-faint')}>
            <Icon className="size-3.5" />
            <span className="hidden min-[400px]:inline">{c.label}</span>
            {has ? <Check className="size-3" /> : <Minus className="size-3" />}
          </div>
        );
      })}
    </div>
  );
}

function ClientForm({ client, onClose }) {
  const { add, save } = useData();
  const toast = useToast();
  const [f, setF] = useState({ name: '', phone: '', email: '', dob: '', anniversary: '', city: '', address: '', occupation: '', source: '', notes: '', ...client });
  const [busy, setBusy] = useState(false);
  const on = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async () => {
    if (!f.name.trim()) return toast('Name is required', 'error');
    setBusy(true);
    try {
      if (client.id) await save('clients', client.id, f);
      else await add('clients', f);
      toast(client.id ? 'Client updated' : 'Client added');
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} size="lg" title={client.id ? 'Edit client' : 'New client'}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button icon={Save} loading={busy} onClick={submit}>Save client</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name / business name" required><Input value={f.name} onChange={on('name')} autoFocus /></Field>
        <Field label="Mobile"><Input type="tel" inputMode="numeric" value={f.phone} onChange={on('phone')} placeholder="98XXXXXXXX" /></Field>
        <Field label="Email"><Input type="email" value={f.email} onChange={on('email')} /></Field>
        <Field label="City"><Input value={f.city} onChange={on('city')} /></Field>
        <Field label="Date of birth" hint="Used for birthday reminders"><Input type="date" value={f.dob} onChange={on('dob')} /></Field>
        <Field label="Anniversary"><Input type="date" value={f.anniversary} onChange={on('anniversary')} /></Field>
        <Field label="Occupation"><Input value={f.occupation} onChange={on('occupation')} /></Field>
        <Field label="Source">
          <Select value={f.source} onChange={on('source')}><option value="">Select</option>{LEAD_SOURCES.map((s) => <option key={s}>{s}</option>)}</Select>
        </Field>
        <Field label="Address" className="sm:col-span-2"><Input value={f.address} onChange={on('address')} /></Field>
        <Field label="Notes" className="sm:col-span-2"><Textarea value={f.notes} onChange={on('notes')} placeholder="Family details, preferences, best time to call" /></Field>
      </div>
    </Modal>
  );
}

function ClientDetail({ clientId, onClose, onEdit }) {
  const { clientById, policies, del } = useData();
  const openForm = usePolicyForm();
  const toast = useToast();
  const [confirm, setConfirm] = useState(false);
  const [policyId, setPolicyId] = useState(null);
  const c = clientById(clientId);
  if (!c) return null;
  const all = policies.filter((p) => p.clientId === c.id).sort((a, b) => (b.endDate || '').localeCompare(a.endDate || ''));
  const live = all.filter(isLive);
  const cats = new Set(live.map((p) => p.category));
  const missing = CATEGORIES.filter((x) => !cats.has(x.id));

  if (policyId) return <PolicyDetail policyId={policyId} onClose={() => setPolicyId(null)} />;

  return (
    <>
      <Modal open onClose={onClose} size="lg" title={c.name} sub={[c.occupation, c.city].filter(Boolean).join(' · ') || 'Client profile'}
        footer={
          <>
            <Button variant="ghost" icon={Trash2} className="mr-auto text-rose-600 dark:text-rose-400" onClick={() => setConfirm(true)}>Delete</Button>
            <Button variant="secondary" icon={Pencil} onClick={() => onEdit(c)}>Edit</Button>
            <Button icon={Plus} onClick={() => { onClose(); openForm({ preset: { clientId: c.id } }); }}>Add policy</Button>
          </>
        }>
        <div className="flex flex-wrap items-center gap-3">
          <Avatar name={c.name} className="size-14 text-base" />
          <div className="min-w-0 flex-1 space-y-0.5 text-xs text-mute">
            {c.phone && <p className="flex items-center gap-1.5"><Phone className="size-3.5" />{c.phone}</p>}
            {c.email && <p className="flex items-center gap-1.5 truncate"><Mail className="size-3.5" />{c.email}</p>}
            {c.dob && <p className="flex items-center gap-1.5"><Cake className="size-3.5" />{fmtDate(c.dob)}</p>}
            {c.address && <p className="flex items-center gap-1.5"><MapPin className="size-3.5" />{c.address}</p>}
          </div>
          <div className="flex gap-2"><ContactButtons client={c} /></div>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-line bg-line">
          {[['Active policies', live.length], ['Annual premium', inr(live.reduce((t, p) => t + num(p.netPremium), 0))], ['Your commission', inr(live.reduce((t, p) => t + num(p.commissionAmount), 0))]].map(([l, v]) => (
            <div key={l} className="bg-surface px-3 py-3">
              <p className="text-[11px] font-semibold text-mute">{l}</p>
              <p className="tnum text-sm font-bold text-ink">{v}</p>
            </div>
          ))}
        </div>

        <h3 className="mb-2 mt-6 text-[11px] font-bold uppercase tracking-wider text-faint">Coverage map</h3>
        <CoverStrip cats={cats} />
        {missing.length > 0 && live.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-brand-soft/60 p-3 text-xs text-brand-strong">
            <span className="font-bold">Cross-sell:</span>
            {missing.map((x) => (
              <button key={x.id} onClick={() => { onClose(); openForm({ preset: { clientId: c.id, category: x.id } }); }} className="rounded-full bg-surface px-2.5 py-1 font-bold shadow-sm hover:brightness-95">
                + {x.label}
              </button>
            ))}
          </div>
        )}

        <h3 className="mb-2 mt-6 text-[11px] font-bold uppercase tracking-wider text-faint">Policies ({all.length})</h3>
        {all.length ? (
          <ul className="divide-y divide-line rounded-xl border border-line">
            {all.map((p) => (
              <li key={p.id}>
                <button onClick={() => setPolicyId(p.id)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-subtle">
                  <IconTile icon={catIcon(p.category)} tone={CAT_TONE[p.category]} className="size-9" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-ink">{policyTitle(p)}</span>
                    <span className="block truncate text-xs text-mute">{p.insurer} · expires {fmtDate(p.endDate)}</span>
                  </span>
                  <span className="tnum hidden text-sm font-bold text-ink sm:block">{inr(p.netPremium)}</span>
                  <StatusBadge policy={p} />
                </button>
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-mute">No policies recorded for this client yet.</p>}

        {c.notes && <p className="mt-5 whitespace-pre-wrap rounded-xl bg-subtle p-4 text-sm text-mute">{c.notes}</p>}
      </Modal>
      <Confirm open={confirm} onClose={() => setConfirm(false)} title="Delete this client?"
        text={all.length ? `${c.name} has ${all.length} policies. Delete those first so no policy is left without a client.` : 'This cannot be undone.'}
        confirmLabel={all.length ? 'Understood' : 'Delete'}
        onConfirm={async () => { if (!all.length) { await del('clients', c.id); toast('Client deleted'); onClose(); } }} />
    </>
  );
}
