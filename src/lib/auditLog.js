/**
 * Lightweight audit logger.
 * Call auditLog({ action, category, targetId, details, status }) anywhere in the app.
 * Writes an immutable AuditLog record via the Base44 SDK.
 */
import { base44 } from '@/api/base44Client';

export async function auditLog({ action, category, targetId = null, details = {}, status = 'success' }) {
  try {
    window.dispatchEvent(new CustomEvent('app-audit-log', { detail: { action, category, targetId, status } }));
  } catch {
    // Ignore non-browser environments
  }

  try {
    const user = await base44.auth.me();
    await base44.entities.AuditLog.create({
      action,
      category,
      actor: user?.email ?? 'unknown',
      target_id: targetId,
      details,
      status,
    });
  } catch {
    // Never let audit logging break the main flow
  }
}