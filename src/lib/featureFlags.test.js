import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isFeatureEnabled, _resetFeatureFlagsCache, loadFeatureFlags } from './featureFlags.js';

vi.mock('@/api/base44Client', () => ({
  base44: {
    entities: {
      FeatureFlag: {
        list: vi.fn(async () => [
          { key: 'ON_ALL', enabled: true, rollout_percentage: 100 },
          { key: 'OFF', enabled: false, rollout_percentage: 100 },
          { key: 'HALF', enabled: true, rollout_percentage: 50 },
        ]),
      },
    },
  },
}));

describe('feature flags', () => {
  beforeEach(() => { _resetFeatureFlagsCache(); });

  it('returns false for uncached flag', () => {
    expect(isFeatureEnabled('ANY_KEY')).toBe(false);
  });

  it('after load, ON_ALL is always true', async () => {
    await loadFeatureFlags();
    expect(isFeatureEnabled('ON_ALL', 'a@b.com')).toBe(true);
    expect(isFeatureEnabled('OFF', 'a@b.com')).toBe(false);
  });

  it('HALF rollout is stable per user', async () => {
    await loadFeatureFlags();
    const a = isFeatureEnabled('HALF', 'alice@x.com');
    const b = isFeatureEnabled('HALF', 'alice@x.com');
    expect(a).toBe(b);
  });
});