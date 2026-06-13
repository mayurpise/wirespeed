import { CF_DOWN_URL } from '../config.js';
import { timedDownload, getTransferDurationMs } from './http-client.js';
import { runBandwidthTest } from './bandwidth.js';
import type { BandwidthResult } from './types.js';

export async function measureDownload(
  onProgress?: (progress: number, currentSpeedBps: number) => void,
): Promise<BandwidthResult> {
  return runBandwidthTest(
    {
      createRequest: (phase) => {
        const url = `${CF_DOWN_URL}?bytes=${phase.bytes}`;
        return () => timedDownload(url);
      },
      computeTransferDuration: (t) => getTransferDurationMs(t, true),
    },
    onProgress,
  );
}
