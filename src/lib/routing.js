/**
 * Routing helpers shared between the app shell and tests.
 */

// Detail routes that should be collapsed onto their parent so that:
//   1. Navigating between detail pages (e.g. /sessions/a -> /sessions/b)
//      does not re-trigger the page-level slide transition.
//   2. The parent sidebar link stays highlighted on detail pages.
//
// Uses strict prefix checks (explicit `/` separator or exact match) so
// unrelated siblings like `/sessions-archive` do not collapse onto
// `/sessions`.
const DETAIL_PARENTS = ['/sessions', '/audit'];

export function rootPathFor(pathname) {
  for (const parent of DETAIL_PARENTS) {
    if (pathname === parent || pathname.startsWith(`${parent}/`)) {
      return parent;
    }
  }
  return pathname;
}
