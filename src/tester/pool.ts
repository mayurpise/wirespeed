/**
 * Sliding-window concurrent executor.
 *
 * Keeps exactly `concurrency` workers busy at all times. As soon as one
 * task finishes, the worker immediately picks up the next — zero idle time
 * between batches.
 *
 * A shared `bail` flag lets any task signal that remaining tasks should be
 * skipped (e.g., on rate-limiting or fatal errors).
 */
export interface PoolContext {
  /** Set to true to stop dispatching new tasks. In-flight tasks still finish. */
  bail: boolean;
}

export async function runPool<T>(
  tasks: (() => Promise<T>)[],
  concurrency: number,
  ctx?: PoolContext,
  onComplete?: (result: T, index: number) => void,
): Promise<T[]> {
  const results: (T | undefined)[] = new Array(tasks.length);
  let nextIdx = 0;
  const poolCtx = ctx ?? { bail: false };

  const worker = async (): Promise<void> => {
    while (nextIdx < tasks.length && !poolCtx.bail) {
      const idx = nextIdx++;
      try {
        const result = await tasks[idx]!();
        results[idx] = result;
        onComplete?.(result, idx);
      } catch {
        // Failed requests are left undefined — filtered out during stats
      }
    }
  };

  const workerCount = Math.min(concurrency, tasks.length);
  await Promise.all(Array.from({ length: workerCount }, worker));
  return results.filter((r): r is T => r !== undefined);
}
