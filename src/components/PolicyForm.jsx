import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { UserPlus, Check, X, Save, Search, FileUp, PencilLine, Sparkles, Loader2, AlertCircle } from 'lucide-react';
import { useData } from '../context/DataContext';
import { Button, Field, Input, Select, Textarea, Modal, Avatar, useToast } from './ui';
import { CAT_ICON } from './icons';
import { CATEGORIES, FIELDS, INSURERS, blankPolicy, defaultGst, nextNcb } from '../lib/constants';
import { addDays, addYears, cx, inr, num, todayISO } from '../lib/utils';

const Ctx = createContext(() => {});
// usePolicyForm()({ policy }) edits, ({ renewFrom }) renews, ({ preset, newClient, lead }) starts a new one.
export const usePolicyForm = () => useContext(Ctx);

export function PolicyFormProvider({ children }) {
  const [state, setState] = useState(null);
  const open = useCallback((opts = {}) => setState({ ...opts, key: Date.now() }), []);
  return (
    <Ctx.Provider value={open}>
      {children}
      {state && <PolicyForm {...state} key={state.key} onClose={() => setState(null)} />}
    </Ctx.Provider>
  );
}

const autoEnd = (start) => (start ? addDays(addYears(start, 1), -1) : '');

function initial({ policy, renewFrom, preset }) {
  if (policy) return { ...blankPolicy(policy.category), ...policy };
  if (renewFrom) {
    const old = renewFrom;
    const start = addDays(old.endDate, 1);
    const next = {
      ...blankPolicy(old.category), ...old,
      businessType: 'Renewal', policyNumber: '', startDate: start, endDate: autoEnd(start), issueDate: todayISO(),
      commissionStatus: 'Pending', renewedFrom: old.id,
    };
    ['id', 'createdAt', 'updatedAt', 'renewalStatus', 'renewedTo', 'status', 'lostReason'].forEach((k) => delete next[k]);
    if (old.category === 'motor') {
      next.prevInsurer = old.insurer || '';
      next.prevPolicyNo = old.policyNumber || '';
      next.ncb = old.claimMade === 'Yes' ? '0' : String(nextNcb(old.ncb));
      next.claimMade = 'No';
    }
    return next;
  }
  return { ...blankPolicy(preset?.category || 'motor'), ...preset };
}

