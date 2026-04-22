import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// The Base44 client module pulls real env + SDK on import. Mock it out so the
// helper module can load in a Node test environment.
vi.mock('@/api/base44Client', () => ({
  base44: { functions: { invoke: vi.fn() } },
}));

// Stub the direct Browserbase REST client — bbClient dispatches to this when
// the direct path is eligible. Tests assert the dispatch, not the network.
vi.mock('./browserbaseApi', () => ({
  listSessions: vi.fn(async () => [{ id: 'sess_1' }]),
  getSession: vi.fn(async () => ({ id: 'sess_1' })),
  createSession: vi.fn(async () => ({ id: 'sess_new' })),
  updateSession: vi.fn(async () => ({ id: 'sess_1', status: 'COMPLETED' })),
  getSessionLogs: vi.fn(async () => []),
  getSessionRecording: vi.fn(async () => ({ events: [] })),
  getProjectUsage: vi.fn(async () => ({ browserMinutes: 0 })),
  listContexts: vi.fn(async () => [{ id: 'ctx_1' }]),
  getContext: vi.fn(async () => ({ id: 'ctx_1' })),
  createContext: vi.fn(async () => ({ id: 'ctx_new' })),
  deleteContext: vi.fn(async () => ({})),
  batchCreateSessions: vi.fn(async () => ({ results: [], errors: [] })),
}));

const ORIGINAL_ENV = { ...import.meta.env };

// Minimal localStorage shim for the Node test environment. Scoped per-test
// via beforeEach.
function installLocalStorage(initial = {}) {
  const store = new Map(Object.entries(initial));
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(k, String(v)); },
    removeItem: (k) => { store.delete(k); },
    clear: () => store.clear(),
  };
}

describe('isLikelyApiKeyBbProxyFailure', () => {
  let isLikelyApiKeyBbProxyFailure;

  beforeEach(async () => {
    const mod = await import('./bbClient');
    isLikelyApiKeyBbProxyFailure = mod.isLikelyApiKeyBbProxyFailure;
  });

  it('returns true for explicit 404 / 405 status on the error object', () => {
    expect(isLikelyApiKeyBbProxyFailure({ status: 404 })).toBe(true);
    expect(isLikelyApiKeyBbProxyFailure({ status: 405 })).toBe(true);
  });

  it('returns true for 404 / 405 status on err.response', () => {
    expect(isLikelyApiKeyBbProxyFailure({ response: { status: 404 } })).toBe(true);
    expect(isLikelyApiKeyBbProxyFailure({ response: { status: 405 } })).toBe(true);
  });

  it('returns true when the message text contains 404 or 405 as a whole number', () => {
    expect(isLikelyApiKeyBbProxyFailure({ message: 'Request failed with status code 404' })).toBe(true);
    expect(isLikelyApiKeyBbProxyFailure({ message: 'HTTP 405 Method Not Allowed' })).toBe(true);
  });

  it('returns false for other statuses / messages', () => {
    expect(isLikelyApiKeyBbProxyFailure({ status: 500 })).toBe(false);
    expect(isLikelyApiKeyBbProxyFailure({ status: 401 })).toBe(false);
    expect(isLikelyApiKeyBbProxyFailure({ message: 'network error' })).toBe(false);
    expect(isLikelyApiKeyBbProxyFailure({})).toBe(false);
  });

  it('does not match 404 / 405 embedded inside longer numbers', () => {
    // Guards against `/404/` matching e.g. 40455 in an unrelated id.
    expect(isLikelyApiKeyBbProxyFailure({ message: 'timeout after 4040ms' })).toBe(false);
    expect(isLikelyApiKeyBbProxyFailure({ message: 'request id 140500' })).toBe(false);
  });

  it('tolerates null / undefined inputs without throwing', () => {
    expect(isLikelyApiKeyBbProxyFailure(null)).toBe(false);
    expect(isLikelyApiKeyBbProxyFailure(undefined)).toBe(false);
  });
});

