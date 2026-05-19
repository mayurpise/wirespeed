# Wirespeed Efficiency Review

**Tool:** wirespeed (fetch-based parallel bandwidth tester, TypeScript CLI)  
**Scope:** Full source under `/home/mayurpise/workspace/wirespeed/src` (config, index, meta, orchestrator, stats/*, tester/*, ui/*) + package.json + README.md  
**Date:** 2026-05-19  
**Method:** Static execution tracing, call-graph analysis, hot-path inspection, allocation counting, concurrency audit. Quantified using typical Cloudflare edge RTTs (20-40 ms) and phase sizes from config (latency 20, download warmup 8×2 + 52 reqs, upload similar).

**Key takeaway:** Three Tier-1 issues dominate cold-start latency: fully serial latency probes (adds ~400-800 ms), sequential non-critical meta fetches (adds 50-3000 ms), and post-latency redundant warmup (adds ~50-100 ms + 16 wasted reqs). Secondary issues are unnecessary per-request allocations and UI polling churn. Several "README vs code" and dead-code mismatches exist.

## Structured Findings

- **Location:** `src/tester/latency.ts:12-22` (the `for (let i = 0; i < LATENCY_REQUESTS; i++)` await loop calling `timedDownload`)
  **Inefficiency:** All 20 zero-byte latency requests are strictly serial. Each `timedDownload` (full fetch + body read + timing) awaits completion before the next. Jitter/median computed only after the full serial run.
  **Impact:** Wall time for latency phase ≈ 20 × RTT (typically 400-800 ms for 20-40 ms edges, plus JS overhead). Delays every download/upload phase start. Callback `onMeasurement` is accepted but ignored in the only caller.
  **Recommendation:** Replace loop with `runPool` (or bounded concurrency 5-8) for the 20 tasks. Collect timings; compute median/jitter on results. This reduces latency phase to ~2-4 RTTs while preserving statistical validity.
  **Tier:** 1

- **Location:** `src/meta.ts:39-77` (`fetchServerMeta`: trace await then locations await inside try)
  **Inefficiency:** Two fetches are sequential. `locations` (global list for city name) is attempted after full trace parse even though `COLO_CITIES` fallback map is exhaustive and city is purely cosmetic. 3 s `AbortSignal.timeout` on the second fetch.
  **Impact:** Adds full locations RTT (50-300 ms typical; worst-case ~3 s on slow/hanging responses) to cold-start before latency phase can begin. Trace itself is cheap (~1 RTT).
  **Recommendation:** `Promise.all` both fetches at entry (locations can run concurrently). Use trace result for colo/ip/loc immediately; override city only if locations resolves fast. Reduce timeout to 600-800 ms or drop locations fetch entirely (map is sufficient).
  **Tier:** 1

- **Location:** `src/tester/download.ts:19` (unconditional `await warmupConnections(CF_DOWN_URL, WARMUP_CONNECTIONS)`) + call site in `src/orchestrator.ts:24-25`
  **Inefficiency:** Latency phase already performed 20 serial fetches to the identical `CF_DOWN_URL?bytes=0` endpoint, establishing TCP+TLS and populating the undici connection pool. Download then repeats a full 2-round 8-connection warmup.
  **Impact:** 16 extra zero-byte requests + ~40-80 ms of wall time (2 rounds of parallel zeros) that provide negligible additional benefit. Wasted network and CPU on every full run.
  **Recommendation:** Remove or guard the download warmup (e.g., `if (!hadLatency) await warmup...`). Rely on latency priming. Consider a single global "ensureWarm" helper called once.
  **Tier:** 2

- **Location:** `src/tester/upload.ts:25` (warmup via `CF_DOWN_URL` before any upload phases)
  **Inefficiency:** Separate unconditional warmup (16 reqs) for upload, using the download URL as a proxy because "upload expects a body". Performed after download has already driven heavy traffic to the same origin.
  **Impact:** Another 16 zero-byte requests + ~50 ms per upload-enabled run. Duplicate logic and comment acknowledging the workaround.
  **Recommendation:** After a download run, reuse the primed pool for upload (same host). If separate warmup required, attempt a minimal-body POST directly to `CF_UP_URL` or lower `WARMUP_CONNECTIONS` for the upload path. Centralize connection priming.
  **Tier:** 2

- **Location:** `src/tester/download.ts:21,48` and `src/tester/upload.ts:27,54` (`allMeasurements.push(m)` in every task closure; returned in `BandwidthResult`)
  **Inefficiency:** Every completed request (up to ~52 per direction) allocates a `Measurement` object and appends to a growing array. The final reported `speedBps` is derived solely from per-phase `computeAggregateBandwidth` + `Math.max` on `phaseAggregates`. The per-request `speedBps` values and the array itself are never consumed for the published speed (only exposed in the result object). `computeBandwidth` (the 90-percentile consumer of this array) is dead code.
  **Impact:** 50-100 unnecessary allocations + array growth + larger result objects per test. Increases JSON output size when `--json` used. Memory "unbounded" in the theoretical sense for very long/custom phases.
  **Recommendation:** Stop collecting/pushing `Measurement` objects in bandwidth paths (or gate behind a debug flag). Return `{ measurements: [], speedBps, ... }` or change `BandwidthResult` shape. Keep collection only for `LatencyResult` where the array is actually used by `computeMedianLatency`/`computeJitter`. Delete dead `computeBandwidth`.
  **Tier:** 2

- **Location:** `src/stats/calculator.ts:19-27` (`computeBandwidth`) + all call sites (none)
  **Inefficiency:** Fully implemented, exported function that is never imported or invoked anywhere in src/, orchestrator, tester, ui, or tests. README claims "90th percentile across all measurements" which does not match the actual aggregate-max implementation.
  **Impact:** Dead code (maintenance, confusion, minor bundle bloat). Documentation/implementation mismatch misleads users and future contributors.
  **Recommendation:** Delete the function. Update README "How it works" section to accurately describe "maximum per-phase aggregate throughput (total bytes / wall time)". Align types if needed.
  **Tier:** 3

- **Location:** `src/ui/renderer.ts:17-18` (unconditional `setInterval(..., RENDER_INTERVAL_MS)` calling `logUpdate(composeFrame(this.state))` every 80 ms) + `src/ui/layout.ts:13-88` (full `composeFrame`)
  **Inefficiency:** Polling renderer recomputes the entire UI frame (header box, multiple conditionals, chalk styling, `progressBar` repeats, `padRight` + ANSI stripping, spinner advance) on every tick regardless of whether `state` changed since the previous interval.
  **Impact:** ~75-150 string/ANSI allocations per second during active phases (download/upload can run 3-10 s). Constant churn even when progress/speed are static between request completions.
  **Recommendation:** Add a `dirty` / `lastVersion` flag (or `Object.is` diff on key fields). Only invoke `logUpdate` (and thus `composeFrame`) when an `update()` actually mutated visible state. Or switch to a "render on demand" model driven from the progress callbacks.
  **Tier:** 2

- **Location:** `src/tester/download.ts:54-64` and `src/tester/upload.ts:60-70` (inside every per-task completion: `performance.now()`, aggBps math, `ema`, `onProgress` call)
  **Inefficiency:** Hot-path work (liveSpeed EMA smoothing + progress fraction + renderer state mutation) executes synchronously on every individual request completion inside the pool workers. Render itself is interval-driven, so many of these are immediately stale.
  **Impact:** Minor per-request CPU + closure/GC pressure (52+ calls per direction). Bursty updates when many parallel requests finish close together. `liveSpeed` is UI-only and discarded for final results.
  **Recommendation:** Throttle: e.g., track last update time and only call `onProgress` at most every 120 ms or every N completions. Move EMA smoothing into the Renderer or a dedicated sampler.
  **Tier:** 3

- **Location:** `src/meta.ts:11-33` (module-top-level `COLO_CITIES` literal, ~65 entries) + `src/tester/latency.ts:6` (unused `onMeasurement` param)
  **Inefficiency:** Large static map always parsed/loaded on first import (even `--version`, `--help`, or `no-download` paths). Latency function signature accepts a progress callback that the sole production caller (`orchestrator.ts:24`) supplies as a no-op.
  **Impact:** Tiny constant memory + parse cost on startup. Dead API surface.
  **Recommendation:** Keep map (acceptable for CLI) or lazy-require it. Remove the unused callback parameter (or wire incremental latency UI if desired).
  **Tier:** 3

- **Location:** `src/tester/download.ts:28-30,32` and `src/tester/upload.ts:34-36,38` (two separate `for (const phase of ...)` loops — first to sum `totalRequests`, second to execute)
  **Inefficiency:** Trivial double iteration over the small static phase arrays simply to pre-compute a denominator for progress.
  **Impact:** Negligible CPU; adds a few dozen instructions.
  **Recommendation:** Compute total via `DOWNLOAD_PHASES.reduce(...)` once, or hard-code (phases are const), or track progress purely by bytes/phase without a global total.
  **Tier:** 3

- **Location:** `src/tester/http-client.ts:27-43` (warmup `for (let round=0; round<2; round++) { await Promise.all(...) }`)
  **Inefficiency:** The two warmup rounds are themselves serialized (first round of 8 completes before second round begins). Second round's purpose ("verify reuse and let OS TCP stack settle") is reasonable but adds a full extra RTT wall time.
  **Impact:** ~1 extra RTT in the warmup sequence (already flagged as potentially redundant post-latency).
  **Recommendation:** If both rounds are kept, at least allow overlap or reduce to a single higher-concurrency round + short delay. Re-evaluate necessity after removing the download warmup.
  **Tier:** 3

- **Location:** `src/orchestrator.ts:22-25` + `src/index.ts:49` (latency and meta are unconditional; only download/upload gated)
  **Inefficiency:** Every invocation (including `--json --no-download --no-upload`) pays the full serial latency + dual meta fetch cost. No flag or early path to skip the 20-ping phase.
  **Impact:** Unavoidable ~500 ms+ tax on "metadata-only" or ultra-fast invocations.
  **Recommendation:** Add `--no-latency` (or infer from other flags) if a fast "server only" mode is desired. Otherwise document that latency is a fixed first-class phase.
  **Tier:** 3

## Execution Trace Summary (for context)

- **Cold start:** `index` → `orchestrator` → `fetchServerMeta` (2 seq fetches) → `measureLatency` (20 serial) → (optional) `measureDownload` (warmup 16 + 4 sequential phases with internal pool) → (optional) `measureUpload` (warmup 16 + 4 phases).
- **Total requests (full run):** ~2 (meta) + 20 (latency) + 16 (down warmup) + 52 (down phases) + 16 (up warmup) + 52 (up phases) ≈ 158 network round-trips, many serial.
- **Hot paths:** per-request closures in pools (alloc + ema + onProgress), 80 ms render loop (full recompose), body streaming readers.
- **Memory:** `allMeasurements` arrays (bandwidth paths), large `Uint8Array` payloads (reused per phase), COLO map.

## Recommendations by Tier (prioritized)

**Tier 1 (implement first — clear user-visible speed wins):**
- Parallelize latency (finding 1)
- Parallelize + de-risk meta (findings 2 + 8)
- Remove/reduce post-latency warmup (finding 3)

**Tier 2:**
- Eliminate duplicate upload warmup + redundant bandwidth measurement collection (4, 5)
- Add dirty tracking to renderer (7)

**Tier 3:**
- Dead code removal, micro-optimizations, API cleanup, doc sync (6, 9-12)

**Total findings: 12**  
**Tier breakdown:** 1×3, 2×3, 3×6

---

*Report generated by Efficiency Review Agent. All paths are absolute within the workspace. Changes should be validated with real RTT measurements on target networks.*