# Architecture Decision Log

## Implemented Safe Refactors

### 1. Dashboard metrics now use one derived pass
- Current issue: Dashboard derived status counts with multiple full-array filters and then sorted all sessions for only 8 visible records.
- Implemented intelligence fix: Replaced repeated scans with a memoized single derivation and a bounded recent-session list.
- Expected gain: Lower render CPU and less memory churn on every polling refresh, especially as session history grows.

### 2. Dashboard animation allocations reduced
- Current issue: Static animation arrays were recreated every render, including every one-second health tick.
- Implemented intelligence fix: Hoisted static column/bar arrays outside the component.
- Expected gain: Less garbage collection pressure during continuous dashboard rendering.

### 3. Browserbase credential reads are cached
- Current issue: Every bbClient call parsed localStorage, and parallel calls parsed the same JSON repeatedly.
- Implemented intelligence fix: Added raw-string memoization for stored credentials.
- Expected gain: Faster hot-path API dispatch and less synchronous main-thread work.

### 4. Retry classification is status/code based
- Current issue: Retry logic relied mostly on string matching error messages.
- Implemented intelligence fix: Prefer explicit retryable HTTP statuses and bbProxy error codes, with string matching only as fallback.
- Expected gain: More reliable retry behavior and fewer false positives/negatives.

### 5. Feature flag loader can recover after transient failures
- Current issue: A failed feature-flag request could leave the shared in-flight promise stuck until manual reset.
- Implemented intelligence fix: Clear `loadPromise` in `finally` while preserving the safe empty cache fallback.
- Expected gain: Better resilience after temporary auth/network failures.

### 6. Dashboard refreshes are latest-wins
- Current issue: Manual refresh and scheduled polling could overlap, allowing an older request to overwrite newer dashboard data.
- Implemented intelligence fix: Added a monotonic refresh sequence so stale responses are ignored.
- Expected gain: More logically sound UI state under slow network conditions.

### 7. Polling intervals now support jitter
- Current issue: Multiple open clients could poll and retry on the same interval boundaries.
- Implemented intelligence fix: Added configurable polling jitter and enabled it on the dashboard.
- Expected gain: Lower synchronized load spikes against backend and Browserbase APIs.

### 8. Shared Browserbase query cache
- Current issue: Dashboard, Sessions, and Status fetched overlapping Browserbase session/usage data independently.
- Implemented intelligence fix: Added `lib/browserbaseData.js` with shared query keys/fetchers/hooks and wired the main UX pages into it.
- Expected gain: Fewer duplicate API calls, smoother navigation, and more consistent refresh/loading states.

## High-Level Architectural Shifts Requiring Approval

### A. Server-side Browserbase secret rotation workflow
- Current issue: `Api_key` exists but Browserbase returns 401 (`Missing x-bb-api-key header`), so production depends on user-saved overrides.
- Proposed intelligence fix: Add an admin-only credential health screen and a guided secret-rotation runbook that verifies the server secret before enabling fleet workflows.
- Expected gain: Eliminates a major production reliability risk and avoids user-specific credential drift.
- Approval needed: Yes, because it changes operational ownership and admin UX.

### B. Unified Browserbase data cache with TanStack Query
- Current issue: Dashboard, Sessions, Status, Monitor, and Contexts each fetch overlapping Browserbase data independently.
- Proposed intelligence fix: Centralize Browserbase query keys, stale times, prefetching, and invalidation around one shared query layer.
- Expected gain: Fewer duplicate network calls, simpler loading/error states, better perceived performance.
- Approval needed: Yes, because it touches multiple user-facing pages.

### C. Move long batch work to durable backend jobs
- Current issue: Some batch flows still depend on browser tab lifetime and UI state accumulation.
- Proposed intelligence fix: Introduce a `BatchJob` entity plus backend worker-style functions for resumable execution and progress polling.
- Expected gain: Safer large runs, resumability, lower frontend memory pressure, consistent reports.
- Approval needed: Yes, because it changes the execution model.

### D. Normalize external Browserbase records into local snapshots
- Current issue: Browserbase session/context data is repeatedly normalized in UI surfaces and can disappear or become expensive to hydrate.
- Proposed intelligence fix: Add local snapshot entities for sessions/contexts with periodic reconciliation and real-time UI reads from Base44 entities.
- Expected gain: Faster dashboards, better offline/history reporting, fewer external API calls.
- Approval needed: Yes, because it creates a local source-of-truth layer.

### E. Split oversized backend proxy into focused function modules
- Current issue: `bbProxy` is large and handles auth, rate limits, telemetry, retries, and every Browserbase action in one file.
- Proposed intelligence fix: Split into focused service functions or a generated dispatch table while preserving one public function entrypoint.
- Expected gain: Lower maintenance risk, easier testing, safer future changes.
- Approval needed: Yes, because backend function structure and deployment risk should be planned carefully.