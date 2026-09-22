import { describe, expect, it } from 'vitest';
import { workspaceConfigSchema } from '../../../src/domain/schemas/workspace-config.js';
import { siteSchema } from '../../../src/domain/schemas/site.js';
import { manifestSchema } from '../../../src/domain/schemas/manifest.js';
import { runSummarySchema } from '../../../src/domain/schemas/run-summary.js';

describe('workspaceConfigSchema', () => {
  it('accepts a minimal config and fills defaults', () => {
    const result = workspaceConfigSchema.parse({ version: 1 });
    expect(result).toEqual({
      version: 1,
      outputDir: 'output',
      keepRuns: 20,
      trace: 'on-failure',
      profilesDir: null,
    });
  });

  it('rejects an invalid trace value', () => {
    expect(() => workspaceConfigSchema.parse({ version: 1, trace: 'always' })).toThrow();
  });

  it('rejects unknown properties', () => {
    expect(() => workspaceConfigSchema.parse({ version: 1, extra: true })).toThrow();
  });
});

describe('siteSchema', () => {
  const base = {
    version: 1,
    name: 'jobs-example',
    baseUrl: 'https://jobs.example.com',
  };

  it('accepts a minimal site and fills defaults', () => {
    const result = siteSchema.parse(base);
    expect(result.browser).toEqual({ headless: false });
    expect(result.pacing).toEqual({ minDelayMs: 400, maxDelayMs: 1200 });
  });

  it('rejects a non-kebab-case name', () => {
    expect(() => siteSchema.parse({ ...base, name: 'Jobs Example' })).toThrow();
  });

  it('accepts every logged-in indicator type', () => {
    for (const indicator of [
      { type: 'role' as const, role: 'button', name: 'Account menu' },
      { type: 'text' as const, text: 'Welcome back' },
      { type: 'urlNotMatching' as const, pattern: '/login' },
    ]) {
      const result = siteSchema.parse({
        ...base,
        session: { loggedInCheck: { url: 'https://jobs.example.com/feed', indicator } },
      });
      expect(result.session.loggedInCheck?.indicator).toEqual(indicator);
    }
  });

  it('rejects pacing where minDelayMs exceeds maxDelayMs', () => {
    expect(() =>
      siteSchema.parse({ ...base, pacing: { minDelayMs: 2000, maxDelayMs: 1000 } }),
    ).toThrow();
  });
});

describe('manifestSchema', () => {
  const base = {
    version: 1,
    name: 'job-search',
    description: 'Search jobs.',
    site: 'jobs-example',
    output: { format: 'csv' as const },
  };

  it('accepts a manifest with every param type', () => {
    const result = manifestSchema.parse({
      ...base,
      params: [
        { name: 'keywords', type: 'string', required: true, description: 'Search keywords' },
        {
          name: 'count',
          type: 'number',
          default: 25,
          min: 1,
          max: 500,
          description: 'Result count',
        },
        { name: 'includeRemote', type: 'boolean', default: true, description: 'Include remote' },
        {
          name: 'sort',
          type: 'enum',
          options: ['recent', 'relevant'],
          default: 'recent',
          description: 'Sort order',
        },
      ],
    });
    expect(result.params).toHaveLength(4);
  });

  it('rejects a param that is both required and has a default', () => {
    expect(() =>
      manifestSchema.parse({
        ...base,
        params: [{ name: 'count', type: 'number', required: true, default: 1, description: 'x' }],
      }),
    ).toThrow();
  });

  it('rejects an enum default not in options', () => {
    expect(() =>
      manifestSchema.parse({
        ...base,
        params: [
          {
            name: 'sort',
            type: 'enum',
            options: ['a', 'b'],
            default: 'c',
            description: 'x',
          },
        ],
      }),
    ).toThrow();
  });

  it('rejects number min greater than max', () => {
    expect(() =>
      manifestSchema.parse({
        ...base,
        params: [{ name: 'count', type: 'number', min: 10, max: 5, description: 'x' }],
      }),
    ).toThrow();
  });
});

describe('runSummarySchema', () => {
  it('accepts a valid run summary', () => {
    const result = runSummarySchema.parse({
      automation: 'job-search',
      site: 'jobs-example',
      status: 'succeeded',
      startedAt: '2026-09-23T14:05:11.000Z',
      finishedAt: '2026-09-23T14:05:48.000Z',
      durationMs: 37000,
      params: { keywords: '.NET developer', count: 25 },
      rowCount: 25,
      outputFile: 'results.csv',
      failedStep: null,
      error: null,
    });
    expect(result.status).toBe('succeeded');
  });

  it('rejects an invalid status', () => {
    expect(() =>
      runSummarySchema.parse({
        automation: 'job-search',
        site: 'jobs-example',
        status: 'running',
        startedAt: '2026-09-23T14:05:11.000Z',
        finishedAt: '2026-09-23T14:05:48.000Z',
        durationMs: 0,
        params: {},
        rowCount: 0,
        outputFile: null,
        failedStep: null,
        error: null,
      }),
    ).toThrow();
  });
});