function PolicyForm({ policy, renewFrom, preset, newClient, lead, onClose }) {
  const { clients, add, save } = useData();
  const toast = useToast();
  const editing = Boolean(policy);
  const [f, setF] = useState(() => initial({ policy, renewFrom, preset }));
  const [clientMode, setClientMode] = useState(newClient ? 'new' : 'pick');
  const [nc, setNc] = useState({ name: '', phone: '', email: '', ...newClient });
  const [commManual, setCommManual] = useState(() => {
    if (!policy) return false;
    const base = policy.category === 'motor' && policy.commissionBase === 'od' ? num(policy.odPremium) : num(policy.netPremium);
    return Math.round((base * num(policy.commissionRate)) / 100) !== num(policy.commissionAmount);
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState('manual'); // 'manual' | 'pdf'
  const [scan, setScan] = useState(null); // { status: 'reading' | 'done' | 'error', ... }
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef(null);

  // Read a policy PDF and pre-fill everything that can be recognised.
  async function readPdf(file) {
    if (!file) return;
    if (file.type !== 'application/pdf' && !/\.pdf$/i.test(file.name)) return setScan({ status: 'error', msg: 'Please choose a PDF file.' });
    setScan({ status: 'reading', file: file.name });
    try {
      const { extractPolicy } = await import('../lib/pdfExtract');
      const { fields, client, count, missing, text } = await extractPolicy(file);
      const { category, ...rest } = fields;
      const digits = (s) => String(s || '').replace(/\D/g, '').slice(-10);
      const match = clients.find(
        (c) => (client.phone && digits(c.phone) === digits(client.phone)) || (client.name && c.name?.trim().toLowerCase() === client.name.toLowerCase()),
      );
      setF((p) => {
        const n = { ...blankPolicy(category), clientId: match?.id || p.clientId, ...rest };
        if (!rest.endDate && rest.startDate) n.endDate = autoEnd(rest.startDate);
        if (category === 'motor' && !rest.netPremium) n.netPremium = num(n.odPremium) + num(n.tpPremium) || '';
        return n;
      });
      if (match) setClientMode('pick');
      else if (client.name) {
        setClientMode('new');
        setNc({ name: '', phone: '', email: '', address: '', dob: '', ...client });
      }
      setCommManual(false);
      setScan({ status: 'done', file: file.name, count, missing, text, matched: match?.name });
      setMode('manual');
    } catch (e) {
      setScan({ status: 'error', msg: e?.message || 'Could not read this PDF. Please enter the details manually.' });
    }
  }

  const isMotor = f.category === 'motor';
  const showOD = isMotor && f.coverType !== 'Third Party';
  const showTP = isMotor && f.coverType !== 'Standalone OD';

  const set = (name, value) =>
    setF((p) => {
      const n = { ...p, [name]: value };
      if (name === 'startDate' && (!p.endDate || p.endDate === autoEnd(p.startDate))) n.endDate = autoEnd(value);
      if (name === 'coverType') {
        if (value === 'Third Party') n.odPremium = '';
        if (value === 'Standalone OD') n.tpPremium = '';
      }
      if (n.category === 'motor' && ['odPremium', 'tpPremium', 'coverType'].includes(name))
        n.netPremium = num(n.odPremium) + num(n.tpPremium) || '';
      return n;
    });

  const switchCategory = (category) =>
    setF((p) => ({
      ...blankPolicy(category),
      clientId: p.clientId, insurer: p.insurer, policyNumber: p.policyNumber, product: p.product,
      startDate: p.startDate, endDate: p.endDate, issueDate: p.issueDate, businessType: p.businessType,
      notes: p.notes, gstRate: defaultGst(category),
    }));

  const net = num(f.netPremium);
  const gstAmount = Math.round((net * num(f.gstRate)) / 100);
  const total = net + gstAmount;
  const commBase = isMotor && f.commissionBase === 'od' ? num(f.odPremium) : net;
  const autoComm = Math.round((commBase * num(f.commissionRate)) / 100);
  const commission = commManual ? num(f.commissionAmount) : autoComm;

  const fields = useMemo(() => FIELDS[f.category].filter((d) => !d.hide?.(f)), [f]);

  async function submit() {
    setError('');
    if (clientMode === 'pick' && !f.clientId) return setError('Select a client or add a new one.');
    if (clientMode === 'new' && !nc.name.trim()) return setError('Enter the new client\'s name.');
    if (!f.insurer.trim()) return setError('Enter the insurance company.');
    if (!f.startDate || !f.endDate) return setError('Start date and end date are required.');
    if (f.endDate < f.startDate) return setError('End date cannot be before the start date.');
    if (!net) return setError('Enter the premium amount.');

    setBusy(true);
    try {
      let clientId = f.clientId;
      if (clientMode === 'new')
        clientId = await add('clients', { name: nc.name.trim(), phone: nc.phone.trim(), email: nc.email.trim(), address: (nc.address || '').trim(), dob: nc.dob || '', source: lead?.source || '' });

      const row = { ...f, clientId };
      FIELDS[f.category].forEach((d) => {
        if (d.type === 'number' && row[d.name] !== '' && row[d.name] != null) row[d.name] = num(row[d.name]);
      });
      Object.assign(row, {
        netPremium: net, odPremium: num(f.odPremium), tpPremium: num(f.tpPremium), gstRate: num(f.gstRate),
        gstAmount, totalPremium: total, commissionRate: num(f.commissionRate), commissionAmount: commission,
      });

      if (editing) {
        await save('policies', policy.id, row);
        toast('Policy updated');
      } else {
        const id = await add('policies', row);
        if (renewFrom) await save('policies', renewFrom.id, { renewalStatus: 'renewed', renewedTo: id });
        if (lead) await save('leads', lead.id, { stage: 'won' });
        toast(renewFrom ? 'Renewal saved' : 'Policy added');
      }
      onClose();
    } catch (e) {
      setError(e?.message || 'Could not save. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="xl"
      title={editing ? 'Edit policy' : renewFrom ? 'Renew policy' : 'New policy'}
      sub={renewFrom ? 'Dates, NCB and previous-policy details are rolled forward. Update the premium.' : 'Fields adapt to the type of insurance.'}
      footer={
        <>
          {error && <p className="mr-auto text-xs font-semibold text-rose-600 dark:text-rose-400">{error}</p>}
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button icon={Save} loading={busy} disabled={mode === 'pdf'} onClick={submit}>{editing ? 'Save changes' : 'Save policy'}</Button>
        </>
      }
    >
      <div className="space-y-7">
        {/* How to add: type it in, or let the PDF fill the form */}
        {!editing && !renewFrom && (
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-subtle p-1">
            {[['manual', 'Enter manually', PencilLine], ['pdf', 'Upload policy PDF', FileUp]].map(([id, label, Icon]) => (
              <button key={id} type="button" onClick={() => setMode(id)}
                className={cx('flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-bold transition', mode === id ? 'bg-surface text-brand-strong shadow-sm' : 'text-mute hover:text-ink')}>
                <Icon className="size-4" /> {label}
              </button>
            ))}
          </div>
        )}

        {mode === 'pdf' && (
          <div>
            <button
              type="button"
              onClick={() => fileInput.current.click()}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => { e.preventDefault(); setDragging(false); readPdf(e.dataTransfer.files?.[0]); }}
              className={cx('flex w-full flex-col items-center rounded-2xl border-2 border-dashed px-6 py-12 text-center transition', dragging ? 'border-brand bg-brand-soft' : 'border-line hover:border-brand/60 hover:bg-subtle')}
            >
              <span className="bg-grad mb-4 grid size-14 place-items-center rounded-2xl text-white shadow-lg shadow-violet-600/30">
                {scan?.status === 'reading' ? <Loader2 className="size-6 animate-spin" /> : <FileUp className="size-6" />}
              </span>
              <span className="text-sm font-bold text-ink">{scan?.status === 'reading' ? `Reading ${scan.file}...` : 'Drop the policy PDF here, or tap to choose'}</span>
              <span className="mt-1 max-w-sm text-xs text-mute">Insurer, policy number, dates, vehicle details, premium and customer are picked up automatically. You review everything before saving.</span>
            </button>
            <input ref={fileInput} type="file" accept="application/pdf,.pdf" hidden onChange={(e) => { readPdf(e.target.files?.[0]); e.target.value = ''; }} />
            {scan?.status === 'error' && (
              <p className="mt-3 flex items-start gap-2 rounded-xl bg-rose-500/10 p-3 text-xs font-semibold text-rose-700 dark:text-rose-300"><AlertCircle className="mt-0.5 size-4 shrink-0" />{scan.msg}</p>
            )}
            <p className="mt-3 text-[11px] text-faint">The PDF is read on this device only and is not uploaded anywhere. Scanned or photographed policies cannot be read.</p>
          </div>
        )}

        {mode === 'manual' && scan?.status === 'done' && (
          <div className="flex items-start gap-3 rounded-xl border border-brand/30 bg-brand-soft p-3.5">
            <Sparkles className="mt-0.5 size-4 shrink-0 text-brand-strong" />
            <div className="text-xs text-brand-strong">
              <p className="font-bold">{scan.count} details filled from {scan.file}</p>
              <p className="mt-0.5 opacity-90">{scan.matched ? `Matched to existing client ${scan.matched}. ` : ''}Please check each field against the policy, add your commission, then save.</p>
              {scan.missing?.length > 0 && (
                <p className="mt-1.5 font-semibold text-amber-700 dark:text-amber-300">Not found in this PDF, please type: {scan.missing.join(', ')}</p>
              )}
              {scan.text && (
                <details className="mt-2">
                  <summary className="font-semibold">View text read from the PDF</summary>
                  <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap rounded-lg bg-surface p-3 text-[11px] text-ink">{scan.text}</pre>
                </details>
              )}
            </div>
          </div>
        )}

        {mode === 'manual' && (<>
        {/* Category */}
        {!editing && !renewFrom && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {CATEGORIES.map((c) => {
              const Icon = CAT_ICON[c.id];
              const active = f.category === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => switchCategory(c.id)}
                  className={cx(
                    'flex items-center gap-2.5 rounded-xl border p-3 text-left text-sm font-bold transition',
                    active ? 'border-brand bg-brand-soft text-brand-strong ring-2 ring-brand/20' : 'border-line text-mute hover:bg-subtle',
                  )}
                >
                  <Icon className="size-5" />
                  {c.label}
                </button>
              );
            })}
          </div>
        )}

        <Section title="Customer">
          {clientMode === 'pick' ? (
            <ClientPicker
              clients={clients}
              value={f.clientId}
              onChange={(id) => set('clientId', id)}
              onNew={(name) => { setNc((p) => ({ ...p, name })); setClientMode('new'); }}
            />
          ) : (
            <div className="rounded-xl border border-dashed border-brand/50 bg-brand-soft/40 p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="flex items-center gap-2 text-xs font-bold text-brand-strong"><UserPlus className="size-4" /> New client</span>
                <button type="button" className="text-xs font-semibold text-mute hover:text-ink" onClick={() => setClientMode('pick')}>Pick existing instead</button>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Full name" required><Input value={nc.name} onChange={(e) => setNc({ ...nc, name: e.target.value })} autoFocus /></Field>
                <Field label="Mobile"><Input type="tel" inputMode="numeric" value={nc.phone} onChange={(e) => setNc({ ...nc, phone: e.target.value })} placeholder="98XXXXXXXX" /></Field>
                <Field label="Email"><Input type="email" value={nc.email} onChange={(e) => setNc({ ...nc, email: e.target.value })} /></Field>
                <Field label="Date of birth"><Input type="date" value={nc.dob || ''} onChange={(e) => setNc({ ...nc, dob: e.target.value })} /></Field>
                <Field label="Address" className="sm:col-span-2"><Input value={nc.address || ''} onChange={(e) => setNc({ ...nc, address: e.target.value })} /></Field>
              </div>
            </div>
          )}
        </Section>

        <Section title="Policy">
          <Grid>
            <Field label="Insurance company" required>
              <Input list="pp-insurers" value={f.insurer} onChange={(e) => set('insurer', e.target.value)} placeholder="Start typing..." />
              <datalist id="pp-insurers">{INSURERS.map((i) => <option key={i} value={i} />)}</datalist>
            </Field>
            <Field label="Policy number"><Input value={f.policyNumber} onChange={(e) => set('policyNumber', e.target.value)} /></Field>
            {!isMotor && <Field label="Product / plan name"><Input value={f.product || ''} onChange={(e) => set('product', e.target.value)} /></Field>}
            <Field label="Business type">
              <Select value={f.businessType} onChange={(e) => set('businessType', e.target.value)}>
                {['New', 'Renewal', 'Rollover / Port'].map((o) => <option key={o}>{o}</option>)}
              </Select>
            </Field>
            <Field label="Start date" required><Input type="date" value={f.startDate} onChange={(e) => set('startDate', e.target.value)} /></Field>
            <Field label={f.category === 'life' ? 'Next premium due date' : 'End date (expiry)'} required hint="Drives renewal reminders">
              <Input type="date" value={f.endDate} onChange={(e) => set('endDate', e.target.value)} />
            </Field>
            <Field label="Issue date" hint="Counted as the sale date"><Input type="date" value={f.issueDate || ''} onChange={(e) => set('issueDate', e.target.value)} /></Field>
          </Grid>
        </Section>

        <Section title={isMotor ? 'Vehicle and cover' : 'Cover details'}>
          <Grid>
            {fields.map((d) => (
              <DynField key={d.name} def={d} value={f[d.name]} onChange={(v) => set(d.name, v)} />
            ))}
          </Grid>
        </Section>

        <Section title="Premium and commission">
          <Grid>
            {showOD && <Field label="OD premium"><Money value={f.odPremium} onChange={(v) => set('odPremium', v)} /></Field>}
            {showTP && <Field label="TP premium" hint="Include PA owner-driver"><Money value={f.tpPremium} onChange={(v) => set('tpPremium', v)} /></Field>}
            <Field label="Net premium" required hint={isMotor ? 'OD + TP, before GST' : 'Before GST'}>
              <Money value={f.netPremium} onChange={(v) => set('netPremium', v)} />
            </Field>
            <Field label="GST %" hint={defaultGst(f.category) === 0 ? 'Individual health and life are GST exempt' : undefined}>
              <Input type="number" inputMode="decimal" value={f.gstRate} onChange={(e) => set('gstRate', e.target.value)} />
            </Field>
            <Field label="Payment mode">
              <Select value={f.paymentMode} onChange={(e) => set('paymentMode', e.target.value)}>
                {['Online', 'Cheque', 'Cash', 'UPI', 'EMI / Auto-debit'].map((o) => <option key={o}>{o}</option>)}
              </Select>
            </Field>
            <Field label="Commission %">
              <Input type="number" inputMode="decimal" value={f.commissionRate} onChange={(e) => { setCommManual(false); set('commissionRate', e.target.value); }} placeholder="15" />
            </Field>
            {isMotor && (
              <Field label="Commission paid on">
                <Select value={f.commissionBase} onChange={(e) => { setCommManual(false); set('commissionBase', e.target.value); }}>
                  <option value="net">Net premium (OD + TP)</option>
                  <option value="od">OD premium only</option>
                </Select>
              </Field>
            )}
            <Field label="Commission earned" hint={commManual ? 'Manually entered' : 'Auto-calculated, type to override'}>
              <Money value={commManual ? f.commissionAmount : autoComm || ''} onChange={(v) => { setCommManual(true); set('commissionAmount', v); }} />
            </Field>
            <Field label="Commission status">
              <Select value={f.commissionStatus} onChange={(e) => set('commissionStatus', e.target.value)}>
                <option>Pending</option>
                <option>Received</option>
              </Select>
            </Field>
          </Grid>

          <div className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-4">
            {[['Net premium', net], ['GST', gstAmount], ['Total payable', total], ['Your commission', commission]].map(([label, value], i) => (
              <div key={label} className={cx('bg-subtle px-4 py-3', i === 3 && 'bg-brand-soft')}>
                <p className="text-[11px] font-semibold text-mute">{label}</p>
                <p className={cx('tnum text-base font-bold', i === 3 ? 'text-brand-strong' : 'text-ink')}>{inr(value)}</p>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Notes and documents">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Notes"><Textarea value={f.notes || ''} onChange={(e) => set('notes', e.target.value)} placeholder="Anything to remember at renewal" /></Field>
            <Field label="Policy document link" hint="Paste a Google Drive or insurer portal link to the PDF">
              <Input type="url" value={f.docLink || ''} onChange={(e) => set('docLink', e.target.value)} placeholder="https://" />
            </Field>
          </div>
        </Section>
        </>)}
      </div>
    </Modal>
  );
}

const Section = ({ title, children }) => (
  <section>
    <h3 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-faint">{title}</h3>
    {children}
  </section>
);
const Grid = ({ children }) => <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>;

function Money({ value, onChange }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-faint">₹</span>
      <Input type="number" inputMode="decimal" min="0" className="pl-7" value={value ?? ''} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function DynField({ def, value, onChange }) {
  const wrap = def.full ? 'sm:col-span-2 lg:col-span-3' : '';
  if (def.type === 'chips') {
    const list = value || [];
    return (
      <Field label={def.label} className={wrap}>
        <div className="flex flex-wrap gap-2">
          {def.options.map((o) => {
            const on = list.includes(o);
            return (
              <button
                key={o}
                type="button"
                onClick={() => onChange(on ? list.filter((x) => x !== o) : [...list, o])}
                className={cx(
                  'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition',
                  on ? 'border-brand bg-brand-soft text-brand-strong' : 'border-line text-mute hover:bg-subtle',
                )}
              >
                {on && <Check className="size-3.5" />}
                {o}
              </button>
            );
          })}
        </div>
      </Field>
    );
  }
  return (
    <Field label={def.label} hint={def.hint} className={wrap}>
      {def.type === 'select' ? (
        <Select value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
          <option value="">Select</option>
          {def.options.map((o) => <option key={o} value={o}>{def.name === 'ncb' ? `${o}%` : o}</option>)}
        </Select>
      ) : def.type === 'textarea' ? (
        <Textarea value={value ?? ''} placeholder={def.placeholder} onChange={(e) => onChange(e.target.value)} />
      ) : def.money ? (
        <Money value={value} onChange={onChange} />
      ) : (
        <Input
          type={def.type}
          inputMode={def.type === 'number' ? 'decimal' : undefined}
          value={value ?? ''}
          placeholder={def.placeholder}
          className={def.upper ? 'uppercase placeholder:normal-case' : ''}
          onChange={(e) => onChange(def.upper ? e.target.value.toUpperCase() : e.target.value)}
        />
      )}
    </Field>
  );
}

function ClientPicker({ clients, value, onChange, onNew }) {
  const [q, setQ] = useState('');
  const selected = clients.find((c) => c.id === value);
  if (selected)
    return (
      <div className="flex items-center gap-3 rounded-xl border border-line bg-subtle p-3">
        <Avatar name={selected.name} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-ink">{selected.name}</p>
          <p className="truncate text-xs text-mute">{[selected.phone, selected.email].filter(Boolean).join(' · ') || 'No contact details'}</p>
        </div>
        <Button variant="ghost" size="sm" icon={X} onClick={() => onChange('')}>Change</Button>
      </div>
    );

  const term = q.trim().toLowerCase();
  const matches = clients.filter((c) => !term || c.name?.toLowerCase().includes(term) || c.phone?.includes(term)).slice(0, 6);
  return (
    <div className="rounded-xl border border-line">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search client by name or mobile"
          className="h-11 w-full rounded-t-xl bg-transparent pl-9 pr-3 text-base text-ink placeholder:text-faint focus:outline-none sm:text-sm"
        />
      </div>
      <div className="max-h-52 overflow-y-auto border-t border-line">
        {matches.map((c) => (
          <button key={c.id} type="button" onClick={() => onChange(c.id)} className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-subtle">
            <Avatar name={c.name} className="size-8 text-[10px]" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-ink">{c.name}</span>
              <span className="block truncate text-xs text-mute">{c.phone || c.email || '-'}</span>
            </span>
          </button>
        ))}
        <button type="button" onClick={() => onNew(q.trim())} className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm font-bold text-brand-strong hover:bg-brand-soft">
          <span className="grid size-8 place-items-center rounded-full bg-brand-soft"><UserPlus className="size-4" /></span>
          {term ? `Add "${q.trim()}" as a new client` : 'Add a new client'}
        </button>
      </div>
    </div>
  );
}