describe('isUsingApiKeyAuth', () => {
  afterEach(() => {
    // Restore whatever Vite injected originally.
    for (const key of Object.keys(import.meta.env)) {
      if (!(key in ORIGINAL_ENV)) delete import.meta.env[key];
    }
    Object.assign(import.meta.env, ORIGINAL_ENV);
  });

  it('is true when VITE_BASE44_API_KEY is set', async () => {
    import.meta.env.VITE_BASE44_API_KEY = 'test-key';
    const { isUsingApiKeyAuth } = await import('./bbClient');
    expect(isUsingApiKeyAuth()).toBe(true);
  });

  it('is false when VITE_BASE44_API_KEY is empty or missing', async () => {
    import.meta.env.VITE_BASE44_API_KEY = '';
    const { isUsingApiKeyAuth } = await import('./bbClient');
    expect(isUsingApiKeyAuth()).toBe(false);
  });
});

describe('canUseDirectBrowserbase', () => {
  beforeEach(() => {
    vi.resetModules();
    installLocalStorage();
    import.meta.env.DEV = true;
    import.meta.env.VITE_BASE44_API_KEY = 'test-key';
    localStorage.setItem('bb_credentials', JSON.stringify({
      apiKey: 'bb_live_abc', projectId: 'proj_1',
    }));
  });

  afterEach(() => {
    for (const key of Object.keys(import.meta.env)) {
      if (!(key in ORIGINAL_ENV)) delete import.meta.env[key];
    }
    Object.assign(import.meta.env, ORIGINAL_ENV);
    delete globalThis.localStorage;
  });

  it('is true when api_key auth + dev mode + stored BB key all hold', async () => {
    const { canUseDirectBrowserbase } = await import('./bbClient');
    expect(canUseDirectBrowserbase()).toBe(true);
  });

  it('is false when VITE_BASE44_API_KEY is unset (user-session auth)', async () => {
    import.meta.env.VITE_BASE44_API_KEY = '';
    const { canUseDirectBrowserbase } = await import('./bbClient');
    expect(canUseDirectBrowserbase()).toBe(false);
  });

  it('is false in a non-dev build (no Vite proxy available)', async () => {
    import.meta.env.DEV = false;
    const { canUseDirectBrowserbase } = await import('./bbClient');
    expect(canUseDirectBrowserbase()).toBe(false);
  });

  it('is false when no Browserbase API key is stored', async () => {
    localStorage.removeItem('bb_credentials');
    const { canUseDirectBrowserbase } = await import('./bbClient');
    expect(canUseDirectBrowserbase()).toBe(false);
  });

  it('is true when projectId is missing (projectId validated per-action in callDirect)', async () => {
    localStorage.setItem('bb_credentials', JSON.stringify({ apiKey: 'bb_live_abc' }));
    const { canUseDirectBrowserbase } = await import('./bbClient');
    // canUseDirectBrowserbase only gates on apiKey; projectId is checked
    // per-action inside callDirect for actions that need it.
    expect(canUseDirectBrowserbase()).toBe(true);
  });

  it('is false when apiKey is whitespace-only, true when only projectId is whitespace', async () => {
    localStorage.setItem('bb_credentials', JSON.stringify({ apiKey: '   ', projectId: 'proj_1' }));
    let { canUseDirectBrowserbase } = await import('./bbClient');
    expect(canUseDirectBrowserbase()).toBe(false);
    vi.resetModules();
    // projectId whitespace doesn't block the gate — only apiKey matters here.
    // Actions requiring projectId will fail early inside callDirect.
    localStorage.setItem('bb_credentials', JSON.stringify({ apiKey: 'bb_live_abc', projectId: '  ' }));
    ({ canUseDirectBrowserbase } = await import('./bbClient'));
    expect(canUseDirectBrowserbase()).toBe(true);
  });

  it('is false when stored credentials are malformed JSON', async () => {
    localStorage.setItem('bb_credentials', 'not-json');
    const { canUseDirectBrowserbase } = await import('./bbClient');
    expect(canUseDirectBrowserbase()).toBe(false);
  });
});

