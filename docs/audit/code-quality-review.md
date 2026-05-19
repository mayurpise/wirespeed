# Code Quality Review — wirespeed (src/)

**Reviewer:** Code Quality Review Agent (scrub skill)  
**Date:** 2026-05-19  
**Scope:** All 17 listed source files in `/home/mayurpise/workspace/wirespeed/src/`, plus `package.json`, `tsconfig.json`, `bin/wirespeed.js`, `README.md` (for contracts). Deep inspection via full reads + targeted grep for duplication, usage, comments, state, parameters, strings, and control flow.  
**Focus:** The 7 scrub categories + copy-paste (esp. download.ts ↔ upload.ts) + other smells. High-signal, actionable only.  
**Total findings:** 14 (3× Tier 1, 6× Tier 2, 5× Tier 3)

---

## Tier 1 Findings (High Impact / Structural)

**File:** `src/tester/download.ts:32-76` and `src/tester/upload.ts:38-82` (plus supporting lines 15-31/20-37, 78-86/84-92)

**Finding:** Near-verbatim copy-paste of the entire multi-phase measurement loop (totalRequests pre-count, per-phase task factory, Measurement construction + push to allMeasurements, phaseBytes filtering, liveSpeed EMA update using shared `ema()`, phaseHitThreshold, progress callback, phaseWall aggregate, early-break logic, and final `Math.max(...phaseAggregates)` + BandwidthResult assembly). The two files differ in only ~8 lines: URL/query vs. payload, duration formula (ttfb-based vs. start-serverTime), and warmup target. Identical mutable state variables and structure.

**Why problem:** Classic DRY violation. High risk of future divergence (already visible in inconsistent duration math). Any change to progress reporting, error handling, or aggregate logic must be applied twice. ~70 lines of duplicated hot-path logic.

**Recommendation:** Extract a single `measureBandwidthPhase` / `runBandwidthTest` helper (or parameterised `measureTransfer` in `tester/bandwidth.ts`) that accepts: base URL or payload factory, a `computeDuration(timing)` function, warmup target, and the PhaseConfig list. Callers supply only the differing strategy pieces. Share the liveSpeed / phaseAggregates orchestration.

**Tier:** 1

---

**File:** `src/config.ts:36-48`

**Finding:** `DOWNLOAD_PHASES` and `UPLOAD_PHASES` are identical literal arrays (same 4 objects, same byte counts, counts, parallel values, and even parallel comments).

**Why problem:** Redundant state definition. Changing ramp-up strategy requires editing two places; easy to introduce skew between download and upload behaviour.

**Recommendation:** Define once:

```ts
export const BANDWIDTH_PHASES: PhaseConfig[] = [ ... ];
export const DOWNLOAD_PHASES = BANDWIDTH_PHASES;
export const UPLOAD_PHASES = BANDWIDTH_PHASES;
```

(Or keep separate only if they legitimately diverge later.)

**Tier:** 1

---

**File:** `src/stats/calculator.ts:19-27` (computeBandwidth) and `src/tester/types.ts:22` (plus population at `download.ts:83`, `upload.ts:89`)

**Finding:** `BandwidthResult.measurements: Measurement[]` is populated with every request but never read by any consumer (`orchestrator`, `ui/layout.ts`, `composeJson`, `composePlainResult`, `index.ts`, or `compute*` callers). `computeBandwidth` (the 90th-percentile implementation matching the README contract and `BANDWIDTH_PERCENTILE`) has zero call sites; final speed is `Math.max(...phaseAggregates)` via `computeAggregateBandwidth`.

**Why problem:** Redundant state / dead data. Wasted allocations and CPU on hot path; misleading public API and documentation contract ("Bandwidth is calculated at the 90th percentile across all measurements").

**Recommendation:** 
1. Remove `measurements` field from `BandwidthResult` (and from the two return objects).
2. Delete the unused `computeBandwidth` function (or restore it as the primary calculator and switch callers if the percentile intent is real).
3. Update README "How it works" to describe actual max-per-phase-aggregate algorithm.

