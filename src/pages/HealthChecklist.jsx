import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCredentials } from '@/lib/useCredentials';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useBrowserbaseSessions, useBrowserbaseUsage } from '@/lib/browserbaseData';
import HealthChecklistItem from '@/components/health/HealthChecklistItem';
import HealthSummaryCard from '@/components/health/HealthSummaryCard';
import { Button } from '@/components/ui/button';
import { HeartPulse, RefreshCw } from 'lucide-react';

function queryStatus(query, enabled) {
  if (!enabled || query.isLoading || query.isFetching) return 'pending';
  return query.isSuccess ? 'ok' : 'warn';
}

export default function HealthChecklist() {
  const { isConfigured } = useCredentials();
  const online = useOnlineStatus();
  const sessionsQuery = useBrowserbaseSessions({ enabled: isConfigured && online, refetchInterval: false });
  const usageQuery = useBrowserbaseUsage({ enabled: isConfigured && online, refetchInterval: false });
  const auditQuery = useQuery({
    queryKey: ['healthAuditLogs'],
    queryFn: () => base44.entities.AuditLog.list('-created_date', 5),
    initialData: [],
  });
  const evidenceQuery = useQuery({
    queryKey: ['healthEvidence'],
    queryFn: () => base44.entities.AutomationEvidence.list('-created_date', 5),
    initialData: [],
  });

  const checks = [
    {
      title: 'Browserbase credentials',
      description: isConfigured ? 'Credentials are saved for this browser.' : 'Credentials are missing, so Browserbase-powered pages cannot run yet.',
      status: isConfigured ? 'ok' : 'warn',
      action: !isConfigured && <Link to="/settings"><Button size="sm">Open Settings</Button></Link>,
    },
    {
      title: 'Browserbase sessions API',
      description: online ? 'Confirms the app can load recent Browserbase sessions.' : 'You appear to be offline, so session checks are paused.',
      status: queryStatus(sessionsQuery, isConfigured && online),
    },
    {
      title: 'Browserbase usage API',
      description: 'Confirms usage metrics can be loaded for dashboard reporting.',
      status: queryStatus(usageQuery, isConfigured && online),
    },
    {
      title: 'Audit log stream',
      description: auditQuery.isError ? 'Audit logs could not be loaded.' : `Audit log storage is reachable${auditQuery.data?.length ? ` with ${auditQuery.data.length} recent item(s).` : '.'}`,
      status: auditQuery.isFetching ? 'pending' : auditQuery.isError ? 'warn' : 'ok',
    },
    {
      title: 'Automation evidence',
      description: evidenceQuery.isError ? 'Evidence records could not be loaded.' : `Evidence storage is reachable${evidenceQuery.data?.length ? ` with ${evidenceQuery.data.length} recent item(s).` : '.'}`,
      status: evidenceQuery.isFetching ? 'pending' : evidenceQuery.isError ? 'warn' : 'ok',
    },
  ];

  const okCount = checks.filter((check) => check.status === 'ok').length;
  const warnCount = checks.filter((check) => check.status === 'warn').length;
  const checkingCount = checks.length - okCount - warnCount;

  const refreshAll = () => {
    sessionsQuery.refetch();
    usageQuery.refetch();
    auditQuery.refetch();
    evidenceQuery.refetch();
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-r from-emerald-500/10 via-cyan-500/5 to-transparent px-5 py-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
          <HeartPulse className="w-5 h-5 text-emerald-400" />
        </div>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-white">Project Health Checklist</h1>
          <p className="text-xs text-gray-400 mt-0.5">A quick operational checklist for common unfinished setup and reliability items.</p>
        </div>
        <Button onClick={refreshAll} variant="outline" className="border-gray-700 text-gray-300 hover:bg-gray-800 gap-2">
          <RefreshCw className="w-4 h-4" /> Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <HealthSummaryCard label="Healthy" value={okCount} tone="emerald" />
        <HealthSummaryCard label="Needs attention" value={warnCount} tone="yellow" />
        <HealthSummaryCard label="Checking" value={checkingCount} tone="gray" />
      </div>

      <div className="space-y-3">
        {checks.map((check) => (
          <HealthChecklistItem key={check.title} {...check} />
        ))}
      </div>
    </div>
  );
}