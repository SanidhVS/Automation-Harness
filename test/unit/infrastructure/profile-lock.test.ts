import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { acquireProfileLock } from '../../../src/infrastructure/browser/profile-lock.js';
import { ProfileLockedError } from '../../../src/domain/errors.js';
import { EXIT_CODES } from '../../../src/domain/exit-codes.js';

describe('acquireProfileLock', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'rerun-lock-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('acquires a free lock and writes pid/timestamp', async () => {
    const lock = await acquireProfileLock(dir, 'jobs-example');
    const content = JSON.parse(await readFile(join(dir, '.rerun.lock'), 'utf8')) as {
      pid: number;
    };
    expect(content.pid).toBe(process.pid);
    await lock.release();
  });

  it('rejects with ProfileLockedError (exit code 5) when a live process holds the lock', async () => {
    const lock = await acquireProfileLock(dir, 'jobs-example');
    try {
      await acquireProfileLock(dir, 'jobs-example');
      throw new Error('expected rejection');
    } catch (error) {
      expect(error).toBeInstanceOf(ProfileLockedError);
      expect((error as ProfileLockedError).code).toBe(EXIT_CODES.profileLocked);
    }
    await lock.release();
  });

  it('reclaims a stale lock left by a dead process', async () => {
    const child = spawn(process.execPath, ['-e', 'process.exit(0)']);
    const deadPid = child.pid;
    if (deadPid === undefined) throw new Error('failed to spawn helper process');
    await new Promise<void>((resolve) => child.once('exit', () => resolve()));

    await writeFile(
      join(dir, '.rerun.lock'),
      JSON.stringify({ pid: deadPid, timestamp: new Date().toISOString() }),
    );

    const lock = await acquireProfileLock(dir, 'jobs-example');
    const content = JSON.parse(await readFile(join(dir, '.rerun.lock'), 'utf8')) as {
      pid: number;
    };
    expect(content.pid).toBe(process.pid);
    await lock.release();
  });

  it('release() removes the lock file', async () => {
    const lock = await acquireProfileLock(dir, 'jobs-example');
    await lock.release();
    await expect(readFile(join(dir, '.rerun.lock'), 'utf8')).rejects.toThrow();
  });
});
