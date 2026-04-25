import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { X, Settings, HeartPulse, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/AuthContext';
import { useCredentials } from '@/lib/useCredentials';

const STORAGE_KEY = 'bb_role_onboarding_dismissed';

export default function RoleAwareOnboarding() {
  const { user } = useAuth() || {};
  const { isConfigured } = useCredentials();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setDismissed(localStorage.getItem(STORAGE_KEY) === '1');
  }, []);

  if (dismissed || isConfigured) return null;

  const isAdmin = user?.role === 'admin';
  const steps = isAdmin
    ? ['Save Browserbase credentials', 'Open the health checklist', 'Run a small authorized QA test']
    : ['Ask an admin for access details', 'Review app health', 'Open saved QA results'];

  return (
    <div className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 p-4 flex items-start gap-3">
      <div className="h-10 w-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center flex-shrink-0">
        <ShieldCheck className="h-5 w-5 text-cyan-300" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-white">{isAdmin ? 'Admin setup checklist' : 'Getting started'}</h2>
            <p className="text-xs text-gray-400 mt-1">Finish these basics to make the command center fully operational.</p>
          </div>
          <button
            type="button"
            onClick={() => {
              localStorage.setItem(STORAGE_KEY, '1');
              setDismissed(true);
            }}
            className="text-gray-500 hover:text-gray-300"
            aria-label="Dismiss onboarding"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-3">
          {steps.map((step, index) => (
            <div key={step} className="rounded-lg border border-gray-800 bg-gray-950/60 px-3 py-2 text-xs text-gray-300">
              <span className="text-cyan-300 font-mono mr-2">{index + 1}</span>{step}
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          <Link to="/settings"><Button size="sm" className="gap-2"><Settings className="h-3.5 w-3.5" /> Settings</Button></Link>
          <Link to="/health"><Button size="sm" variant="outline" className="gap-2"><HeartPulse className="h-3.5 w-3.5" /> Health</Button></Link>
        </div>
      </div>
    </div>
  );
}