export function normalizeLogEntry(sessionId, raw, index = 0) {
  const text = typeof raw === 'string' ? raw : JSON.stringify(raw);
  const lower = text.toLowerCase();
  const level = lower.includes('error') || lower.includes('failed') ? 'error' : lower.includes('warn') ? 'warn' : 'info';
  return {
    id: `${sessionId}-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`,
    sessionId,
    ts: new Date().toISOString(),
    text,
    level,
  };
}

export function buildTimelineItems(sessions, logsBySession) {
  return sessions
    .flatMap((session) => {
      const base = [{
        id: `session-${session.id}`,
        sessionId: session.id,
        ts: session.updatedAt || session.startedAt || session.createdAt || new Date().toISOString(),
        type: 'session',
        level: session.status === 'ERROR' || session.status === 'TIMED_OUT' ? 'error' : 'info',
        text: `Status ${session.status}${session.region ? ` · ${session.region}` : ''}`,
      }];
      const logs = (logsBySession[session.id] || []).map((log) => ({
        ...log,
        type: 'log',
      }));
      return [...base, ...logs];
    })
    .sort((a, b) => new Date(b.ts) - new Date(a.ts));
}

export function detectStuckSessions(sessions, logsBySession) {
  const now = Date.now();
  return sessions
    .filter((session) => session.status === 'RUNNING')
    .map((session) => {
      const latestLog = (logsBySession[session.id] || []).slice(-1)[0];
      const lastActivity = latestLog?.ts || session.updatedAt || session.startedAt || session.createdAt;
      const idleMinutes = Math.floor((now - new Date(lastActivity).getTime()) / 60000);
      return {
        session,
        idleMinutes,
        stuck: idleMinutes >= 3,
      };
    })
    .filter((item) => item.stuck)
    .sort((a, b) => b.idleMinutes - a.idleMinutes);
}

export function detectAnomalies(sessions, logsBySession) {
  return sessions.flatMap((session) => {
    const anomalies = [];
    const logs = logsBySession[session.id] || [];
    const errorLogs = logs.filter((log) => log.level === 'error');

    if (session.status === 'ERROR' || session.status === 'TIMED_OUT') {
      anomalies.push({
        id: `status-${session.id}`,
        sessionId: session.id,
        severity: 'high',
        title: `Session ${session.status}`,
        detail: 'Session entered a failed state.',
      });
    }

    if (errorLogs.length >= 3) {
      anomalies.push({
        id: `logs-${session.id}`,
        sessionId: session.id,
        severity: 'medium',
        title: 'Repeated error logs',
        detail: `${errorLogs.length} error-like log entries detected.`,
      });
    }

    if (!session.connectUrl) {
      anomalies.push({
        id: `cdp-${session.id}`,
        sessionId: session.id,
        severity: 'low',
        title: 'Missing connect URL',
        detail: 'Live observation may be limited for this session.',
      });
    }

    return anomalies;
  });
}

export function groupFailures(sessions, logsBySession) {
  const groups = {};

  sessions.forEach((session) => {
    const failed = session.status === 'ERROR' || session.status === 'TIMED_OUT';
    const errorLog = (logsBySession[session.id] || []).find((log) => log.level === 'error');
    if (!failed && !errorLog) return;

    const key = failed ? session.status : 'LOG_ERROR';
    if (!groups[key]) groups[key] = [];
    groups[key].push({
      sessionId: session.id,
      message: errorLog?.text || `Session ended with ${session.status}`,
    });
  });

  return Object.entries(groups).map(([key, items]) => ({
    key,
    count: items.length,
    samples: items.slice(0, 3),
  }));
}