import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';

const { appId, token, functionsVersion, appBaseUrl } = appParams;

// Optional: authenticate server-side (local dev / CI) using a Base44 API key
// instead of an interactive Google login. When set, the SDK sends an `api_key`
// header on every request — the documented pattern from the Base44 API reference.
// If unset, the client falls back to the normal user-session flow.
const apiKey = import.meta.env.VITE_BASE44_API_KEY;

export const base44 = createClient({
  appId,
  token,
  functionsVersion,
  serverUrl: '',
  requiresAuth: false,
  appBaseUrl,
  ...(apiKey ? { headers: { api_key: apiKey } } : {}),
});
