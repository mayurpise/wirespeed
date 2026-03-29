import { performance } from 'node:perf_hooks';
import { CF_DOWN_URL, DOWNLOAD_PHASES, FINISH_REQUEST_DURATION_MS, MIN_REQUEST_DURATION_MS } from '../config.js';
import { timedDownload } from './http-client.js';
import { runPool } from './pool.js';
import { computeAggregateBandwidth, ema } from '../stats/calculator.js';
import { bpsToMbps } from '../stats/units.js';
import type { Measurement, BandwidthResult } from './types.js';

export async function measureDownload(
  onProgress?: (progress: number, currentSpeedBps: number) => void,
): Promise<BandwidthResult> {
  const allMeasurements: Measurement[] = [];
  let liveSpeed = 0;
  let totalRequests = 0;
  let completedRequests = 0;

  const phaseAggregates: number[] = [];

  for (const phase of DOWNLOAD_PHASES) {
    totalRequests += phase.count;
  }

  for (const phase of DOWNLOAD_PHASES) {
    const url = `${CF_DOWN_URL}?bytes=${phase.bytes}`;
    let phaseHitThreshold = false;
    let phaseBytes = 0;
    const ctx = { bail: false };

    const phaseStart = performance.now();

    const tasks = Array.from({ length: phase.count }, () => async () => {
      const timing = await timedDownload(url);
      const durationMs = timing.endTime - timing.ttfb;
      const speedBps = durationMs > 0
        ? (timing.bytesTransferred * 8 * 1000) / durationMs
        : 0;

      const m: Measurement = { bytes: timing.bytesTransferred, durationMs, speedBps };
      allMeasurements.push(m);

      if (durationMs >= MIN_REQUEST_DURATION_MS) {
        phaseBytes += timing.bytesTransferred;
      }

      if (speedBps > 0) {
        const elapsed = performance.now() - phaseStart;
        const aggBps = elapsed > 0 ? (phaseBytes * 8 * 1000) / elapsed : 0;
        liveSpeed = liveSpeed === 0 ? aggBps : ema(aggBps, liveSpeed);
      }
      if (durationMs > FINISH_REQUEST_DURATION_MS) {
        phaseHitThreshold = true;
      }

      completedRequests++;
      onProgress?.(completedRequests / totalRequests, liveSpeed);
      return m;
    });

    await runPool(tasks, phase.parallel, ctx);

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
    measurements: allMeasurements,
    speedBps,
    speedMbps: bpsToMbps(speedBps),
  };
}
