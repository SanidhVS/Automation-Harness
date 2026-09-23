import envPaths from 'env-paths';
import { mkdir, chmod } from 'node:fs/promises';
import { join } from 'node:path';
import { platform } from 'node:process';
import { PRODUCT_NAME } from '../../shared/product.js';

/** OS-appropriate app-data directory for Rerun (Section 9.1): `%LOCALAPPDATA%` on Windows,
 * `~/Library/Application Support` on macOS, `~/.local/share` on Linux. */
export function appDataDir(): string {
  // env-paths defaults to appending "-nodejs" to the name (to avoid clashing with native
  // apps of the same name) — not what Section 9.1's plain `~/Library/Application
  // Support/<product>` example shows, and not what a user would expect to find.
  return envPaths(PRODUCT_NAME, { suffix: '' }).data;
}

/** Resolves a site's browser profile directory: `profilesDirOverride/<site>` when the
 * workspace config sets `profilesDir`, otherwise `<appDataDir>/profiles/<site>`. */
export function resolveProfileDir(siteName: string, profilesDirOverride: string | null): string {
  const base = profilesDirOverride ?? join(appDataDir(), 'profiles');
  return join(base, siteName);
}

/** Creates the profile directory if missing, with user-only permissions on POSIX. */
export async function ensureProfileDir(profileDir: string): Promise<void> {
  await mkdir(profileDir, { recursive: true });
  if (platform !== 'win32') {
    await chmod(profileDir, 0o700);
  }
}
