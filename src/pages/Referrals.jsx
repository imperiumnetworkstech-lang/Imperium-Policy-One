import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Handshake, Trophy, MessageCircle, UserCheck, Target, IndianRupee, Info } from 'lucide-react';
import { useData } from '../context/DataContext';
import { Avatar, Badge, Button, Card, CardHead, Empty, IconTile, PageHeader } from '../components/ui';
import { referralBoard } from '../lib/family';
import { cx, inr, inrShort, waLink } from '../lib/utils';

const MEDAL = ['bg-amber-400 text-amber-950', 'bg-slate-300 text-slate-800', 'bg-orange-300 text-orange-950'];

export default function Referrals() {
  const { clients, leads, policies, profile } = useData();
  const board = useMemo(() => referralBoard(clients, leads, policies), [clients, leads, policies]);

  const referredClients = board.reduce((t, r) => t + r.clients.length, 0);
  const referredLeads = board.reduce((t, r) => t + r.leads.length, 0);
  const premium = board.reduce((t, r) => t + r.premium, 0);
  const untagged = clients.filter((c) => c.source === 'Referral' && !c.referredBy);

  const thanks = (r) =>
    `Dear ${r.referrer.name},\n\nThank you for recommending me to ${r.clients.map((c) => c.name).slice(0, 3).join(', ') || 'your friends and family'}. Your trust means a lot, and I will take good care of them.\n\nIf anyone else you know needs help with insurance, I am always here.\n\nRegards,\n${[profile.name, profile.agency].filter(Boolean).join(', ')}`;

  const stats = [
    { icon: Handshake, tone: 'brand', label: 'Clients who refer', value: board.length },
    { icon: UserCheck, tone: 'green', label: 'Clients from referrals', value: referredClients },
    { icon: Target, tone: 'blue', label: 'Referred leads', value: referredLeads },
    { icon: IndianRupee, tone: 'pink', label: 'Premium from referrals', value: inrShort(premium) },
  ];

  return (
    <>
      <PageHeader title="Referrals" sub="See which clients bring you the most business, and thank them." />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="p-4">
            <IconTile icon={s.icon} tone={s.tone} className="size-9" />
            <p className="tnum mt-3 text-2xl font-bold text-ink">{s.value}</p>
            <p className="text-xs font-bold text-ink">{s.label}</p>
          </Card>
        ))}
      </div>

      {untagged.length > 0 && (
        <div className="mb-4 flex items-start gap-2.5 rounded-2xl bg-amber-500/10 p-4 text-sm text-amber-800 dark:text-amber-200">
          <Info className="mt-0.5 size-4 shrink-0" />
          <span>
            {untagged.length} client{untagged.length === 1 ? ' has' : 's have'} source "Referral" but no referrer chosen ({untagged.slice(0, 3).map((c) => c.name).join(', ')}{untagged.length > 3 ? '...' : ''}).
            Edit {untagged.length === 1 ? 'them' : 'each'} on the Clients page and pick "Referred by" so the right person gets credit.
          </span>
        </div>
      )}

      <Card className="overflow-hidden">
        <CardHead title="Referral leaderboard" icon={Trophy} sub="Ranked by premium from the clients they referred" />
        {!board.length ? (
          <Empty icon={Handshake} title="No referrals recorded yet" text='When you add a client or lead, choose who referred them in the "Referred by" field. They show up here.'>
            <Button as={Link} to="/clients" variant="secondary">Go to clients</Button>
          </Empty>
        ) : (
          <ul className="mt-3 divide-y divide-line border-t border-line">
            {board.map((r, i) => {
              const won = r.leads.filter((l) => l.stage === 'won').length;
              const open = r.leads.filter((l) => !['won', 'lost'].includes(l.stage)).length;
              return (
                <li key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-3.5 sm:px-5">
                  <span className={cx('grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold tnum', MEDAL[i] || 'bg-subtle text-mute')}>{i + 1}</span>
                  <Link to={`/clients?id=${r.id}`} className="flex min-w-0 flex-1 basis-48 items-center gap-3">
                    <Avatar name={r.referrer.name} className="size-9 text-[11px]" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold text-ink">{r.referrer.name}</span>
                      <span className="block truncate text-xs text-mute">{r.clients.map((c) => c.name).join(', ') || 'Leads only'}</span>
                    </span>
                  </Link>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge tone="green">{r.clients.length} client{r.clients.length === 1 ? '' : 's'}</Badge>
                    {r.leads.length > 0 && <Badge tone="blue">{open} open · {won} won</Badge>}
                  </div>
                  <div className="w-28 text-right">
                    <p className="tnum text-sm font-bold text-ink">{inr(r.premium)}</p>
                    <p className="tnum text-[11px] text-mute">{inr(r.commission)} comm.</p>
                  </div>
                  {r.referrer.phone && (
                    <Button as="a" href={waLink(r.referrer.phone, thanks(r))} target="_blank" rel="noreferrer" size="sm" variant="whatsapp" icon={MessageCircle}>Thank</Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </>
  );
}
