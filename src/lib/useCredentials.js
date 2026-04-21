import { useState } from 'react';

const STORAGE_KEY = 'bb_credentials';

export function useCredentials() {
  const [credentials, setCredentials] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : { apiKey: '', projectId: '' };
    } catch {
      return { apiKey: '', projectId: '' };
    }
  });

  const saveCredentials = (creds) => {
    setCredentials(creds);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(creds));
  };

  const clearCredentials = () => {
    setCredentials({ apiKey: '', projectId: '' });
    localStorage.removeItem(STORAGE_KEY);
  };

  // API key lives in the server-side secret (Api_key) — always operational.
  // credentials here are optional overrides stored locally (e.g. for multi-project use).
  const isConfigured = true;

  return { credentials, saveCredentials, clearCredentials, isConfigured };
}