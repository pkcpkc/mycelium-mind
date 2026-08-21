import { describe, it, expect } from 'vitest';
import { asyncPool } from '../utils/async-pool.js';

describe('asyncPool', () => {
  it('should process all items and preserve result order', async () => {
    const items = [10, 20, 30, 40, 50];
    const results = await asyncPool(2, items, async (item) => {
      return item * 2;
    });
    expect(results).toEqual([20, 40, 60, 80, 100]);
  });

  it('should limit active concurrency to specified limit', async () => {
    let running = 0;
    let maxRunning = 0;
    const items = Array.from({ length: 12 }, (_, i) => i);

    await asyncPool(3, items, async (item) => {
      running++;
      maxRunning = Math.max(maxRunning, running);
      await new Promise(resolve => setTimeout(resolve, 20));
      running--;
      return item;
    });

    expect(maxRunning).toBeLessThanOrEqual(3);
  });

  it('should handle empty input array gracefully', async () => {
    const results = await asyncPool(4, [], async (x) => x);
    expect(results).toEqual([]);
  });
});
