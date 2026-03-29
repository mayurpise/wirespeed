import { fetchServerMeta } from './meta.js';
import { measureLatency } from './tester/latency.js';
import { measureDownload } from './tester/download.js';
import { measureUpload } from './tester/upload.js';
import { Renderer } from './ui/renderer.js';
import type { TestResults, LiveUpdate } from './tester/types.js';

export interface RunOptions {
  noDownload: boolean;
  noUpload: boolean;
}

export async function runSpeedTest(
  renderer: Renderer,
  options: RunOptions,
): Promise<TestResults> {
  renderer.update({ phase: 'init', progress: 0, currentSpeed: 0 });

  const server = await fetchServerMeta();
  renderer.update({ server });

  // Latency
  renderer.update({ phase: 'latency', progress: 0, currentSpeed: 0 });
  const latency = await measureLatency((_i, _ms) => {});
  renderer.update({ latency });

  // Download
  let download: TestResults['download'] = null;
  if (!options.noDownload) {
    renderer.update({ phase: 'download', progress: 0, currentSpeed: 0 });
    download = await measureDownload((progress, currentSpeed) => {
      renderer.update({ progress, currentSpeed });
    });
    renderer.update({ download, progress: 1 });
  }

  // Upload
  let upload: TestResults['upload'] = null;
  if (!options.noUpload) {
    renderer.update({ phase: 'upload', progress: 0, currentSpeed: 0 });
    upload = await measureUpload((progress, currentSpeed) => {
      renderer.update({ progress, currentSpeed });
    });
    renderer.update({ upload, progress: 1 });
  }

  renderer.update({ phase: 'done' });
  return { server, latency, download, upload };
}
