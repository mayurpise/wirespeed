import { CF_DOWN_URL, LATENCY_REQUESTS } from '../config.js';
import { timedDownload } from './http-client.js';
import { computeMedianLatency, computeJitter } from '../stats/calculator.js';
import type { LatencyResult } from './types.js';

export async function measureLatency(
  onMeasurement?: (index: number, latencyMs: number) => void,
): Promise<LatencyResult> {
  const url = `${CF_DOWN_URL}?bytes=0`;
  const measurements: number[] = [];

  for (let i = 0; i < LATENCY_REQUESTS; i++) {
    try {
      const timing = await timedDownload(url);
      const latencyMs = (timing.ttfb - timing.startTime) - timing.serverTime;
      const clamped = Math.max(0, latencyMs);
      measurements.push(clamped);
      onMeasurement?.(i, clamped);
    } catch {
      // Skip failed measurements
    }
  }

  return {
    measurements,
    median: computeMedianLatency(measurements),
    jitter: computeJitter(measurements),
  };
}
