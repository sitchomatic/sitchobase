import { useState } from 'react';

const STORAGE_KEY = 'bb_credentials';

export function useCredentials() {
  const [credentials, setCredentials] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : { apiKey: 'bb_live_B_p5sKrXHCpxUJ2UQHWpEfPad6A', projectId: 'cd060316-4ca4-49c7-881e-63b9cabd1735' };
    } catch {
      return { apiKey: 'bb_live_B_p5sKrXHCpxUJ2UQHWpEfPad6A', projectId: 'cd060316-4ca4-49c7-881e-63b9cabd1735' };
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