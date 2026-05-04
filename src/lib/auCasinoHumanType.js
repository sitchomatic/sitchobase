/**
 * Human-like typing helper for the AU casino dual-target validator.
 *
 * GOAL.md §Phase 5 calls for 20–70ms per-keystroke jitter. We do the
 * focus + clear in JS (fast, reliable) then dispatch one `input` event
 * per character with a randomised delay between them. This produces an
 * input timeline indistinguishable from real mobile keyboard typing in
 * the casinos' bot-detection telemetry.
 */
import { evaluate, wait } from '@/lib/authorizedBulkCdp';

const MIN_DELAY_MS = 20;
const MAX_DELAY_MS = 70;

function jitter() {
  return MIN_DELAY_MS + Math.floor(Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS + 1));
}

function buildFocusAndClearScript(selector) {
  return `(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) return { ok: false };
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    el.focus();
    if (setter) setter.call(el, ''); else el.value = '';
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return { ok: true };
  })()`;
}

function buildAppendCharScript(selector, char) {
  return `(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) return { ok: false };
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    const next = (el.value || '') + ${JSON.stringify(char)};
    if (setter) setter.call(el, next); else el.value = next;
    el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: ${JSON.stringify(char)} }));
    return { ok: true };
  })()`;
}

/**
 * Type `value` into the element matched by `selector`, one character at
 * a time with 20–70ms jitter between keystrokes. Aborts cleanly if the
 * caller's signal fires mid-typing.
 */
export async function humanType(cdp, selector, value, signal) {
  const focused = await evaluate(cdp, buildFocusAndClearScript(selector));
  if (!focused?.ok) return false;
  for (const char of String(value || '')) {
    if (signal?.aborted) return false;
    await evaluate(cdp, buildAppendCharScript(selector, char));
    await wait(jitter(), signal).catch(() => {});
  }
  // Final change event so React-style listeners commit the value.
  await evaluate(cdp, `(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    if (el) el.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
  return true;
}