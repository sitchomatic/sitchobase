/**
 * Pagination helper (#34). Loops `entity.list()` in page-sized chunks until
 * either (a) a page returns less than pageSize (end), or (b) we hit hardCap
 * as a safety net.
 *
 * Example:
 *   const all = await listAllPaginated(base44.entities.ProxyPool, '-created_date');
 */
export async function listAllPaginated(entity, orderBy = '-created_date', { pageSize = 500, hardCap = 10_000 } = {}) {
  const out = [];
  let skip = 0;
  while (out.length < hardCap) {
    // Base44 SDK list() supports (orderBy, limit, skip) on most entities.
    let page;
    try {
      page = await entity.list(orderBy, pageSize, skip);
    } catch {
      // Older signature: list(orderBy, limit)
      page = await entity.list(orderBy, pageSize);
      return page;
    }
    if (!Array.isArray(page) || page.length === 0) break;
    out.push(...page);
    if (page.length < pageSize) break;
    skip += pageSize;
  }
  return out;
}