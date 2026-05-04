export const RETRY_FAILURE_TYPES = {
  network_timeout: 'Network timeout',
  transient_network: 'Transient network error',
  selector_missing: 'Selector missing',
  configuration_error: 'Configuration error',
  unknown: 'Unknown failure',
};

export const DEFAULT_RETRY_POLICY = {
  enabled: true,
  maxRetries: 2,
  initialDelayMs: 1500,
  multiplier: 2,
  retryableFailureTypes: ['network_timeout', 'transient_network'],
};

export function classifyRetryFailure(error) {
  const message = String(error?.message || error || '').toLowerCase();

  if (message.includes('timeout') || message.includes('timed out') || message.includes('aborted')) {
    return 'network_timeout';
  }

  if (message.includes('network') || message.includes('fetch') || message.includes('websocket') || message.includes('connection')) {
    return 'transient_network';
  }

  if (message.includes('selector') || message.includes('form controls') || message.includes('not found')) {
    return 'selector_missing';
  }

  if (message.includes('configured') || message.includes('configuration') || message.includes('could not be used')) {
    return 'configuration_error';
  }

  return 'unknown';
}

export function isPermanentFailureType(type) {
  return type === 'selector_missing' || type === 'configuration_error';
}

export function normalizeRetryPolicy(policy = {}) {
  return {
    ...DEFAULT_RETRY_POLICY,
    ...policy,
    maxRetries: Math.max(0, Math.floor(Number(policy.maxRetries ?? DEFAULT_RETRY_POLICY.maxRetries))),
    initialDelayMs: Math.max(250, Math.floor(Number(policy.initialDelayMs ?? DEFAULT_RETRY_POLICY.initialDelayMs))),
    multiplier: Math.max(1, Number(policy.multiplier ?? DEFAULT_RETRY_POLICY.multiplier)),
    retryableFailureTypes: Array.isArray(policy.retryableFailureTypes)
      ? policy.retryableFailureTypes
      : DEFAULT_RETRY_POLICY.retryableFailureTypes,
  };
}

export function getRetryDelayMs(policy, attemptNumber) {
  const normalized = normalizeRetryPolicy(policy);
  return Math.round(normalized.initialDelayMs * Math.pow(normalized.multiplier, Math.max(0, attemptNumber - 1)));
}

export function shouldRetryFailure(policy, failureType, attemptNumber) {
  const normalized = normalizeRetryPolicy(policy);
  return Boolean(
    normalized.enabled
    && attemptNumber <= normalized.maxRetries
    && normalized.retryableFailureTypes.includes(failureType)
    && !isPermanentFailureType(failureType)
  );
}