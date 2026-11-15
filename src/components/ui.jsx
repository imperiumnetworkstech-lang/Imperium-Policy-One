import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Search, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { cx } from '../lib/utils';

/* ---------- Button ---------- */
const BTN = {
  primary: 'bg-brand text-white shadow-md shadow-violet-600/25 hover:bg-brand-strong dark:text-[#0b0a12]',
  gradient: 'bg-grad text-white shadow-lg shadow-fuchsia-500/25',
  secondary: 'bg-surface text-ink border border-line hover:bg-subtle',
  ghost: 'text-mute hover:bg-subtle hover:text-ink',
  danger: 'bg-rose-600 text-white hover:bg-rose-700',
  soft: 'bg-brand-soft text-brand-strong hover:brightness-95',
  whatsapp: 'bg-emerald-600 text-white hover:bg-emerald-700',
};
const BTN_SIZE = { sm: 'h-8 px-2.5 text-xs gap-1.5', md: 'h-10 px-4 text-sm gap-2', lg: 'h-12 px-5 text-base gap-2' };

export function Button({ variant = 'primary', size = 'md', icon: Icon, loading, className, children, as: As = 'button', ...rest }) {
  return (
    <As
      className={cx(
        'inline-flex items-center justify-center rounded-full font-semibold whitespace-nowrap transition active:scale-[0.98] disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
        BTN[variant], BTN_SIZE[size], className,
      )}
      disabled={loading || rest.disabled}
      {...rest}
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : Icon ? <Icon className={size === 'sm' ? 'size-3.5' : 'size-4'} /> : null}
      {children}
    </As>
  );
}

export function IconButton({ icon: Icon, label, className, ...rest }) {
  return (
    <button
      aria-label={label}
      title={label}
      className={cx('inline-grid size-9 shrink-0 place-items-center rounded-lg text-mute transition hover:bg-subtle hover:text-ink', className)}
      {...rest}
    >
      <Icon className="size-[18px]" />
    </button>
  );
}

/* ---------- Form controls ---------- */
const control =
  'w-full rounded-lg border border-line bg-surface px-3 text-base sm:text-sm text-ink placeholder:text-faint transition focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25 disabled:bg-subtle disabled:text-mute';

export function Field({ label, hint, required, className, children }) {
  return (
    <label className={cx('block', className)}>
      {label && (
        <span className="mb-1.5 block text-xs font-semibold text-mute">
          {label}
          {required && <span className="text-rose-500"> *</span>}
        </span>
      )}
      {children}
      {hint && <span className="mt-1 block text-[11px] text-faint">{hint}</span>}
    </label>
  );
}
export const Input = ({ className, ...rest }) => <input className={cx(control, 'h-10', className)} {...rest} />;
export const Textarea = ({ className, ...rest }) => <textarea rows={3} className={cx(control, 'py-2', className)} {...rest} />;
export const Select = ({ className, children, ...rest }) => (
  <select className={cx(control, 'h-10 pr-8', className)} {...rest}>
    {children}
  </select>
);

