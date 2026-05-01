import { useState, useEffect, useCallback } from 'react';
import { sanitizeCredential } from '@/lib/credentialSanitize';

const STORAGE_KEY = 'bb_credentials';
const SAVED_AT_KEY = 'bb_credentials_saved_at';
const EMPTY = { apiKey: '', projectId: '' };

// Custom event broadcast within the same tab when credentials change.
// `storage` events only fire in *other* tabs, so we need this to keep
// every consumer (Dashboard, Sessions, Contexts, etc.) in sync after a
// save/clear in the current tab without a full reload.
const CHANGE_EVENT = 'bb-credentials-changed';

export function hasStoredApiKey() {
  const creds = readStored();
  return Boolean(creds?.apiKey);
}

/** Mask an API key for display, keeping the first 6 and last 4 chars. */
export function maskApiKey(key) {
  if (!key) return '';
  if (key.length <= 12) return '•'.repeat(key.length);
  return `${key.slice(0, 6)}…${key.slice(-4)}`;
}

function readStored() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return EMPTY;
    const parsed = JSON.parse(stored);
    // Defensive — if storage is corrupt/shape-wrong, fall back to empty
    return {
      apiKey: sanitizeCredential(parsed?.apiKey),
      projectId: sanitizeCredential(parsed?.projectId),
    };
  } catch {
    return EMPTY;
  }
}

function readSavedAt() {
  try {
    const ts = localStorage.getItem(SAVED_AT_KEY);
    return ts ? Number(ts) || null : null;
  } catch {
    return null;
  }
}

export function useCredentials() {
  const [credentials, setCredentials] = useState(readStored);
  const [savedAt, setSavedAt] = useState(readSavedAt);

  // Keep this hook in sync when credentials change anywhere — same tab
  // (custom event) or another tab (native `storage` event).
  useEffect(() => {
    const refresh = () => {
      setCredentials(readStored());
      setSavedAt(readSavedAt());
    };
    const onStorage = (e) => {
      if (e.key === STORAGE_KEY || e.key === SAVED_AT_KEY || e.key === null) refresh();
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener(CHANGE_EVENT, refresh);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(CHANGE_EVENT, refresh);
    };
  }, []);

  const saveCredentials = useCallback((creds) => {
    const clean = {
      apiKey: sanitizeCredential(creds?.apiKey),
      projectId: sanitizeCredential(creds?.projectId),
    };
    const ts = Date.now();
    setCredentials(clean);
    setSavedAt(ts);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
      localStorage.setItem(SAVED_AT_KEY, String(ts));
    } catch {
      // Storage full / blocked — state still updates, best-effort persistence
    }
    try { window.dispatchEvent(new Event(CHANGE_EVENT)); } catch { /* ignore */ }
    return clean;
  }, []);

  const clearCredentials = useCallback(() => {
    setCredentials(EMPTY);
    setSavedAt(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(SAVED_AT_KEY);
    } catch { /* ignore */ }
    try { window.dispatchEvent(new Event(CHANGE_EVENT)); } catch { /* ignore */ }
  }, []);

  // API key lives in the server-side secret (Api_key).
  // We require projectId to be set locally to consider the app configured.
  const isConfigured = !!(credentials?.projectId);

  return { credentials, saveCredentials, clearCredentials, isConfigured, savedAt };
}