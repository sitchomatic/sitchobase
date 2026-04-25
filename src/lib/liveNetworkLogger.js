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
  const OriginalXHR = window.XMLHttpRequest;

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

  window.XMLHttpRequest = function LoggedXMLHttpRequest() {
    const xhr = new OriginalXHR();
    let method = 'GET';
    let url = 'unknown';
    let started = 0;
    const originalOpen = xhr.open;
    const originalSend = xhr.send;

    xhr.open = function open(nextMethod, nextUrl, ...args) {
      method = String(nextMethod || 'GET').toUpperCase();
      url = String(nextUrl || 'unknown');
      return originalOpen.call(xhr, nextMethod, nextUrl, ...args);
    };

    xhr.send = function send(body) {
      started = performance.now();
      emit({
        type: 'request',
        direction: 'OUT',
        source: 'xhr',
        action: `${method} ${url}`,
        payload: redact({ method, url, body: parseBody(body) }),
      });
      xhr.addEventListener('loadend', () => {
        let payload = '';
        try { payload = redact(xhr.responseText?.slice?.(0, MAX_TEXT) || ''); } catch { payload = '[Response body unavailable]'; }
        emit({
          type: xhr.status >= 400 ? 'error' : 'response',
          direction: xhr.status >= 400 ? 'ERR' : 'IN',
          source: 'xhr',
          action: `${xhr.status || 0} ${method} ${url}`,
          status: xhr.status,
          durationMs: Math.round(performance.now() - started),
          payload,
        });
      });
      return originalSend.call(xhr, body);
    };

    return xhr;
  };

  ['log', 'warn', 'error'].forEach((level) => {
    const original = console[level]?.bind(console);
    if (!original) return;
    console[level] = (...args) => {
      emit({
        type: level === 'error' ? 'error' : 'console',
        direction: level === 'error' ? 'ERR' : 'LOG',
        source: 'console',
        action: level.toUpperCase(),
        payload: redact(args.map((arg) => typeof arg === 'string' ? arg : arg)),
      });
      original(...args);
    };
  });
}