export function SearchInput({ value, onChange, placeholder = 'Search', className }) {
  return (
    <div className={cx('relative', className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={cx(control, 'h-10 pl-9')} />
    </div>
  );
}

// Pill group used for filters and small either/or choices.
export function Segmented({ value, onChange, options, className }) {
  return (
    <div className={cx('no-scrollbar flex gap-1 overflow-x-auto rounded-xl bg-subtle p-1', className)}>
      {options.map((o) => {
        const id = o.id ?? o;
        const active = id === value;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            className={cx(
              'flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition',
              active ? 'bg-surface text-ink shadow-sm' : 'text-mute hover:text-ink',
            )}
          >
            {o.label ?? o}
            {o.count != null && (
              <span className={cx('rounded-full px-1.5 text-[10px] tnum', active ? 'bg-brand-soft text-brand-strong' : 'bg-line/70 text-mute')}>{o.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ---------- Surfaces ---------- */
export const Card = ({ className, children, ...rest }) => (
  <div className={cx('rounded-3xl border border-line bg-surface shadow-card', className)} {...rest}>
    {children}
  </div>
);

export function CardHead({ title, sub, action, icon: Icon }) {
  return (
    <div className="flex items-center justify-between gap-3 px-5 pt-5">
      <div className="flex min-w-0 items-center gap-2.5">
        {Icon && <Icon className="size-4 shrink-0 text-brand" />}
        <div className="min-w-0">
          <h3 className="truncate text-sm font-bold text-ink">{title}</h3>
          {sub && <p className="truncate text-xs text-mute">{sub}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

const TONES = {
  green: 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300',
  amber: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  red: 'bg-rose-500/12 text-rose-700 dark:text-rose-300',
  blue: 'bg-sky-500/12 text-sky-700 dark:text-sky-300',
  violet: 'bg-violet-500/12 text-violet-700 dark:text-violet-300',
  gray: 'bg-slate-500/12 text-mute',
  brand: 'bg-brand-soft text-brand-strong',
  pink: 'bg-pink-500/12 text-fuchsia-600 dark:text-fuchsia-300',
  periwinkle: 'bg-indigo-500/12 text-indigo-600 dark:text-indigo-300',
};
export const toneClass = (tone) => TONES[tone] || TONES.gray;
const DOTS = { green: 'bg-emerald-500', amber: 'bg-amber-500', red: 'bg-rose-500', blue: 'bg-sky-500', violet: 'bg-violet-500', gray: 'bg-slate-400', brand: 'bg-brand', pink: 'bg-fuchsia-500', periwinkle: 'bg-indigo-400' };
export const toneDot = (tone) => DOTS[tone] || DOTS.gray;
export const Badge = ({ tone = 'gray', className, children }) => (
  <span className={cx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap', toneClass(tone), className)}>
    {children}
  </span>
);

export function IconTile({ icon: Icon, tone = 'brand', className }) {
  return (
    <span className={cx('grid size-10 shrink-0 place-items-center rounded-xl', toneClass(tone), className)}>
      <Icon className="size-5" />
    </span>
  );
}

export function Avatar({ name, src, className }) {
  const [broken, setBroken] = useState(false);
  const letters = String(name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('');
  if (src && !broken)
    return <img src={src} alt={name || 'Profile photo'} referrerPolicy="no-referrer" onError={() => setBroken(true)} className={cx('size-10 shrink-0 rounded-full object-cover', className)} />;
  return (
    <span className={cx('grid size-10 shrink-0 place-items-center rounded-full bg-brand-soft text-xs font-bold text-brand-strong', className)}>
      {letters || '?'}
    </span>
  );
}

export function PageHeader({ title, sub, children }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold text-ink sm:text-[28px]">{title}</h1>
        {sub && <p className="mt-0.5 text-sm text-mute">{sub}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

export function Empty({ icon: Icon, title, text, children }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      {Icon && (
        <span className="mb-4 grid size-14 place-items-center rounded-2xl bg-brand-soft text-brand-strong">
          <Icon className="size-6" />
        </span>
      )}
      <p className="text-sm font-bold text-ink">{title}</p>
      {text && <p className="mt-1 max-w-sm text-sm text-mute">{text}</p>}
      {children && <div className="mt-4 flex flex-wrap justify-center gap-2">{children}</div>}
    </div>
  );
}

export function Progress({ value, className, tone = 'bg-brand' }) {
  return (
    <div className={cx('h-2 overflow-hidden rounded-full bg-subtle', className)}>
      <div className={cx('h-full rounded-full transition-all duration-500', tone)} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

/* ---------- Modal: bottom sheet on phones, dialog on larger screens ---------- */
export function Modal({ open, onClose, title, sub, size = 'md', footer, children }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;
  const width = { sm: 'sm:max-w-md', md: 'sm:max-w-xl', lg: 'sm:max-w-3xl', xl: 'sm:max-w-4xl' }[size];
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <div className="anim-fade absolute inset-0 bg-slate-950/55 backdrop-blur-[2px]" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className={cx('anim-modal relative flex max-h-[94dvh] w-full flex-col rounded-t-3xl bg-surface shadow-pop sm:max-h-[88dvh] sm:rounded-2xl', width)}
      >
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-base font-bold text-ink">{title}</h2>
            {sub && <p className="truncate text-xs text-mute">{sub}</p>}
          </div>
          <IconButton icon={X} label="Close" onClick={onClose} className="-mr-2 -mt-1" />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">{children}</div>
        {footer && (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

export function Confirm({ open, onClose, onConfirm, title, text, confirmLabel = 'Delete' }) {
  const [busy, setBusy] = useState(false);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            variant="danger"
            loading={busy}
            onClick={async () => {
              setBusy(true);
              try { await onConfirm(); } finally { setBusy(false); onClose(); }
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm text-mute">{text}</p>
    </Modal>
  );
}

/* ---------- Toasts ---------- */
const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const toast = useCallback((message, type = 'success') => {
    const id = Math.random().toString(36).slice(2);
    setItems((list) => [...list, { id, message, type }]);
    setTimeout(() => setItems((list) => list.filter((t) => t.id !== id)), 3200);
  }, []);
  return (
    <ToastCtx.Provider value={toast}>
      {children}
      {createPortal(
        <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex flex-col items-center gap-2 px-4 lg:bottom-6">
          {items.map((t) => (
            <div key={t.id} className="anim-rise pointer-events-auto flex max-w-sm items-center gap-2.5 rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white shadow-pop dark:bg-slate-100 dark:text-slate-900">
              {t.type === 'error' ? <AlertCircle className="size-4 shrink-0 text-rose-400" /> : <CheckCircle2 className="size-4 shrink-0 text-emerald-400 dark:text-emerald-600" />}
              {t.message}
            </div>
          ))}
        </div>,
        document.body,
      )}
    </ToastCtx.Provider>
  );
}

/* ---------- Theme ---------- */
export function useTheme() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));
  const toggle = () => {
    const next = !dark;
    document.documentElement.classList.toggle('dark', next);
    try { localStorage.setItem('ipo:theme', next ? 'dark' : 'light'); } catch { /* storage blocked */ }
    setDark(next);
  };
  return { dark, toggle };
}
export function initTheme() {
  let pref = null;
  try { pref = localStorage.getItem('ipo:theme'); } catch { /* storage blocked */ }
  const dark = pref ? pref === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.classList.toggle('dark', dark);
}

export function Spinner({ label = 'Loading' }) {
  return (
    <div className="grid h-full min-h-[50vh] place-items-center">
      <div className="flex items-center gap-3 text-sm font-medium text-mute">
        <Loader2 className="size-5 animate-spin text-brand" />
        {label}
      </div>
    </div>
  );
}
