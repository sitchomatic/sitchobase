/**
 * Lightweight runtime validators for entity records coming back from the DB.
 *
 * We don't want a Zod dependency for ~3 schemas. Each validator:
 *   - returns a normalized record on success
 *   - returns null (+ console.warn) on malformed shape, so callers can filter
 *
 * This prevents one bad record from nuking a whole page render.
 */

const isString = (v) => typeof v === 'string';
const isNumber = (v) => typeof v === 'number' && Number.isFinite(v);
const isBool = (v) => typeof v === 'boolean';
const isInt = (v) => Number.isInteger(v);

function warnOnce(key, msg) {
  if (!warnOnce.seen) warnOnce.seen = new Set();
  if (warnOnce.seen.has(key)) return;
  warnOnce.seen.add(key);
  console.warn(`[safeParse] ${msg}`);
}

/** Parse an array of records, filtering out malformed entries. */
export function safeParseMany(records, parser, label = 'record') {
  if (!Array.isArray(records)) return [];
  const out = [];
  for (const r of records) {
    const parsed = parser(r);
    if (parsed) out.push(parsed);
    else warnOnce(`${label}:${r?.id || 'unknown'}`, `Dropping malformed ${label} id=${r?.id}`);
  }
  return out;
}

/** JoeIgniteRun record validator — returns normalized record or null */
export function parseJoeIgniteRun(r) {
  if (!r || typeof r !== 'object') return null;
  if (!isString(r.email) || !isString(r.batchId)) return null;
  return {
    id: r.id,
    batchId: r.batchId,
    email: r.email,
    status: isString(r.status) ? r.status : 'queued',
    sessionId: isString(r.sessionId) ? r.sessionId : null,
    attempts: isNumber(r.attempts) ? r.attempts : 0,
    joeOutcome: isString(r.joeOutcome) ? r.joeOutcome : null,
    ignitionOutcome: isString(r.ignitionOutcome) ? r.ignitionOutcome : null,
    isBurned: isBool(r.isBurned) ? r.isBurned : false,
    details: isString(r.details) ? r.details : '',
    proxyId: isString(r.proxyId) ? r.proxyId : null,
    proxyProvider: isString(r.proxyProvider) ? r.proxyProvider : 'none',
    startedAt: isString(r.startedAt) ? r.startedAt : null,
    endedAt: isString(r.endedAt) ? r.endedAt : null,
    created_date: r.created_date,
  };
}

/** ProxyPool record validator */
export function parseProxyPool(r) {
  if (!r || typeof r !== 'object') return null;
  if (!isString(r.server) || r.server.length === 0) return null;
  return {
    id: r.id,
    label: isString(r.label) ? r.label : '',
    server: r.server,
    username: isString(r.username) ? r.username : '',
    password: isString(r.password) ? r.password : '',
    enabled: r.enabled !== false, // default true
    timesUsed: isNumber(r.timesUsed) ? r.timesUsed : 0,
    successCount: isNumber(r.successCount) ? r.successCount : 0,
    failureCount: isNumber(r.failureCount) ? r.failureCount : 0,
    lastUsedAt: isString(r.lastUsedAt) ? r.lastUsedAt : null,
    created_date: r.created_date,
  };
}

/** Browserbase session shape — lenient, we only depend on a few fields */
export function parseBbSession(s) {
  if (!s || typeof s !== 'object') return null;
  if (!isString(s.id)) return null;
  return {
    ...s,
    id: s.id,
    status: isString(s.status) ? s.status : 'UNKNOWN',
    region: isString(s.region) ? s.region : '—',
    createdAt: s.createdAt,
    startedAt: s.startedAt,
    endedAt: s.endedAt,
    proxyBytes: isNumber(s.proxyBytes) ? s.proxyBytes : 0,
    keepAlive: isBool(s.keepAlive) ? s.keepAlive : false,
    contextId: isString(s.contextId) ? s.contextId : null,
  };
}

export function parseFeatureFlag(r) {
  if (!r || typeof r !== 'object' || !isString(r.key) || !r.key.trim()) return null;
  return {
    id: r.id,
    key: r.key.trim(),
    enabled: isBool(r.enabled) ? r.enabled : false,
    rollout_percentage: isInt(r.rollout_percentage) ? r.rollout_percentage : 100,
    description: isString(r.description) ? r.description : '',
    updated_date: r.updated_date,
    created_date: r.created_date,
  };
}

export function parseDailyMetric(r) {
  if (!r || typeof r !== 'object' || !isString(r.date) || !isString(r.action)) return null;
  return {
    id: r.id,
    date: r.date,
    action: r.action,
    count: isInt(r.count) ? r.count : 0,
    errors: isInt(r.errors) ? r.errors : 0,
    sum_duration_ms: isNumber(r.sum_duration_ms) ? r.sum_duration_ms : 0,
    max_duration_ms: isNumber(r.max_duration_ms) ? r.max_duration_ms : 0,
    created_date: r.created_date,
  };
}

export function parseSlowCall(r) {
  if (!r || typeof r !== 'object' || !isString(r.action)) return null;
  return {
    id: r.id,
    action: r.action,
    duration_ms: isNumber(r.duration_ms) ? r.duration_ms : 0,
    status: isInt(r.status) ? r.status : 0,
    actor: isString(r.actor) ? r.actor : 'unknown',
    request_id: isString(r.request_id) ? r.request_id : '',
    params_summary: isString(r.params_summary) ? r.params_summary : '',
    created_date: r.created_date,
  };
}