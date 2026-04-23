import { useEffect } from 'react';
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ErrorBoundary from '@/components/shared/ErrorBoundary';

// Layout
import AppLayout from '@/components/layout/AppLayout';

// Pages
import Dashboard from './pages/Dashboard';
import Sessions from './pages/Sessions';
import FleetLauncher from './pages/FleetLauncher';
import MirrorMode from './pages/MirrorMode';
import Contexts from './pages/Contexts';
import Personas from './pages/Personas';
import Analytics from './pages/Analytics';
import StagehandAI from './pages/StagehandAI';
import Settings from './pages/Settings';
import BulkTest from './pages/BulkTest';
import Monitor from './pages/Monitor';
import AuditLog from './pages/AuditLog.jsx';
import TestReports from './pages/TestReports';
import JoeIgnite from './pages/JoeIgnite';
import Proxies from './pages/Proxies';
import ProxyEfficiency from './pages/ProxyEfficiency';
import Status from './pages/Status';
import SessionDetailPanel from '@/components/sessions/SessionDetailPanel';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-gray-950">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-gray-800 border-t-emerald-500 rounded-full animate-spin"></div>
          <div className="text-xs text-gray-600">Loading BB Command Center…</div>
        </div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      navigateToLogin();
      return null;
    }
  }

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/sessions" element={<Sessions />} />
        <Route path="/sessions/:id" element={<Sessions />} />
        <Route path="/fleet" element={<FleetLauncher />} />
        <Route path="/mirror" element={<MirrorMode />} />
        <Route path="/contexts" element={<Contexts />} />
        <Route path="/personas" element={<Personas />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/stagehand" element={<StagehandAI />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/bulk" element={<BulkTest />} />
        <Route path="/joe-ignite" element={<JoeIgnite />} />
        <Route path="/proxies" element={<Proxies />} />
        <Route path="/proxies/efficiency" element={<ProxyEfficiency />} />
        <Route path="/reports" element={<TestReports />} />
        <Route path="/monitor" element={<Monitor />} />
        <Route path="/audit" element={<AuditLog />} />
        <Route path="/audit/:id" element={<AuditLog />} />
        <Route path="/status" element={<Status />} />
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const applyTheme = () => document.documentElement.classList.toggle('dark', media.matches);
    applyTheme();
    media.addEventListener('change', applyTheme);
    return () => media.removeEventListener('change', applyTheme);
  }, []);

  return (
    <ErrorBoundary>
      <AuthProvider>
        <QueryClientProvider client={queryClientInstance}>
          <Router>
            <AuthenticatedApp />
          </Router>
          <Toaster />
        </QueryClientProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;