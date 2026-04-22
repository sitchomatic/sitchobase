import { describe, it, expect } from 'vitest';
import {
  classifyOutcome,
  finalOutcomeFromResults,
  JOE_IGNITE_CONFIG,
} from './joeIgniteConfig';

describe('classifyOutcome', () => {
  it('returns SUCCESS when successBanner is true', () => {
    expect(classifyOutcome({ successBanner: true })).toBe('SUCCESS');
  });

  it('returns SUCCESS for logged-in URL markers', () => {
    expect(classifyOutcome({ url: 'https://x/account' })).toBe('SUCCESS');
    expect(classifyOutcome({ url: 'https://x/lobby' })).toBe('SUCCESS');
    expect(classifyOutcome({ url: 'https://x/dashboard' })).toBe('SUCCESS');
  });

  it('returns SUCCESS for logged-in body text markers', () => {
    expect(classifyOutcome({ text: 'Logout' })).toBe('SUCCESS');
    expect(classifyOutcome({ text: 'Sign Out' })).toBe('SUCCESS');
    expect(classifyOutcome({ text: 'My Account' })).toBe('SUCCESS');
  });

  it('returns TEMP_LOCK for the exact temp-lock phrase', () => {
    expect(classifyOutcome({ text: 'Your account is temporarily disabled.' }))
      .toBe('TEMP_LOCK');
  });

  it('returns PERM_BAN for the exact ban phrase', () => {
    expect(classifyOutcome({ text: 'This account has been disabled.' }))
      .toBe('PERM_BAN');
  });

  it('prioritizes SUCCESS signals over lock/ban text', () => {
    // If the page shows both a success marker and the ban phrase (unlikely
    // but worth pinning), SUCCESS wins — SUCCESS checks come first.
    expect(
      classifyOutcome({ url: 'https://x/account', text: 'has been disabled' })
    ).toBe('SUCCESS');
  });

  it('returns CONTINUE for an "incorrect" response', () => {
    expect(classifyOutcome({ text: 'Username or password is incorrect.' }))
      .toBe('CONTINUE');
  });

  it('returns CONTINUE when no signal matches', () => {
    expect(classifyOutcome({})).toBe('CONTINUE');
    expect(classifyOutcome({ text: 'something else entirely' }))
      .toBe('CONTINUE');
  });

  it('is case-insensitive for URL and text matching', () => {
    expect(classifyOutcome({ url: 'HTTPS://X/ACCOUNT' })).toBe('SUCCESS');
    expect(classifyOutcome({ text: 'HAS BEEN DISABLED' })).toBe('PERM_BAN');
  });
});

describe('finalOutcomeFromResults', () => {
  it('returns SUCCESS if either site succeeded', () => {
    expect(finalOutcomeFromResults({ joe: 'SUCCESS', ignition: 'CONTINUE' }))
      .toBe('SUCCESS');
    expect(finalOutcomeFromResults({ joe: 'CONTINUE', ignition: 'SUCCESS' }))
      .toBe('SUCCESS');
  });

  it('prefers PERM_BAN over TEMP_LOCK and NO_ACCOUNT', () => {
    expect(finalOutcomeFromResults({ joe: 'PERM_BAN', ignition: 'TEMP_LOCK' }))
      .toBe('PERM_BAN');
    expect(finalOutcomeFromResults({ joe: 'PERM_BAN', ignition: 'CONTINUE' }))
      .toBe('PERM_BAN');
  });

  it('returns TEMP_LOCK over NO_ACCOUNT', () => {
    expect(finalOutcomeFromResults({ joe: 'TEMP_LOCK', ignition: 'CONTINUE' }))
      .toBe('TEMP_LOCK');
  });

  it('returns ERROR only when both sites errored', () => {
    expect(finalOutcomeFromResults({ joe: 'ERROR', ignition: 'ERROR' }))
      .toBe('ERROR');
    // Mixed ERROR + CONTINUE → still NO_ACCOUNT (CONTINUE means "incorrect")
    expect(finalOutcomeFromResults({ joe: 'ERROR', ignition: 'CONTINUE' }))
      .toBe('NO_ACCOUNT');
  });

  it('returns NO_ACCOUNT when both sites only ever returned CONTINUE', () => {
    expect(finalOutcomeFromResults({ joe: 'CONTINUE', ignition: 'CONTINUE' }))
      .toBe('NO_ACCOUNT');
  });
});

describe('JOE_IGNITE_CONFIG', () => {
  it('exposes the sites / selectors contract the runner relies on', () => {
    expect(JOE_IGNITE_CONFIG.SITES.joe.selectors)
      .toMatchObject({ username: expect.any(String), password: expect.any(String), submit: expect.any(String) });
    expect(JOE_IGNITE_CONFIG.SITES.ignition.selectors)
      .toMatchObject({ username: expect.any(String), password: expect.any(String), submit: expect.any(String) });
  });

  it('includes all outcomes used by classifier and finalizer', () => {
    for (const outcome of ['SUCCESS', 'PERM_BAN', 'TEMP_LOCK', 'NO_ACCOUNT', 'CONTINUE', 'ERROR']) {
      expect(JOE_IGNITE_CONFIG.OUTCOMES).toContain(outcome);
    }
  });
});
