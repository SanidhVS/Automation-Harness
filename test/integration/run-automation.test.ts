import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { startFixtureSite, type FixtureSite } from '../fixture-site/server.js';
import { runAutomation } from '../../src/application/run-automation.js';
import { FileWorkspaceStore } from '../../src/infrastructure/workspace/file-workspace-store.js';
import { PlaywrightBrowserLauncher } from '../../src/infrastructure/browser/playwright-launcher.js';
import { TsxFlowLoader } from '../../src/infrastructure/flow-loader/tsx-flow-loader.js';
import { FileOutputStore } from '../../src/infrastructure/output/file-output-store.js';
import { SystemClock } from '../../src/infrastructure/system-clock.js';
import { ConsoleLogger } from '../../src/infrastructure/logging/console-logger.js';
import type { Prompter } from '../../src/application/ports/prompter.js';
import type { Site } from '../../src/domain/schemas/site.js';
import type { Manifest } from '../../src/domain/schemas/manifest.js';

const sdkIndexUrl = pathToFileURL(join(process.cwd(), 'src', 'index.ts')).href;

const neverCalledPrompter: Prompter = {
  waitForEnter: () => {
    throw new Error('prompter should not be called in this test');
  },
};

async function writeWorkspace(
  root: string,
  fixtureUrl: string,
  automation: string,
  manifest: Omit<Manifest, 'name' | 'site' | 'version'>,
  flowBody: string,
): Promise<void> {
  await writeFile(
    join(root, 'rerun.config.json'),
    JSON.stringify({ version: 1, trace: 'on-failure', keepRuns: 20, outputDir: 'output' }),
  );
  // Real workspaces get a package.json with "type": "module" (Section 7.2) — tsImport
  // needs one nearby to resolve flow.ts's own imports as ESM rather than CJS-wrapped.
  await writeFile(join(root, 'package.json'), JSON.stringify({ type: 'module' }));

  const site: Site = {
    version: 1,
    name: 'fixture',
    baseUrl: fixtureUrl,
    session: {},
    browser: { headless: true },
    pacing: { minDelayMs: 0, maxDelayMs: 0 },
  };
  await mkdir(join(root, 'sites'), { recursive: true });
  await writeFile(join(root, 'sites', 'fixture.json'), JSON.stringify(site));

  const fullManifest: Manifest = { version: 1, name: automation, site: 'fixture', ...manifest };
  const automationDir = join(root, 'automations', automation);
  await mkdir(automationDir, { recursive: true });
  await writeFile(join(automationDir, 'manifest.json'), JSON.stringify(fullManifest));
  await writeFile(
    join(automationDir, 'flow.ts'),
    `import { defineFlow } from '${sdkIndexUrl}';\n\nexport default defineFlow(async (ctx) => {\n${flowBody}\n});\n`,
  );
}

