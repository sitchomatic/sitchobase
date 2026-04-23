import { useState } from 'react';
import { sanitizeCredential } from '@/lib/credentialSanitize';

const STORAGE_KEY = 'bb_credentials';
const EMPTY = { apiKey: '', projectId: '' };

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

export function useCredentials() {
  const [credentials, setCredentials] = useState(readStored);

  const saveCredentials = (creds) => {
    const clean = {
      apiKey: sanitizeCredential(creds?.apiKey),
      projectId: sanitizeCredential(creds?.projectId),
    };
    setCredentials(clean);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
    } catch {
      // Storage full / blocked — state still updates, best-effort persistence
    }
    return clean;
  };

  const clearCredentials = () => {
    setCredentials(EMPTY);
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  };

  // API key lives in the server-side secret (Api_key).
  // We require projectId to be set locally to consider the app configured.
  const isConfigured = !!(credentials?.projectId);

  return { credentials, saveCredentials, clearCredentials, isConfigured };
}