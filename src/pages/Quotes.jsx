import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Plus, Scale, Trash2, Save, FileDown, MessageCircle, Star, BadgeCheck, Copy, Share2, X, FileUp, Loader2, CheckCircle2, AlertCircle,
} from 'lucide-react';
import { useData } from '../context/DataContext';
import { usePolicyForm } from '../components/PolicyForm';
import { Badge, Button, Card, Confirm, Empty, Field, IconTile, Input, Modal, PageHeader, Segmented, Select, Textarea, useToast } from '../components/ui';
import { CAT_ICON, CAT_TONE, catIcon } from '../components/icons';
import { CATEGORIES, INSURERS, catLabel, defaultGst } from '../lib/constants';
import { buildQuotePdf, cheapest, coverLabel, optionTotal, quoteText } from '../lib/quotePdf';
import { addDays, cx, fmtDate, inr, num, todayISO, waLink } from '../lib/utils';

const STATUSES = [
  { id: 'draft', label: 'Draft', tone: 'gray' },
  { id: 'sent', label: 'Sent', tone: 'blue' },
  { id: 'won', label: 'Won', tone: 'green' },
  { id: 'lost', label: 'Lost', tone: 'red' },
];
const blankOption = (category) => ({ insurer: '', plan: '', cover: '', premium: '', gstRate: defaultGst(category), features: '', recommended: false });

