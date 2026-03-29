export const CF_DOWN_URL = 'https://speed.cloudflare.com/__down';
export const CF_UP_URL = 'https://speed.cloudflare.com/__up';
export const CF_TRACE_URL = 'https://speed.cloudflare.com/cdn-cgi/trace';
export const CF_LOCATIONS_URL = 'https://speed.cloudflare.com/locations';

export const LATENCY_REQUESTS = 20;
export const BANDWIDTH_PERCENTILE = 0.9;
export const LATENCY_PERCENTILE = 0.5;
export const MIN_REQUEST_DURATION_MS = 10;
export const FINISH_REQUEST_DURATION_MS = 1000;
export const ESTIMATED_SERVER_TIME_MS = 10;
export const RENDER_INTERVAL_MS = 80;
export const EMA_ALPHA = 0.3;

export interface PhaseConfig {
  bytes: number;
  count: number;
  parallel: number;
}

export const DOWNLOAD_PHASES: PhaseConfig[] = [
  { bytes: 100_000, count: 2, parallel: 1 },
  { bytes: 1_000_000, count: 4, parallel: 4 },
  { bytes: 10_000_000, count: 3, parallel: 6 },
  { bytes: 25_000_000, count: 2, parallel: 6 },
  { bytes: 100_000_000, count: 1, parallel: 4 },
];

export const UPLOAD_PHASES: PhaseConfig[] = [
  { bytes: 100_000, count: 2, parallel: 1 },
  { bytes: 1_000_000, count: 4, parallel: 3 },
  { bytes: 10_000_000, count: 2, parallel: 3 },
];
