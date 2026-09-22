import { describe, expect, it, vi } from 'vitest';
import { createHelpers } from '../../../src/sdk/helpers.js';
import { FlowAssertionError } from '../../../src/domain/errors.js';

describe('helpers.pause', () => {
  it('waits within the site pacing bounds', async () => {
    const { pause } = createHelpers({ minDelayMs: 20, maxDelayMs: 30 });
    const start = Date.now();
    await pause();
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(19);
    expect(elapsed).toBeLessThan(200);
  });

  it('handles minDelayMs === maxDelayMs', async () => {
    const { pause } = createHelpers({ minDelayMs: 10, maxDelayMs: 10 });
    const start = Date.now();
    await pause();
    expect(Date.now() - start).toBeGreaterThanOrEqual(9);
  });
});

describe('helpers.assert', () => {
  it('does nothing when the condition is true', () => {
    const { assert } = createHelpers({ minDelayMs: 0, maxDelayMs: 0 });
    expect(() => assert(true, 'should not throw')).not.toThrow();
  });

  it('throws FlowAssertionError with the given message when false', () => {
    const { assert } = createHelpers({ minDelayMs: 0, maxDelayMs: 0 });
    expect(() => assert(false, 'expected at least one result')).toThrow(FlowAssertionError);
    expect(() => assert(false, 'expected at least one result')).toThrow(
      'expected at least one result',
    );
  });
});

describe('helpers.collectUntil', () => {
  const helpers = createHelpers({ minDelayMs: 0, maxDelayMs: 0 });

  it('collects across pages until count is reached, calling next() between rounds', async () => {
    const pages = [
      ['a', 'b', 'c'],
      ['d', 'e', 'f'],
      ['g', 'h', 'i'],
    ];
    let page = 0;
    const next = vi.fn(async () => {
      page += 1;
      return page < pages.length;
    });
    const rows = await helpers.collectUntil({
      count: 5,
      extract: async () => pages[page] ?? [],
      next,
    });
    expect(rows).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('stops when next() returns false even under count', async () => {
    const rows = await helpers.collectUntil({
      count: 100,
      extract: async () => ['a', 'b'],
      next: async () => false,
    });
    expect(rows).toEqual(['a', 'b']);
  });

  it('dedupes rows across rounds by the given key', async () => {
    const batches = [
      ['a', 'b'],
      ['b', 'c'],
      ['c', 'd'],
    ];
    let round = 0;
    const rows = await helpers.collectUntil({
      count: 10,
      extract: async () => batches[round] ?? [],
      next: async () => {
        round += 1;
        return round < batches.length;
      },
      dedupeBy: (row) => row,
    });
    expect(rows).toEqual(['a', 'b', 'c', 'd']);
  });

  it('stops after two consecutive rounds add no new rows', async () => {
    const next = vi.fn(async () => true);
    const rows = await helpers.collectUntil({
      count: 100,
      extract: async () => ['same', 'same'],
      next,
      dedupeBy: (row) => row,
      maxRounds: 20,
    });
    expect(rows).toEqual(['same']);
    // one successful round (adds "same"), then two no-new rounds before stopping
    expect(next).toHaveBeenCalledTimes(2);
  });

  it('stops at maxRounds even if more would be available', async () => {
    let round = 0;
    const rows = await helpers.collectUntil({
      count: 100,
      extract: async () => {
        round += 1;
        return [`row-${String(round)}`];
      },
      next: async () => true,
      maxRounds: 3,
    });
    expect(rows).toHaveLength(3);
  });

  it('truncates the final batch to exactly count', async () => {
    const rows = await helpers.collectUntil({
      count: 2,
      extract: async () => ['a', 'b', 'c', 'd'],
      next: async () => true,
    });
    expect(rows).toEqual(['a', 'b']);
  });
});
