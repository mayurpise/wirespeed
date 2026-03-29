import logUpdate from 'log-update';
import { RENDER_INTERVAL_MS } from '../config.js';
import { composeFrame } from './layout.js';
import { resetSpinner } from './components.js';
import type { LiveUpdate } from '../tester/types.js';

export class Renderer {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private state: LiveUpdate = {
    phase: 'init',
    progress: 0,
    currentSpeed: 0,
  };

  start(): void {
    resetSpinner();
    this.intervalId = setInterval(() => {
      logUpdate(composeFrame(this.state));
    }, RENDER_INTERVAL_MS);
    // Render immediately
    logUpdate(composeFrame(this.state));
  }

  update(patch: Partial<LiveUpdate>): void {
    Object.assign(this.state, patch);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    // Render final frame and persist it
    logUpdate(composeFrame(this.state));
    logUpdate.done();
  }

  getState(): LiveUpdate {
    return { ...this.state };
  }
}
