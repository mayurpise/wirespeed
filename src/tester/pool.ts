/**
 * Sliding-window concurrent executor.
 *
 * Keeps exactly `concurrency` workers busy at all times. As soon as one
 * task finishes, the worker immediately picks up the next — zero idle time
 * between batches.
 */
export async function runPool<T>(
  tasks: (() => Promise<T>)[],
  concurrency: number,
): Promise<void> {
  let nextIdx = 0;

  const worker = async (): Promise<void> => {
    while (nextIdx < tasks.length) {
      const idx = nextIdx++;
      try {
        await tasks[idx]!();
      } catch {
        // Failed requests are ignored (per-task error handling inside thunks)
      }
    }
  };

  const workerCount = Math.min(concurrency, tasks.length);
  await Promise.all(Array.from({ length: workerCount }, worker));
}
