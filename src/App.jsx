import { useEffect, lazy, Suspense } from 'react';
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ErrorBoundary from '@/components/shared/ErrorBoundary';
import OfflineBanner from '@/components/shared/OfflineBanner';
import KeyboardShortcuts from '@/components/shared/KeyboardShortcuts';
import AdminRoute from '@/components/shared/AdminRoute';
import { installFrontendErrorReporter } from '@/lib/frontendErrorReporter';
import { loadFeatureFlags } from '@/lib/featureFlags';

// Layout
import AppLayout from '@/components/layout/AppLayout';

// Eagerly loaded (small + used on first paint)
import Dashboard from './pages/Dashboard';
import Sessions from './pages/Sessions';
import Status from './pages/Status';
import Settings from './pages/Settings';

// #37 Lazy-load heavy pages — cuts initial bundle (~40% from recharts/quill).
const FleetLauncher = lazy(() => import('./pages/FleetLauncher'));
const MirrorMode = lazy(() => import('./pages/MirrorMode'));
const Contexts = lazy(() => import('./pages/Contexts'));
const Personas = lazy(() => import('./pages/Personas'));
const Analytics = lazy(() => import('./pages/Analytics'));
const StagehandAI = lazy(() => import('./pages/StagehandAI'));
const AuthorizedBulkQA = lazy(() => import('./pages/AuthorizedBulkQA.jsx'));
const Monitor = lazy(() => import('./pages/Monitor'));
const AuditLog = lazy(() => import('./pages/AuditLog.jsx'));
const TestReports = lazy(() => import('./pages/TestReports'));
const Proxies = lazy(() => import('./pages/Proxies'));
const ProxyEfficiency = lazy(() => import('./pages/ProxyEfficiency'));
const AdminMetrics = lazy(() => import('./pages/AdminMetrics'));
const AdminSlowCalls = lazy(() => import('./pages/AdminSlowCalls'));
const AdminFlags = lazy(() => import('./pages/AdminFlags'));
const AdminSelfTest = lazy(() => import('./pages/AdminSelfTest'));
const Runbook = lazy(() => import('./pages/Runbook'));

function LazyFallback() {
  return (
    <div className="flex items-center justify-center h-full min-h-[40vh]">
      <div className="w-8 h-8 border-4 border-gray-800 border-t-emerald-500 rounded-full animate-spin" />
    </div>
  );
}

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
    <Suspense fallback={<LazyFallback />}>
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
          <Route path="/bulk" element={<AuthorizedBulkQA />} />
          <Route path="/joe-ignite" element={<Navigate to="/bulk" replace />} />
          <Route path="/proxies" element={<Proxies />} />
          <Route path="/proxies/efficiency" element={<ProxyEfficiency />} />
          <Route path="/reports" element={<TestReports />} />
          <Route path="/monitor" element={<Monitor />} />
          <Route path="/audit" element={<AuditLog />} />
          <Route path="/audit/:id" element={<AuditLog />} />
          <Route path="/status" element={<Status />} />
          <Route path="/admin/metrics" element={<AdminRoute><AdminMetrics /></AdminRoute>} />
          <Route path="/admin/slow" element={<AdminRoute><AdminSlowCalls /></AdminRoute>} />
          <Route path="/admin/flags" element={<AdminRoute><AdminFlags /></AdminRoute>} />
          <Route path="/admin/self-test" element={<AdminRoute><AdminSelfTest /></AdminRoute>} />
          <Route path="/help/runbook" element={<Runbook />} />
        </Route>
        <Route path="*" element={<PageNotFound />} />
      </Routes>
    </Suspense>
  );
};

function App() {
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const applyTheme = () => document.documentElement.classList.toggle('dark', media.matches);
    applyTheme();
    media.addEventListener('change', applyTheme);

    // Install global error reporter (#19) and prewarm feature flags (#48)
    installFrontendErrorReporter();
    loadFeatureFlags();

    return () => media.removeEventListener('change', applyTheme);
  }, []);

  return (
    <ErrorBoundary>
      <AuthProvider>
        <QueryClientProvider client={queryClientInstance}>
          <Router>
            <OfflineBanner />
            <KeyboardShortcuts />
            <AuthenticatedApp />
          </Router>
          <Toaster />
        </QueryClientProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;