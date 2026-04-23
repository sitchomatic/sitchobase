/**
 * Scheduled cleanup (#49) — archives / deletes JoeIgniteRun records older
 * than 90 days to prevent the table from ballooning.
 *
 * Admin-only invoke. Intended to be wired to a daily scheduled automation.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const CUTOFF_DAYS = 90;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    // Allow the scheduler (no user) and admins; reject everyone else.
    if (user && user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: admin only' }, { status: 403 });
    }

    const cutoff = new Date(Date.now() - CUTOFF_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const old = await base44.asServiceRole.entities.JoeIgniteRun.filter({
      created_date: { $lt: cutoff },
    }, '-created_date', 500);

    let deleted = 0, failed = 0;
    for (const row of old || []) {
      try {
        await base44.asServiceRole.entities.JoeIgniteRun.delete(row.id);
        deleted++;
      } catch {
        failed++;
      }
    }
    return Response.json({ ok: true, deleted, failed, cutoff });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});