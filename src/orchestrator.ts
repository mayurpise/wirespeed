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
  // Phase: init
  renderer.update({ phase: 'init', progress: 0, currentSpeed: 0 });

  const server = await fetchServerMeta();
  renderer.update({ server });

  // Phase: latency
  renderer.update({ phase: 'latency', progress: 0, currentSpeed: 0 });
  const latency = await measureLatency((_i, _ms) => {
    // Could update live latency display here if desired
  });
  renderer.update({ latency });

  // Phase: download
  let download: TestResults['download'] = null;
  if (!options.noDownload) {
    renderer.update({ phase: 'download', progress: 0, currentSpeed: 0 });
    download = await measureDownload((progress, currentSpeed) => {
      renderer.update({ progress, currentSpeed });
    });
    renderer.update({ download, progress: 1 });
  }

  // Phase: upload
  let upload: TestResults['upload'] = null;
  if (!options.noUpload) {
    renderer.update({ phase: 'upload', progress: 0, currentSpeed: 0 });
    upload = await measureUpload((progress, currentSpeed) => {
      renderer.update({ progress, currentSpeed });
    });
    renderer.update({ upload, progress: 1 });
  }

  // Done
  renderer.update({ phase: 'done' });

  return { server, latency, download, upload };
}
