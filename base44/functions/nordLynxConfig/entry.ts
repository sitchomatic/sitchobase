import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const NORD_API = 'https://api.nordvpn.com';
const WG_FILTER = 'filters[servers_technologies][identifier]=wireguard_udp';

function cleanKey(value) {
  return String(value || '')
    .replace(/\\\//g, '/')
    .replace(/\\n/g, '')
    .replace(/\s+/g, '')
    .trim();
}

function normalizeCountry(value) {
  return String(value || '').trim().toLowerCase();
}

function findCountryId(countries, requested) {
  const needle = normalizeCountry(requested);
  if (!needle) return null;

  const stack = [...countries];
  while (stack.length) {
    const country = stack.shift();
    const code = normalizeCountry(country.code);
    const name = normalizeCountry(country.name);
    if (String(country.id) === needle || code === needle || name === needle) return country.id;
    if (Array.isArray(country.cities)) stack.push(...country.cities.map((city) => ({ ...city, code: country.code })));
    if (Array.isArray(country.regions)) stack.push(...country.regions);
  }

  return null;
}

function getTechnologyPublicKey(server) {
  const technologies = Array.isArray(server.technologies) ? server.technologies : [];
  const wireguard = technologies.find((tech) => tech.identifier === 'wireguard_udp');
  const metadata = wireguard?.metadata || [];
  const publicKeyMeta = metadata.find((item) => item.name === 'public_key' || item.name === 'publicKey');
  return cleanKey(publicKeyMeta?.value || server.public_key || server.publicKey);
}

function scoreServer(server) {
  const load = Number(server.load ?? 100);
  const distancePenalty = Number(server.distance ?? 0) / 1000;
  return load + distancePenalty;
}

function chooseBestServer(servers) {
  const candidates = servers
    .filter((server) => getTechnologyPublicKey(server))
    .filter((server) => Number(server.load ?? 100) < 50)
    .sort((a, b) => scoreServer(a) - scoreServer(b));

  const fallback = servers
    .filter((server) => getTechnologyPublicKey(server))
    .sort((a, b) => scoreServer(a) - scoreServer(b));

  return candidates[0] || fallback[0] || null;
}

async function nordFetch(path, options = {}, attempt = 0) {
  const response = await fetch(`${NORD_API}${path}`, options);
  if ((response.status === 429 || response.status >= 500) && attempt < 2) {
    await new Promise((resolve) => setTimeout(resolve, 350 * (attempt + 1)));
    return nordFetch(path, options, attempt + 1);
  }
  if (!response.ok) {
    const text = await response.text();
    const message = response.status === 401 ? 'Nord access token expired or invalid' : `Nord API error ${response.status}: ${text.slice(0, 180)}`;
    throw new Error(message);
  }
  return response.json();
}

function buildWireGuardConfig({ privateKey, serverPublicKey, endpoint }) {
  return `[Interface]\nPrivateKey = ${privateKey}\nAddress = 10.5.0.2/32\nDNS = 103.86.96.100, 103.86.99.100\nMTU = 1420\n\n[Peer]\nPublicKey = ${serverPublicKey}\nAllowedIPs = 0.0.0.0/0, ::/0\nEndpoint = ${endpoint}:51820\nPersistentKeepalive = 25\n`;
}

function buildDockerBundle(configText) {
  const escapedConfig = configText.replace(/`/g, '\\`').replace(/\$/g, '\\$');
  return `FROM alpine:3.20\nRUN apk add --no-cache wireguard-tools wireguard-go iproute2 iptables microsocks bash curl\nCOPY nordlynx.conf /etc/wireguard/nordlynx.conf\nCOPY start.sh /start.sh\nRUN chmod +x /start.sh\nEXPOSE 1080\nCMD ["/start.sh"]\n\n--- nordlynx.conf ---\n${escapedConfig}\n--- start.sh ---\n#!/usr/bin/env bash\nset -euo pipefail\nexport WG_QUICK_USERSPACE_IMPLEMENTATION=wireguard-go\nwg-quick up /etc/wireguard/nordlynx.conf\nmicrosocks -i 0.0.0.0 -p 1080\n`;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { accessToken, country = 'US' } = await req.json();
    const token = String(accessToken || '').trim();
    if (!token) return Response.json({ error: 'Nord access token is required' }, { status: 400 });

    const authHeaders = { Authorization: `token:${token}` };
    const [credentials, countries] = await Promise.all([
      nordFetch('/v1/users/services/credentials', { headers: authHeaders }),
      nordFetch('/v1/servers/countries'),
    ]);

    const countryId = findCountryId(countries, country);
    const countryFilter = countryId ? `&filters[country_id]=${encodeURIComponent(countryId)}` : '';
    const servers = await nordFetch(`/v1/servers/recommendations?${WG_FILTER}${countryFilter}&limit=20`, { headers: authHeaders });
    const bestServer = chooseBestServer(Array.isArray(servers) ? servers : []);
    if (!bestServer) return Response.json({ error: 'No usable NordLynx WireGuard server found' }, { status: 404 });

    const privateKey = cleanKey(credentials.nordlynx_private_key || credentials.nordlynxPrivateKey || credentials.private_key);
    const serviceUsername = credentials.username || credentials.service_username || '';
    const servicePassword = credentials.password || credentials.service_password || '';
    const serverPublicKey = getTechnologyPublicKey(bestServer);
    const endpoint = bestServer.station || bestServer.hostname || bestServer.name;

    if (!privateKey || !serverPublicKey || !endpoint) {
      return Response.json({ error: 'Nord returned incomplete WireGuard credentials or server metadata' }, { status: 422 });
    }

    const wireguardConfig = buildWireGuardConfig({ privateKey, serverPublicKey, endpoint });
    return Response.json({
      countryId,
      server: {
        id: bestServer.id,
        name: bestServer.name,
        hostname: bestServer.hostname,
        endpoint,
        load: bestServer.load,
      },
      serviceCredentials: {
        username: serviceUsername,
        passwordAvailable: Boolean(servicePassword),
      },
      socksProxyUrl: 'socks5://127.0.0.1:1080',
      wireguardConfig,
      dockerBundle: buildDockerBundle(wireguardConfig),
      hardening: ['Filtered for wireguard_udp', 'Preferred servers below 50% load', 'Retried transient Nord API failures', 'Sanitized escaped Nord key characters'],
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});