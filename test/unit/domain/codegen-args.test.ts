import { describe, expect, it } from 'vitest';
import { buildCodegenArgs } from '../../../src/domain/codegen-args.js';

describe('buildCodegenArgs', () => {
  it('records into the site profile via --user-data-dir', () => {
    expect(buildCodegenArgs('/profiles/jobs', '/rec/out.ts', 'https://example.com', false)).toEqual(
      ['--user-data-dir', '/profiles/jobs', '-o', '/rec/out.ts', 'https://example.com'],
    );
  });

  it('adds --channel chrome when the site prefers Chrome', () => {
    expect(buildCodegenArgs('/profiles/jobs', '/rec/out.ts', 'https://example.com', true)).toEqual([
      '--user-data-dir',
      '/profiles/jobs',
      '-o',
      '/rec/out.ts',
      '--channel',
      'chrome',
      'https://example.com',
    ]);
  });
});
