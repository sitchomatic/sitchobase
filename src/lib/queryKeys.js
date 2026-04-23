export const queryKeys = {
  featureFlags: ['featureFlags'],
  adminMetrics: ['adminMetrics'],
  slowCalls: ['slowCalls'],
  proxyPool: ['proxyPool'],
  sessions: ['sessions'],
};

export function invalidateMany(queryClient, keys) {
  return Promise.all(keys.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
}