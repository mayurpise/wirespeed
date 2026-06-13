import { fetchServerMeta } from './meta.js';
import { measureLatency } from './tester/latency.js';
import { measureDownload } from './tester/download.js';
import { measureUpload } from './tester/upload.js';
import type { Renderer } from './ui/renderer.js';
import type { LiveUpdate, TestResults } from './tester/types.js';

export interface RunOptions {
  noDownload: boolean;
  noUpload: boolean;
}

function makeNoopRenderer(): { update(patch: Partial<LiveUpdate>): void } {
  return { update() {} };
}

export async function runSpeedTest(
  renderer: Renderer | undefined,
  options: RunOptions,
): Promise<TestResults> {
  const r = renderer ?? makeNoopRenderer();
  r.update({ phase: 'init', progress: 0, currentSpeed: 0 });

  const server = await fetchServerMeta();
  r.update({ server });

  // Latency
  r.update({ phase: 'latency', progress: 0, currentSpeed: 0 });
  const latency = await measureLatency();
  r.update({ latency });

  // Download
  let download: TestResults['download'] = null;
  if (!options.noDownload) {
    r.update({ phase: 'download', progress: 0, currentSpeed: 0 });
    download = await measureDownload((progress, currentSpeed) => {
      r.update({ progress, currentSpeed });
    });
    r.update({ download, progress: 1 });
  }

  // Upload
  let upload: TestResults['upload'] = null;
  if (!options.noUpload) {
    r.update({ phase: 'upload', progress: 0, currentSpeed: 0 });
    upload = await measureUpload((progress, currentSpeed) => {
      r.update({ progress, currentSpeed });
    });
    r.update({ upload, progress: 1 });
  }

  r.update({ phase: 'done' });
  return { server, latency, download, upload };
}
