import { mkdtemp, mkdir, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Clock } from '../../../src/application/ports/clock.js';
import {
  formatRunTimestamp,
  RunFolderManager,
} from '../../../src/infrastructure/output/run-folder-manager.js';

class FixedClock implements Clock {
  constructor(private readonly date: Date) {}
  now(): Date {
    return this.date;
  }
}

describe('formatRunTimestamp', () => {
  it('formats as YYYY-MM-DD_HH-mm-ss', () => {
    const date = new Date(2026, 8, 23, 14, 5, 11);
    expect(formatRunTimestamp(date)).toBe('2026-09-23_14-05-11');
  });
});

describe('RunFolderManager', () => {
  let workspaceRoot: string;

  beforeEach(async () => {
    workspaceRoot = await mkdtemp(join(tmpdir(), 'rerun-run-folder-'));
  });

  afterEach(async () => {
    await rm(workspaceRoot, { recursive: true, force: true });
  });

  it('creates a timestamped run folder under output/<automation>/', async () => {
    const manager = new RunFolderManager(new FixedClock(new Date(2026, 8, 23, 14, 5, 11)));
    const { path, timestamp } = await manager.createRunFolder(
      workspaceRoot,
      'output',
      'job-search',
    );
    expect(timestamp).toBe('2026-09-23_14-05-11');
    expect(path).toBe(join(workspaceRoot, 'output', 'job-search', '2026-09-23_14-05-11'));
    await expect(readdir(path)).resolves.toEqual([]);
  });

  it('deletes only the oldest folders beyond keepRuns', async () => {
    const automationDir = join(workspaceRoot, 'output', 'job-search');
    const names = ['2026-01-01_00-00-00', '2026-01-02_00-00-00', '2026-01-03_00-00-00'];
    for (const name of names) {
      await mkdir(join(automationDir, name), { recursive: true });
    }
    const manager = new RunFolderManager(new FixedClock(new Date()));
    const deleted = await manager.applyRetention(workspaceRoot, 'output', 'job-search', 2);
    expect(deleted).toEqual(['2026-01-01_00-00-00']);
    const remaining = await readdir(automationDir);
    expect(remaining.sort()).toEqual(['2026-01-02_00-00-00', '2026-01-03_00-00-00']);
  });

  it('is a no-op when the automation has no output folder yet', async () => {
    const manager = new RunFolderManager(new FixedClock(new Date()));
    const deleted = await manager.applyRetention(workspaceRoot, 'output', 'never-run', 5);
    expect(deleted).toEqual([]);
  });
});