**Tier:** 1

---

## Tier 2 Findings (Medium Impact)

**File:** `src/tester/pool.ts:11-14,23-27` (and docstring 3-9); usage sites `download.ts:36,59-60,75` and `upload.ts:42,65-66,81`

**Finding:** `PoolContext { bail: boolean }` + `while (... && !poolCtx.bail)` guard is fully documented for task-driven early termination, yet `bail` is never written to true anywhere. `phaseHitThreshold` is a local scalar checked *after* `await runPool(...)` to decide whether to `break` the outer phases loop.

**Why problem:** Dead code in a core abstraction, misleading documentation, leaky contract (ctx exposed for a use-case that was never wired up).

**Recommendation:** Delete `bail` and the guard (or implement real cooperative cancellation by setting `ctx.bail = true` from inside a task and making the pool responsive mid-dispatch). Simplify `runPool(tasks, concurrency)` to a 2-arg signature.

**Tier:** 2

---

**File:** `src/tester/pool.ts:20,32,41`; call sites `download.ts:68`, `upload.ts:74`

**Finding:** `runPool` signature includes optional `onComplete?: (result, index) => void` and always returns `T[]`, but both are ignored by all callers. Callers close over `allMeasurements`, `liveSpeed`, etc. and perform side effects inside the task thunks.

**Why problem:** Parameter sprawl + leaky abstraction. The pool claims to be a "result collector" but usage bypasses it entirely via mutation.

**Recommendation:** Reduce to `async function runPool<T>(tasks: (() => Promise<T>)[], concurrency: number): Promise<void>`. Remove internal results array, onComplete, and the filter return. If ordered results ever needed, add a proper collector inside the helper.

**Tier:** 2

---

**File:** `src/ui/components.ts:47-50` and `src/ui/layout.ts:8`

**Finding:** Identical ANSI strip regex (`/\x1b\[[0-9;]*m/g`) appears once in `stripAnsi` helper and once duplicated inline inside `padRight`.

**Why problem:** Copy-paste duplication of low-level string manipulation.

**Recommendation:** Export `stripAnsi` from `components.ts` and call it from `padRight` (or rename to `visibleLength` + reuse).

**Tier:** 2

---

**File:** `src/tester/latency.ts:6-8,18` and `src/orchestrator.ts:24`

**Finding:** `measureLatency(onMeasurement?: (i, ms) => void)` accepts the callback and calls it for every successful ping, but `orchestrator` always supplies the no-op `(_i, _ms) => {}`. No latency-phase live updates ever reach the renderer (contrast with download/upload `onProgress`).

**Why problem:** Vestigial parameter and dead call path; API surface larger than needed.

**Recommendation:** Remove the `onMeasurement` parameter (and all internal wiring). If live per-ping UI is desired later, add it explicitly in a follow-up.

**Tier:** 2

---

**File:** `src/meta.ts:61`

**Finding:** `AbortSignal.timeout(3000)` for the locations API is a magic number not defined in `config.ts`.

**Why problem:** All other timing constants (RENDER_INTERVAL_MS, FINISH_..., WARMUP_..., etc.) are centralised; this one is not.

**Recommendation:** Add `export const LOCATIONS_FETCH_TIMEOUT_MS = 3000;` (or 5000) to `config.ts` and import it.

**Tier:** 2

---

**File:** `src/index.ts:40-49` and `src/orchestrator.ts:14-17,23-47`

**Finding:** `new Renderer()` is created unconditionally; `runSpeedTest(renderer, ...)` is always called even for `--json` / non-TTY. Inside non-interactive path, ~8 `renderer.update(...)` calls are performed but their state is discarded; a manual `finalState: LiveUpdate` is then rebuilt from results.

**Why problem:** Wasted work + tight coupling of orchestration to a live-UI object. The final-state construction duplicates the `LiveUpdate` shape.

