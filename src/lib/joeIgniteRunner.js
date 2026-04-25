/**
 * Joe Ignite runner — orchestrates a queue of credentials with N concurrent workers.
 * Each worker: creates a BB session → runs runCredentialInSession → closes the session.
 */
import { bbClient } from '@/lib/bbClient';
import { base44 } from '@/api/base44Client';
import { JOE_IGNITE_CONFIG, finalOutcomeFromResults } from '@/lib/joeIgniteConfig';
import { runCredentialInSession } from '@/lib/joeIgniteCDP';
import { fetchEnabledProxies, toBrowserbaseProxy, createRoundRobinPicker } from '@/lib/proxyPool';
import { inferProxyProvider } from '@/lib/proxyProvider';
import { applyAuMobilePreset } from '@/lib/auMobilePreset';

export async function runJoeIgniteBatch({
  credentials,
  concurrency = JOE_IGNITE_CONFIG.DEFAULT_CONCURRENCY,
  batchId,
  onRowUpdate,
  onComplete,
  shouldAbort,
  proxySource = 'none', // 'none' | 'bb-au' | 'pool'
  auMobile = false,     // iPhone UA + mobile viewport + en-AU locale + ap-southeast-1 region
}) {
  const queue = credentials.map((c, i) => ({ ...c, index: i }));
  const inflight = new Set();

  // Load external proxy pool only when selected
  const proxyPool = proxySource === 'pool' ? await fetchEnabledProxies().catch(() => []) : [];
  const pickProxy = createRoundRobinPicker(proxyPool);

  const runOne = async (cred) => {
    const update = (patch) => onRowUpdate?.({ email: cred.email, index: cred.index, ...patch });
    const startedAt = new Date().toISOString();
    update({ status: 'running', startedAt });

    let sessionId = null;
    let released = false;
    let outcomeStatus = 'error';
    let attempts = 0;
    let results = { joe: null, ignition: null };
    const detailsTrail = [];
    const assignedProxy = proxySource === 'pool' ? pickProxy() : null;

    const releaseSession = async () => {
      if (!sessionId || released) return;
      released = true;
      try { await bbClient.updateSession(sessionId); } catch (e) {
        detailsTrail.push(`release-failed: ${e.message}`);
      }
    };

    try {
      let sessionOpts = {
        timeout: 60,
        browserSettings: { viewport: { width: 1366, height: 768 } },
        userMetadata: { launchedFrom: 'BBCommandCenter', testRun: 'joe_ignite', task: 'login-verify', email: cred.email, batchId, proxySource, proxyId: assignedProxy?.id, auMobile },
      };
      if (proxySource === 'bb-au') {
        sessionOpts.proxies = [{ type: 'browserbase', geolocation: { country: 'AU' } }];
      } else if (assignedProxy) {
        sessionOpts.proxies = [toBrowserbaseProxy(assignedProxy)];
      }
      if (auMobile) sessionOpts = applyAuMobilePreset(sessionOpts);
      const session = await bbClient.createSession(sessionOpts);
      sessionId = session.id;
      update({ sessionId });

      const run = await runCredentialInSession({
        connectUrl: session.connectUrl,
        email: cred.email,
        password: cred.password,
        auMobile,
        onProgress: (p) => {
          attempts = p.attempt ?? attempts;
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
      outcomeStatus = finalOutcomeFromResults(results).toLowerCase();
    } catch (err) {
      detailsTrail.push(`FATAL: ${err.message}`);
      outcomeStatus = 'error';
    } finally {
      await releaseSession();
    }

    const isBurned = outcomeStatus === 'success' || outcomeStatus === 'perm_ban';
    const proxyProvider = proxySource === 'bb-au'
      ? 'bb-au'
      : (assignedProxy ? inferProxyProvider(assignedProxy) : 'none');
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
      proxyId: assignedProxy?.id || null,
      proxyProvider,
      startedAt,
      endedAt: new Date().toISOString(),
    };

    try { await base44.entities.JoeIgniteRun.create(payload); }
    catch (e) { console.warn('JoeIgniteRun persist failed:', e.message); }

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