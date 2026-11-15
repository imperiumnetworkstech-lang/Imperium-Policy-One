import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Plus, Users, Pencil, Trash2, Save, Check, Minus, MapPin, Mail, Phone, Cake, House, UserPlus, Link2, Unlink, Handshake, Share2,
} from 'lucide-react';
import { useData } from '../context/DataContext';
import { usePolicyForm } from '../components/PolicyForm';
import { ContactButtons, PolicyDetail, StatusBadge } from '../components/policyShared';
import { ShareLinkPanel } from '../components/ShareLink';
import { Avatar, Badge, Button, Card, Confirm, Empty, Field, IconTile, Input, Modal, PageHeader, SearchInput, Select, Textarea, useToast } from '../components/ui';
import { CAT_ICON, CAT_TONE, catIcon } from '../components/icons';
import { CATEGORIES, LEAD_SOURCES, isLive, policyTitle } from '../lib/constants';
import { RELATIONS, householdOf, householdSummary } from '../lib/family';
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
        const family = c.householdId ? 0 : clients.filter((x) => x.householdId === c.id).length;
        return { c, all, live, family, cats: new Set(live.map((p) => p.category)), premium: live.reduce((t, p) => t + num(p.netPremium), 0) };
      })
      .filter(({ c, live, cats, family }) => {
        if (term && ![c.name, c.phone, c.email, c.city].some((v) => String(v || '').toLowerCase().includes(term))) return false;
        if (filter === 'single') return cats.size === 1;
        if (filter === 'multi') return cats.size > 1;
        if (filter === 'inactive') return live.length === 0;
        if (filter === 'families') return family > 0;
        return true;
      });
  }, [clients, policies, q, filter]);

  const nameOf = (id) => clients.find((x) => x.id === id)?.name;

  return (
    <>
      <PageHeader title="Clients" sub={`${clients.length} clients in your book`}>
        <Button icon={Plus} onClick={() => setEditing({})}>Add client</Button>
      </PageHeader>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <SearchInput value={q} onChange={setQ} placeholder="Search name, mobile, email, city" className="sm:w-80" />
        <Select value={filter} onChange={(e) => setFilter(e.target.value)} className="sm:w-56">
          <option value="all">All clients</option>
          <option value="families">Families</option>
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
          {rows.map(({ c, live, cats, premium, family }) => (
            <Card key={c.id} className="cursor-pointer p-4 transition hover:-translate-y-0.5 hover:border-brand/40" onClick={() => setOpenId(c.id)}>
              <div className="flex items-center gap-3">
                <Avatar name={c.name} className="size-11" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-ink">{c.name}</p>
                  <p className="truncate text-xs text-mute">
                    {c.householdId ? `${c.relation || 'Family'} of ${nameOf(c.householdId) || '-'}` : [c.phone, c.city].filter(Boolean).join(' · ') || 'No contact details'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="tnum text-sm font-bold text-ink">{inrShort(premium)}</p>
                  <p className="text-[11px] text-mute">{live.length} active</p>
                </div>
              </div>
              {family > 0 && (
                <p className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-brand-strong"><House className="size-3.5" /> Family of {family + 1}</p>
              )}
              <CoverStrip cats={cats} />
            </Card>
          ))}
        </div>
      )}

      {editing && <ClientForm client={editing} onClose={() => setEditing(null)} />}
      {openId && (
        <ClientDetail
          clientId={openId}
          onOpen={setOpenId}
          onClose={() => setOpenId(null)}
          onEdit={(c) => { setOpenId(null); setEditing(c); }}
        />
      )}
    </>
  );
}

// Which of the four lines this client holds: the fastest way to spot a cross-sell.
function CoverStrip({ cats, compact }) {
  return (
    <div className={cx('grid grid-cols-4 gap-1.5', compact ? 'mt-0' : 'mt-3')}>
      {CATEGORIES.map((c) => {
        const Icon = CAT_ICON[c.id];
        const has = cats.has(c.id);
        return (
          <div key={c.id} title={has ? `Has ${c.label}` : `No ${c.label} cover`} className={cx('flex items-center justify-center gap-1 rounded-lg py-1.5 text-[10px] font-bold', has ? 'bg-brand-soft text-brand-strong' : 'border border-dashed border-line text-faint')}>
            <Icon className="size-3.5" />
            {!compact && <span className="hidden min-[400px]:inline">{c.label}</span>}
            {has ? <Check className="size-3" /> : <Minus className="size-3" />}
          </div>
        );
      })}
    </div>
  );
}

