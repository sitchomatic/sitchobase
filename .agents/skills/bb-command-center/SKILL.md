# BB Command Center — local dev + testing

Frontend SPA for Browserbase session orchestration, built on [Base44](https://base44.com). JSX + Vite + Tailwind, no TypeScript. Deployed via Base44 Builder.

## Run locally against the live backend (no Google login)

1. `npm install`
2. Create `.env.local` at repo root (gitignored):
   ```
   VITE_BASE44_APP_ID=69e7f1a3b572f70dbd1458b4
   VITE_BASE44_APP_BASE_URL=https://sitchobase.base44.app
   VITE_BASE44_API_KEY=<ask user — server-side Base44 api key>
   ```
3. `npm run dev -- --host 127.0.0.1` (bind IPv4 explicitly; Chrome on the VM has trouble with the default `localhost` binding).
4. Open `http://127.0.0.1:5173/`.

When `VITE_BASE44_API_KEY` is set, the SDK authenticates every request with an `api_key` header (see `src/api/base44Client.js`) and the user-session flow is skipped (`src/lib/app-params.js` returns `token: null`). AuthProvider does NOT call `base44.auth.me()` in this mode, so the "Loading BB Command Center…" spinner clears in <5s and the Dashboard mounts without a Google login.

**Never set `VITE_BASE44_API_KEY` in a deployed build** — Vite inlines `VITE_*` vars into the client bundle, which would leak the key.

## Quality gate commands

All three must exit 0 before pushing:

```
npm run lint
npm run typecheck
npm run build
```

- `lint`: `eslint . --quiet` (no warnings).
- `typecheck`: `tsc -p ./jsconfig.json` — note `checkJs: false, noEmit: true`; this is a pure syntax pass, not real type checking. The codebase has zero type annotations, so re-enabling `checkJs` is a large, separate effort.
- `build`: `vite build`. Must produce `dist/index-*.js` + `dist/index-*.css`.

Dev server: `npm run dev -- --host 127.0.0.1` on `http://127.0.0.1:5173/`.

## Routing — dual layer gotcha

Adding a new route requires updates in **two** places, or the sidebar link silently falls through to `PageNotFound` despite the route "being defined":

1. `src/App.jsx` — React Router `<Route path="/foo" element={<Foo/>} />`.
2. `src/components/layout/AppShellRoutes.jsx` — the hardcoded `routeMap` object. This is the component that actually picks which page to mount, keyed off `rootPathFor(pathname)`. A missing entry here → `PageNotFound`.

If you add route X, grep for existing routes in both files and mirror the pattern.

## Tailwind config must be `.cjs`

`package.json` has `"type": "module"`, which makes Node parse every `.js` as ESM. Tailwind's config uses `module.exports = {...}`, which is CommonJS. The file is therefore named `tailwind.config.cjs` and referenced by that name from `components.json`. Do NOT rename back to `.js` — the dev server crashes on first CSS request with `ReferenceError: module is not defined`.

## Known limitations

- **`bbProxy` + `api_key` auth → 404.** The Base44 function `bbProxy` does not accept `api_key` header auth. It's invoked via `base44.functions.invoke('bbProxy', …)` from `src/lib/bbClient.js` (Settings → Test Connection) and from the Contexts page list. Both 404 under api_key auth. Every other page works fine under api_key auth. For those two flows, you need an interactive Google login (don't set `VITE_BASE44_API_KEY`).
- **Contexts list is always empty even with a real session** — Browserbase doesn't expose a list-all-contexts endpoint; documented in `base44/functions/bbProxy/entry.ts`.
- **Session Recording is stubbed** — the Browserbase recording endpoint is deprecated; the UI is intentionally non-functional.

## Joe Ignite (frontend + backend) gotchas

- Route wiring is still dual-layer: `/joe-ignite` must exist in both `src/App.jsx` and `src/components/layout/AppShellRoutes.jsx`.
- Run modes differ:
  - **Browser mode** (`src/lib/joeIgniteRunner.js`) runs from the client and works with the local `VITE_BASE44_API_KEY` flow.
  - **Serverless mode** calls `base44.functions.invoke('joeIgniteBatch', …)` (`src/pages/JoeIgnite.jsx`). Backend handler (`base44/functions/joeIgniteBatch/entry.ts`) enforces `base44.auth.me()` and also needs the `Api_key` Base44 secret configured for Browserbase. If either is missing, startup fails (401/400).
- Serverless worker behavior is constrained by backend limits: concurrency is capped to 8 in the function and the deployment has ~5-minute execution ceiling (see header comment in `base44/functions/joeIgniteBatch/entry.ts`). Keep batches modest in serverless mode; use browser mode for larger runs.

## Browserbase credentials (UI-only)

Entered in Settings → API Credentials and stored in browser `localStorage` under `bb_api_key` / `bb_project_id` (see `src/lib/useCredentials.js`). Not committed to the repo. `CredentialsGuard` shows a yellow banner on pages that need them until they're saved.

Known test account values at time of writing:
- Project ID: `cd060316-4ca4-49c7-881e-63b9cabd1735`
- API key: lives with the user — ask; do not paste into chat.

## Testing

No automated test suite in this repo. For UI verification:
1. Boot the dev server with api_key auth (above).
2. Click through each sidebar route; the entire 15-route sidebar should paint content without white screens or React crashes.
3. Known-degraded pages (Contexts list, Session Recording, Settings Test Connection under api_key auth) are documented limitations — do NOT treat them as regressions unless they stop rendering entirely.

For recordings, maximize Chrome first. `wmctrl` isn't installed on the VM by default, so use the window manager's maximize button manually before starting a recording.