describe('runAutomation integration (fixture site, real Chromium)', () => {
  let fixture: FixtureSite;
  let workspaceRoot: string;
  let profileDir: string;

  beforeAll(async () => {
    fixture = await startFixtureSite();
  });

  afterAll(async () => {
    await fixture.close();
  });

  beforeEach(async () => {
    workspaceRoot = await mkdtemp(join(tmpdir(), 'rerun-workspace-'));
    profileDir = await mkdtemp(join(tmpdir(), 'rerun-profile-'));
  });

  afterEach(async () => {
    await rm(workspaceRoot, { recursive: true, force: true });
    await rm(profileDir, { recursive: true, force: true });
  });

  function deps() {
    return {
      workspaceStore: new FileWorkspaceStore(),
      browserLauncher: new PlaywrightBrowserLauncher(
        new ConsoleLogger({ verbose: false }),
        'fixture',
      ),
      flowLoader: new TsxFlowLoader(),
      outputStore: new FileOutputStore(new SystemClock()),
      clock: new SystemClock(),
      logger: new ConsoleLogger({ verbose: false }),
      prompter: neverCalledPrompter,
    };
  }

  it('collects exactly N rows across pages', async () => {
    await writeWorkspace(
      workspaceRoot,
      fixture.url,
      'paginate-test',
      { description: 'x', params: [], output: { format: 'csv' }, browser: { headless: null } },
      `
  await ctx.step('Log in (test stub)', async () => {
    await ctx.context.addCookies([{ name: 'rerun_session', value: '1', url: '${fixture.url}' }]);
  });
  await ctx.step('Collect via pagination', async () => {
    await ctx.page.goto('${fixture.url}/search?total=25');
    const rows = await ctx.helpers.collectUntil({
      count: 25,
      extract: async () => (await ctx.page.locator('#results li').allTextContents()).map((text) => ({ text })),
      next: async () => ctx.helpers.clickIfVisible(ctx.page.getByRole('button', { name: 'Next' })),
    });
    ctx.output.addRows(rows);
  });
  await ctx.step('Verify', async () => {
    ctx.helpers.assert(ctx.output.rowCount === 25, 'expected 25 rows, got ' + ctx.output.rowCount);
  });
`,
    );

    const result = await runAutomation(deps(), {
      startDir: workspaceRoot,
      automation: 'paginate-test',
      profileDir,
      paramOverrides: {},
      interactive: false,
    });

    expect(result.status).toBe('succeeded');
    expect(result.exitCode).toBe(0);
    expect(result.rowCount).toBe(25);
    expect(result.outputFile).toBe('results.csv');

    const csv = await readFile(join(result.runFolder ?? '', 'results.csv'), 'utf8');
    expect(csv.trim().split('\n')).toHaveLength(26); // header + 25 rows

    const runJson = JSON.parse(
      await readFile(join(result.runFolder ?? '', 'run.json'), 'utf8'),
    ) as { status: string; rowCount: number };
    expect(runJson.status).toBe('succeeded');
    expect(runJson.rowCount).toBe(25);
  });

  it('collects exactly N rows via infinite scroll, deduping across rounds', async () => {
    await writeWorkspace(
      workspaceRoot,
      fixture.url,
      'infinite-test',
      { description: 'x', params: [], output: { format: 'csv' }, browser: { headless: null } },
      `
  await ctx.step('Log in (test stub)', async () => {
    await ctx.context.addCookies([{ name: 'rerun_session', value: '1', url: '${fixture.url}' }]);
  });
  await ctx.step('Collect via infinite scroll', async () => {
    await ctx.page.goto('${fixture.url}/infinite?total=25');
    const rows = await ctx.helpers.collectUntil({
      count: 25,
      extract: async () => ctx.page.locator('#results li a').evaluateAll((links) => links.map((a) => ({ title: a.textContent, link: a.getAttribute('href') }))),
      next: async () => ctx.helpers.scrollToLoadMore(ctx.page),
      dedupeBy: (row) => row.link,
    });
    ctx.output.addRows(rows);
  });
  await ctx.step('Verify', async () => {
    ctx.helpers.assert(ctx.output.rowCount === 25, 'expected 25 rows, got ' + ctx.output.rowCount);
  });
`,
    );

    const result = await runAutomation(deps(), {
      startDir: workspaceRoot,
      automation: 'infinite-test',
      profileDir,
      paramOverrides: {},
      interactive: false,
    });

    expect(result.status).toBe('succeeded');
    expect(result.rowCount).toBe(25);
  });

  it('produces a complete failure bundle for a broken flow', async () => {
    await writeWorkspace(
      workspaceRoot,
      fixture.url,
      'broken-test',
      { description: 'x', params: [], output: { format: 'csv' }, browser: { headless: null } },
      `
  await ctx.step('Log in (test stub)', async () => {
    await ctx.context.addCookies([{ name: 'rerun_session', value: '1', url: '${fixture.url}' }]);
  });
  await ctx.step('Doomed step', async () => {
    await ctx.page.goto('${fixture.url}/feed');
    ctx.helpers.assert(false, 'this step always fails');
  });
`,
    );

    const result = await runAutomation(deps(), {
      startDir: workspaceRoot,
      automation: 'broken-test',
      profileDir,
      paramOverrides: {},
      interactive: false,
    });

    expect(result.status).toBe('failed');
    expect(result.exitCode).toBe(1);
    expect(result.errorMessage).toContain('this step always fails');

    const failureDir = join(result.runFolder ?? '', 'failure');
    const errorText = await readFile(join(failureDir, 'error.txt'), 'utf8');
    expect(errorText).toContain('this step always fails');

    // The source-line window in step.txt depends on stack-trace source-mapping through
    // tsx's tsImport(); running inside vitest's own module loader (as this test does)
    // distorts that mapping in a way plain `node` usage (the real CLI) doesn't — verified
    // separately. So this only checks the reliable part: the step label is present and
    // step.txt was written without crashing (best-effort per Section 9.5).
    const stepText = await readFile(join(failureDir, 'step.txt'), 'utf8');
    expect(stepText).toContain('Doomed step');

    const snapshotText = await readFile(join(failureDir, 'snapshot.txt'), 'utf8');
    expect(snapshotText).toContain(`${fixture.url}/feed`);

    const screenshotStat = await readFile(join(failureDir, 'screenshot.png'));
    expect(screenshotStat.length).toBeGreaterThan(0);

    const traceStat = await readFile(join(failureDir, 'trace.zip'));
    expect(traceStat.length).toBeGreaterThan(0);

    const runJson = JSON.parse(
      await readFile(join(result.runFolder ?? '', 'run.json'), 'utf8'),
    ) as {
      status: string;
      failedStep: string | null;
    };
    expect(runJson.status).toBe('failed');
    expect(runJson.failedStep).toBe('Doomed step');
  });
});
