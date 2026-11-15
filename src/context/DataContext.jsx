import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { buildShareData, fingerprint, publishShare } from '../lib/share';
import { useAuth } from './AuthContext';
import { watch, create, update, remove, put, onWriteError, newDocId, bulkWrite } from '../lib/store';

const Ctx = createContext(null);
export const useData = () => useContext(Ctx);

const COLS = ['policies', 'clients', 'leads', 'claims', 'quotes', 'meta'];

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
  const [state, setState] = useState({ uid: null, data: {}, server: {} });
  const [error, setError] = useState(null);
  const [waited, setWaited] = useState(false);
  // True when the cloud database has not answered for a while: changes stay on this device until it does.
  const [unreachable, setUnreachable] = useState(false);

  useEffect(() => {
    setError(null);
    setWaited(false);
    setUnreachable(false);
    if (!uid) {
      setState({ uid: null, data: {}, server: {} });
      return;
    }
    setState({ uid, data: readCache(uid), server: {} });
    const stops = COLS.map((col) =>
      watch(
        uid,
        col,
        (rows, { fromServer }) => {
          setState((s) =>
            s.uid === uid ? { ...s, data: { ...s.data, [col]: rows }, server: fromServer ? { ...s.server, [col]: true } : s.server } : s,
          );
          if (fromServer) setUnreachable(false);
          writeCache(uid, col, rows);
        },
        (err) => setError(err),
      ),
    );
    const offWrite = onWriteError((err) => setError(err));
    // Never hold the screen for a slow network: show the app after a moment and fill in as data arrives.
    const timer = setTimeout(() => setWaited(true), 700);
    const slow = setTimeout(() => setUnreachable(true), 8000);
    return () => {
      stops.forEach((s) => s());
      offWrite();
      clearTimeout(timer);
      clearTimeout(slow);
    };
  }, [uid]);

  const value = useMemo(() => {
    const data = state.uid === uid ? state.data : {};
    const server = state.uid === uid ? state.server : {};
    const synced = COLS.every((c) => server[c]);
    const offline = Boolean(uid) && !synced && unreachable && !error;
    const syncing = Boolean(uid) && !synced && !offline && !error;
    const loading = Boolean(uid) && COLS.some((c) => !data[c]) && !waited && !error;
    const saved = (data.meta || []).find((m) => m.id === 'profile') || {};
    const profile = { ...saved, name: saved.name || user?.name || '', email: saved.email || user?.email || '', photo: user?.photo || saved.photo || '' };
    const clients = [...(data.clients || [])].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    return {
      loading,
      syncing,
      offline,
      error,
      profile,
      clients,
      policies: data.policies || [],
      leads: data.leads || [],
      claims: data.claims || [],
      quotes: data.quotes || [],
      clientById: (id) => clients.find((c) => c.id === id),
      add: (col, row) => create(uid, col, row),
      save: (col, id, patch) => update(uid, col, id, patch),
      del: (col, id) => remove(uid, col, id),
      synced: Boolean(uid) && synced,
      saveProfile: (patch) => put(uid, 'meta', 'profile', patch),
      newId: (col) => newDocId(uid, col),
      bulkAdd: (items) => bulkWrite(uid, items),
    };
  }, [state, error, waited, unreachable, uid, user]);

  // Keep customer self-service links current: re-publish a link whenever its content changes.
  // Runs only once the server has confirmed the data, so a stale on-device copy is never published.
  useEffect(() => {
    if (!uid || !value.synced) return;
    const shared = value.clients.filter((c) => c.shareToken);
    if (!shared.length) return;
    const t = setTimeout(() => {
      shared.forEach((c) => {
        const data = buildShareData(c, value.clients, value.policies, value.profile, uid);
        const fp = fingerprint(data);
        const k = `ipo:share:${c.shareToken}`;
        let last = null;
        try { last = localStorage.getItem(k); } catch { /* storage blocked */ }
        if (last === fp) return;
        publishShare(c.shareToken, data)
          .then(() => { try { localStorage.setItem(k, fp); } catch { /* storage blocked */ } })
          .catch((err) => console.warn('Could not update customer link', err));
      });
    }, 1500);
    return () => clearTimeout(t);
  }, [uid, value]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
