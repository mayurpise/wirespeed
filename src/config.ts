export const CF_DOWN_URL = 'https://speed.cloudflare.com/__down';
export const CF_UP_URL = 'https://speed.cloudflare.com/__up';
export const CF_TRACE_URL = 'https://speed.cloudflare.com/cdn-cgi/trace';
export const CF_LOCATIONS_URL = 'https://speed.cloudflare.com/locations';

export const LATENCY_REQUESTS = 20;
/** Concurrency for latency probes to reduce wall time while preserving sample quality. */
export const LATENCY_CONCURRENCY = 6;
export const LATENCY_PERCENTILE = 0.5;
export const MIN_REQUEST_DURATION_MS = 10;
/** Skip to next phase if any single request exceeds this. */
export const FINISH_REQUEST_DURATION_MS = 10_000;
export const ESTIMATED_SERVER_TIME_MS = 10;
export const RENDER_INTERVAL_MS = 80;
export const EMA_ALPHA = 0.3;

/** Timeout for the optional locations API call used to enrich colo city name. */
export const LOCATIONS_FETCH_TIMEOUT_MS = 3000;

/** Timeout for the Cloudflare /cdn-cgi/trace meta fetch. */
export const TRACE_FETCH_TIMEOUT_MS = 5000;

export interface PhaseConfig {
  bytes: number;
  count: number;
  /** Max in-flight requests for this phase. */
  parallel: number;
}

/**
 * Bandwidth test phases: ramp up TCP windows, then saturate.
 *
 * Phase 1: small payloads to warm TCP congestion windows on reused connections.
 * Phase 2-3: sustained measurement with large payloads and high parallelism.
 *
 * Payload capped at 25 MB — Cloudflare rate-limits/blocks requests ≥ 100 MB.
 * With 16 parallel 25 MB streams on a 1 Gbps link, each stream finishes in ~200ms,
 * keeping the pipe constantly saturated via the sliding window.
 */
export const BANDWIDTH_PHASES: PhaseConfig[] = [
  { bytes: 1_000_000, count: 4, parallel: 4 },       // 4 MB  — TCP window warmup (connections already open)
  { bytes: 10_000_000, count: 8, parallel: 8 },       // 80 MB — ramp up
  { bytes: 25_000_000, count: 16, parallel: 16 },     // 400 MB — saturate
  { bytes: 25_000_000, count: 24, parallel: 16 },     // 600 MB — sustained measurement
];

export const DOWNLOAD_PHASES = BANDWIDTH_PHASES;
export const UPLOAD_PHASES = BANDWIDTH_PHASES;
