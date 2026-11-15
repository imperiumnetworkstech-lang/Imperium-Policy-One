// Households and referrals are both stored on the client record:
//   householdId - id of the household's main client (empty for the main client itself)
//   relation    - this person's relation to the main client
//   referredBy  - id of the client who referred this person (also used on leads)
import { isLive, totalPremium } from './constants';
import { num, parseISO, todayISO } from './utils';

export const RELATIONS = ['Spouse', 'Son', 'Daughter', 'Father', 'Mother', 'Brother', 'Sister', 'Father-in-law', 'Mother-in-law', 'Grandparent', 'Other'];

export const headIdOf = (c) => (c?.householdId ? c.householdId : c?.id);

export function householdOf(client, clients) {
  if (!client) return { head: null, members: [] };
  const headId = headIdOf(client);
  const head = clients.find((c) => c.id === headId) || client;
  const members = clients.filter((c) => c.id !== head.id && c.householdId === head.id);
  return { head, members, all: [head, ...members] };
}

export const ageOf = (dob) => {
  const d = parseISO(dob);
  if (!d) return null;
  const t = parseISO(todayISO());
  let a = t.getFullYear() - d.getFullYear();
  if (t < new Date(t.getFullYear(), d.getMonth(), d.getDate())) a -= 1;
  return a;
};

// Cover summary and gaps for one household.
export function householdSummary(people, policies) {
  const rows = people.map((p) => {
    const live = policies.filter((x) => x.clientId === p.id && isLive(x));
    return { person: p, live, cats: new Set(live.map((x) => x.category)) };
  });
  const allLive = rows.flatMap((r) => r.live);
  const anyHealth = rows.some((r) => r.cats.has('health'));
  // A family floater on one member usually covers the others, so a person counts as health-covered
  // if they hold a health policy, or a floater exists in the household.
  const floater = allLive.some((x) => x.category === 'health' && /floater/i.test(x.planType || ''));
  const gaps = [];
  rows.forEach(({ person, cats }) => {
    const age = ageOf(person.dob);
    const who = person.relation ? `${person.name} (${person.relation})` : person.name;
    if (!cats.has('health') && !floater) gaps.push({ personId: person.id, line: 'health', text: `${who} has no health cover` });
    // Term cover matters for the household's earners: the main client and their spouse, aged 18 to 60.
    const earner = !person.relation || person.relation === 'Spouse';
    if (!cats.has('life') && earner && (age == null || (age >= 18 && age <= 60)))
      gaps.push({ personId: person.id, line: 'life', text: `${who} has no life / term cover` });
  });
  return {
    rows,
    anyHealth,
    floater,
    gaps,
    premium: allLive.reduce((t, x) => t + totalPremium(x), 0),
    commission: allLive.reduce((t, x) => t + num(x.commissionAmount), 0),
    cover: allLive.reduce((t, x) => t + num(x.sumInsured || x.idv), 0),
  };
}

// One row per client who has referred at least one client or lead.
export function referralBoard(clients, leads, policies) {
  const map = new Map();
  const row = (id) => {
    if (!map.has(id)) map.set(id, { id, clients: [], leads: [], premium: 0, commission: 0 });
    return map.get(id);
  };
  clients.forEach((c) => {
    if (!c.referredBy || !clients.some((x) => x.id === c.referredBy)) return;
    const r = row(c.referredBy);
    r.clients.push(c);
    policies.filter((p) => p.clientId === c.id).forEach((p) => {
      r.premium += num(p.netPremium);
      r.commission += num(p.commissionAmount);
    });
  });
  leads.forEach((l) => {
    if (!l.referredBy || !clients.some((x) => x.id === l.referredBy)) return;
    row(l.referredBy).leads.push(l);
  });
  return [...map.values()]
    .map((r) => ({ ...r, referrer: clients.find((c) => c.id === r.id) }))
    .sort((a, b) => b.premium - a.premium || b.clients.length - a.clients.length);
}
