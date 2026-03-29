import { parseArgs } from 'node:util';
import { Renderer } from './ui/renderer.js';
import { composePlainResult, composeJson } from './ui/layout.js';
import { runSpeedTest } from './orchestrator.js';
import type { LiveUpdate } from './tester/types.js';

const { values } = parseArgs({
  options: {
    json: { type: 'boolean', default: false },
    'no-upload': { type: 'boolean', default: false },
    'no-download': { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h', default: false },
    version: { type: 'boolean', short: 'v', default: false },
  },
  strict: true,
});

if (values.help) {
  console.log(`
  how-fast - Terminal internet speed test

  Usage: how-fast [options]

  Options:
    --json           Output results as JSON
    --no-download    Skip download test
    --no-upload      Skip upload test
    -h, --help       Show this help
    -v, --version    Show version
  `);
  process.exit(0);
}

if (values.version) {
  console.log('how-fast v1.0.0');
  process.exit(0);
}

const isInteractive = process.stdout.isTTY && !values.json;

const renderer = new Renderer();

if (isInteractive) {
  renderer.start();
}

try {
  const results = await runSpeedTest(renderer, {
    noDownload: values['no-download'] ?? false,
    noUpload: values['no-upload'] ?? false,
  });

  if (isInteractive) {
    renderer.stop();
  } else {
    const finalState: LiveUpdate = {
      phase: 'done',
      progress: 1,
      currentSpeed: 0,
      server: results.server,
      latency: results.latency,
      download: results.download ?? undefined,
      upload: results.upload ?? undefined,
    };

    if (values.json) {
      console.log(composeJson(finalState));
    } else {
      console.log(composePlainResult(finalState));
    }
  }
} catch (err) {
  if (isInteractive) renderer.stop();
  console.error('Speed test failed:', err instanceof Error ? err.message : err);
  process.exit(1);
}
