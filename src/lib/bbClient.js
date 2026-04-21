/**
 * Frontend client for the bbProxy backend function.
 * All Browserbase API calls go through here — no more CORS issues.
 */
import { base44 } from '@/api/base44Client';

async function call(action, extras = {}) {
  // Proxy reads API key from server-side secret (Api_key).
  // Pass projectId from localStorage only if user has set one (needed for getProjectUsage).
  const stored = localStorage.getItem('bb_credentials');
  const creds = stored ? JSON.parse(stored) : {};
  const payload = { action, ...extras };
  if (creds.projectId) payload.projectId = creds.projectId;
  const res = await base44.functions.invoke('bbProxy', payload);
  return res.data.data;
}

export const bbClient = {
  // Sessions
  listSessions: (status = null) => call('listSessions', status ? { status } : {}),
  getSession: (sessionId) => call('getSession', { sessionId }),
  createSession: (options = {}) => call('createSession', { options }),
  updateSession: (sessionId, data) => call('updateSession', { sessionId, data }),
  getSessionLogs: (sessionId) => call('getSessionLogs', { sessionId }),
  getSessionRecording: (sessionId) => call('getSessionRecording', { sessionId }),

  // Usage
  getProjectUsage: () => call('getProjectUsage'),

  // Contexts
  listContexts: () => call('listContexts'),
  createContext: () => call('createContext'),
  deleteContext: (contextId) => call('deleteContext', { contextId }),

  // Batch
  batchCreateSessions: (count, options = {}) => call('batchCreateSessions', { count, options }),

  // Commands
  sendCommand: (sessionId, command, commandParams = {}) => call('sendCommand', { sessionId, command, commandParams }),
  captureScreenshot: (sessionId) => call('captureScreenshot', { sessionId }),
};

export function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function formatDuration(startedAt, endedAt) {
  const start = new Date(startedAt);
  const end = endedAt ? new Date(endedAt) : new Date();
  const diff = Math.floor((end - start) / 1000);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ${diff % 60}s`;
  return `${Math.floor(diff / 3600)}h ${Math.floor((diff % 3600) / 60)}m`;
}