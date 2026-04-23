import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const THRESHOLD_ERROR_RATE = 10;
const THRESHOLD_SLOW_CALLS = 5;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const today = new Date().toISOString().slice(0, 10);
    const metrics = await base44.asServiceRole.entities.DailyMetric.filter({ date: today, action: '__total__' }, '-created_date', 1);
    const slowCalls = await base44.asServiceRole.entities.SlowCall.list('-created_date', 20);
    const total = metrics?.[0] || null;
    const errorRate = total?.count ? ((total.errors || 0) / total.count) * 100 : 0;
    const recentSlow = (slowCalls || []).filter((row) => {
      if (!row.created_date) return false;
      return Date.now() - new Date(row.created_date).getTime() < 24 * 60 * 60 * 1000;
    });

    const alerts = [];
    if (errorRate >= THRESHOLD_ERROR_RATE) alerts.push(`High error rate: ${errorRate.toFixed(1)}%`);
    if (recentSlow.length >= THRESHOLD_SLOW_CALLS) alerts.push(`High slow-call volume: ${recentSlow.length} in the last 24h`);

    return Response.json({
      ok: true,
      date: today,
      total_calls: total?.count || 0,
      total_errors: total?.errors || 0,
      error_rate: Number(errorRate.toFixed(1)),
      slow_calls_24h: recentSlow.length,
      alerts,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});