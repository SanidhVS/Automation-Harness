import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FileWorkspaceStore } from '../../../src/infrastructure/workspace/file-workspace-store.js';
import type { Site } from '../../../src/domain/schemas/site.js';
import type { Manifest } from '../../../src/domain/schemas/manifest.js';

describe('FileWorkspaceStore', () => {
  let root: string;
  const store = new FileWorkspaceStore();

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'rerun-workspace-'));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  describe('findRoot', () => {
    it('finds the workspace root from a nested cwd', async () => {
      await writeFile(join(root, 'rerun.config.json'), '{"version":1}');
      const nested = join(root, 'automations', 'job-search');
      await mkdir(nested, { recursive: true });
      await expect(store.findRoot(nested)).resolves.toBe(root);
    });

    it('returns null when no config is found', async () => {
      await expect(store.findRoot(root)).resolves.toBeNull();
    });
  });

  describe('config', () => {
    it('reads a valid config with defaults filled in', async () => {
      await writeFile(join(root, 'rerun.config.json'), '{"version":1}');
      const result = await store.readConfig(root);
      expect(result).toEqual({
        ok: true,
        value: {
          version: 1,
          outputDir: 'output',
          keepRuns: 20,
          trace: 'on-failure',
          profilesDir: null,
        },
      });
    });

    it('reports every validation issue, not just the first', async () => {
      await writeFile(
        join(root, 'rerun.config.json'),
        '{"version":1,"trace":"nope","keepRuns":-1}',
      );
      const result = await store.readConfig(root);
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error('expected failure');
      expect(result.issues.length).toBeGreaterThanOrEqual(2);
    });

    it('reports malformed JSON as a validation issue rather than throwing', async () => {
      await writeFile(join(root, 'rerun.config.json'), '{not json');
      const result = await store.readConfig(root);
      expect(result.ok).toBe(false);
    });

    it('reports a missing config file as a validation issue', async () => {
      const result = await store.readConfig(root);
      expect(result).toEqual({ ok: false, issues: ['rerun.config.json: not found'] });
    });
  });

  describe('sites', () => {
    const site: Site = {
      version: 1,
      name: 'jobs-example',
      baseUrl: 'https://jobs.example.com',
      session: {},
      browser: { headless: false },
      pacing: { minDelayMs: 400, maxDelayMs: 1200 },
    };

    it('round-trips a site through write and read', async () => {
      await store.writeSite(root, site);
      const result = await store.readSite(root, 'jobs-example');
      expect(result).toEqual({ ok: true, value: site });
    });

    it('lists site names without the .json extension', async () => {
      await store.writeSite(root, site);
      await expect(store.listSites(root)).resolves.toEqual(['jobs-example']);
    });

    it('returns null for a site that does not exist', async () => {
      await expect(store.readSite(root, 'missing')).resolves.toBeNull();
    });

    it('returns an empty list when the sites directory does not exist', async () => {
      await expect(store.listSites(root)).resolves.toEqual([]);
    });
  });

  describe('manifests', () => {
    const manifest: Manifest = {
      version: 1,
      name: 'job-search',
      description: 'Search jobs.',
      site: 'jobs-example',
      params: [],
      output: { format: 'csv' },
      browser: { headless: null },
    };

    it('round-trips a manifest through write and read', async () => {
      await store.writeManifest(root, manifest);
      const result = await store.readManifest(root, 'job-search');
      expect(result).toEqual({ ok: true, value: manifest });
    });

    it('lists automation names as directories', async () => {
      await store.writeManifest(root, manifest);
      await expect(store.listAutomations(root)).resolves.toEqual(['job-search']);
    });

    it('returns null for a manifest that does not exist', async () => {
      await expect(store.readManifest(root, 'missing')).resolves.toBeNull();
    });
  });
});
