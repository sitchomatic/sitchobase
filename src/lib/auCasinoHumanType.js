/**
 * Human-like typing helper for the AU casino dual-target validator.
 *
 * Uses real CDP Input.dispatchKeyEvent calls instead of JS property
 * setters so the keystroke timeline looks authentic to bot-detection
 * telemetry that hooks keyboard event listeners.
 *
 * Also dispatches synthetic touch events before focusing an input —
 * real mobile users tap to focus; the absence of pointer/touch events
 * before a focus() call is a detectable anomaly.
 *
 * Per GOAL.md §Phase 5: 20–70ms per-keystroke jitter.
 */
import { evaluate, wait } from '@/lib/authorizedBulkCdp';

const MIN_DELAY_MS = 20;
const MAX_DELAY_MS = 70;

function jitter() {
  return MIN_DELAY_MS + Math.floor(Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS + 1));
}

/** Small extra pause before the first keystroke (50–150ms) to mimic
 *  the moment a human visually locates the field after tapping it. */
function preFocusDelay() {
  return 50 + Math.floor(Math.random() * 100);
}

/**
 * Simulate a mobile tap on the element (touchstart → touchend → click)
 * then focus it, matching what real Android Chrome fires.
 */
function buildTapAndFocusScript(selector) {
  return `(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) return { ok: false };
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const touch = new Touch({ identifier: Date.now(), target: el, clientX: cx, clientY: cy });
    el.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, cancelable: true, touches: [touch], targetTouches: [touch], changedTouches: [touch] }));
    el.dispatchEvent(new TouchEvent('touchend',   { bubbles: true, cancelable: true, touches: [],      targetTouches: [],      changedTouches: [touch] }));
    el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: cx, clientY: cy, pointerType: 'touch' }));
    el.dispatchEvent(new PointerEvent('pointerup',   { bubbles: true, clientX: cx, clientY: cy, pointerType: 'touch' }));
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: cx, clientY: cy }));
    el.focus();
    return { ok: true };
  })()`;
}

/**
 * Clear the field value using the same setter technique so React-style
 * frameworks see the change. Called once right after focusing.
 */
function buildClearScript(selector) {
  return `(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) return { ok: false };
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    if (setter) setter.call(el, ''); else el.value = '';
    el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'deleteContent' }));
    return { ok: true };
  })()`;
}

/**
 * Dispatch a single key via CDP Input.dispatchKeyEvent. This produces
 * the full keydown → char → keyup sequence that keyboard-event
 * listeners see — unlike Runtime.evaluate property setters which fire
 * zero key events.
 */
async function cdpTypeChar(cdp, char) {
  const keyCode = char.charCodeAt(0);
  await cdp.send('Input.dispatchKeyEvent', {
    type: 'keyDown',
    text: char,
    key: char,
    windowsVirtualKeyCode: keyCode,
    nativeVirtualKeyCode: keyCode,
  });
  await cdp.send('Input.dispatchKeyEvent', {
    type: 'char',
    text: char,
    key: char,
    windowsVirtualKeyCode: keyCode,
    nativeVirtualKeyCode: keyCode,
  });
  await cdp.send('Input.dispatchKeyEvent', {
    type: 'keyUp',
    text: char,
    key: char,
    windowsVirtualKeyCode: keyCode,
    nativeVirtualKeyCode: keyCode,
  });
}

/**
 * Type `value` into the element matched by `selector`, one character at
 * a time with 20–70ms jitter between keystrokes using real CDP keyboard
 * events. Taps the element first with synthetic touch events.
 */
export async function humanType(cdp, selector, value, signal) {
  // 1. Tap + focus (with touch/pointer events)
  const tapped = await evaluate(cdp, buildTapAndFocusScript(selector));
  if (!tapped?.ok) return false;

  await wait(preFocusDelay(), signal).catch(() => {});
  if (signal?.aborted) return false;

  // 2. Clear existing value
  await evaluate(cdp, buildClearScript(selector));

  // 3. Type each character via CDP keyboard events
  for (const char of String(value || '')) {
    if (signal?.aborted) return false;
    await cdpTypeChar(cdp, char);
    await wait(jitter(), signal).catch(() => {});
  }

  // 4. Final change event so React-style listeners commit the value
  await evaluate(cdp, `(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    if (el) el.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
  return true;
}