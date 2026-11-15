import { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, FileText, CalendarClock, Users, Target, LifeBuoy, Lightbulb, ChartColumn, Calculator,
  Settings, Plus, Sun, Moon, LogOut, Menu, IdCard, Loader2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { PolicyFormProvider, usePolicyForm } from './PolicyForm';
import { Avatar, IconButton, Modal, Spinner, useTheme } from './ui';
import { APP_NAME } from '../lib/constants';
import { renewalBuckets } from '../lib/insights';
import { cx } from '../lib/utils';

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/policies', label: 'Policies', icon: FileText },
  { to: '/renewals', label: 'Renewals', icon: CalendarClock },
  { to: '/clients', label: 'Clients', icon: Users },
  { to: '/leads', label: 'Leads', icon: Target },
  { to: '/claims', label: 'Claims', icon: LifeBuoy },
  { to: '/insights', label: 'Insights', icon: Lightbulb, group: 'Grow' },
  { to: '/reports', label: 'Reports', icon: ChartColumn, group: 'Grow' },
  { to: '/calculator', label: 'Calculator', icon: Calculator, group: 'Grow' },
  { to: '/card', label: 'Business card', icon: IdCard, group: 'Grow' },
  { to: '/settings', label: 'Settings', icon: Settings, group: 'Account' },
];

// Brand lockup: the Imperium petal mark with the product name, styled like the logo.
export function Logo({ compact }) {
  return (
    <span className="flex items-center gap-2" aria-label={APP_NAME}>
      <img src="/brand/mark-64.png" alt="" width="36" height="36" className="size-9 shrink-0 object-contain" />
      <span className="font-display text-[19px] font-bold leading-none tracking-tight">
        <span className="text-ink">Imperium</span>
        <span className={cx('text-[#6a1fd0] dark:text-[#b69bff]', compact ? 'hidden min-[380px]:inline' : '')}> PolicyOne</span>
      </span>
    </span>
  );
}

export default function Layout() {
  return (
    <PolicyFormProvider>
      <Shell />
    </PolicyFormProvider>
  );
}

