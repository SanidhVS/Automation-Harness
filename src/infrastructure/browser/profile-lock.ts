import { rmSync } from 'node:fs';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ProfileLockedError } from '../../domain/errors.js';

const LOCK_FILE_NAME = '.rerun.lock';

interface LockContent {
  readonly pid: number;
  readonly timestamp: string;
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (cause) {
    return (cause as NodeJS.ErrnoException).code === 'EPERM';
  }
}

async function readLockFile(lockPath: string): Promise<LockContent | null> {
  try {
    const raw = await readFile(lockPath, 'utf8');
    const parsed = JSON.parse(raw) as Partial<LockContent>;
    if (typeof parsed.pid === 'number' && typeof parsed.timestamp === 'string') {
      return { pid: parsed.pid, timestamp: parsed.timestamp };
    }
    return null;
  } catch {
    return null;
  }
}

export interface ProfileLock {
  release(): Promise<void>;
}

/** Acquires `<profileDir>/.rerun.lock`, failing with `ProfileLockedError` (exit code 5) if
 * another live Rerun process holds it, or silently reclaiming a stale lock left by a dead
 * process (Section 9.2). The lock is also released on SIGINT/SIGTERM/normal exit. */
export async function acquireProfileLock(
  profileDir: string,
  siteName: string,
): Promise<ProfileLock> {
  const lockPath = join(profileDir, LOCK_FILE_NAME);

  for (;;) {
    try {
      await writeFile(
        lockPath,
        JSON.stringify({ pid: process.pid, timestamp: new Date().toISOString() }),
        { flag: 'wx' },
      );
      break;
    } catch (cause) {
      if ((cause as NodeJS.ErrnoException).code !== 'EEXIST') throw cause;
      const existing = await readLockFile(lockPath);
      if (existing !== null && isProcessAlive(existing.pid)) {
        throw new ProfileLockedError(
          `Site "${siteName}" is in use by another Rerun process (pid ${String(existing.pid)}). Wait for it to finish.`,
        );
      }
      await rm(lockPath, { force: true });
    }
  }

  const cleanupOnExit = (): void => {
    try {
      rmSync(lockPath, { force: true });
    } catch {
      /* best effort */
    }
  };
  const onSignal = (signal: NodeJS.Signals): void => {
    process.exit(signal === 'SIGINT' ? 130 : 143);
  };
  process.once('exit', cleanupOnExit);
  process.once('SIGINT', onSignal);
  process.once('SIGTERM', onSignal);

  let released = false;
  return {
    release: async () => {
      if (released) return;
      released = true;
      process.removeListener('exit', cleanupOnExit);
      process.removeListener('SIGINT', onSignal);
      process.removeListener('SIGTERM', onSignal);
      await rm(lockPath, { force: true });
    },
  };
}