// Searchable-enough picker for linking to another client.
function ClientSelect({ value, onChange, exclude = [], placeholder = 'None' }) {
  const { clients } = useData();
  return (
    <Select value={value || ''} onChange={(e) => onChange(e.target.value)}>
      <option value="">{placeholder}</option>
      {clients.filter((c) => !exclude.includes(c.id)).map((c) => (
        <option key={c.id} value={c.id}>{c.name}{c.phone ? ` (${c.phone})` : ''}</option>
      ))}
    </Select>
  );
}

export function ClientForm({ client, onClose, onSaved }) {
  const { clients, add, save } = useData();
  const toast = useToast();
  const [f, setF] = useState({
    name: '', phone: '', email: '', dob: '', anniversary: '', city: '', address: '', occupation: '', source: '', notes: '',
    householdId: '', relation: '', referredBy: '', ...client,
  });
  const [busy, setBusy] = useState(false);
  const on = (k) => (e) => setF({ ...f, [k]: e.target.value });
  // A household's main client cannot itself join another household.
  const isHead = client.id && clients.some((c) => c.householdId === client.id);
  const heads = clients.filter((c) => !c.householdId).map((c) => c.id);

  const submit = async () => {
    if (!f.name.trim()) return toast('Name is required', 'error');
    if (f.householdId && !f.relation) return toast('Choose the relation to the family head', 'error');
    setBusy(true);
    try {
      const row = { ...f, relation: f.householdId ? f.relation : '', source: f.referredBy && !f.source ? 'Referral' : f.source };
      let id = client.id;
      if (id) await save('clients', id, row);
      else id = await add('clients', row);
      toast(client.id ? 'Client updated' : 'Client added');
      onSaved?.(id);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} size="lg" title={client.id ? 'Edit client' : client.householdId ? 'Add family member' : 'New client'}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button icon={Save} loading={busy} onClick={submit}>Save client</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name / business name" required><Input value={f.name} onChange={on('name')} autoFocus /></Field>
        <Field label="Mobile"><Input type="tel" inputMode="numeric" value={f.phone} onChange={on('phone')} placeholder="98XXXXXXXX" /></Field>
        <Field label="Email"><Input type="email" value={f.email} onChange={on('email')} /></Field>
        <Field label="City"><Input value={f.city} onChange={on('city')} /></Field>
        <Field label="Date of birth" hint="Used for birthday reminders and family gaps"><Input type="date" value={f.dob} onChange={on('dob')} /></Field>
        <Field label="Anniversary"><Input type="date" value={f.anniversary} onChange={on('anniversary')} /></Field>
        <Field label="Occupation"><Input value={f.occupation} onChange={on('occupation')} /></Field>
        <Field label="Source">
          <Select value={f.source} onChange={on('source')}><option value="">Select</option>{LEAD_SOURCES.map((s) => <option key={s}>{s}</option>)}</Select>
        </Field>

        <div className="rounded-2xl border border-line bg-subtle p-4 sm:col-span-2">
          <p className="mb-3 flex items-center gap-2 text-xs font-bold text-ink"><House className="size-4 text-brand" /> Family</p>
          {isHead ? (
            <p className="text-xs text-mute">{f.name || 'This client'} is the main member of a family. Manage members from the client's profile.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Belongs to the family of" hint="Pick the main member, e.g. the husband or parent">
                <ClientSelect value={f.householdId} onChange={(v) => setF({ ...f, householdId: v })} exclude={[client.id, ...clients.filter((c) => !heads.includes(c.id)).map((c) => c.id)]} placeholder="Not part of a family" />
              </Field>
              <Field label="Relation to them">
                <Select value={f.relation} onChange={on('relation')} disabled={!f.householdId}>
                  <option value="">Select</option>
                  {RELATIONS.map((r) => <option key={r}>{r}</option>)}
                </Select>
              </Field>
            </div>
          )}
        </div>

        <Field label="Referred by" hint="The client who sent this person to you">
          <ClientSelect value={f.referredBy} onChange={(v) => setF({ ...f, referredBy: v })} exclude={[client.id]} />
        </Field>
        <Field label="Address"><Input value={f.address} onChange={on('address')} /></Field>
        <Field label="Notes" className="sm:col-span-2"><Textarea value={f.notes} onChange={on('notes')} placeholder="Preferences, best time to call" /></Field>
      </div>
    </Modal>
  );
}

