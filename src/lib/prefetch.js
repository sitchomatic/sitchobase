/**
 * Hover-prefetch helper (#40). Warms a query when the user hovers a link.
 */
import { queryClientInstance } from '@/lib/query-client';

export function prefetchOnHover(key, fetcher, { staleTime = 10_000 } = {}) {
  return {
    onMouseEnter: () => {
      queryClientInstance.prefetchQuery({ queryKey: key, queryFn: fetcher, staleTime });
    },
    onFocus: () => {
      queryClientInstance.prefetchQuery({ queryKey: key, queryFn: fetcher, staleTime });
    },
  };
}