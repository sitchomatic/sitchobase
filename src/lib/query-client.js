import { QueryClient } from '@tanstack/react-query';

/**
 * Sensible defaults:
 *   - retry: 1 (bbClient already has its own retry + circuit breaker)
 *   - staleTime: 5s default — lets fast navigation avoid refetch flash but
 *     doesn't leave stale data on screen for long
 *   - refetchOnWindowFocus: off (live pages poll on their own cadence)
 * Individual queries can still override these by passing staleTime explicitly.
 */
export const queryClientInstance = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5_000,
      gcTime: 5 * 60_000,
    },
    mutations: {
      retry: 0,
    },
  },
});