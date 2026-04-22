import { describe, it, expect, beforeEach, vi } from 'vitest';

// proxyPool imports @/api/base44Client at module top; stub it so tests run in node.
vi.mock('@/api/base44Client', () => ({
  base44: { entities: { ProxyPool: { list: vi.fn() } } },
}));

import { toBrowserbaseProxy, parseProxyList, createRoundRobinPicker } from './proxyPool';

describe('toBrowserbaseProxy', () => {
  it('maps server + optional creds to the Browserbase external-proxy shape', () => {
    expect(toBrowserbaseProxy({ server: 'host:8080' }))
      .toEqual({ type: 'external', server: 'host:8080' });
    expect(toBrowserbaseProxy({ server: 'host:8080', username: 'u', password: 'p' }))
      .toEqual({ type: 'external', server: 'host:8080', username: 'u', password: 'p' });
  });

  it('omits username/password when not provided', () => {
    const result = toBrowserbaseProxy({ server: 'host:1', username: '' });
    expect(result).not.toHaveProperty('username');
    expect(result).not.toHaveProperty('password');
  });
});

describe('parseProxyList', () => {
  it('parses host:port:user:pass lines', () => {
    expect(parseProxyList('1.2.3.4:8080:alice:secret')).toEqual([
      { server: '1.2.3.4:8080', username: 'alice', password: 'secret', enabled: true },
    ]);
  });

  it('parses host:port lines', () => {
    expect(parseProxyList('1.2.3.4:8080')).toEqual([
      { server: '1.2.3.4:8080', enabled: true },
    ]);
  });

  it('parses user:pass@host:port lines', () => {
    expect(parseProxyList('alice:secret@1.2.3.4:8080')).toEqual([
      { username: 'alice', password: 'secret', server: '1.2.3.4:8080', enabled: true },
    ]);
  });

  it('handles mixed formats, blank lines, and whitespace', () => {
    const input = [
      '',
      '  1.2.3.4:8080  ',
      '',
      'alice:secret@5.6.7.8:9090',
      '9.9.9.9:1111:bob:pw',
    ].join('\n');
    expect(parseProxyList(input)).toEqual([
      { server: '1.2.3.4:8080', enabled: true },
      { username: 'alice', password: 'secret', server: '5.6.7.8:9090', enabled: true },
      { server: '9.9.9.9:1111', username: 'bob', password: 'pw', enabled: true },
    ]);
  });

  it('drops lines that do not match any supported format', () => {
    expect(parseProxyList('not a proxy\nfoo\n1.2.3.4')).toEqual([]);
  });

  it('accepts CRLF input', () => {
    expect(parseProxyList('1.1.1.1:80\r\n2.2.2.2:81')).toEqual([
      { server: '1.1.1.1:80', enabled: true },
      { server: '2.2.2.2:81', enabled: true },
    ]);
  });
});

describe('createRoundRobinPicker', () => {
  beforeEach(() => {
    // jsdom-free localStorage shim.
    const store = new Map();
    globalThis.localStorage = {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => { store.set(k, String(v)); },
      removeItem: (k) => { store.delete(k); },
      clear: () => store.clear(),
    };
  });

  it('returns null when the pool is empty', () => {
    const pick = createRoundRobinPicker([]);
    expect(pick()).toBeNull();
  });

  it('cycles through the pool in order', () => {
    const a = { server: 'a:1' };
    const b = { server: 'b:2' };
    const c = { server: 'c:3' };
    const pick = createRoundRobinPicker([a, b, c]);
    expect(pick()).toBe(a);
    expect(pick()).toBe(b);
    expect(pick()).toBe(c);
    expect(pick()).toBe(a);
  });

  it('persists the cursor across picker instances via localStorage', () => {
    const pool = [{ server: 'a' }, { server: 'b' }, { server: 'c' }];
    const first = createRoundRobinPicker(pool);
    first();
    first();
    // Next picker should resume at index 2.
    const second = createRoundRobinPicker(pool);
    expect(second().server).toBe('c');
    expect(second().server).toBe('a');
  });
});
