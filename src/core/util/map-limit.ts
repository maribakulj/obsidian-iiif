/**
 * Run an async mapper over an array with a cap on concurrency.
 *
 * Results preserve input order: `results[i]` always corresponds to
 * `items[i]`, regardless of the order work completed. The first error
 * rejects the returned promise (other workers drain but their results
 * are discarded), so callers that want to survive failures should
 * wrap each item's work in try/catch inside the mapper and return
 * a settled value themselves.
 */
export async function mapLimit<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
  onProgress?: (done: number, total: number) => void,
): Promise<R[]> {
  if (!Number.isInteger(limit) || limit <= 0) {
    throw new Error(`mapLimit: limit must be a positive integer, got ${limit}`);
  }
  const total = items.length;
  const results: R[] = new Array(total);
  if (total === 0) return results;

  let nextIndex = 0;
  let done = 0;
  const workers: Promise<void>[] = [];
  const concurrency = Math.min(limit, total);

  const worker = async (): Promise<void> => {
    while (true) {
      const i = nextIndex++;
      if (i >= total) return;
      results[i] = await fn(items[i]!, i);
      done++;
      onProgress?.(done, total);
    }
  };

  for (let i = 0; i < concurrency; i++) workers.push(worker());
  await Promise.all(workers);
  return results;
}
