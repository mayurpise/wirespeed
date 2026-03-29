import type { Measurement } from '../tester/types.js';
import { MIN_REQUEST_DURATION_MS, BANDWIDTH_PERCENTILE, LATENCY_PERCENTILE, EMA_ALPHA } from '../config.js';

export function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0]!;

  const pos = (sorted.length - 1) * p;
  const base = Math.floor(pos);
  const rest = pos - base;

  const next = sorted[base + 1];
  if (next !== undefined) {
    return sorted[base]! + rest * (next - sorted[base]!);
  }
  return sorted[base]!;
}

export function computeBandwidth(measurements: Measurement[]): number {
  const valid = measurements
    .filter(m => m.durationMs >= MIN_REQUEST_DURATION_MS)
    .map(m => m.speedBps)
    .sort((a, b) => a - b);

  if (valid.length === 0) return 0;
  return percentile(valid, BANDWIDTH_PERCENTILE);
}

/**
 * Aggregate throughput = total bytes transferred / wall-clock duration.
 * This is the correct metric when multiple connections run in parallel:
 * individual request speeds are low (they share bandwidth), but aggregate
 * reflects the actual link utilization.
 */
export function computeAggregateBandwidth(
  totalBytes: number,
  wallTimeMs: number,
): number {
  if (wallTimeMs <= 0) return 0;
  return (totalBytes * 8 * 1000) / wallTimeMs;
}

export function computeMedianLatency(latencies: number[]): number {
  const sorted = [...latencies].sort((a, b) => a - b);
  return percentile(sorted, LATENCY_PERCENTILE);
}

export function computeJitter(latencies: number[]): number {
  if (latencies.length < 2) return 0;
  let sum = 0;
  for (let i = 1; i < latencies.length; i++) {
    sum += Math.abs(latencies[i]! - latencies[i - 1]!);
  }
  return sum / (latencies.length - 1);
}

export function ema(current: number, previous: number): number {
  return EMA_ALPHA * current + (1 - EMA_ALPHA) * previous;
}
