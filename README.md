# Imperium PolicyOne - The Complete Insurance CRM for Growth

A mobile-first CRM for insurance agents: policies, renewals, commissions, clients, leads, claims, a motor premium calculator and automatic gap insights. React + Vite + Tailwind, with Firebase Auth and Cloud Firestore.

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:5173. The app needs the Firebase keys in `.env` (see below) and shows a setup screen until they are there. Every new account starts empty.

## Connect Firebase

1. Create a project at https://console.firebase.google.com and add a **Web app**.
2. Copy the config values into `.env` (see `.env.example`).
3. **Authentication > Sign-in method**: enable **Email/Password** (and **Google** if you want the Google button).
4. **Firestore Database**: create the database, then open the **Rules** tab, paste the contents of `firestore.rules` and publish. These rules let each agent read and write only their own data.
5. Restart `npm run dev`.

Data lives under `users/{uid}/policies | clients | leads | claims | meta`.

## Deploy

### Vercel (free Hobby plan)

`vercel.json` is already set up (Vite build, page routing, long caching for assets).

1. Push this folder to a GitHub repository. `.env` is in `.gitignore`, so your keys are not uploaded.
2. On https://vercel.com, sign in with GitHub, click **Add New > Project** and import the repository.
3. Under **Environment Variables**, add the six `VITE_FIREBASE_*` values from your `.env` (same names, same values).
4. Click **Deploy**. You get a link like `https://your-project.vercel.app`.
5. In the Firebase console, open **Authentication > Settings > Authorized domains** and add that `your-project.vercel.app` domain. Without this, sign-in on the live site fails.

Every push to GitHub redeploys automatically. If you change an environment variable, redeploy from the Vercel dashboard so the new value is built in.

The Hobby plan is for personal, non-commercial use. If you start charging agents, move to Vercel Pro.

### Other hosts

`npm run build` produces a `dist` folder that works on Firebase Hosting or Netlify too. Set the same `VITE_FIREBASE_*` variables, add the domain to Firebase Authorized domains, and route all paths to `index.html`.

## What is inside

| Screen | What it does |
| --- | --- |
| Dashboard | Premium sold, commission earned, active policies, renewals due, 12 month trend, business mix, monthly target, agenda |
| Policies | Dynamic form per line (Motor, Health, Life, Non-Motor), search, filters, CSV export |
| Renewals | Overdue / 7 / 30 / 60 / 90 day buckets, WhatsApp reminders, one-tap renew with NCB roll-forward, lost reasons |
| Clients | Client 360 with a coverage map that shows cross-sell gaps |
| Leads | Pipeline board with follow-up dates, convert a won lead into a policy |
| Claims | Track each claim to settlement; a motor claim resets NCB at renewal |
| Insights | Cross-sell, upsell, win-back, pending commission, stale leads, retention rate |
| Reports | By insurer, line, month, new vs renewal; commission reconciliation |
| Calculator | Indicative motor premium (India Motor Tariff OD rates, IRDAI TP rates), IDV estimator |

## Editing rates and fields

- Policy fields per insurance type: `src/lib/constants.js` (`FIELDS`).
- Third-party rates, OD tariff and depreciation: `src/lib/premium.js`. Update these when IRDAI revises TP premiums.
- Insurer list and default GST: `src/lib/constants.js`.
