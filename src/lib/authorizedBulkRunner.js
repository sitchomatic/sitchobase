import { bbClient } from '@/lib/bbClient';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function buildScript({ usernameSelector, passwordSelector, submitSelector, username, password }) {
  return `(() => {
    const setValue = (selector, value) => {
      const el = document.querySelector(selector);
      if (!el) return false;
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
      el.focus();
      if (setter) setter.call(el, value); else el.value = value;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    };
    const userOk = setValue(${JSON.stringify(usernameSelector)}, ${JSON.stringify(username)});
    const passOk = setValue(${JSON.stringify(passwordSelector)}, ${JSON.stringify(password)});
    const submit = document.querySelector(${JSON.stringify(submitSelector)});
    if (userOk && passOk && submit) submit.click();
    return { userOk, passOk, submitOk: !!submit, beforeUrl: location.href };
  })()`;
}

export async function runAuthorizedBulkQA({ rows, config, concurrency, onRowUpdate, shouldAbort }) {
  const queue = [...rows];
  const startedAt = Date.now();

  const runOne = async (row) => {
    let sessionId = null;
    const update = (patch) => onRowUpdate?.({ index: row.index, username: row.username, ...patch });
    update({ status: 'running', startedAt: new Date().toISOString() });

    try {
      const session = await bbClient.createSession({
        keepAlive: false,
        timeout: 120,
        browserSettings: { viewport: { width: 1366, height: 768 } },
        userMetadata: {
          launchedFrom: 'AuthorizedBulkQA',
          targetHost: new URL(config.targetUrl).host,
          rowIndex: row.index,
        },
      });
      sessionId = session.id;
      update({ sessionId });

      const ws = new WebSocket(session.connectUrl);
      const cdp = await new Promise((resolve, reject) => {
        const pending = new Map();
        let nextId = 1;
        const timer = setTimeout(() => reject(new Error('Browser connection timed out')), 15000);
        ws.onopen = () => {
          clearTimeout(timer);
          resolve({
            send(method, params = {}) {
              const id = nextId++;
              ws.send(JSON.stringify({ id, method, params }));
              return new Promise((res, rej) => {
                pending.set(id, { res, rej });
                setTimeout(() => {
                  if (pending.has(id)) {
                    pending.delete(id);
                    rej(new Error(`${method} timed out`));
                  }
                }, 20000);
              });
            },
            close() { try { ws.close(); } catch {} },
            _pending: pending,
          });
        };
        ws.onmessage = (event) => {
          const message = JSON.parse(event.data);
          if (!message.id || !pending.has(message.id)) return;
          const callbacks = pending.get(message.id);
          pending.delete(message.id);
          if (message.error) callbacks.rej(new Error(message.error.message));
          else callbacks.res(message.result);
        };
        ws.onerror = () => reject(new Error('Browser connection failed'));
      });

      try {
        await cdp.send('Page.enable');
        await cdp.send('Runtime.enable');
        await cdp.send('Page.navigate', { url: config.targetUrl });
        await sleep(3000);
        const fillResult = await cdp.send('Runtime.evaluate', {
          expression: buildScript({ ...config, username: row.username, password: row.password }),
          returnByValue: true,
          awaitPromise: true,
        });
        const fill = fillResult?.result?.value || {};
        if (!fill.userOk || !fill.passOk || !fill.submitOk) {
          throw new Error('One or more selectors were not found on the page.');
        }
        await sleep(4000);
        const stateResult = await cdp.send('Runtime.evaluate', {
          expression: `({ url: location.href, title: document.title, text: (document.body?.innerText || '').slice(0, 500) })`,
          returnByValue: true,
        });
        const state = stateResult?.result?.value || {};
        const changedUrl = state.url && state.url !== fill.beforeUrl;
        update({
          status: changedUrl ? 'passed' : 'review',
          outcome: changedUrl ? 'Navigation changed after submit' : 'Submitted; manual review recommended',
          finalUrl: state.url,
          pageTitle: state.title,
          endedAt: new Date().toISOString(),
        });
      } finally {
        cdp.close();
      }
    } catch (error) {
      update({ status: 'failed', outcome: error.message, endedAt: new Date().toISOString() });
    } finally {
      if (sessionId) await bbClient.updateSession(sessionId).catch(() => {});
    }
  };

  const worker = async () => {
    while (queue.length && !shouldAbort?.()) {
      const row = queue.shift();
      if (row) await runOne(row);
    }
  };

  await Promise.all(Array.from({ length: concurrency }, worker));
  return { durationMs: Date.now() - startedAt };
}