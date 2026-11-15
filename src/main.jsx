import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { DataProvider } from './context/DataContext';
import { ToastProvider, initTheme } from './components/ui';
import { missingConfig } from './lib/firebase';
import './index.css';

initTheme();

// Shown only when the deployment is missing its Firebase keys.
function SetupNeeded() {
  return (
    <div className="grid min-h-dvh place-items-center bg-bg px-5">
      <div className="w-full max-w-md rounded-3xl border border-line bg-surface p-7 shadow-card">
        <img src="/brand/logo-full.png" alt="Imperium PolicyOne" className="mx-auto h-24 w-auto dark:hidden" />
        <img src="/brand/logo-full-dark.png" alt="Imperium PolicyOne" className="mx-auto hidden h-24 w-auto dark:block" />
        <h1 className="font-display mt-6 text-xl font-bold text-ink">Firebase is not configured</h1>
        <p className="mt-2 text-sm text-mute">
          Add these values to the <code>.env</code> file (or to your host's environment variables) and restart:
        </p>
        <ul className="mt-3 space-y-1 rounded-xl bg-subtle p-3 font-mono text-xs text-ink">
          {missingConfig.map((k) => <li key={k}>{k}</li>)}
        </ul>
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {missingConfig.length ? (
      <SetupNeeded />
    ) : (
      <BrowserRouter>
        <AuthProvider>
          <DataProvider>
            <ToastProvider>
              <App />
            </ToastProvider>
          </DataProvider>
        </AuthProvider>
      </BrowserRouter>
    )}
  </StrictMode>,
);
