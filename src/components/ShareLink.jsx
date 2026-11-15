import { useState } from 'react';
import { Link2, Copy, MessageCircle, ExternalLink, Power, ShieldCheck, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { Button, Confirm, Modal, useToast } from './ui';
import { buildShareData, fingerprint, newShareToken, publishShare, shareUrl, unpublishShare } from '../lib/share';
import { waLink } from '../lib/utils';

const RULES_HELP = 'The link could not be published. Update your Firestore rules with the latest firestore.rules (it adds the "shares" section), publish them, and try again.';

export function ShareLinkPanel({ client, onClose }) {
  const { user } = useAuth();
  const { clients, policies, profile, save } = useData();
  const toast = useToast();
  const [busy, setBusy] = useState('');
  const [confirm, setConfirm] = useState(false);
  const token = client.shareToken;
  const url = token ? shareUrl(token) : '';

  const publish = async (t) => {
    const data = buildShareData(client, clients, policies, profile, user.uid);
    await publishShare(t, data);
    try { localStorage.setItem(`ipo:share:${t}`, fingerprint(data)); } catch { /* storage blocked */ }
  };

  const create = async () => {
    setBusy('create');
    const t = newShareToken();
    try {
      await publish(t);
      await save('clients', client.id, { shareToken: t });
      toast('Customer link created');
    } catch (e) {
      console.error(e);
      toast(e?.code === 'permission-denied' ? RULES_HELP : e.message || 'Could not create the link', 'error');
    } finally {
      setBusy('');
    }
  };

  const refresh = async () => {
    setBusy('refresh');
    try { await publish(token); toast('Link updated'); } catch (e) { toast(e?.code === 'permission-denied' ? RULES_HELP : e.message, 'error'); } finally { setBusy(''); }
  };

  const turnOff = async () => {
    try { await unpublishShare(token); } catch { /* already gone */ }
    await save('clients', client.id, { shareToken: '' });
    toast('Link switched off');
  };

  const message = `Dear ${client.name},\n\nYou can now see all your insurance policies, expiry dates and documents any time at this private link:\n${url}\n\nSave it for quick access. Please do not share it with others.\n\nRegards,\n${[profile.name, profile.agency].filter(Boolean).join(', ')}`;

  return (
    <>
      <Modal open onClose={onClose} size="md" title="Customer link" sub={client.name}>
        {!token ? (
          <div className="space-y-4 text-sm">
            <div className="flex gap-3 rounded-2xl bg-subtle p-4">
              <Link2 className="mt-0.5 size-5 shrink-0 text-brand" />
              <div className="text-mute">
                <p className="font-bold text-ink">A private page for {client.name}</p>
                Shows their policies{client.householdId ? '' : ' and their family\'s'}, expiry dates, cover amounts and document links, with buttons to call or WhatsApp you. No login needed. It updates automatically when you change their policies.
              </div>
            </div>
            <p className="flex gap-2 text-xs text-mute"><ShieldCheck className="size-4 shrink-0 text-emerald-600" /> The link is random and cannot be guessed. Commission and your notes are never shown. You can switch it off at any time.</p>
            <Button icon={Link2} loading={busy === 'create'} className="w-full" onClick={create}>Create link</Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2 rounded-xl border border-line bg-subtle p-2 pl-3">
              <span className="min-w-0 flex-1 truncate text-xs font-semibold text-ink">{url}</span>
              <Button size="sm" variant="secondary" icon={Copy} onClick={() => navigator.clipboard?.writeText(url).then(() => toast('Link copied'))}>Copy</Button>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {client.phone ? (
                <Button as="a" href={waLink(client.phone, message)} target="_blank" rel="noreferrer" variant="whatsapp" icon={MessageCircle}>Send on WhatsApp</Button>
              ) : (
                <Button as="a" href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer" variant="whatsapp" icon={MessageCircle}>Share on WhatsApp</Button>
              )}
              <Button as="a" href={url} target="_blank" rel="noreferrer" variant="secondary" icon={ExternalLink}>Open as customer</Button>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4">
              <p className="text-xs text-mute">Updates automatically when their policies change.</p>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" icon={RefreshCw} loading={busy === 'refresh'} onClick={refresh}>Update now</Button>
                <Button size="sm" variant="ghost" icon={Power} className="text-rose-600 dark:text-rose-400" onClick={() => setConfirm(true)}>Switch off</Button>
              </div>
            </div>
          </div>
        )}
      </Modal>
      <Confirm open={confirm} onClose={() => setConfirm(false)} title="Switch off this link?" confirmLabel="Switch off"
        text="The customer will no longer be able to open it. You can create a new link later; it will have a different address."
        onConfirm={turnOff} />
    </>
  );
}
