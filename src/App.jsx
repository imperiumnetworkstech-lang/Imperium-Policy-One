import { Navigate, Route, Routes, useMatch } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import { Spinner } from './components/ui';
import AuthPage from './pages/Auth';
import Dashboard from './pages/Dashboard';
import Policies from './pages/Policies';
import Renewals from './pages/Renewals';
import Clients from './pages/Clients';
import Leads from './pages/Leads';
import Claims from './pages/Claims';
import Insights from './pages/Insights';
import Reports from './pages/Reports';
import CalculatorPage from './pages/Calculator';
import BusinessCard from './pages/BusinessCard';
import SettingsPage from './pages/Settings';
import Quotes from './pages/Quotes';
import Referrals from './pages/Referrals';
import Goals from './pages/Goals';
import CustomerView from './pages/CustomerView';

// Every screen ships in the main bundle (they are small), so moving between
// screens never waits on the network. Only the PDF reader loads on demand.
export default function App() {
  const { user, ready } = useAuth();
  // Customer self-service links are public: no login needed.
  const share = useMatch('/c/:token');
  if (share) return <CustomerView token={share.params.token} />;
  if (!ready) return <div className="h-dvh"><Spinner /></div>;

  if (!user)
    return (
      <Routes>
        <Route path="/signup" element={<AuthPage mode="signup" />} />
        <Route path="*" element={<AuthPage mode="login" />} />
      </Routes>
    );

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="policies" element={<Policies />} />
        <Route path="renewals" element={<Renewals />} />
        <Route path="clients" element={<Clients />} />
        <Route path="leads" element={<Leads />} />
        <Route path="claims" element={<Claims />} />
        <Route path="insights" element={<Insights />} />
        <Route path="reports" element={<Reports />} />
        <Route path="quotes" element={<Quotes />} />
        <Route path="referrals" element={<Referrals />} />
        <Route path="goals" element={<Goals />} />
        <Route path="calculator" element={<CalculatorPage />} />
        <Route path="card" element={<BusinessCard />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
