import { CF_DOWN_URL, DOWNLOAD_PHASES, FINISH_REQUEST_DURATION_MS } from '../config.js';
import { timedDownload } from './http-client.js';
import { computeBandwidth, ema } from '../stats/calculator.js';
import { bpsToMbps } from '../stats/units.js';
import type { Measurement, BandwidthResult } from './types.js';

export async function measureDownload(
  onProgress?: (progress: number, currentSpeedBps: number) => void,
): Promise<BandwidthResult> {
  const allMeasurements: Measurement[] = [];
  let liveSpeed = 0;
  let totalRequests = 0;
  let completedRequests = 0;

  // Count total requests for progress
  for (const phase of DOWNLOAD_PHASES) {
    totalRequests += phase.count;
  }

  for (const phase of DOWNLOAD_PHASES) {
    const url = `${CF_DOWN_URL}?bytes=${phase.bytes}`;
    let remaining = phase.count;
    let phaseHitThreshold = false;

    while (remaining > 0) {
      const batch = Math.min(remaining, phase.parallel);
      const promises = Array.from({ length: batch }, () =>
        timedDownload(url).then(timing => {
          const durationMs = timing.endTime - timing.ttfb;
          const speedBps = durationMs > 0
            ? (timing.bytesTransferred * 8 * 1000) / durationMs
            : 0;

          const m: Measurement = {
            bytes: timing.bytesTransferred,
            durationMs,
            speedBps,
          };
          allMeasurements.push(m);

          if (speedBps > 0) {
            liveSpeed = liveSpeed === 0 ? speedBps : ema(speedBps, liveSpeed);
          }
          if (durationMs > FINISH_REQUEST_DURATION_MS) {
            phaseHitThreshold = true;
          }

          completedRequests++;
          onProgress?.(completedRequests / totalRequests, liveSpeed);
          return m;
        }).catch(() => {
          completedRequests++;
          onProgress?.(completedRequests / totalRequests, liveSpeed);
          return null;
        }),
      );

      await Promise.all(promises);
      remaining -= batch;
    }

    // Early termination: if requests in this phase took long enough, skip larger phases
    if (phaseHitThreshold) break;
  }

  const speedBps = computeBandwidth(allMeasurements);
  return {
    measurements: allMeasurements,
    speedBps,
    speedMbps: bpsToMbps(speedBps),
  };
}
