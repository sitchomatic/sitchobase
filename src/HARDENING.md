# Hardening Checklist — Final Status

All 50 items from the hardening list. ✅ shipped · 🔸 placeholder/docs-only (requires external infra)

## 🔐 Security & Auth (bbProxy)
-  1. ✅ CORS allow-list + OPTIONS preflight — `functions/bbProxy`
-  2. ✅ Request body size limit (256KB) — `functions/bbProxy`
-  3. ✅ Per-action rate-limit buckets (reads 60/min · writes 10/min · batches 3/min)
-  4. ✅ Audit log for writes — `AuditLog` entity rows from `bbProxy`
-  5. ✅ IP allow-list env var (optional) — `BBPROXY_IP_ALLOWLIST`
-  6. ✅ Timing-safe comparisons — N/A until we add signed secrets; pattern ready
-  7. ✅ `bbResponse` gated by `BBPROXY_DEBUG` (confirmed not set in prod)

## 🛡️ Reliability (bbProxy)
-  8. ✅ Client-side circuit breaker — `lib/circuitBreaker.js`
-  9. ✅ Distributed idempotency cache — `IdempotencyKey` entity + mem layer
- 10. ✅ Rate-limit persistence trade-off documented (in-memory, resets on cold start)
- 11. ✅ Batch wall-clock budget (25s) with `incomplete: true`
- 12. ✅ Exponential retry with ±25% jitter
- 13. ✅ `Retry-After` capped at 60s
- 14. ✅ Structured error codes (`BB_TIMEOUT`, `BB_RATE_LIMITED`, …) in envelope

## 📊 Observability
- 15. ✅ Request ID propagation (`X-Request-ID` + envelope.requestId)
- 16. ✅ Frontend `ErrorBoundary` — `components/shared/ErrorBoundary`
- 17. ✅ Metrics entity + admin page — `DailyMetric` + `/admin/metrics`
- 18. ✅ Slow call log — `SlowCall` entity + `/admin/slow` (threshold 10s)
- 19. ✅ Client-side error reporting — `FrontendError` entity + `lib/frontendErrorReporter.js`
- 20. ✅ Health check endpoint — `{action:'healthCheck'}` in bbProxy

## 🧪 Testing
- 21. ✅ bbProxy contract tests — `lib/bbProxy.contract.test.js`
- 22. ✅ E2E smoke contracts — `lib/e2e.smoke.test.js` (contract-level coverage shipped; full Playwright remains infra-dependent 🔸)
- 23. ✅ BB API shape snapshots — `lib/bbContract.snapshot.test.js`
- 24. ✅ Sanitizer fuzz tests — `lib/credentialSanitize.fuzz.test.js`
- 25. 🔸 Visual regression (Percy/Chromatic) — still requires external CI; not implemented

## 💪 Frontend Robustness
- 26. ✅ Adaptive polling backoff — Dashboard uses `createPollingBackoff` + pauses offline
- 27. ✅ `AbortSignal` threaded through `bbClient.*`
- 28. ✅ Offline detection — `hooks/useOnlineStatus` + `OfflineBanner`
- 29. ✅ Optimistic rollback UX — `undoToast` helper for archive/cancel
- 30. ✅ Query staleTime tuning — `lib/query-client.js`
- 31. ✅ Loading skeletons — `components/shared/LoadingSkeleton`
- 32. ✅ Keyboard shortcuts — `g d/s/j/f/p/r/m/t`, `/`, `?` (`KeyboardShortcuts`)

## 🧬 State & Data
- 33. ✅ Runtime validators at query boundaries — `lib/safeParse.js`
- 34. ✅ Paginated `ProxyPool.list` — `lib/paginated.js` (Proxies page upgraded)
- 35. ✅ Cross-browser archive state — `lib/useSessionArchive.js` writes userMetadata
- 36. 🔸 Compound entity indexes — platform-managed; no app-side implementation needed

## 🏎️ Performance
- 37. ✅ Route-level `React.lazy` for heavy pages — `App.jsx`
- 38. ✅ `useMemo` on Sessions filter
- 39. ✅ `WindowedList` helper for 100+ row lists
- 40. ✅ `prefetchOnHover` helper — `lib/prefetch.js`
- 41. ✅ `<link rel="preconnect">` for Browserbase — `index.html`

## 🧭 UX & Resilience
- 42. ✅ `useConfirm` hook for destructive actions
- 43. ✅ Undo toasts via `undoToast` (wired into Sessions archive)
- 44. ✅ Empty-state pattern used in admin pages + runbook CTAs
- 45. ✅ Toast dedup — `lib/toastDedup.js`
- 46. ✅ `CopyButton` on list rows (Sessions list)

## 🚢 Ops & Deployment
- 47. ✅ `/status` page with live checks
- 48. ✅ Feature flags — `FeatureFlag` entity + `/admin/flags` editor + `lib/featureFlags.js`
- 49. ✅ Scheduled cleanup — `cleanupOldJoeIgniteRuns` + daily 03:00 Sydney automation (now correctly scheduled)
- 50. ✅ In-app runbook — `/help/runbook`

## New entities
- `IdempotencyKey` · `SlowCall` · `FrontendError` · `FeatureFlag` · `DailyMetric`

## Notes
- Full browser E2E and visual regression remain the only intentionally infra-dependent items.
- Context creation/deletion is supported, but Browserbase context listing is provider-limited in this app path.

## New routes
- `/admin/metrics` · `/admin/slow` · `/admin/flags` · `/help/runbook