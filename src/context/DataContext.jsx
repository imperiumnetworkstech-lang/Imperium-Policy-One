import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext';
import { watch, create, update, remove, put, onWriteError } from '../lib/store';

const Ctx = createContext(null);
export const useData = () => useContext(Ctx);

const COLS = ['policies', 'clients', 'leads', 'claims', 'meta'];

// A copy of the last known data is kept on the device so the app opens instantly,
// then the live data from the server replaces it in the background.
const cacheKey = (uid, col) => `ipo:cache:${uid}:${col}`;
function readCache(uid) {
  const out = {};
  COLS.forEach((col) => {
    try {
      const raw = localStorage.getItem(cacheKey(uid, col));
      if (raw) out[col] = JSON.parse(raw);
    } catch { /* ignore a bad cache entry */ }
  });
  return out;
}
function writeCache(uid, col, rows) {
  try {
    localStorage.setItem(cacheKey(uid, col), JSON.stringify(rows));
  } catch { /* storage full or blocked: the app still works, just without the instant start */ }
}

export function DataProvider({ children }) {
  const { user } = useAuth();
  const uid = user?.uid;
  const [state, setState] = useState({ uid: null, data: {}, live: {} });
  const [error, setError] = useState(null);
  const [waited, setWaited] = useState(false);

  useEffect(() => {
    setError(null);
    setWaited(false);
    if (!uid) {
      setState({ uid: null, data: {}, live: {} });
      return;
    }
    setState({ uid, data: readCache(uid), live: {} });
    const stops = COLS.map((col) =>
      watch(
        uid,
        col,
        (rows) => {
          setState((s) => (s.uid === uid ? { ...s, data: { ...s.data, [col]: rows }, live: { ...s.live, [col]: true } } : s));
          writeCache(uid, col, rows);
        },
        (err) => setError(err),
      ),
    );
    const offWrite = onWriteError((err) => setError(err));
    // Never hold the screen for a slow network: show the app after a moment and fill in as data arrives.
    const timer = setTimeout(() => setWaited(true), 700);
    return () => {
      stops.forEach((s) => s());
      offWrite();
      clearTimeout(timer);
    };
  }, [uid]);

  const value = useMemo(() => {
    const data = state.uid === uid ? state.data : {};
    const live = state.uid === uid ? state.live : {};
    const syncing = Boolean(uid) && COLS.some((c) => !live[c]) && !error;
    const loading = Boolean(uid) && COLS.some((c) => !data[c]) && !waited && !error;
    const saved = (data.meta || []).find((m) => m.id === 'profile') || {};
    const profile = { ...saved, name: saved.name || user?.name || '', email: saved.email || user?.email || '', photo: user?.photo || saved.photo || '' };
    const clients = [...(data.clients || [])].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    return {
      loading,
      syncing,
      error,
      profile,
      clients,
      policies: data.policies || [],
      leads: data.leads || [],
      claims: data.claims || [],
      clientById: (id) => clients.find((c) => c.id === id),
      add: (col, row) => create(uid, col, row),
      save: (col, id, patch) => update(uid, col, id, patch),
      del: (col, id) => remove(uid, col, id),
      saveProfile: (patch) => put(uid, 'meta', 'profile', patch),
    };
  }, [state, error, waited, uid, user]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
