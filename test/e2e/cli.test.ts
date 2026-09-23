import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { startFixtureSite, type FixtureSite } from '../fixture-site/server.js';

const CLI_PATH = join(process.cwd(), 'dist', 'cli', 'main.js');
const sdkIndexUrl = pathToFileURL(join(process.cwd(), 'src', 'index.ts')).href;

interface CliResult {
  readonly code: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

function cli(args: readonly string[], cwd: string): Promise<CliResult> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn('node', [CLI_PATH, ...args], { cwd });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk: Buffer) => (stdout += chunk.toString()));
    child.stderr.on('data', (chunk: Buffer) => (stderr += chunk.toString()));
    child.on('error', reject);
    child.on('exit', (code) => resolvePromise({ code, stdout, stderr }));
  });
}

describe('rerun CLI end to end (Section 14.4)', () => {
  let fixture: FixtureSite;
  let workspaceRoot: string;

  beforeAll(async () => {
    fixture = await startFixtureSite();
  });

  afterAll(async () => {
    await fixture.close();
  });

  beforeEach(async () => {
    workspaceRoot = await mkdtemp(join(tmpdir(), 'rerun-e2e-'));
  });

  afterEach(async () => {
    await rm(workspaceRoot, { recursive: true, force: true });
  });

  it('runs the full author-run-fail-fix lifecycle through the real CLI', async () => {
    // init
    const init = await cli(['init', '.', '--skip-install'], workspaceRoot);
    expect(init.code).toBe(0);
    expect(
      JSON.parse(await readFile(join(workspaceRoot, 'rerun.config.json'), 'utf8')),
    ).toMatchObject({ version: 1 });

    // site add
    const siteAdd = await cli(
      ['site', 'add', 'fixture', '--base-url', fixture.url, '--headless'],
      workspaceRoot,
    );
    expect(siteAdd.code).toBe(0);

    // new
    const created = await cli(['new', 'job-search', '--site', 'fixture'], workspaceRoot);
    expect(created.code).toBe(0);

    // write a real flow.ts (this session's flow-authoring stand-in for a human/AI session)
    await writeFile(
      join(workspaceRoot, 'automations', 'job-search', 'flow.ts'),
      `import { defineFlow } from '${sdkIndexUrl}';

export default defineFlow(async (ctx) => {
  await ctx.context.addCookies([{ name: 'rerun_session', value: '1', url: '${fixture.url}' }]);
  await ctx.step('Search', async () => {
    await ctx.page.goto('${fixture.url}/search?total=' + ctx.params.count);
    const rows = await ctx.helpers.collectUntil({
      count: ctx.params.count,
      extract: async () => (await ctx.page.locator('#results li').allTextContents()).map((text) => ({ text })),
      next: async () => ctx.helpers.clickIfVisible(ctx.page.getByRole('button', { name: 'Next' })),
    });
    ctx.output.addRows(rows);
  });
  await ctx.step('Verify', async () => {
    ctx.helpers.assert(ctx.output.rowCount === ctx.params.count, 'row count mismatch');
  });
});
`,
    );
    await writeFile(
      join(workspaceRoot, 'automations', 'job-search', 'manifest.json'),
      JSON.stringify({
        version: 1,
        name: 'job-search',
        description: 'e2e test automation',
        site: 'fixture',
        params: [{ name: 'count', type: 'number', default: 5, min: 1, max: 100, description: 'x' }],
        output: { format: 'csv' },
        browser: { headless: null },
      }),
    );

    // run with a small param first (Section 3.2's own advice)
    const run = await cli(['run', 'job-search', '--param', 'count=5', '--headless'], workspaceRoot);
    expect(run.code).toBe(0);
    expect(run.stdout).toContain('job-search');
    const results = await readFile(
      (await readdirLatestRun(workspaceRoot, 'job-search')).resultsCsvPath,
      'utf8',
    );
    expect(results.trim().split('\n')).toHaveLength(6); // header + 5 rows

    // break the flow, assert exit code 1 and a failure bundle
    await writeFile(
      join(workspaceRoot, 'automations', 'job-search', 'flow.ts'),
      `import { defineFlow } from '${sdkIndexUrl}';

export default defineFlow(async (ctx) => {
  await ctx.step('Doomed step', async () => {
    ctx.helpers.assert(false, 'e2e deliberate failure');
  });
});
`,
    );
    const brokenRun = await cli(['run', 'job-search', '--headless'], workspaceRoot);
    expect(brokenRun.code).toBe(1);

    // fix --json
    const fix = await cli(['--json', 'fix', 'job-search'], workspaceRoot);
    expect(fix.code).toBe(0);
    const fixOutput = JSON.parse(fix.stdout) as {
      failedStep: string;
      error: string;
      files: { error: string; step: string; snapshot: string };
    };
    expect(fixOutput.failedStep).toBe('Doomed step');
    expect(fixOutput.error).toContain('e2e deliberate failure');
    expect(await readFile(fixOutput.files.error, 'utf8')).toContain('e2e deliberate failure');

    // list
    const list = await cli(['list'], workspaceRoot);
    expect(list.code).toBe(0);
    expect(list.stdout).toContain('job-search');
    expect(list.stdout).toContain('failed');

    // doctor
    const doctor = await cli(['doctor'], workspaceRoot);
    expect(doctor.stdout).toContain('Node.js version');
    expect(doctor.stdout).toContain('Workspace');
  });
});

async function readdirLatestRun(
  workspaceRoot: string,
  automation: string,
): Promise<{ resultsCsvPath: string }> {
  const { readdir } = await import('node:fs/promises');
  const dir = join(workspaceRoot, 'output', automation);
  const entries = (await readdir(dir, { withFileTypes: true }))
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort()
    .reverse();
  const latest = entries[0];
  if (latest === undefined) throw new Error('no run folder found');
  return { resultsCsvPath: join(dir, latest, 'results.csv') };
}