function Shell() {
  const { user, logOut } = useAuth();
  const { loading, syncing, error, profile, policies } = useData();
  const { dark, toggle } = useTheme();
  const openPolicy = usePolicyForm();
  const [more, setMore] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const b = renewalBuckets(policies);
  const urgent = b.overdue.length + b.week.length;
  const name = profile.name || user?.email;

  const item = (n, onClick) => (
    <NavLink
      key={n.to}
      to={n.to}
      end={n.end}
      onClick={onClick}
      className={({ isActive }) =>
        cx(
          'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition',
          isActive ? 'bg-brand-soft text-brand-strong' : 'text-mute hover:bg-subtle hover:text-ink',
        )
      }
    >
      {({ isActive }) => (
        <>
          <n.icon className={cx('size-[18px]', isActive ? 'text-brand' : 'text-faint group-hover:text-mute')} />
          <span className="flex-1">{n.label}</span>
          {n.to === '/renewals' && urgent > 0 && (
            <span className="bg-grad rounded-full px-1.5 text-[10px] font-bold text-white tnum">{urgent}</span>
          )}
        </>
      )}
    </NavLink>
  );

  const groups = [undefined, 'Grow', 'Account'];
  const sidebarNav = (onClick) =>
    groups.map((g) => (
      <div key={g || 'main'} className="space-y-1">
        {g && <p className="px-3 pb-1 pt-4 text-[10px] font-bold uppercase tracking-widest text-faint">{g}</p>}
        {NAV.filter((n) => n.group === g).map((n) => item(n, onClick))}
      </div>
    ));

  const bottom = [NAV[0], NAV[1], null, NAV[2]];

  return (
    <div className="flex h-dvh overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-line bg-surface lg:flex">
        <div className="px-5 py-5"><Logo /></div>
        <div className="px-4">
          <button
            onClick={() => openPolicy()}
            className="bg-grad flex h-11 w-full items-center justify-center gap-2 rounded-full text-sm font-bold text-white shadow-lg shadow-fuchsia-500/25 transition active:scale-[0.98]"
          >
            <Plus className="size-4" /> New policy
          </button>
        </div>
        <nav className="no-scrollbar mt-4 flex-1 overflow-y-auto px-3 pb-4">{sidebarNav()}</nav>
        <div className="bg-grad-soft m-3 flex items-center gap-3 rounded-2xl p-3">
          <Avatar name={name} src={profile.photo} className="bg-surface text-brand-strong" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-ink">{name}</p>
            <p className="truncate text-[11px] text-mute">{profile.agency || user?.email}</p>
          </div>
          <IconButton icon={LogOut} label="Sign out" onClick={logOut} className="hover:bg-surface" />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-line bg-surface/80 px-4 backdrop-blur lg:h-16 lg:px-8">
          <div className="lg:hidden"><Logo compact /></div>
          <div className="hidden text-sm font-semibold text-mute lg:block">
            {NAV.find((n) => (n.end ? location.pathname === n.to : location.pathname.startsWith(n.to)))?.label}
          </div>
          <div className="flex items-center gap-1">
            {syncing && !loading && (
              <span className="mr-1 flex items-center gap-1.5 text-[11px] font-semibold text-mute"><Loader2 className="size-3.5 animate-spin text-brand" /> Syncing</span>
            )}
            <IconButton icon={dark ? Sun : Moon} label="Toggle theme" onClick={toggle} />
            <button className="lg:hidden" onClick={() => navigate('/settings')} aria-label="Account"><Avatar name={name} src={profile.photo} className="size-8 text-[10px]" /></button>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto">
          <div key={location.pathname} className="anim-rise mx-auto w-full max-w-7xl px-4 pb-28 pt-5 lg:px-8 lg:pb-10 lg:pt-7">
            {error ? (
              <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-5 text-sm text-rose-700 dark:text-rose-300">
                <p className="font-bold">Could not load your data</p>
                <p className="mt-1">{error.code === 'permission-denied' ? 'Firestore denied access. Publish the rules from firestore.rules in the Firebase console.' : error.message}</p>
              </div>
            ) : loading ? <Spinner label="Opening" /> : <Outlet />}
          </div>
        </main>

        {/* Mobile bottom navigation */}
        <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
          {bottom.map((n) =>
            n ? (
              <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => cx('relative flex h-16 flex-col items-center justify-center gap-1 text-[10px] font-bold', isActive ? 'text-brand' : 'text-faint')}>
                <n.icon className="size-5" />
                {n.label}
                {n.to === '/renewals' && urgent > 0 && <span className="absolute right-[26%] top-2.5 size-2 rounded-full bg-amber-500 ring-2 ring-surface" />}
              </NavLink>
            ) : (
              <div key="add" className="grid place-items-center">
                <button onClick={() => openPolicy()} aria-label="New policy" className="-mt-7 grid size-14 place-items-center rounded-full bg-grad text-white shadow-lg shadow-fuchsia-500/35 ring-4 ring-surface transition active:scale-95">
                  <Plus className="size-6" />
                </button>
              </div>
            ),
          )}
          <button onClick={() => setMore(true)} className="flex h-16 flex-col items-center justify-center gap-1 text-[10px] font-bold text-faint">
            <Menu className="size-5" /> More
          </button>
        </nav>
      </div>

      <Modal open={more} onClose={() => setMore(false)} title="Menu" size="sm">
        <div className="grid grid-cols-3 gap-2">
          {NAV.slice(3).map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              onClick={() => setMore(false)}
              className={({ isActive }) => cx('flex flex-col items-center gap-2 rounded-xl border p-3 text-xs font-bold', isActive ? 'border-brand bg-brand-soft text-brand-strong' : 'border-line text-mute')}
            >
              <n.icon className="size-5" />
              {n.label}
            </NavLink>
          ))}
        </div>
        <button onClick={logOut} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-line p-3 text-sm font-bold text-rose-600 dark:text-rose-400">
          <LogOut className="size-4" /> Sign out
        </button>
      </Modal>
    </div>
  );
}
