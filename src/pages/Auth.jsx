import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, BellRing, IndianRupee, Lightbulb, Mail, Lock, User, Building2, Sparkles } from 'lucide-react';
import { useAuth, authMessage } from '../context/AuthContext';
import { Button, Field, Input } from '../components/ui';
import { APP_NAME } from '../lib/constants';

const POINTS = [
  { icon: BellRing, title: 'Never miss a renewal', text: 'Every expiry sorted into 7, 30, 60 and 90 day buckets with one-tap WhatsApp reminders.' },
  { icon: IndianRupee, title: 'Know what you earned', text: 'Commission tracked per policy, pending versus received, by insurer and by month.' },
  { icon: Lightbulb, title: 'See the gaps in your book', text: 'Cross-sell, upsell and win-back opportunities surfaced automatically from your clients.' },
];

export default function AuthPage({ mode }) {
  const signup = mode === 'signup';
  const { signIn, signUp, signInGoogle, resetPassword } = useAuth();
  const navigate = useNavigate();
  const [f, setF] = useState({ name: '', agency: '', email: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const on = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function run(fn, after) {
    setError('');
    setNotice('');
    setBusy(true);
    try {
      await fn();
      after?.();
    } catch (e) {
      setError(authMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const submit = (e) => {
    e.preventDefault();
    if (signup && !f.name.trim()) return setError('Please enter your name.');
    run(() => (signup ? signUp(f) : signIn(f)), () => navigate('/'));
  };

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      {/* Brand panel, in the style of imperiumnetworks.in */}
      <div className="auth-art relative hidden overflow-hidden border-r border-line lg:block">
        <div className="relative flex h-full min-h-dvh flex-col justify-between gap-10 overflow-y-auto p-12">
          <img src="/brand/logo-full.png" alt="Imperium PolicyOne - The Complete Insurance CRM for Growth" className="h-24 w-auto self-start xl:h-28 dark:hidden" />
          <img src="/brand/logo-full-dark.png" alt="Imperium PolicyOne - The Complete Insurance CRM for Growth" className="hidden h-24 w-auto self-start xl:h-28 dark:block" />
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-brand-strong">
              <Sparkles className="size-3.5" /> Built for Indian insurance agents and POSPs
            </span>
            <h1 className="mt-5 max-w-lg text-5xl font-bold leading-[1.05] text-ink xl:text-6xl">
              Grow your <span className="text-grad">insurance</span> book, <span className="text-grad">faster.</span>
            </h1>
            <p className="mt-5 max-w-md text-lg text-mute">
              Policies, renewals, commissions and clients in one place, on your laptop and in your pocket.
            </p>
            <div className="mt-9 grid max-w-lg gap-3">
              {POINTS.map((p) => (
                <div key={p.title} className="flex gap-4 rounded-2xl border border-line bg-surface p-4">
                  <span className="bg-grad grid size-10 shrink-0 place-items-center rounded-xl text-white shadow-md shadow-fuchsia-500/25">
                    <p.icon className="size-5" />
                  </span>
                  <div>
                    <p className="font-display text-[15px] font-semibold text-ink">{p.title}</p>
                    <p className="text-sm text-mute">{p.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <p className="text-xs text-faint">Motor, health, life and non-motor. A product of Imperium Networks.</p>
        </div>
      </div>

      {/* Form */}
      <div className="relative flex items-center justify-center overflow-hidden bg-surface px-5 py-10">
        <div className="anim-rise relative w-full max-w-sm">
          <img src="/brand/logo-full.png" alt="Imperium PolicyOne" className="mx-auto mb-8 h-24 w-auto lg:hidden dark:hidden" />
          <img src="/brand/logo-full-dark.png" alt="Imperium PolicyOne" className="mx-auto mb-8 hidden h-24 w-auto dark:block lg:dark:hidden" />
          <h2 className="text-3xl font-bold text-ink">{signup ? 'Create your agent account' : 'Welcome back'}</h2>
          <p className="mt-1.5 text-sm text-mute">
            {signup ? `Start managing your book with ${APP_NAME}.` : 'Sign in to your book of business.'}
          </p>

          <form onSubmit={submit} className="mt-7 space-y-4">
            {signup && (
              <>
                <Field label="Your name"><IconInput icon={User} value={f.name} onChange={on('name')} autoComplete="name" required /></Field>
                <Field label="Agency name (optional)"><IconInput icon={Building2} value={f.agency} onChange={on('agency')} /></Field>
              </>
            )}
            <Field label="Email"><IconInput icon={Mail} type="email" value={f.email} onChange={on('email')} autoComplete="email" required /></Field>
            <Field label="Password">
              <IconInput icon={Lock} type="password" value={f.password} onChange={on('password')} minLength={6} autoComplete={signup ? 'new-password' : 'current-password'} required />
            </Field>

            {!signup && (
              <button
                type="button"
                className="text-xs font-semibold text-brand-strong hover:underline"
                onClick={() => (f.email ? run(() => resetPassword(f.email), () => setNotice('Password reset email sent. Check your inbox.')) : setError('Enter your email above first.'))}
              >
                Forgot password?
              </button>
            )}

            {error && <p className="rounded-xl bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-700 dark:text-rose-300">{error}</p>}
            {notice && <p className="rounded-xl bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300">{notice}</p>}

            <Button type="submit" variant="gradient" size="lg" loading={busy} className="w-full">
              {signup ? 'Create account' : 'Sign in'} <ArrowRight className="size-4" />
            </Button>
          </form>

          <div className="my-5 flex items-center gap-3 text-[11px] font-semibold text-faint">
            <span className="h-px flex-1 bg-line" /> OR <span className="h-px flex-1 bg-line" />
          </div>
          <Button variant="secondary" size="lg" className="w-full" onClick={() => run(signInGoogle, () => navigate('/'))}>
            <GoogleMark /> Continue with Google
          </Button>

          <p className="mt-6 text-center text-sm text-mute">
            {signup ? 'Already have an account? ' : 'New here? '}
            <Link to={signup ? '/login' : '/signup'} className="font-bold text-brand-strong hover:underline">
              {signup ? 'Sign in' : 'Create an account'}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

function IconInput({ icon: Icon, ...rest }) {
  return (
    <div className="relative">
      <Icon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
      <Input className="h-11 rounded-xl pl-9" {...rest} />
    </div>
  );
}

const GoogleMark = () => (
  <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38z" />
  </svg>
);
