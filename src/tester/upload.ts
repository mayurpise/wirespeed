import { CF_UP_URL } from '../config.js';
import { timedUpload, getTransferDurationMs } from './http-client.js';
import { runBandwidthTest } from './bandwidth.js';
import type { BandwidthResult } from './types.js';

export async function measureUpload(
  onProgress?: (progress: number, currentSpeedBps: number) => void,
): Promise<BandwidthResult> {
  return runBandwidthTest(
    {
      createRequest: (phase) => {
        const payload = new Uint8Array(phase.bytes);
        return () => timedUpload(CF_UP_URL, payload);
      },
      computeTransferDuration: (t) => getTransferDurationMs(t, false),
    },
    onProgress,
  );
}
