import { performance } from 'node:perf_hooks';
import { ESTIMATED_SERVER_TIME_MS } from '../config.js';
import { USER_AGENT } from '../version.js';
import type { TimingResult } from './types.js';

function parseServerTiming(headers: Headers): number {
  const st = headers.get('server-timing');
  if (st) {
    const match = /dur=([\d.]+)/.exec(st);
    if (match?.[1]) return parseFloat(match[1]);
  }
  return ESTIMATED_SERVER_TIME_MS;
}

export async function timedDownload(url: string): Promise<TimingResult> {
  const startTime = performance.now();
  const response = await fetch(url, {
    cache: 'no-store',
    headers: { 'User-Agent': USER_AGENT },
  });

  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  if (!response.body) throw new Error('No response body');

  let ttfb = 0;
  let bytesTransferred = 0;
  let firstChunk = true;

  const reader = response.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (firstChunk) {
      ttfb = performance.now();
      firstChunk = false;
    }
    if (done) break;
    bytesTransferred += value.byteLength;
  }

  // If no body bytes (zero-byte latency test), ttfb is the end time
  if (firstChunk) ttfb = performance.now();

  const endTime = performance.now();
  const serverTime = parseServerTiming(response.headers);

  return { startTime, ttfb, endTime, bytesTransferred, serverTime };
}

export async function timedUpload(url: string, payload: Uint8Array): Promise<TimingResult> {
  const startTime = performance.now();
  const response = await fetch(url, {
    method: 'POST',
    body: Buffer.from(payload),
    cache: 'no-store',
    headers: {
      'User-Agent': USER_AGENT,
      'Content-Type': 'application/octet-stream',
    },
  });

  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  // Consume response body
  if (response.body) {
    const reader = response.body.getReader();
    while (!(await reader.read()).done) {}
  }

  const endTime = performance.now();
  const ttfb = endTime; // not meaningful for upload
  const serverTime = parseServerTiming(response.headers);

  return {
    startTime,
    ttfb,
    endTime,
    bytesTransferred: payload.byteLength,
    serverTime,
  };
}
