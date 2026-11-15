import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Save, Download, LogOut, CloudCheck, CloudOff, Sun, Moon, FileSpreadsheet } from 'lucide-react';
import ImportBook from '../components/ImportBook';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { Avatar, Button, Card, CardHead, Field, Input, useTheme, useToast } from '../components/ui';

export default function SettingsPage() {
  const { user, logOut } = useAuth();
  const { profile, saveProfile, policies, clients, leads, claims, syncing, offline } = useData();
  const { dark, toggle } = useTheme();
  const toast = useToast();
  const [f, setF] = useState({ name: '', agency: '', phone: '', licence: '', monthlyTarget: '' });
  const [busy, setBusy] = useState('');
  const [importing, setImporting] = useState(false);
  const on = (k) => (e) => setF({ ...f, [k]: e.target.value });

  useEffect(() => {
    setF({ name: profile.name || '', agency: profile.agency || '', phone: profile.phone || '', licence: profile.licence || '', monthlyTarget: profile.monthlyTarget ?? '' });
  }, [profile.name, profile.agency, profile.phone, profile.licence, profile.monthlyTarget]);

  const run = async (key, fn, done) => {
    setBusy(key);
    try { await fn(); toast(done); } catch (e) { toast(e.message || 'Something went wrong', 'error'); } finally { setBusy(''); }
  };

  const downloadPdf = () =>
    run('pdf', async () => {
      const { downloadBookPdf } = await import('../lib/pdfReport');
      await downloadBookPdf({ profile, clients, policies, leads, claims });
    }, 'PDF report downloaded');

  return (
    <>
      <div className="mb-5 flex items-center gap-4">
        <Avatar name={profile.name || user?.email} src={profile.photo} className="size-14 text-base" />
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-ink sm:text-[28px]">Settings</h1>
          <p className="truncate text-sm text-mute">{user?.email}</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHead title="Agent profile" sub="Used in WhatsApp reminders and quote messages" />
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <Field label="Your name"><Input value={f.name} onChange={on('name')} /></Field>
            <Field label="Agency name"><Input value={f.agency} onChange={on('agency')} /></Field>
            <Field label="Mobile"><Input type="tel" inputMode="numeric" value={f.phone} onChange={on('phone')} /></Field>
            <Field label="IRDAI licence / POSP code"><Input value={f.licence} onChange={on('licence')} /></Field>
            <div className="flex items-end text-xs text-mute">
              <p>Monthly and yearly targets are set on the <Link to="/goals" className="font-bold text-brand-strong hover:underline">Goals</Link> page.</p>
            </div>
            <div className="flex items-end">
              <Button icon={Save} loading={busy === 'profile'} onClick={() => run('profile', () => saveProfile({ name: f.name, agency: f.agency, phone: f.phone, licence: f.licence }), 'Profile saved')}>Save profile</Button>
            </div>
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="p-5">
            <div className="flex items-start gap-3">
              <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${offline ? 'bg-amber-500/15 text-amber-600 dark:text-amber-300' : 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-300'}`}>
                {offline ? <CloudOff className="size-5" /> : <CloudCheck className="size-5" />}
              </span>
              <div>
                <p className="text-sm font-bold text-ink">{offline ? 'Cloud database not reachable' : syncing ? 'Connecting to the cloud...' : 'Saved to the cloud'}</p>
                <p className="mt-0.5 text-xs text-mute">
                  {offline
                    ? 'Changes are kept on this device and upload automatically once the database responds. If this persists, check that the Firestore database is created in the Firebase console.'
                    : 'Your data is stored securely in Firebase and syncs live across your laptop and phone, with offline support.'}
                </p>
              </div>
            </div>
          </Card>

          <Card className="flex items-center justify-between p-5">
            <div>
              <p className="text-sm font-bold text-ink">Appearance</p>
              <p className="text-xs text-mute">{dark ? 'Dark' : 'Light'} theme</p>
            </div>
            <Button variant="secondary" icon={dark ? Sun : Moon} onClick={toggle}>{dark ? 'Light' : 'Dark'}</Button>
          </Card>
        </div>

        <Card className="lg:col-span-2">
          <CardHead title="Your data" sub={`${policies.length} policies · ${clients.length} clients · ${leads.length} leads · ${claims.length} claims`} />
          <div className="flex flex-wrap gap-2 p-5">
            <Button variant="secondary" icon={Download} loading={busy === 'pdf'} onClick={downloadPdf}>Download report (PDF)</Button>
            <Button variant="secondary" icon={FileSpreadsheet} onClick={() => setImporting(true)}>Import from Excel</Button>
          </div>
          {importing && <ImportBook onClose={() => setImporting(false)} />}
          <p className="px-5 pb-5 text-xs text-mute">A branded PDF of all your policies, clients, leads and claims with totals. Spreadsheet exports are on the Policies and Reports pages.</p>
        </Card>

        <Card className="flex items-center justify-between p-5">
          <div>
            <p className="text-sm font-bold text-ink">Sign out</p>
            <p className="text-xs text-mute">End this session on this device</p>
          </div>
          <Button variant="secondary" icon={LogOut} onClick={logOut}>Sign out</Button>
        </Card>
      </div>
    </>
  );
}