export default function Quotes() {
  const { quotes, clientById } = useData();
  const [view, setView] = useState('open');
  const [editing, setEditing] = useState(null);
  const location = useLocation();
  const navigate = useNavigate();

  // A calculator can send a ready-made comparison here ("Create quote").
  useEffect(() => {
    const prefill = location.state?.prefill;
    if (!prefill) return;
    setEditing({
      ...prefill,
      options: (prefill.options || []).length
        ? [...prefill.options, ...Array(Math.max(0, 3 - prefill.options.length)).fill(null).map(() => blankOption(prefill.category || 'motor'))]
        : undefined,
    });
    navigate('/quotes', { replace: true, state: null });
  }, [location.state, navigate]);

  const rows = useMemo(
    () =>
      [...quotes]
        .filter((q) => (view === 'open' ? ['draft', 'sent'].includes(q.status || 'draft') : view === 'all' ? true : q.status === view))
        .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')),
    [quotes, view],
  );
  const count = (fn) => quotes.filter(fn).length;

  return (
    <>
      <PageHeader title="Quotes" sub="Compare insurers side by side and send a branded comparison.">
        <Button icon={Plus} onClick={() => setEditing({})}>New comparison</Button>
      </PageHeader>

      <Segmented
        value={view}
        onChange={setView}
        className="mb-4 w-fit"
        options={[
          { id: 'open', label: 'Open', count: count((q) => ['draft', 'sent'].includes(q.status || 'draft')) },
          { id: 'won', label: 'Won', count: count((q) => q.status === 'won') },
          { id: 'lost', label: 'Lost', count: count((q) => q.status === 'lost') },
          { id: 'all', label: 'All' },
        ]}
      />

      {!rows.length ? (
        <Card>
          <Empty icon={Scale} title={quotes.length ? 'Nothing in this view' : 'No comparisons yet'} text="Enter quotes from 2 to 5 insurers for a customer, then send a clean PDF or WhatsApp comparison instead of a handwritten sheet.">
            <Button icon={Plus} onClick={() => setEditing({})}>New comparison</Button>
          </Empty>
        </Card>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {rows.map((q) => {
            const customer = q.clientId ? clientById(q.clientId) : q.customer;
            const opts = (q.options || []).filter((o) => o.insurer);
            const best = opts.find((o) => o.recommended) || cheapest(opts);
            const st = STATUSES.find((s) => s.id === (q.status || 'draft'));
            return (
              <Card key={q.id} className="cursor-pointer p-4 transition hover:border-brand/40" onClick={() => setEditing(q)}>
                <div className="flex items-start gap-3">
                  <IconTile icon={catIcon(q.category)} tone={CAT_TONE[q.category]} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-ink">{customer?.name || 'Customer'}</p>
                    <p className="truncate text-xs text-mute">{catLabel(q.category)}{q.title ? ` · ${q.title}` : ''}</p>
                    <p className="text-[11px] text-faint">{fmtDate(q.date)} · {opts.length} insurer{opts.length === 1 ? '' : 's'}</p>
                  </div>
                  <Badge tone={st.tone}>{st.label}</Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {opts.map((o, i) => (
                    <span key={i} className={cx('rounded-full px-2.5 py-1 text-[11px] font-semibold', o === best ? 'bg-brand-soft text-brand-strong' : 'bg-subtle text-mute')}>
                      {o.insurer} · {inr(optionTotal(o))}
                    </span>
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {editing && <QuoteEditor quote={editing} onClose={() => setEditing(null)} />}
    </>
  );
}

function QuoteEditor({ quote, onClose }) {
  const { clients, clientById, profile, add, save, del } = useData();
  const openPolicy = usePolicyForm();
  const toast = useToast();
  const initialCategory = quote.category || 'motor';
  const [q, setQ] = useState({
    category: initialCategory, clientId: '', customer: { name: '', phone: '' }, title: '', details: '', notes: '',
    date: todayISO(), validTill: addDays(todayISO(), 7), status: 'draft',
    ...quote,
    options: quote.options?.length ? quote.options : [blankOption(initialCategory), blankOption(initialCategory), blankOption(initialCategory)],
  });
  const [busy, setBusy] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [id, setId] = useState(quote.id || null);
  const [uploads, setUploads] = useState([]); // [{ name, status: 'reading' | 'done' | 'error', note }]
  const quoteFiles = useRef(null);
  const qRef = useRef(null);

  // Read each insurer's quotation PDF into the next empty column.
  async function readQuotes(files) {
    const list = [...files].filter((f) => /\.pdf$/i.test(f.name) || f.type === 'application/pdf');
    if (!list.length) return toast('Please choose PDF files', 'error');
    setUploads((u) => [...u, ...list.map((f) => ({ name: f.name, status: 'reading' }))]);
    const { extractQuote } = await import('../lib/pdfExtract');
    let work = qRef.current; // working copy, so several files fill successive columns
    for (const file of list) {
      let note;
      let status = 'done';
      try {
        const r = await extractQuote(file);
        const options = [...work.options];
        let slot = options.findIndex((o) => !o.insurer && !num(o.premium));
        if (slot < 0 && options.length < 5) {
          options.push(blankOption(work.category));
          slot = options.length - 1;
        }
        if (slot < 0) {
          status = 'error';
          note = 'All 5 columns are full';
        } else {
          options[slot] = { ...options[slot], ...Object.fromEntries(Object.entries(r.option).filter(([, v]) => v !== '' && v != null)) };
          const first = !work.options.some((x) => x.insurer);
          work = {
            ...work,
            options,
            category: first && r.category ? r.category : work.category,
            title: work.title || r.title,
            customer: !work.clientId && !work.customer?.name && r.customer.name ? r.customer : work.customer,
          };
          setQ(work);
          note = r.missing.length ? `${r.option.insurer || 'Read'}: please type ${r.missing.join(', ')}` : `${r.option.insurer} added`;
        }
      } catch (e) {
        status = 'error';
        note = e.message || 'Could not read this PDF';
      }
      setUploads((u) => u.map((x) => (x.name === file.name && x.status === 'reading' ? { ...x, status, note } : x)));
    }
  }

  qRef.current = q;
  const customer = q.clientId ? clientById(q.clientId) || {} : q.customer;
  const set = (k, v) => setQ((s) => ({ ...s, [k]: v }));
  const setOpt = (i, k, v) =>
    setQ((s) => ({
      ...s,
      options: s.options.map((o, j) => (j === i ? { ...o, [k]: v } : k === 'recommended' && v ? { ...o, recommended: false } : o)),
    }));
  const filled = q.options.filter((o) => o.insurer && num(o.premium) > 0);
  const best = filled.find((o) => o.recommended) || cheapest(filled);

  const validate = () => {
    if (!customer?.name) return 'Choose a client or type the customer name.';
    if (filled.length < 1) return 'Enter at least one insurer with its premium.';
    return '';
  };

  async function persist(extra = {}) {
    const row = {
      ...q, ...extra,
      options: q.options.filter((o) => o.insurer).map((o) => ({ ...o, cover: num(o.cover), premium: num(o.premium), gstRate: num(o.gstRate) })),
    };
    delete row.id;
    if (id) await save('quotes', id, row);
    else setId(await add('quotes', row));
    setQ((s) => ({ ...s, ...extra }));
  }

  const run = async (key, fn) => {
    const err = validate();
    if (err) return toast(err, 'error');
    setBusy(key);
    try { await fn(); } catch (e) { toast(e.message || 'Something went wrong', 'error'); } finally { setBusy(''); }
  };

  const savePdf = () =>
    run('pdf', async () => {
      await persist({ status: q.status === 'draft' ? 'sent' : q.status });
      const doc = await buildQuotePdf(q, customer, profile);
      const name = `quote-${(customer.name || 'customer').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-${q.date}.pdf`;
      const file = new File([doc.output('blob')], name, { type: 'application/pdf' });
      // On phones, open the share sheet so the PDF can go straight into WhatsApp.
      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: 'Insurance quote comparison' });
          return toast('Quote shared');
        } catch (e) {
          if (e?.name === 'AbortError') return;
        }
      }
      doc.save(name);
      toast('Quote PDF downloaded');
    });

  const sendWhatsApp = () =>
    run('wa', async () => {
      await persist({ status: q.status === 'draft' ? 'sent' : q.status });
      const text = quoteText(q, customer, profile);
      window.open(customer.phone ? waLink(customer.phone, text) : `https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
    });

  const markWon = () =>
    run('won', async () => {
      const chosen = best;
      await persist({ status: 'won', wonInsurer: chosen.insurer });
      onClose();
      const preset = {
        category: q.category, insurer: chosen.insurer, product: chosen.plan, netPremium: num(chosen.premium), gstRate: num(chosen.gstRate),
        ...(q.clientId ? { clientId: q.clientId } : {}),
        ...(q.category === 'motor' ? { idv: num(chosen.cover) || '' } : { sumInsured: num(chosen.cover) || '' }),
      };
      openPolicy(q.clientId ? { preset } : { preset, newClient: { name: customer.name, phone: customer.phone || '' } });
      toast('Quote won. Complete the policy details.');
    });

  return (
    <>
      <Modal
        open
        onClose={onClose}
        size="xl"
        title={quote.id ? 'Quote comparison' : 'New quote comparison'}
        sub="Fill what you have. Only insurers with a premium are shown to the customer."
        footer={
          <>
            {id && <Button variant="ghost" icon={Trash2} className="mr-auto text-rose-600 dark:text-rose-400" onClick={() => setConfirm(true)}>Delete</Button>}
            <Button variant="secondary" icon={Save} loading={busy === 'save'} onClick={() => run('save', async () => { await persist(); toast('Quote saved'); })}>Save</Button>
            <Button variant="whatsapp" icon={MessageCircle} loading={busy === 'wa'} onClick={sendWhatsApp}>WhatsApp</Button>
            <Button variant="secondary" icon={navigator.canShare ? Share2 : FileDown} loading={busy === 'pdf'} onClick={savePdf}>PDF</Button>
            {q.status !== 'won' && <Button icon={BadgeCheck} loading={busy === 'won'} onClick={markWon}>Customer chose {best?.insurer ? best.insurer.split(' ')[0] : 'one'}</Button>}
          </>
        }
      >
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {CATEGORIES.map((c) => {
              const Icon = CAT_ICON[c.id];
              const active = q.category === c.id;
              return (
                <button key={c.id} type="button" onClick={() => setQ((s) => ({ ...s, category: c.id, options: s.options.map((o) => ({ ...o, gstRate: o.premium ? o.gstRate : defaultGst(c.id) })) }))}
                  className={cx('flex items-center gap-2.5 rounded-xl border p-3 text-sm font-bold transition', active ? 'border-brand bg-brand-soft text-brand-strong ring-2 ring-brand/20' : 'border-line text-mute hover:bg-subtle')}>
                  <Icon className="size-5" /> {c.label}
                </button>
              );
            })}
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Existing client">
              <Select value={q.clientId} onChange={(e) => set('clientId', e.target.value)}>
                <option value="">New customer (type below)</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </Field>
            {!q.clientId && (
              <>
                <Field label="Customer name" required><Input value={q.customer?.name || ''} onChange={(e) => set('customer', { ...q.customer, name: e.target.value })} /></Field>
                <Field label="Mobile"><Input type="tel" inputMode="numeric" value={q.customer?.phone || ''} onChange={(e) => set('customer', { ...q.customer, phone: e.target.value })} /></Field>
              </>
            )}
            <Field label={q.category === 'motor' ? 'Vehicle' : 'Requirement'} className={q.clientId ? 'sm:col-span-2' : ''}>
              <Input value={q.title} onChange={(e) => set('title', e.target.value)} placeholder={q.category === 'motor' ? 'Hyundai Creta SX, MH12AB1234' : 'Family floater for 4, 10 lakh'} />
            </Field>
            <Field label="Quote date"><Input type="date" value={q.date} onChange={(e) => set('date', e.target.value)} /></Field>
            <Field label="Valid till"><Input type="date" value={q.validTill} onChange={(e) => set('validTill', e.target.value)} /></Field>
            <Field label="Details for the customer" className="sm:col-span-3">
              <Textarea rows={2} value={q.details} onChange={(e) => set('details', e.target.value)} placeholder="NCB 25%, no claim last year; or members' ages and pre-existing conditions" />
            </Field>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-faint">Insurer quotes</h3>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" icon={FileUp} onClick={() => quoteFiles.current.click()}>Upload quote PDFs</Button>
                {q.options.length < 5 && <Button size="sm" variant="soft" icon={Plus} onClick={() => set('options', [...q.options, blankOption(q.category)])}>Add insurer</Button>}
              </div>
              <input ref={quoteFiles} type="file" accept="application/pdf,.pdf" multiple hidden onChange={(e) => { readQuotes(e.target.files || []); e.target.value = ''; }} />
            </div>
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); readQuotes(e.dataTransfer.files || []); }}
              className="mb-3 rounded-2xl border-2 border-dashed border-line px-4 py-3 text-center text-xs text-mute"
            >
              Drop insurer quote PDFs here (up to 5, one insurer each). Insurer, plan, {coverLabel(q.category)}, premium, GST and add-ons are filled in for you.
            </div>
            {uploads.length > 0 && (
              <ul className="mb-3 space-y-1">
                {uploads.map((u, i) => (
                  <li key={i} className={cx('flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs', u.status === 'error' ? 'bg-rose-500/10 text-rose-700 dark:text-rose-300' : u.status === 'done' ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'bg-subtle text-mute')}>
                    {u.status === 'reading' ? <Loader2 className="size-3.5 animate-spin" /> : u.status === 'done' ? <CheckCircle2 className="size-3.5" /> : <AlertCircle className="size-3.5" />}
                    <span className="truncate font-semibold">{u.name}</span>
                    <span className="truncate">{u.status === 'reading' ? 'Reading...' : u.note}</span>
                  </li>
                ))}
              </ul>
            )}
            <datalist id="pp-quote-insurers">{INSURERS.map((i) => <option key={i} value={i} />)}</datalist>
            <div className="grid gap-3 lg:grid-cols-2">
              {q.options.map((o, i) => {
                const isBest = o === best;
                return (
                  <div key={i} className={cx('rounded-2xl border p-4', isBest ? 'border-brand bg-brand-soft/40 ring-2 ring-brand/15' : 'border-line')}>
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-xs font-bold text-ink">Option {i + 1}{isBest && <span className="text-brand-strong"> · {o.recommended ? 'Recommended' : 'Lowest price'}</span>}</span>
                      <div className="flex items-center gap-1">
                        <button type="button" title="Mark as recommended" onClick={() => setOpt(i, 'recommended', !o.recommended)} className={cx('grid size-8 place-items-center rounded-lg', o.recommended ? 'text-amber-500' : 'text-faint hover:text-ink')}>
                          <Star className={cx('size-4', o.recommended && 'fill-current')} />
                        </button>
                        {q.options.length > 1 && (
                          <button type="button" title="Remove" onClick={() => set('options', q.options.filter((_, j) => j !== i))} className="grid size-8 place-items-center rounded-lg text-faint hover:text-rose-600"><X className="size-4" /></button>
                        )}
                      </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="Insurer"><Input list="pp-quote-insurers" value={o.insurer} onChange={(e) => setOpt(i, 'insurer', e.target.value)} placeholder="Start typing..." /></Field>
                      <Field label="Plan"><Input value={o.plan} onChange={(e) => setOpt(i, 'plan', e.target.value)} /></Field>
                      <Field label={coverLabel(q.category)}><Input type="number" inputMode="decimal" value={o.cover} onChange={(e) => setOpt(i, 'cover', e.target.value)} /></Field>
                      <Field label="Premium before GST"><Input type="number" inputMode="decimal" value={o.premium} onChange={(e) => setOpt(i, 'premium', e.target.value)} /></Field>
                      <Field label="GST %"><Input type="number" inputMode="decimal" value={o.gstRate} onChange={(e) => setOpt(i, 'gstRate', e.target.value)} /></Field>
                      <div className="flex items-end">
                        <p className="w-full rounded-xl bg-subtle px-3 py-2.5 text-xs text-mute">Total <b className="tnum block text-base text-ink">{inr(optionTotal(o))}</b></p>
                      </div>
                      <Field label="Key benefits" className="sm:col-span-2">
                        <Input value={o.features} onChange={(e) => setOpt(i, 'features', e.target.value)} placeholder="Zero dep, RSA, cashless garages 6,000+" />
                      </Field>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-[1fr_200px]">
            <Field label="Your advice (shown on the comparison)">
              <Textarea rows={2} value={q.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Why you recommend this option" />
            </Field>
            <Field label="Status">
              <Select value={q.status} onChange={(e) => set('status', e.target.value)}>
                {STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </Select>
            </Field>
          </div>

          {filled.length > 0 && (
            <details className="rounded-xl border border-line p-3 text-xs">
              <summary className="font-semibold text-ink">Preview WhatsApp message</summary>
              <pre className="mt-2 whitespace-pre-wrap font-sans text-mute">{quoteText(q, customer || {}, profile)}</pre>
              <button className="mt-2 flex items-center gap-1 font-bold text-brand-strong" onClick={() => navigator.clipboard?.writeText(quoteText(q, customer || {}, profile)).then(() => toast('Copied'))}>
                <Copy className="size-3.5" /> Copy text
              </button>
            </details>
          )}
        </div>
      </Modal>
      <Confirm open={confirm} onClose={() => setConfirm(false)} title="Delete this comparison?" text="This cannot be undone."
        onConfirm={async () => { await del('quotes', id); toast('Quote deleted'); onClose(); }} />
    </>
  );
}

