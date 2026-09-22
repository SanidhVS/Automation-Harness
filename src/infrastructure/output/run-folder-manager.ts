import { mkdir, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import type { Clock } from '../../application/ports/clock.js';
import { selectRunsToDelete } from '../../domain/retention.js';

function pad(value: number): string {
  return value.toString().padStart(2, '0');
}

/** Formats a timestamp as `YYYY-MM-DD_HH-mm-ss` in local time — the run folder name
 * (Section 9.4 step 4). */
export function formatRunTimestamp(date: Date): string {
  const y = date.getFullYear().toString();
  const mo = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const h = pad(date.getHours());
  const mi = pad(date.getMinutes());
  const s = pad(date.getSeconds());
  return `${y}-${mo}-${d}_${h}-${mi}-${s}`;
}

/** Creates timestamped run folders under `output/<automation>/` and applies the
 * `keepRuns` retention policy (Section 8.1, 9.4 step 11). */
export class RunFolderManager {
  constructor(private readonly clock: Clock) {}

  async createRunFolder(
    workspaceRoot: string,
    outputDir: string,
    automation: string,
  ): Promise<{ path: string; timestamp: string }> {
    const timestamp = formatRunTimestamp(this.clock.now());
    const path = join(workspaceRoot, outputDir, automation, timestamp);
    await mkdir(path, { recursive: true });
    return { path, timestamp };
  }

  async applyRetention(
    workspaceRoot: string,
    outputDir: string,
    automation: string,
    keepRuns: number,
  ): Promise<readonly string[]> {
    const automationDir = join(workspaceRoot, outputDir, automation);
    let entries;
    try {
      entries = await readdir(automationDir, { withFileTypes: true });
    } catch (cause) {
      if ((cause as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw cause;
    }
    const runFolders = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
    const toDelete = selectRunsToDelete(runFolders, keepRuns);
    await Promise.all(toDelete.map((name) => rm(join(automationDir, name), { recursive: true })));
    return toDelete;
  }
}
