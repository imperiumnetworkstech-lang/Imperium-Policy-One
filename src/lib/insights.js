// Turns the agent's book into a list of concrete, actionable gaps.
import { isLive, isRenewable, policyStatus, totalPremium, policyTitle } from './constants';
import { daysUntil, daysToAnnual, num } from './utils';
import { householdSummary } from './family';

export function buildInsights({ policies, clients, leads }) {
  const out = [];
  const byClient = new Map();
  policies.forEach((p) => {
    if (!byClient.has(p.clientId)) byClient.set(p.clientId, []);
    byClient.get(p.clientId).push(p);
  });
  const add = (group, item) => out.push({ group, ...item });

  clients.forEach((c) => {
    const all = byClient.get(c.id) || [];
    const live = all.filter(isLive);
    const cats = new Set(live.map((p) => p.category));

    if (live.length) {
      if (!cats.has('health'))
        add('cross', { key: `h-${c.id}`, clientId: c.id, title: `${c.name} has no health cover with you`, detail: `Holds ${[...cats].length ? [...cats].map(label).join(', ') : 'no'} cover. Pitch a family floater.`, pitch: 'health' });
      if (!cats.has('life') && (cats.has('health') || cats.has('motor')))
        add('cross', { key: `l-${c.id}`, clientId: c.id, title: `${c.name} has no life / term plan`, detail: 'Existing customer with protection gap. Pitch a term plan.', pitch: 'life' });
      if (!cats.has('motor') && cats.has('health'))
        add('cross', { key: `m-${c.id}`, clientId: c.id, title: `${c.name} has no motor policy with you`, detail: 'Ask for vehicle renewal dates and quote before expiry.', pitch: 'motor' });
    }

    if (all.length && !live.length)
      add('winback', { key: `w-${c.id}`, clientId: c.id, title: `${c.name} has no active policy`, detail: `${all.length} past ${all.length === 1 ? 'policy' : 'policies'} lapsed or lost. Worth a win-back call.` });

    if (!c.phone || !c.email || !c.dob) {
      const missing = [!c.phone && 'phone', !c.email && 'email', !c.dob && 'date of birth'].filter(Boolean);
      add('data', { key: `d-${c.id}`, clientId: c.id, title: `${c.name}: missing ${missing.join(', ')}`, detail: 'Complete the profile so reminders and greetings can reach them.' });
    }

    const bd = daysToAnnual(c.dob);
    if (bd != null && bd <= 7)
      add('moments', { key: `b-${c.id}`, clientId: c.id, title: `${c.name}'s birthday ${bd === 0 ? 'is today' : `in ${bd} day${bd === 1 ? '' : 's'}`}`, detail: 'A greeting keeps you top of mind before the next renewal.' });
  });

  policies.forEach((p) => {
    const st = policyStatus(p);
    const client = clients.find((c) => c.id === p.clientId);
    const who = client?.name || 'Client';

    if (st === 'expired') {
      const d = Math.abs(daysUntil(p.endDate));
      add('renewal', { key: `x-${p.id}`, policyId: p.id, clientId: p.clientId, value: totalPremium(p), title: `${who}: ${policyTitle(p)} expired ${d} day${d === 1 ? '' : 's'} ago`, detail: p.category === 'motor' && d <= 90 ? `NCB is retained only within 90 days of expiry. ${90 - d} days left.` : 'Renew it or mark it lost so your retention numbers stay honest.' });
    }

    if (isLive(p) && p.category === 'health' && num(p.sumInsured) > 0 && num(p.sumInsured) < 500000)
      add('upsell', { key: `u-${p.id}`, policyId: p.id, clientId: p.clientId, title: `${who} is under-insured on health`, detail: `Sum insured is only ₹${num(p.sumInsured).toLocaleString('en-IN')}. Suggest a super top-up or upgrade at renewal.` });

    if (isLive(p) && p.category === 'motor' && p.coverType !== 'Third Party' && !(p.addons || []).includes('Zero Depreciation')) {
      const age = new Date().getFullYear() - num(p.mfgYear);
      if (num(p.mfgYear) && age <= 5)
        add('upsell', { key: `z-${p.id}`, policyId: p.id, clientId: p.clientId, title: `${who}: ${policyTitle(p)} has no Zero Dep`, detail: `Vehicle is ${age <= 0 ? 'under a year' : age + ' yr'} old. Add Zero Depreciation at renewal.` });
    }

    if (isLive(p) && p.category === 'motor' && p.coverType === 'Third Party')
      add('upsell', { key: `t-${p.id}`, policyId: p.id, clientId: p.clientId, title: `${who}: ${policyTitle(p)} is TP only`, detail: 'Own damage is uncovered. Quote a comprehensive upgrade.' });

    if (p.commissionStatus !== 'Received' && num(p.commissionAmount) > 0 && daysUntil(p.issueDate || p.startDate) < -45)
      add('commission', { key: `c-${p.id}`, policyId: p.id, clientId: p.clientId, value: num(p.commissionAmount), title: `Commission pending from ${p.insurer || 'insurer'}`, detail: `₹${num(p.commissionAmount).toLocaleString('en-IN')} on ${who}'s ${policyTitle(p)}, issued over 45 days ago.` });
  });

  // Family gaps: a member of a household with no health or term cover.
  clients
    .filter((c) => !c.householdId && clients.some((m) => m.householdId === c.id))
    .forEach((head) => {
      const people = [head, ...clients.filter((m) => m.householdId === head.id)];
      householdSummary(people, policies).gaps.forEach((g) =>
        add('family', { key: `fam-${g.personId}-${g.line}`, clientId: g.personId, title: g.text, detail: `Part of ${head.name}'s family. Cover the whole household at once.`, pitch: g.line }),
      );
    });

  leads.forEach((l) => {
    if (['won', 'lost'].includes(l.stage)) return;
    const d = daysUntil(l.followUp);
    if (d != null && d < 0)
      add('leads', { key: `f-${l.id}`, leadId: l.id, value: num(l.expectedPremium), title: `Follow-up overdue: ${l.name}`, detail: `Was due ${Math.abs(d)} day${d === -1 ? '' : 's'} ago. Leads cool off fast.` });
  });

  return out;
}

