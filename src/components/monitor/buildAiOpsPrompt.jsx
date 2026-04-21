export function buildAiOpsPrompt({ sessions, failureGroups, stuckSessions, anomalies }) {
  return `You are analyzing a Browserbase observation dashboard.

Running sessions: ${sessions.length}
Potentially stuck sessions: ${stuckSessions.length}
Anomalies: ${anomalies.length}

Sessions:
${sessions.map((s) => `- ${s.id} | status=${s.status} | region=${s.region || 'unknown'} | startedAt=${s.startedAt || 'n/a'} | proxyBytes=${s.proxyBytes || 0}`).join('\n')}

Failure groups:
${failureGroups.length ? failureGroups.map((group) => `- ${group.key}: ${group.count} sessions\n  ${group.samples.map((sample) => `${sample.sessionId}: ${sample.message}`).join('\n  ')}`).join('\n') : '- none'}

Stuck sessions:
${stuckSessions.length ? stuckSessions.map((item) => `- ${item.session.id}: idle ${item.idleMinutes} min`).join('\n') : '- none'}

Anomalies:
${anomalies.length ? anomalies.map((item) => `- ${item.sessionId}: ${item.title} - ${item.detail}`).join('\n') : '- none'}

Give:
1. a very short summary
2. grouped failure interpretation
3. 3 concrete fix suggestions
Keep it concise and operational.`;
}