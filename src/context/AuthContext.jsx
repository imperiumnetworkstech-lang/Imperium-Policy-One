import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut,
  sendPasswordResetEmail, updateProfile, GoogleAuthProvider, signInWithPopup,
} from 'firebase/auth';
import { auth } from '../lib/firebase';
import { put } from '../lib/store';

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

const LAST_USER = 'ipo:lastUser';
// On sign-out, remove the remembered user and the on-device copy of their data.
function forgetDevice() {
  Object.keys(localStorage)
    .filter((k) => k === LAST_USER || k.startsWith('ipo:cache:') || k.startsWith('pp:'))
    .forEach((k) => localStorage.removeItem(k));
}

const MESSAGES = {
  'auth/email-already-in-use': 'An account with this email already exists. Try signing in.',
  'auth/invalid-email': 'That email address does not look right.',
  'auth/weak-password': 'Use a password with at least 6 characters.',
  'auth/invalid-credential': 'Incorrect email or password.',
  'auth/user-not-found': 'No account found with this email.',
  'auth/wrong-password': 'Incorrect email or password.',
  'auth/too-many-requests': 'Too many attempts. Please wait a minute and try again.',
  'auth/network-request-failed': 'Network error. Check your connection.',
  'auth/popup-closed-by-user': 'Sign-in was cancelled.',
  'auth/popup-blocked': 'The browser blocked the Google sign-in window. Allow pop-ups and try again.',
  'auth/unauthorized-domain': 'This website address is not allowed to sign in yet. Add it under Firebase Authentication > Settings > Authorized domains.',
  'auth/operation-not-allowed': 'This sign-in method is not enabled in your Firebase project yet.',
};
export const authMessage = (err) => MESSAGES[err?.code] || err?.message || 'Something went wrong.';

export function AuthProvider({ children }) {
  // Remember the last signed-in agent so the app opens straight away; Firebase then confirms the session.
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem(LAST_USER) || 'null'); } catch { return null; }
  });
  const [ready, setReady] = useState(() => Boolean(user));

  useEffect(
    () =>
      onAuthStateChanged(auth, (u) => {
        const next = u ? { uid: u.uid, email: u.email, name: u.displayName || '', photo: u.photoURL || '' } : null;
        try {
          if (next) localStorage.setItem(LAST_USER, JSON.stringify(next));
          else forgetDevice();
        } catch { /* storage blocked */ }
        setUser(next);
        setReady(true);
      }),
    [],
  );

  const api = useMemo(
    () => ({
      user,
      ready,

      async signUp({ name, agency, email, password }) {
        const cred = await createUserWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
        await updateProfile(cred.user, { displayName: name });
        const uid = cred.user.uid;
        setUser({ uid, email: cred.user.email, name, photo: '' });
        await put(uid, 'meta', 'profile', { name, agency: agency || '', email: cred.user.email, monthlyTarget: 100000 });
      },

      signIn: ({ email, password }) => signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password),

      async signInGoogle() {
        const cred = await signInWithPopup(auth, new GoogleAuthProvider());
        const u = cred.user;
        // Keep the Google name and profile photo with the agent's profile.
        await put(u.uid, 'meta', 'profile', { email: u.email, name: u.displayName || '', photo: u.photoURL || '' });
      },

      resetPassword: (email) => sendPasswordResetEmail(auth, email.trim()),

      logOut() {
        try { forgetDevice(); } catch { /* storage blocked */ }
        return signOut(auth);
      },
    }),
    [user, ready],
  );

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}
