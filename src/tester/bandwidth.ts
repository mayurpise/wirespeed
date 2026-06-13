import { performance } from 'node:perf_hooks';
import {
  BANDWIDTH_PHASES,
  FINISH_REQUEST_DURATION_MS,
  MIN_REQUEST_DURATION_MS,
} from '../config.js';
import { runPool } from './pool.js';
import { computeAggregateBandwidth, ema } from '../stats/calculator.js';
import { bpsToMbps } from '../stats/units.js';
import type { PhaseConfig } from '../config.js';
import type { TimingResult } from './types.js';
import type { BandwidthResult } from './types.js';

export interface BandwidthStrategy {
  createRequest(phase: PhaseConfig): () => Promise<TimingResult>;
  computeTransferDuration(timing: TimingResult): number;
}

/**
 * Shared phased parallel bandwidth measurement.
 * Used by both download and upload to avoid duplication of the
 * orchestration, progress tracking, EMA live speed, early-break,
 * and aggregate-max logic.
 */
export async function runBandwidthTest(
  strategy: BandwidthStrategy,
  onProgress?: (progress: number, currentSpeedBps: number) => void,
  phases: PhaseConfig[] = BANDWIDTH_PHASES,
): Promise<BandwidthResult> {
  let liveSpeed = 0;
  let totalRequests = 0;
  let completedRequests = 0;

  const phaseAggregates: number[] = [];

  for (const phase of phases) {
    totalRequests += phase.count;
  }

  for (const phase of phases) {
    let phaseHitThreshold = false;
    let phaseBytes = 0;

    const phaseStart = performance.now();

    const makeRequest = strategy.createRequest(phase);
    const tasks = Array.from({ length: phase.count }, () => async () => {
      const timing = await makeRequest();
      const durationMs = strategy.computeTransferDuration(timing);
      const speedBps = durationMs > 0
        ? (timing.bytesTransferred * 8 * 1000) / durationMs
        : 0;

      if (durationMs >= MIN_REQUEST_DURATION_MS) {
        phaseBytes += timing.bytesTransferred;
      }

      if (speedBps > 0) {
        const elapsed = performance.now() - phaseStart;
        const aggBps = computeAggregateBandwidth(phaseBytes, elapsed);
        liveSpeed = liveSpeed === 0 ? aggBps : ema(aggBps, liveSpeed);
      }
      if (durationMs > FINISH_REQUEST_DURATION_MS) {
        phaseHitThreshold = true;
      }

      completedRequests++;
      onProgress?.(completedRequests / totalRequests, liveSpeed);
    });

    await runPool(tasks, phase.parallel);

    const phaseWallMs = performance.now() - phaseStart;
    if (phaseBytes > 0 && phaseWallMs > 0) {
      phaseAggregates.push(computeAggregateBandwidth(phaseBytes, phaseWallMs));
    }

    if (phaseHitThreshold) break;
  }

  const speedBps = phaseAggregates.length > 0
    ? Math.max(...phaseAggregates)
    : 0;

  return {
    speedBps,
    speedMbps: bpsToMbps(speedBps),
  };
}
