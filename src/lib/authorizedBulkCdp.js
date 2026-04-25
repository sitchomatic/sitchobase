const DEFAULT_COMMAND_TIMEOUT_MS = 20_000;

export function wait(ms, signal) {
  if (signal?.aborted) return Promise.reject(new DOMException('Aborted', 'AbortError'));
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    const abort = () => {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    signal?.addEventListener('abort', abort, { once: true });
  });
}

export function createAbortSignal(shouldAbort) {
  const controller = new AbortController();
  const interval = setInterval(() => {
    if (shouldAbort?.()) controller.abort();
  }, 250);
  controller.signal.addEventListener('abort', () => clearInterval(interval), { once: true });
  return controller;
}

export function connectCdp(connectUrl, { timeoutMs = 15_000 } = {}) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(connectUrl);
    const pending = new Map();
    let nextId = 1;
    let opened = false;

    const failPending = (error) => {
      for (const { reject: rejectCommand, timer } of pending.values()) {
        clearTimeout(timer);
        rejectCommand(error);
      }
      pending.clear();
    };

    const startupTimer = setTimeout(() => {
      failPending(new Error('Browser connection timed out'));
      try { socket.close(); } catch {}
      reject(new Error('Browser connection timed out'));
    }, timeoutMs);

    socket.onopen = () => {
      opened = true;
      clearTimeout(startupTimer);
      resolve({
        send(method, params = {}, commandTimeoutMs = DEFAULT_COMMAND_TIMEOUT_MS) {
          if (socket.readyState !== WebSocket.OPEN) {
            return Promise.reject(new Error('Browser connection is closed'));
          }

          const id = nextId++;
          socket.send(JSON.stringify({ id, method, params }));

          return new Promise((resolveCommand, rejectCommand) => {
            const timer = setTimeout(() => {
              pending.delete(id);
              rejectCommand(new Error(`${method} timed out`));
            }, commandTimeoutMs);
            pending.set(id, { resolve: resolveCommand, reject: rejectCommand, timer });
          });
        },
        close() {
          failPending(new Error('Browser connection closed'));
          try { socket.close(); } catch {}
        },
      });
    };

    socket.onmessage = (event) => {
      let message;
      try {
        message = JSON.parse(event.data);
      } catch {
        return;
      }

      if (!message.id || !pending.has(message.id)) return;
      const command = pending.get(message.id);
      pending.delete(message.id);
      clearTimeout(command.timer);

      if (message.error) command.reject(new Error(message.error.message || 'Browser command failed'));
      else command.resolve(message.result);
    };

    socket.onerror = () => {
      const error = new Error('Browser connection failed');
      clearTimeout(startupTimer);
      failPending(error);
      if (!opened) reject(error);
    };

    socket.onclose = () => {
      clearTimeout(startupTimer);
      failPending(new Error('Browser connection closed'));
    };
  });
}

export async function evaluate(cdp, expression, options = {}, timeoutMs = DEFAULT_COMMAND_TIMEOUT_MS) {
  const result = await cdp.send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
    ...options,
  }, timeoutMs);
  if (result?.exceptionDetails) {
    throw new Error(result.exceptionDetails.text || 'Page evaluation failed');
  }
  return result?.result?.value;
}

export async function waitForPageIdle(cdp, signal, timeoutMs = 12_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const state = await evaluate(cdp, 'document.readyState');
    if (state === 'complete' || state === 'interactive') return;
    await wait(300, signal);
  }
}