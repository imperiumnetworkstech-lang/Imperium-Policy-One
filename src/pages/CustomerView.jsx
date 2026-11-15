import { useEffect, useState } from 'react';
import { Phone, MessageCircle, Mail, FileText, ShieldCheck, Loader2, LinkIcon, BellRing } from 'lucide-react';
import { Avatar, Badge, IconTile } from '../components/ui';
import { CAT_TONE, catIcon } from '../components/icons';
import { fetchShare } from '../lib/share';
import { daysUntil, fmtDate, inr, waLink } from '../lib/utils';

// Public page a customer opens from their private link. No login.
function statusOf(p) {
  if (p.renewed) return { tone: 'blue', label: 'Renewed' };
  const d = daysUntil(p.endDate);
  if (d == null) return { tone: 'green', label: 'Active' };
  if (d < 0) return { tone: 'red', label: `Expired ${Math.abs(d)}d ago` };
  if (d <= 30) return { tone: 'amber', label: d === 0 ? 'Expires today' : `Renew in ${d}d` };
  return { tone: 'green', label: 'Active' };
}

// `preview` shows given data instead of fetching (used to check the page before sharing).
export default function CustomerView({ token, preview }) {
  const [state, setState] = useState({ loading: !preview, data: preview || null, error: '' });

  useEffect(() => {
    if (preview) return;
    fetchShare(token)
      .then((data) => setState({ loading: false, data, error: '' }))
      .catch((e) => setState({ loading: false, data: null, error: e?.code === 'permission-denied' ? 'missing' : 'network' }));
  }, [token, preview]);

  useEffect(() => {
    if (state.data?.customer?.name) document.title = `${state.data.customer.name} - My policies`;
  }, [state.data]);

  if (state.loading)
    return (
      <div className="grid min-h-dvh place-items-center bg-bg">
        <Loader2 className="size-6 animate-spin text-brand" />
      </div>
    );

  const { data } = state;
  if (!data)
    return (
      <div className="grid min-h-dvh place-items-center bg-bg px-5">
        <div className="w-full max-w-sm rounded-3xl border border-line bg-surface p-7 text-center shadow-card">
          <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-subtle text-mute"><LinkIcon className="size-5" /></span>
          <p className="mt-4 text-lg font-bold text-ink">{state.error === 'network' ? 'Could not load this page' : 'This link is not active'}</p>
          <p className="mt-1 text-sm text-mute">{state.error === 'network' ? 'Check your internet connection and try again.' : 'It may have been switched off. Please ask your insurance advisor for a new link.'}</p>
        </div>
      </div>
    );

  const { agent, customer, people } = data;
  const all = people.flatMap((p) => p.policies.map((x) => ({ ...x, person: p })));
  const dueSoon = all.filter((x) => !x.renewed && daysUntil(x.endDate) != null && daysUntil(x.endDate) <= 30);
  const ask = (text) => (agent.phone ? waLink(agent.phone, text) : null);

  return (
    <div className="min-h-dvh bg-bg">
      <header className="bg-grad-soft border-b border-line">
        <div className="mx-auto max-w-3xl px-5 pb-8 pt-6">
          <img src="/brand/logo-full.png" alt="Imperium PolicyOne" className="h-12 w-auto dark:hidden" />
          <img src="/brand/logo-full-dark.png" alt="Imperium PolicyOne" className="hidden h-12 w-auto dark:block" />
          <h1 className="mt-6 text-3xl font-bold text-ink">Hello, {customer.name.split(' ')[0]}</h1>
          <p className="mt-1 text-sm text-mute">
            {all.length} {all.length === 1 ? 'policy' : 'policies'}{people.length > 1 ? ` for your family of ${people.length}` : ''}, managed by your advisor.
          </p>

          {/* Advisor */}
          <div className="mt-5 flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-surface p-4">
            <Avatar name={agent.name || agent.agency} src={agent.photo} className="size-12" />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-faint">Your insurance advisor</p>
              <p className="truncate font-display text-base font-bold text-ink">{agent.name || agent.agency}</p>
              <p className="truncate text-xs text-mute">{[agent.agency !== agent.name && agent.agency, agent.licence && `Licence ${agent.licence}`].filter(Boolean).join(' · ')}</p>
            </div>
            <div className="flex gap-2">
              {agent.phone && <a href={`tel:${agent.phone}`} className="grid size-10 place-items-center rounded-full border border-line text-ink hover:bg-subtle" aria-label="Call"><Phone className="size-4" /></a>}
              {agent.phone && <a href={ask(`Hello ${agent.name || ''}, this is ${customer.name}.`)} target="_blank" rel="noreferrer" className="grid size-10 place-items-center rounded-full bg-emerald-600 text-white hover:bg-emerald-700" aria-label="WhatsApp"><MessageCircle className="size-4" /></a>}
              {agent.email && <a href={`mailto:${agent.email}`} className="grid size-10 place-items-center rounded-full border border-line text-ink hover:bg-subtle" aria-label="Email"><Mail className="size-4" /></a>}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-5 py-6">
        {dueSoon.length > 0 && (
          <div className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
            <BellRing className="mt-0.5 size-5 shrink-0 text-amber-600" />
            <div className="text-sm">
              <p className="font-bold text-ink">{dueSoon.length === 1 ? 'A policy needs renewal' : `${dueSoon.length} policies need renewal`}</p>
              <p className="text-mute">{dueSoon.map((x) => `${x.title} (${fmtDate(x.endDate)})`).join(', ')}</p>
            </div>
          </div>
        )}

        {people.map((person) => (
          <section key={person.name + person.relation}>
            {people.length > 1 && (
              <h2 className="mb-2 text-sm font-bold text-ink">{person.name}{person.relation && <span className="font-normal text-mute"> · {person.relation}</span>}</h2>
            )}
            {!person.policies.length ? (
              <p className="rounded-2xl border border-dashed border-line p-4 text-sm text-mute">No active policies.</p>
            ) : (
              <div className="space-y-3">
                {person.policies.map((p, i) => {
                  const st = statusOf(p);
                  return (
                    <article key={i} className="rounded-2xl border border-line bg-surface p-4 shadow-card">
                      <div className="flex items-start gap-3">
                        <IconTile icon={catIcon(p.category)} tone={CAT_TONE[p.category]} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-display text-[15px] font-semibold text-ink">{p.title}</p>
                          <p className="truncate text-xs text-mute">{p.type} · {p.insurer}</p>
                        </div>
                        <Badge tone={st.tone}>{st.label}</Badge>
                      </div>
                      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-4">
                        <div><dt className="text-faint">Policy no.</dt><dd className="break-all font-semibold text-ink">{p.policyNumber || '-'}</dd></div>
                        <div><dt className="text-faint">Valid till</dt><dd className="font-semibold text-ink">{fmtDate(p.endDate)}</dd></div>
                        {p.cover > 0 && <div><dt className="text-faint">{p.coverLabel}</dt><dd className="tnum font-semibold text-ink">{inr(p.cover)}</dd></div>}
                        <div><dt className="text-faint">Premium</dt><dd className="tnum font-semibold text-ink">{inr(p.premium)}</dd></div>
                        {p.sub && p.category === 'motor' && <div className="col-span-2"><dt className="text-faint">Vehicle</dt><dd className="font-semibold text-ink">{p.sub}</dd></div>}
                        {p.nominee && <div className="col-span-2"><dt className="text-faint">Nominee</dt><dd className="font-semibold text-ink">{p.nominee}</dd></div>}
                      </dl>
                      <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
                        {p.docLink && (
                          <a href={p.docLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs font-bold text-ink hover:bg-subtle">
                            <FileText className="size-3.5" /> Policy document
                          </a>
                        )}
                        {agent.phone && (
                          <a href={ask(`Hello ${agent.name || ''}, this is ${customer.name}. I have a question about my ${p.type.toLowerCase()} policy ${p.policyNumber || p.title}.`)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs font-bold text-ink hover:bg-subtle">
                            <MessageCircle className="size-3.5" /> Ask a question
                          </a>
                        )}
                        {agent.phone && st.tone !== 'green' && st.tone !== 'blue' && (
                          <a href={ask(`Hello ${agent.name || ''}, please send me the renewal quote for my ${p.type.toLowerCase()} policy ${p.policyNumber || p.title}, expiring ${fmtDate(p.endDate)}.`)} target="_blank" rel="noreferrer" className="bg-grad inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold text-white">
                            Renew now
                          </a>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        ))}

        <p className="flex items-center justify-center gap-1.5 pt-4 text-center text-[11px] text-faint">
          <ShieldCheck className="size-3.5" /> Private page for {customer.name}. Please do not share this link. {data.updatedAt ? `Last updated ${fmtDate(data.updatedAt.slice(0, 10))}.` : ''}
        </p>
      </main>
    </div>
  );
}
