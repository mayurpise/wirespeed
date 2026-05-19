import { CF_DOWN_URL, LATENCY_REQUESTS, LATENCY_CONCURRENCY } from '../config.js';
import { timedDownload } from './http-client.js';
import { runPool } from './pool.js';
import { computeMedianLatency, computeJitter } from '../stats/calculator.js';
import type { LatencyResult } from './types.js';

export async function measureLatency(): Promise<LatencyResult> {
  const url = `${CF_DOWN_URL}?bytes=0`;
  const measurements: number[] = [];

  const tasks = Array.from({ length: LATENCY_REQUESTS }, () => async () => {
    try {
      const timing = await timedDownload(url);
      const latencyMs = (timing.ttfb - timing.startTime) - timing.serverTime;
      const clamped = Math.max(0, latencyMs);
      measurements.push(clamped);
    } catch {
      // Skip failed measurements
    }
  });

  await runPool(tasks, LATENCY_CONCURRENCY);

  return {
    measurements,
    median: computeMedianLatency(measurements),
    jitter: computeJitter(measurements),
  };
}