function ClientDetail({ clientId, onOpen, onClose, onEdit }) {
  const { clients, clientById, policies, leads, save, del } = useData();
  const openForm = usePolicyForm();
  const toast = useToast();
  const [confirm, setConfirm] = useState(false);
  const [policyId, setPolicyId] = useState(null);
  const [memberForm, setMemberForm] = useState(null);
  const [linking, setLinking] = useState(false);
  const [link, setLink] = useState({ id: '', relation: '' });
  const [sharing, setSharing] = useState(false);
  const c = clientById(clientId);
  if (!c) return null;
  const all = policies.filter((p) => p.clientId === c.id).sort((a, b) => (b.endDate || '').localeCompare(a.endDate || ''));
  const live = all.filter(isLive);
  const cats = new Set(live.map((p) => p.category));
  const missing = CATEGORIES.filter((x) => !cats.has(x.id));

  const family = householdOf(c, clients);
  const hasFamily = family.members.length > 0;
  const summary = hasFamily ? householdSummary(family.all, policies) : null;

  const referrer = c.referredBy ? clientById(c.referredBy) : null;
  const referred = clients.filter((x) => x.referredBy === c.id);
  const referredLeads = leads.filter((l) => l.referredBy === c.id);

  if (policyId) return <PolicyDetail policyId={policyId} onClose={() => setPolicyId(null)} />;
  if (memberForm) return <ClientForm client={memberForm} onClose={() => setMemberForm(null)} />;
  if (sharing) return <ShareLinkPanel client={c} onClose={() => setSharing(false)} />;

  const linkMember = async () => {
    if (!link.id || !link.relation) return toast('Choose the person and their relation', 'error');
    const target = clientById(link.id);
    // If the person being linked heads their own family, move their members across too.
    const theirs = clients.filter((x) => x.householdId === link.id);
    await save('clients', link.id, { householdId: family.head.id, relation: link.relation });
    await Promise.all(theirs.map((m) => save('clients', m.id, { householdId: family.head.id })));
    toast(`${target?.name} added to the family`);
    setLinking(false);
    setLink({ id: '', relation: '' });
  };

  const removeDelete = async () => {
    if (all.length) return;
    // Release any family members and referral links that point at this client.
    await Promise.all([
      ...clients.filter((x) => x.householdId === c.id).map((m) => save('clients', m.id, { householdId: '', relation: '' })),
      ...clients.filter((x) => x.referredBy === c.id).map((m) => save('clients', m.id, { referredBy: '' })),
    ]);
    await del('clients', c.id);
    toast('Client deleted');
    onClose();
  };

  return (
    <>
      <Modal open onClose={onClose} size="lg" title={c.name} sub={[c.householdId ? `${c.relation || 'Member'} of ${family.head?.name}` : null, c.occupation, c.city].filter(Boolean).join(' · ') || 'Client profile'}
        footer={
          <>
            <Button variant="ghost" icon={Trash2} className="mr-auto text-rose-600 dark:text-rose-400" onClick={() => setConfirm(true)}>Delete</Button>
            <Button variant="secondary" icon={Share2} onClick={() => setSharing(true)}>Customer link</Button>
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

        {/* Family */}
        <div className="mb-2 mt-6 flex items-center justify-between">
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-faint">Family {hasFamily ? `(${family.all.length})` : ''}</h3>
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" icon={Link2} onClick={() => setLinking((v) => !v)}>Link existing</Button>
            <Button size="sm" variant="soft" icon={UserPlus} onClick={() => setMemberForm({ householdId: family.head.id, city: family.head.city || '', address: family.head.address || '' })}>Add member</Button>
          </div>
        </div>

        {linking && (
          <div className="mb-3 grid gap-3 rounded-xl border border-line bg-subtle p-3 sm:grid-cols-[1fr_160px_auto] sm:items-end">
            <Field label="Client">
              <ClientSelect value={link.id} onChange={(v) => setLink({ ...link, id: v })} exclude={family.all.map((x) => x.id)} placeholder="Choose a client" />
            </Field>
            <Field label={`Relation to ${family.head.name}`}>
              <Select value={link.relation} onChange={(e) => setLink({ ...link, relation: e.target.value })}>
                <option value="">Select</option>
                {RELATIONS.map((r) => <option key={r}>{r}</option>)}
              </Select>
            </Field>
            <Button onClick={linkMember}>Link</Button>
          </div>
        )}

        {hasFamily ? (
          <div className="rounded-2xl border border-line">
            <div className="grid grid-cols-3 gap-px overflow-hidden rounded-t-2xl bg-line">
              {[['Family premium', inr(summary.premium)], ['Total cover', inrShort(summary.cover)], ['Your commission', inr(summary.commission)]].map(([l, v]) => (
                <div key={l} className="bg-subtle px-3 py-2.5">
                  <p className="text-[11px] font-semibold text-mute">{l}</p>
                  <p className="tnum text-sm font-bold text-ink">{v}</p>
                </div>
              ))}
            </div>
            <ul className="divide-y divide-line">
              {summary.rows.map(({ person, cats: pc, live: pl }) => (
                <li key={person.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                  <button className="flex min-w-0 flex-1 basis-40 items-center gap-2.5 text-left" onClick={() => person.id !== c.id && onOpen(person.id)}>
                    <Avatar name={person.name} className="size-8 text-[10px]" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold text-ink">{person.name}{person.id === c.id && <span className="font-normal text-mute"> (this client)</span>}</span>
                      <span className="block truncate text-xs text-mute">{person.relation || 'Main member'} · {pl.length} active</span>
                    </span>
                  </button>
                  <div className="w-44"><CoverStrip cats={pc} compact /></div>
                  {person.householdId && (
                    <button title="Remove from family" className="text-faint hover:text-rose-600" onClick={async () => { await save('clients', person.id, { householdId: '', relation: '' }); toast(`${person.name} removed from the family`); }}>
                      <Unlink className="size-4" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
            {summary.gaps.length > 0 && (
              <div className="space-y-1.5 border-t border-line bg-amber-500/8 p-3">
                <p className="text-xs font-bold text-amber-700 dark:text-amber-300">Family gaps</p>
                {summary.gaps.map((g) => (
                  <div key={g.personId + g.line} className="flex items-center justify-between gap-2 text-xs text-ink">
                    <span>{g.text}</span>
                    <button className="font-bold text-brand-strong hover:underline" onClick={() => { onClose(); openForm({ preset: { clientId: g.personId, category: g.line } }); }}>+ Add {g.line}</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-line p-3 text-xs text-mute">No family linked yet. Add the spouse, parents or children to see the whole household's cover and gaps.</p>
        )}

        {/* Referrals */}
        <h3 className="mb-2 mt-6 text-[11px] font-bold uppercase tracking-wider text-faint">Referrals</h3>
        <div className="flex flex-wrap gap-2 text-xs">
          {referrer ? (
            <button onClick={() => onOpen(referrer.id)} className="flex items-center gap-1.5 rounded-full bg-subtle px-3 py-1.5 font-semibold text-ink hover:bg-brand-soft">
              <Handshake className="size-3.5 text-brand" /> Referred by {referrer.name}
            </button>
          ) : (
            <span className="rounded-full bg-subtle px-3 py-1.5 text-mute">Not referred by a client</span>
          )}
          <Badge tone={referred.length ? 'green' : 'gray'}>Referred {referred.length} client{referred.length === 1 ? '' : 's'}</Badge>
          {referredLeads.length > 0 && <Badge tone="blue">{referredLeads.length} lead{referredLeads.length === 1 ? '' : 's'}</Badge>}
        </div>
        {referred.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {referred.map((r) => (
              <button key={r.id} onClick={() => onOpen(r.id)} className="rounded-full border border-line px-2.5 py-1 text-xs font-semibold text-ink hover:bg-subtle">{r.name}</button>
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
        text={all.length ? `${c.name} has ${all.length} policies. Delete those first so no policy is left without a client.` : 'Family members and referrals linked to this client are kept and simply unlinked. This cannot be undone.'}
        confirmLabel={all.length ? 'Understood' : 'Delete'}
        onConfirm={removeDelete} />
    </>
  );
}
