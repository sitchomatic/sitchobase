export function detectFleetFailurePatterns(sessions, logsBySession) {
  const alerts = [];
  const patternMatches = {
    forbidden403: [],
    highMemory: [],
    scriptTimeout: [],
  };

  sessions.forEach((session) => {
    const logs = logsBySession[session.id] || [];
    logs.forEach((log) => {
      const text = String(log.text || '').toLowerCase();
      if (text.includes('403 forbidden') || text.includes('status 403') || text.includes('forbidden')) {
        patternMatches.forbidden403.push(session.id);
      }
      if (text.includes('high memory') || text.includes('memory usage') || text.includes('out of memory') || text.includes('heap')) {
        patternMatches.highMemory.push(session.id);
      }
      if (text.includes('timeout') || text.includes('timed out') || text.includes('script timeout')) {
        patternMatches.scriptTimeout.push(session.id);
      }
    });
  });

  const unique = (items) => [...new Set(items)];

  const forbiddenSessions = unique(patternMatches.forbidden403);
  const memorySessions = unique(patternMatches.highMemory);
  const timeoutSessions = unique(patternMatches.scriptTimeout);

  if (forbiddenSessions.length > 0) {
    alerts.push({
      id: `fleet-403-${forbiddenSessions.length}`,
      type: '403_FORBIDDEN',
      severity: forbiddenSessions.length >= 3 ? 'high' : 'medium',
      title: '403 failures detected',
      detail: `${forbiddenSessions.length} session${forbiddenSessions.length > 1 ? 's' : ''} hit access-forbidden errors.`,
      sessionIds: forbiddenSessions,
    });
  }

  if (memorySessions.length > 0) {
    alerts.push({
      id: `fleet-memory-${memorySessions.length}`,
      type: 'HIGH_MEMORY',
      severity: memorySessions.length >= 2 ? 'high' : 'medium',
      title: 'High memory pressure',
      detail: `${memorySessions.length} session${memorySessions.length > 1 ? 's show' : ' shows'} memory pressure signals.`,
      sessionIds: memorySessions,
    });
  }

  if (timeoutSessions.length > 0) {
    alerts.push({
      id: `fleet-timeout-${timeoutSessions.length}`,
      type: 'SCRIPT_TIMEOUT',
      severity: timeoutSessions.length >= 3 ? 'high' : 'medium',
      title: 'Script timeouts detected',
      detail: `${timeoutSessions.length} session${timeoutSessions.length > 1 ? 's' : ''} reported timeout patterns.`,
      sessionIds: timeoutSessions,
    });
  }

  return alerts.sort((a, b) => b.sessionIds.length - a.sessionIds.length);
}

export function getFleetAlertSummary(alerts) {
  return {
    total: alerts.length,
    high: alerts.filter((a) => a.severity === 'high').length,
    medium: alerts.filter((a) => a.severity === 'medium').length,
  };
}