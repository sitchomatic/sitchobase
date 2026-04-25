import { useQuery } from '@tanstack/react-query';
import { bbClient } from '@/lib/bbClient';

export const browserbaseQueryKeys = {
  sessionsRoot: ['browserbase', 'sessions'],
  sessions: (status = 'ALL') => ['browserbase', 'sessions', status || 'ALL'],
  usage: ['browserbase', 'usage'],
  contexts: ['browserbase', 'contexts'],
};

export function normalizeSessionStatus(status) {
  return !status || status === 'ALL' ? null : status;
}

export async function fetchBrowserbaseSessions(status = 'ALL') {
  return bbClient.listSessions(normalizeSessionStatus(status));
}

export async function fetchBrowserbaseUsage() {
  return bbClient.getProjectUsage();
}

export async function fetchBrowserbaseContexts() {
  return bbClient.listContexts();
}

export function useBrowserbaseSessions({ status = 'ALL', enabled = true, refetchInterval = false } = {}) {
  return useQuery({
    queryKey: browserbaseQueryKeys.sessions(status),
    queryFn: () => fetchBrowserbaseSessions(status),
    enabled,
    initialData: [],
    staleTime: 8_000,
    refetchInterval,
    refetchIntervalInBackground: false,
  });
}

export function useBrowserbaseUsage({ enabled = true, refetchInterval = false } = {}) {
  return useQuery({
    queryKey: browserbaseQueryKeys.usage,
    queryFn: fetchBrowserbaseUsage,
    enabled,
    staleTime: 15_000,
    gcTime: 10 * 60_000,
    refetchInterval,
    refetchIntervalInBackground: false,
  });
}

export function useBrowserbaseContexts({ enabled = true } = {}) {
  return useQuery({
    queryKey: browserbaseQueryKeys.contexts,
    queryFn: fetchBrowserbaseContexts,
    enabled,
    initialData: [],
    staleTime: 30_000,
  });
}