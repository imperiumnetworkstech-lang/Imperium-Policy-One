// Customer self-service links.
// A customer has no login, so the link reads a separate public document, shares/{token}, holding
// only what that customer should see. The token is random and unguessable; the agent can switch
// the link off, which deletes the document. The agent's own data under users/{uid} stays private.
import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from './firebase';
import { catLabel, policyStatus, policySub, policyTitle, totalPremium } from './constants';
import { householdOf } from './family';
import { num } from './utils';

export function newShareToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export const shareUrl = (token) => `${window.location.origin}/c/${token}`;

// The published copy: the customer, their family members and every policy they hold.
export function buildShareData(client, clients, policies, profile, ownerUid) {
  const { head, all } = householdOf(client, clients);
  // Only the main member's link shows the whole family; a member's link shows just their own policies.
  const people = client.id === head.id ? all : [client];
  return {
    ownerUid,
    clientId: client.id,
    customer: { name: client.name || '' },
    agent: {
      name: profile.name || '', agency: profile.agency || '', phone: profile.phone || '', email: profile.email || '',
      licence: profile.licence || '', photo: profile.photo || '',
    },
    people: people.map((p) => ({
      name: p.name || '',
      relation: p.id === client.id ? '' : p.relation || 'Family',
      policies: policies
        .filter((x) => x.clientId === p.id && !['cancelled', 'lost'].includes(policyStatus(x)))
        .sort((a, b) => (a.endDate || '').localeCompare(b.endDate || ''))
        .map((x) => ({
          category: x.category,
          type: catLabel(x.category),
          title: policyTitle(x),
          sub: policySub(x),
          insurer: x.insurer || '',
          policyNumber: x.policyNumber || '',
          startDate: x.startDate || '',
          endDate: x.endDate || '',
          renewed: x.renewalStatus === 'renewed',
          premium: totalPremium(x),
          cover: num(x.sumInsured || x.idv),
          coverLabel: x.category === 'motor' ? 'IDV' : x.category === 'life' ? 'Sum assured' : 'Sum insured',
          nominee: x.nominee || '',
          docLink: x.docLink || '',
        })),
    })),
  };
}

export const publishShare = (token, data) => setDoc(doc(db, 'shares', token), { ...data, updatedAt: new Date().toISOString() });
export const unpublishShare = (token) => deleteDoc(doc(db, 'shares', token));
export async function fetchShare(token) {
  const snap = await getDoc(doc(db, 'shares', token));
  return snap.exists() ? snap.data() : null;
}

// Cheap fingerprint so a link is only re-published when its content actually changed.
export function fingerprint(data) {
  const s = JSON.stringify(data);
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return String(h);
}
