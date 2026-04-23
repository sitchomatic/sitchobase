import { describe, it, expect, vi, beforeEach } from 'vitest';

const create = vi.fn(async () => ({}));
vi.mock('@/api/base44Client', () => ({
  base44: { entities: { FrontendError: { create } } },
}));

import { reportFrontendError } from './frontendErrorReporter.js';

describe('frontendErrorReporter', () => {
  beforeEach(() => { create.mockClear(); });

  it('sends a basic error', async () => {
    await reportFrontendError({ message: 'boom', source: 'render' });
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('dedupes within the window', async () => {
    await reportFrontendError({ message: 'dedup-me', source: 'render' });
    await reportFrontendError({ message: 'dedup-me', source: 'render' });
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('swallows errors from the entity create', async () => {
    create.mockImplementationOnce(() => { throw new Error('db down'); });
    await expect(reportFrontendError({ message: 'ok', source: 'render' })).resolves.not.toThrow();
  });
});