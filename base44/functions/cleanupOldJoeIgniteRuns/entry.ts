/**
 * Scheduled cleanup (#49) — archives / deletes JoeIgniteRun records older
 * than 90 days to prevent the table from ballooning.
 *
 * Admin-only invoke. Intended to be wired to a daily scheduled automation.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const CUTOFF_DAYS = 90;
const MAX_DELETE_PER_RUN = 500;
// Each target: { name, filter(cutoff) } — JoeIgniteRun/SlowCall/FrontendError
// purge by created_date; IdempotencyKey purges by its own expires_at field
// (TTL = 1h) so we keep the entity bounded without waiting 90 days.
const CLEANUP_TARGETS = [
  { name: 'JoeIgniteRun', filter: (cutoff) => ({ created_date: { $lt: cutoff } }) },
  { name: 'SlowCall', filter: (cutoff) => ({ created_date: { $lt: cutoff } }) },
  { name: 'FrontendError', filter: (cutoff) => ({ created_date: { $lt: cutoff } }) },
  { name: 'IdempotencyKey', filter: () => ({ expires_at: { $lt: new Date().toISOString() } }) },
];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    // Allow the scheduler (no user) and admins; reject everyone else.
    if (user && user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: admin only' }, { status: 403 });
    }

    const cutoff = new Date(Date.now() - CUTOFF_DAYS * 24 * 60 * 60 * 1000).toISOString();
    let deleted = 0;
    let failed = 0;
    const byEntity = {};

    for (const target of CLEANUP_TARGETS) {
      const entity = base44.asServiceRole.entities[target.name];
      const rows = await entity.filter(target.filter(cutoff), '-created_date', MAX_DELETE_PER_RUN);
      let entityDeleted = 0;
      let entityFailed = 0;

      for (const row of rows || []) {
        try {
          await entity.delete(row.id);
          deleted++;
          entityDeleted++;
        } catch {
          failed++;
          entityFailed++;
        }
      }

      byEntity[target.name] = { deleted: entityDeleted, failed: entityFailed };
    }

    return Response.json({ ok: true, deleted, failed, cutoff, byEntity });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});