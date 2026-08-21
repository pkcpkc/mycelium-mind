/**
 * Executes items with a bounded concurrency pool.
 *
 * @param concurrency Maximum number of tasks to run concurrently.
 * @param items Items to process.
 * @param taskFn Task function returning a Promise.
 * @returns Array of resolved results matching the input items order.
 */
export async function asyncPool<T, R>(
  concurrency: number,
  items: T[],
  taskFn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const limit = Math.max(1, concurrency);
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  const worker = async (): Promise<void> => {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      results[index] = await taskFn(items[index], index);
    }
  };

  const poolSize = Math.min(limit, items.length);
  const workers = Array.from({ length: poolSize }, () => worker());
  await Promise.all(workers);

  return results;
}
