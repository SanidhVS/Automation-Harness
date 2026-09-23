import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { appDataDir, resolveProfileDir } from '../../../src/infrastructure/paths/app-paths.js';

describe('appDataDir', () => {
  it('does not carry env-paths’ default "-nodejs" suffix', () => {
    expect(appDataDir()).not.toContain('-nodejs');
    expect(appDataDir()).toMatch(/rerun/);
  });
});

describe('resolveProfileDir', () => {
  it('uses the override directory when given', () => {
    expect(resolveProfileDir('jobs-example', '/custom/profiles')).toBe(
      join('/custom/profiles', 'jobs-example'),
    );
  });

  it('falls back to <app-data>/profiles/<site> when no override is given', () => {
    const result = resolveProfileDir('jobs-example', null);
    expect(result.endsWith(join('profiles', 'jobs-example'))).toBe(true);
  });
});
