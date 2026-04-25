const SENSITIVE_KEYS = ['apikey', 'api_key', 'authorization', 'password', 'secret', 'token', 'cookie', 'apikeyoverride'];
const MAX_TEXT = 1200;

function isSensitiveKey(key = '') {
  const normalized = String(key).toLowerCase().replace(/[^a-z0-9_]/g, '');
  return SENSITIVE_KEYS.some((sensitive) => normalized.includes(sensitive));
}

export function redact(value, depth = 0) {
  if (value == null) return value;
  if (depth > 4) return '[Max depth]';
  if (typeof value === 'string') {
    if (value.length > MAX_TEXT) return `${value.slice(0, MAX_TEXT)}…`;
    return value.replace(/bb_live_[A-Za-z0-9_-]+/g, 'bb_live_[REDACTED]');
  }
  if (typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => redact(item, depth + 1));

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      isSensitiveKey(key) ? '[REDACTED]' : redact(item, depth + 1),
    ])
  );
}

function emit(detail) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('app-terminal-log', {
    detail: {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      at: new Date().toISOString(),
      ...detail,
    },
  }));
}

function parseBody(body) {
  if (!body) return undefined;
  if (typeof body === 'string') {
    try { return JSON.parse(body); } catch { return body.slice(0, MAX_TEXT); }
  }
  if (body instanceof FormData) return '[FormData]';
  if (body instanceof Blob) return `[Blob ${body.size} bytes]`;
  return '[Body]';
}

async function readResponse(response) {
  const contentType = response.headers?.get?.('content-type') || '';
  const clone = response.clone();
  if (contentType.includes('application/json')) {
    return redact(await clone.json());
  }
  const text = await clone.text();
  return text ? redact(text.slice(0, MAX_TEXT)) : '';
}

export function terminalLog(detail) {
  emit({ ...detail, payload: redact(detail.payload) });
}

export function installLiveNetworkLogger() {
  if (typeof window === 'undefined' || window.__liveNetworkLoggerInstalled) return;
  window.__liveNetworkLoggerInstalled = true;
  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input?.url || 'unknown';
    const method = (init.method || input?.method || 'GET').toUpperCase();
    const started = performance.now();

    emit({
      type: 'request',
      direction: 'OUT',
      source: 'fetch',
      action: `${method} ${url}`,
      payload: redact({ method, url, body: parseBody(init.body) }),
    });

    try {
      const response = await originalFetch(input, init);
      let payload = '';
      try { payload = await readResponse(response); } catch { payload = '[Response body unavailable]'; }
      emit({
        type: 'response',
        direction: 'IN',
        source: 'fetch',
        action: `${response.status} ${method} ${url}`,
        status: response.status,
        durationMs: Math.round(performance.now() - started),
        payload,
      });
      return response;
    } catch (error) {
      emit({
        type: 'error',
        direction: 'ERR',
        source: 'fetch',
        action: `${method} ${url}`,
        durationMs: Math.round(performance.now() - started),
        payload: { message: error.message },
      });
      throw error;
    }
  };
}