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

  const isConfigured = !!(credentials.apiKey && credentials.projectId);

  return { credentials, saveCredentials, clearCredentials, isConfigured };
}