describe('bbClient dispatch', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    installLocalStorage();
  });

  afterEach(() => {
    for (const key of Object.keys(import.meta.env)) {
      if (!(key in ORIGINAL_ENV)) delete import.meta.env[key];
    }
    Object.assign(import.meta.env, ORIGINAL_ENV);
    delete globalThis.localStorage;
  });

  it('routes to the direct Browserbase client when api_key + dev + creds', async () => {
    import.meta.env.DEV = true;
    import.meta.env.VITE_BASE44_API_KEY = 'test-key';
    localStorage.setItem('bb_credentials', JSON.stringify({
      apiKey: 'bb_live_abc', projectId: 'proj_1',
    }));
    const bb = await import('./browserbaseApi');
    const { base44 } = await import('@/api/base44Client');
    const { bbClient } = await import('./bbClient');

    const sessions = await bbClient.listSessions();

    expect(bb.listSessions).toHaveBeenCalledWith('bb_live_abc', null);
    expect(base44.functions.invoke).not.toHaveBeenCalled();
    expect(sessions).toEqual([{ id: 'sess_1' }]);
  });

  it('passes projectId through to createSession on the direct path', async () => {
    import.meta.env.DEV = true;
    import.meta.env.VITE_BASE44_API_KEY = 'test-key';
    localStorage.setItem('bb_credentials', JSON.stringify({
      apiKey: 'bb_live_abc', projectId: 'proj_1',
    }));
    const bb = await import('./browserbaseApi');
    const { bbClient } = await import('./bbClient');

    await bbClient.createSession({ keepAlive: true });

    expect(bb.createSession).toHaveBeenCalledWith(
      'bb_live_abc',
      { projectId: 'proj_1', keepAlive: true },
    );
  });

  it('falls back to bbProxy when the direct path is not eligible', async () => {
    import.meta.env.DEV = false;
    import.meta.env.VITE_BASE44_API_KEY = '';
    localStorage.setItem('bb_credentials', JSON.stringify({
      apiKey: 'bb_live_abc', projectId: 'proj_1',
    }));
    const bb = await import('./browserbaseApi');
    const { base44 } = await import('@/api/base44Client');
    base44.functions.invoke.mockResolvedValueOnce({ data: { data: [{ id: 's' }] } });
    const { bbClient } = await import('./bbClient');

    const result = await bbClient.listSessions();

    expect(bb.listSessions).not.toHaveBeenCalled();
    expect(base44.functions.invoke).toHaveBeenCalledWith(
      'bbProxy',
      expect.objectContaining({ action: 'listSessions', projectId: 'proj_1' }),
    );
    expect(result).toEqual([{ id: 's' }]);
  });

  it('updateSession with no data defaults to REQUEST_RELEASE on the direct path', async () => {
    import.meta.env.DEV = true;
    import.meta.env.VITE_BASE44_API_KEY = 'test-key';
    localStorage.setItem('bb_credentials', JSON.stringify({
      apiKey: 'bb_live_abc', projectId: 'proj_1',
    }));
    const bb = await import('./browserbaseApi');
    const { bbClient } = await import('./bbClient');

    await bbClient.updateSession('sess_1');

    expect(bb.updateSession).toHaveBeenCalledWith(
      'bb_live_abc',
      'sess_1',
      { status: 'REQUEST_RELEASE', projectId: 'proj_1' },
    );
  });

  it('updateSession with userMetadata forwards it (and projectId) on the direct path', async () => {
    import.meta.env.DEV = true;
    import.meta.env.VITE_BASE44_API_KEY = 'test-key';
    localStorage.setItem('bb_credentials', JSON.stringify({
      apiKey: 'bb_live_abc', projectId: 'proj_1',
    }));
    const bb = await import('./browserbaseApi');
    const { bbClient } = await import('./bbClient');

    await bbClient.updateSession('sess_1', { userMetadata: { mirrorCommand: 'hi' } });

    expect(bb.updateSession).toHaveBeenCalledWith(
      'bb_live_abc',
      'sess_1',
      { userMetadata: { mirrorCommand: 'hi' }, projectId: 'proj_1' },
    );
  });

  it('getContext is dispatched to the direct path', async () => {
    import.meta.env.DEV = true;
    import.meta.env.VITE_BASE44_API_KEY = 'test-key';
    localStorage.setItem('bb_credentials', JSON.stringify({
      apiKey: 'bb_live_abc', projectId: 'proj_1',
    }));
    const bb = await import('./browserbaseApi');
    const { bbClient } = await import('./bbClient');

    await bbClient.getContext('ctx_1');

    expect(bb.getContext).toHaveBeenCalledWith('bb_live_abc', 'ctx_1');
  });
});