**Recommendation:** Make the renderer parameter optional (or accept a `ProgressReporter` interface with a no-op default). Run the core test logic without a renderer when `!isInteractive`, then emit plain/JSON from the plain `TestResults`.

**Tier:** 2

---

**File:** `src/tester/download.ts:42` vs `src/tester/upload.ts:48`

**Finding:** Transfer duration for speed calculation is computed differently:
- Download: `endTime - ttfb`
- Upload: `(endTime - startTime) - serverTime`

**Why problem:** Inconsistent measurement of "how long the payload transfer took". Can produce non-comparable Mbps values and subtle accuracy drift.

**Recommendation:** Unify. Either:
- Always expose a `transferDurationMs` from `TimingResult`, or
- Subtract `serverTime` consistently (or document why download deliberately excludes it).

Add a small helper `getTransferDuration(t: TimingResult, isUpload: boolean)`.

**Tier:** 2

---

## Tier 3 Findings (Low Impact / Polish)

**File:** `src/ui/renderer.ts:38-40`

**Finding:** `getState(): LiveUpdate` is implemented and public but has zero call sites.

**Why problem:** Dead code / unnecessary API surface.

**Recommendation:** Delete the method.

**Tier:** 3

---

**File:** `src/tester/upload.ts:4,23-25`

**Finding:** `CF_DOWN_URL` is imported solely to pass to `warmupConnections`; the two-line comment explicitly leaks the "upload endpoint expects a body" internal detail.

**Why problem:** Minor leaky abstraction and noisy comment.

**Recommendation:** Keep the call (connection reuse is across host), but remove the explanatory comment or move the choice of warmup URL into `http-client.ts` as an implementation detail.

**Tier:** 3

---

**File:** `src/orchestrator.ts:22,27,37`, `src/ui/layout.ts:16,28,41,52,67,82`, `src/ui/renderer.ts:20,33`, `src/meta.ts:56,71`, and similar section markers

**Finding:** Numerous `// Latency`, `// Download`, `// Header box`, `// Render immediately`, `// Use fallback map` etc. comments that restate what the immediately following code obviously does.

**Why problem:** Per scrub rules, these are WHAT-narration comments (not non-obvious WHY). They add noise and will rot.

**Recommendation:** Delete them. Keep only the genuine explanatory comments (warmup body consumption, aggregate-bandwidth rationale, Cloudflare 25 MB cap).

**Tier:** 3

---

**File:** `src/tester/http-client.ts:27`

**Finding:** Warmup performs exactly two rounds (`for (let round = 0; round < 2; round++)`).

**Why problem:** Magic number; other repetition counts live in config.

**Recommendation:** Add `export const WARMUP_ROUNDS = 2;` to `config.ts` (or make the count a parameter of `warmupConnections`).

**Tier:** 3

---

**File:** `src/tester/upload.ts:16-18` (generatePayload) + surrounding

**Finding:** `generatePayload` is a one-line wrapper around `new Uint8Array(bytes)`. Only called from the upload path.

**Why problem:** Tiny unnecessary indirection / naming.

**Recommendation:** Inline the single call site (`new Uint8Array(phase.bytes)`) and delete the helper.

**Tier:** 3

---

## Additional Notes (Non-Finding)

- `TestPhase` union type + `LiveUpdate` are well-typed (no raw stringly-typed phase literals outside the type definition).
- `BANDWIDTH_PERCENTILE` etc. are properly centralised in config.
- No obvious observers/effects or cached derived state (the Renderer interval is a simple polling render).
- `strip-ansi` package exists in node_modules but is not used; the local regex is intentional for zero-dep.
- README example version (`v1.0.0`) and "90th percentile" description are stale relative to code.
- `bin/wirespeed.js` and `tsconfig.json` are minimal and correct.
- No other high-signal issues found after exhaustive cross-file usage search (dead `computeBandwidth`, unused returns, bail, getState, etc. were the main ones).

**End of findings. 14 total.**

To address the top issues, begin with the Tier-1 duplication + dead data removal; both yield the largest reduction in lines and future bug surface.