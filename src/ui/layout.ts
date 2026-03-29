import { symbols, colors, latencyColor } from './theme.js';
import { box, progressBar, getSpinnerFrame } from './components.js';
import { formatSpeed, formatLatency } from '../stats/units.js';
import { VERSION } from '../version.js';
import type { LiveUpdate } from '../tester/types.js';

function padRight(str: string, len: number): string {
  const stripped = str.replace(/\x1b\[[0-9;]*m/g, '');
  const pad = Math.max(0, len - stripped.length);
  return str + ' '.repeat(pad);
}

export function composeFrame(state: LiveUpdate): string {
  const lines: string[] = [];

  // Header box
  const headerLines = [
    colors.header(`wirespeed`) + colors.dim(`  v${VERSION}`),
  ];
  if (state.server) {
    headerLines.push(
      colors.dim(`Server: Cloudflare ${state.server.colo} (${state.server.city})`),
    );
  }
  lines.push(box(headerLines));
  lines.push('');

  // Phase status
  if (state.phase === 'init') {
    lines.push(`   ${getSpinnerFrame()} ${colors.dim('Connecting to server...')}`);
  } else if (state.phase === 'latency') {
    lines.push(`   ${getSpinnerFrame()} ${colors.dim('Measuring latency...')}`);
  } else if (state.phase === 'download') {
    lines.push(`   ${getSpinnerFrame()} ${colors.dim('Testing download speed...')}`);
  } else if (state.phase === 'upload') {
    lines.push(`   ${getSpinnerFrame()} ${colors.dim('Testing upload speed...')}`);
  }

  lines.push('');

  // Latency
  if (state.latency) {
    const lc = latencyColor(state.latency.median);
    lines.push(
      `   ${symbols.latency}  ${colors.label('Latency')}    ${padRight(lc(formatLatency(state.latency.median)), 16)}` +
      colors.dim(`jitter: ${formatLatency(state.latency.jitter)}`),
    );
  } else if (state.phase === 'latency') {
    lines.push(`   ${symbols.latency}  ${colors.label('Latency')}    ${colors.dim('measuring...')}`);
  }

  // Download
  if (state.download) {
    lines.push(
      `   ${symbols.download}  ${colors.label('Download')}   ${colors.download(formatSpeed(state.download.speedBps))}  ${colors.success(symbols.check)}`,
    );
  } else if (state.phase === 'download') {
    const speedStr = state.currentSpeed > 0
      ? colors.download(formatSpeed(state.currentSpeed))
      : colors.dim('—');
    lines.push(`   ${symbols.download}  ${colors.label('Download')}   ${speedStr}`);
    lines.push(`      ${progressBar(state.progress)}  ${colors.dim(`${Math.round(state.progress * 100)}%`)}`);
  } else if (state.phase !== 'init' && state.phase !== 'latency') {
    lines.push(`   ${symbols.download}  ${colors.label('Download')}   ${colors.dim('—')}`);
  }

  // Upload
  if (state.upload) {
    lines.push(
      `   ${symbols.upload}  ${colors.label('Upload')}     ${colors.upload(formatSpeed(state.upload.speedBps))}  ${colors.success(symbols.check)}`,
    );
  } else if (state.phase === 'upload') {
    const speedStr = state.currentSpeed > 0
      ? colors.upload(formatSpeed(state.currentSpeed))
      : colors.dim('—');
    lines.push(`   ${symbols.upload}  ${colors.label('Upload')}     ${speedStr}`);
    lines.push(`      ${progressBar(state.progress)}  ${colors.dim(`${Math.round(state.progress * 100)}%`)}`);
  } else if (state.phase === 'done') {
    lines.push(`   ${symbols.upload}  ${colors.label('Upload')}     ${colors.dim('—')}`);
  }

  // Done
  if (state.phase === 'done') {
    lines.push('');
  }

  return lines.join('\n');
}

export function composePlainResult(state: LiveUpdate): string {
  const lines: string[] = [];
  if (state.server) {
    lines.push(`Server: Cloudflare ${state.server.colo} (${state.server.city})`);
  }
  if (state.latency) {
    lines.push(`Latency: ${formatLatency(state.latency.median)} (jitter: ${formatLatency(state.latency.jitter)})`);
  }
  if (state.download) {
    lines.push(`Download: ${formatSpeed(state.download.speedBps)}`);
  }
  if (state.upload) {
    lines.push(`Upload: ${formatSpeed(state.upload.speedBps)}`);
  }
  return lines.join('\n');
}

export function composeJson(state: LiveUpdate): string {
  return JSON.stringify({
    server: state.server,
    latency: state.latency ? {
      median_ms: Math.round(state.latency.median * 100) / 100,
      jitter_ms: Math.round(state.latency.jitter * 100) / 100,
    } : null,
    download: state.download ? {
      speed_bps: Math.round(state.download.speedBps),
      speed_mbps: Math.round(state.download.speedMbps * 100) / 100,
    } : null,
    upload: state.upload ? {
      speed_bps: Math.round(state.upload.speedBps),
      speed_mbps: Math.round(state.upload.speedMbps * 100) / 100,
    } : null,
  }, null, 2);
}
