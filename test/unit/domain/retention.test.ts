import { describe, expect, it } from 'vitest';
import { selectRunsToDelete } from '../../../src/domain/retention.js';

describe('selectRunsToDelete', () => {
  it('keeps everything when under the limit', () => {
    expect(selectRunsToDelete(['a', 'b'], 5)).toEqual([]);
  });

  it('deletes the oldest (lexically smallest) folders beyond the limit', () => {
    const folders = [
      '2026-09-20_10-00-00',
      '2026-09-21_10-00-00',
      '2026-09-22_10-00-00',
      '2026-09-23_10-00-00',
    ];
    expect(selectRunsToDelete(folders, 2)).toEqual(['2026-09-20_10-00-00', '2026-09-21_10-00-00']);
  });

  it('is order-independent on the input', () => {
    const shuffled = ['b', 'c', 'a'];
    expect(selectRunsToDelete(shuffled, 1)).toEqual(['a', 'b']);
  });

  it('deletes nothing for a non-positive keepRuns', () => {
    expect(selectRunsToDelete(['a', 'b'], 0)).toEqual([]);
  });
});
