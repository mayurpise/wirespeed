export interface TimingResult {
  startTime: number;
  ttfb: number;
  endTime: number;
  bytesTransferred: number;
  serverTime: number;
}

export interface Measurement {
  bytes: number;
  durationMs: number;
  speedBps: number;
}

export interface LatencyResult {
  measurements: number[];
  median: number;
  jitter: number;
}

export interface BandwidthResult {
  measurements: Measurement[];
  speedBps: number;
  speedMbps: number;
}

export interface ServerMeta {
  colo: string;
  city: string;
  ip: string;
  loc: string;
}

export interface TestResults {
  server: ServerMeta;
  latency: LatencyResult;
  download: BandwidthResult | null;
  upload: BandwidthResult | null;
}

export type TestPhase = 'init' | 'latency' | 'download' | 'upload' | 'done';

export interface LiveUpdate {
  phase: TestPhase;
  progress: number;
  currentSpeed: number;
  latency?: LatencyResult;
  download?: BandwidthResult;
  upload?: BandwidthResult;
  server?: ServerMeta;
}
