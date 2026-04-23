/**
 * Tests for pagination helper (#34 companion test).
 */
import { describe, it, expect, vi } from 'vitest';
import { listAllPaginated } from './paginated.js';

function mockEntity(pages) {
  let call = 0;
  return {
    list: vi.fn(async () => {
      const page = pages[call] || [];
      call++;
      return page;
    }),
  };
}

describe('listAllPaginated', () => {
  it('concatenates multiple full pages until a short page signals end', async () => {
    const e = mockEntity([
      Array.from({ length: 500 }, (_, i) => ({ id: i })),
      Array.from({ length: 500 }, (_, i) => ({ id: 500 + i })),
      Array.from({ length: 42 }, (_, i) => ({ id: 1000 + i })),
    ]);
    const all = await listAllPaginated(e, '-created_date');
    expect(all.length).toBe(1042);
  });

  it('stops at hardCap to prevent runaways', async () => {
    const e = {
      list: vi.fn(async () => Array.from({ length: 500 }, () => ({ id: 'x' }))),
    };
    const all = await listAllPaginated(e, '-created_date', { hardCap: 1200 });
    expect(all.length).toBeLessThanOrEqual(1200);
  });

  it('handles empty results', async () => {
    const e = { list: vi.fn(async () => []) };
    const all = await listAllPaginated(e);
    expect(all).toEqual([]);
  });
});