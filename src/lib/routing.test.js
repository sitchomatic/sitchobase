import { describe, it, expect } from 'vitest';
import { rootPathFor } from './routing';

describe('rootPathFor', () => {
  it('returns the pathname unchanged for top-level routes', () => {
    expect(rootPathFor('/')).toBe('/');
    expect(rootPathFor('/settings')).toBe('/settings');
    expect(rootPathFor('/reports')).toBe('/reports');
  });

  it('collapses /sessions/:id onto /sessions', () => {
    expect(rootPathFor('/sessions')).toBe('/sessions');
    expect(rootPathFor('/sessions/abc123')).toBe('/sessions');
    expect(rootPathFor('/sessions/abc/logs')).toBe('/sessions');
  });

  it('collapses /audit/:id onto /audit', () => {
    expect(rootPathFor('/audit')).toBe('/audit');
    expect(rootPathFor('/audit/evt_42')).toBe('/audit');
  });

  it('does not collapse unrelated siblings that share a prefix', () => {
    // Guards against a regression where `startsWith('/sessions')` matched
    // e.g. `/sessions-archive` and silently changed the active sidebar item.
    expect(rootPathFor('/sessions-archive')).toBe('/sessions-archive');
    expect(rootPathFor('/sessionsx')).toBe('/sessionsx');
    expect(rootPathFor('/audit-history')).toBe('/audit-history');
  });

  it('does not cross-contaminate detail prefixes', () => {
    expect(rootPathFor('/fleet')).toBe('/fleet');
    expect(rootPathFor('/contexts/ctx_1')).toBe('/contexts/ctx_1');
  });
});