const label = (c) => ({ motor: 'motor', health: 'health', life: 'life', non_motor: 'non-motor' })[c] || c;

export const INSIGHT_GROUPS = [
  { id: 'renewal', label: 'Renewals slipping', tone: 'red', blurb: 'Expired policies with no decision yet' },
  { id: 'cross', label: 'Cross-sell gaps', tone: 'green', blurb: 'Clients missing a line of cover' },
  { id: 'family', label: 'Family gaps', tone: 'pink', blurb: 'Household members without cover' },
  { id: 'upsell', label: 'Upsell at renewal', tone: 'violet', blurb: 'Thin cover you can strengthen' },
  { id: 'commission', label: 'Commission to chase', tone: 'amber', blurb: 'Earned but not yet received' },
  { id: 'leads', label: 'Stale leads', tone: 'blue', blurb: 'Follow-ups that are overdue' },
  { id: 'winback', label: 'Win-back', tone: 'gray', blurb: 'Clients with nothing active' },
  { id: 'moments', label: 'Moments', tone: 'blue', blurb: 'Birthdays this week' },
  { id: 'data', label: 'Data hygiene', tone: 'gray', blurb: 'Incomplete client profiles' },
];

// Share of policies that came up for renewal and were actually renewed.
export function retention(policies) {
  // A policy that expired within the last 30 days is still winnable, so it is not counted as a miss yet.
  const decided = policies.filter((p) => {
    const st = policyStatus(p);
    return st === 'renewed' || st === 'lost' || (st === 'expired' && daysUntil(p.endDate) < -30);
  });
  if (!decided.length) return null;
  const renewed = decided.filter((p) => policyStatus(p) === 'renewed').length;
  return Math.round((renewed / decided.length) * 100);
}

export const renewalBuckets = (policies) => {
  const due = policies.filter(isRenewable).map((p) => ({ p, d: daysUntil(p.endDate) })).filter((x) => x.d != null);
  return {
    overdue: due.filter((x) => x.d < 0),
    week: due.filter((x) => x.d >= 0 && x.d <= 7),
    month: due.filter((x) => x.d > 7 && x.d <= 30),
    sixty: due.filter((x) => x.d > 30 && x.d <= 60),
    ninety: due.filter((x) => x.d > 60 && x.d <= 90),
  };
};
