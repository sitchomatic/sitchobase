/**
 * Feature flags (#48).
 * Loads all FeatureFlag entities once on app boot and exposes a sync check.
 * Rollout buckets are stable per user.email (djb2 → %100).
 */
import { base44 } from '@/api/base44Client';

let cache = null;
let loadPromise = null;

function hashBucket(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h % 100;
}

export async function loadFeatureFlags() {
  if (cache) return cache;
  if (loadPromise) return loadPromise;
  loadPromise = base44.entities.FeatureFlag.list('', 200)
    .then((rows) => {
      cache = {};
      (rows || []).forEach((r) => { cache[r.key] = r; });
      return cache;
    })
    .catch(() => (cache = {}));
  return loadPromise;
}

export function isFeatureEnabled(key, userEmail) {
  if (!cache) return false;
  const flag = cache[key];
  if (!flag || flag.enabled === false) return false;
  const pct = Number.isFinite(flag.rollout_percentage) ? flag.rollout_percentage : 100;
  if (pct >= 100) return true;
  if (pct <= 0) return false;
  if (!userEmail) return false;
  return hashBucket(userEmail) < pct;
}

export function _resetFeatureFlagsCache() { cache = null; loadPromise = null; }