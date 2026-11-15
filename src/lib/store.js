// Data access for one agent: every record lives under users/{uid}/{collection} in Firestore.
import { collection, doc, onSnapshot, updateDoc, deleteDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';

const clean = (data) => JSON.parse(JSON.stringify(data));
const now = () => new Date().toISOString();

// Firestore applies every write to its local cache at once and syncs to the server in the
// background, so writes are not awaited: the screen updates immediately, even on a slow network.
const writeErrorHandlers = new Set();
export function onWriteError(fn) {
  writeErrorHandlers.add(fn);
  return () => writeErrorHandlers.delete(fn);
}
const background = (promise) => {
  promise.catch((err) => {
    console.error('Save failed', err);
    writeErrorHandlers.forEach((fn) => fn(err));
  });
};

const colRef = (uid, col) => collection(db, 'users', uid, col);
const docRef = (uid, col, id) => doc(db, 'users', uid, col, id);

export function watch(uid, col, cb, onError) {
  return onSnapshot(
    colRef(uid, col),
    (snap) => cb(snap.docs.map((d) => ({ ...d.data(), id: d.id }))),
    (err) => onError?.(err),
  );
}

export async function create(uid, col, data) {
  const ref = doc(colRef(uid, col));
  background(setDoc(ref, clean({ ...data, createdAt: now(), updatedAt: now() })));
  return ref.id;
}

export async function update(uid, col, id, data) {
  const patch = clean({ ...data, updatedAt: now() });
  delete patch.id;
  background(updateDoc(docRef(uid, col, id), patch));
}

export async function put(uid, col, id, data) {
  const row = clean({ ...data, updatedAt: now() });
  delete row.id;
  background(setDoc(docRef(uid, col, id), row, { merge: true }));
}

export async function remove(uid, col, id) {
  background(deleteDoc(docRef(uid, col, id)));
}
