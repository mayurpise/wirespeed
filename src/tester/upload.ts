import { performance } from 'node:perf_hooks';
import {
  CF_UP_URL,
  CF_DOWN_URL,
  UPLOAD_PHASES,
  FINISH_REQUEST_DURATION_MS,
  MIN_REQUEST_DURATION_MS,
  WARMUP_CONNECTIONS,
} from '../config.js';
import { timedUpload, warmupConnections } from './http-client.js';
import { runPool } from './pool.js';
import { computeAggregateBandwidth, ema } from '../stats/calculator.js';
import { bpsToMbps } from '../stats/units.js';
import type { BandwidthResult } from './types.js';

export async function measureUpload(
  onProgress?: (progress: number, currentSpeedBps: number) => void,
): Promise<BandwidthResult> {
  // Pre-warm connections to the upload endpoint
  // Uses the download endpoint since upload endpoint expects a body
  await warmupConnections(CF_DOWN_URL, WARMUP_CONNECTIONS);

  let liveSpeed = 0;
  let totalRequests = 0;
  let completedRequests = 0;

  const phaseAggregates: number[] = [];

  for (const phase of UPLOAD_PHASES) {
    totalRequests += phase.count;
  }

  for (const phase of UPLOAD_PHASES) {
    const payload = new Uint8Array(phase.bytes);
    let phaseHitThreshold = false;
    let phaseBytes = 0;

    const phaseStart = performance.now();

    const tasks = Array.from({ length: phase.count }, () => async () => {
      const timing = await timedUpload(CF_UP_URL, payload);
      const durationMs = (timing.endTime - timing.startTime) - timing.serverTime;
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
