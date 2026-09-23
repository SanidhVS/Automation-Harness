import { readFile } from 'node:fs/promises';
import type { BrowserLauncher } from './ports/browser-launcher.js';
import type { WorkspaceStore } from './ports/workspace-store.js';
import type { FlowLoader } from './ports/flow-loader.js';
import type { OutputStore } from './ports/output-store.js';
import type { Clock } from './ports/clock.js';
import type { Prompter } from './ports/prompter.js';
import { loginSite } from './login-site.js';
import { resolveParams, type ParamValue } from '../domain/params/resolve-params.js';
import { ConfigError, ValidationError, WorkspaceNotFoundError } from '../domain/errors.js';
import { EXIT_CODES, type ExitCode } from '../domain/exit-codes.js';
import type { RunSummary } from '../domain/schemas/run-summary.js';
import { runFlow, type FlowRunLogger } from '../sdk/runner.js';
import { pruneAriaSnapshot } from '../domain/snapshot/aria-snapshot-pruner.js';
import { PRODUCT_NAME } from '../shared/product.js';

export interface RunAutomationDeps {
  readonly workspaceStore: WorkspaceStore;
  readonly browserLauncher: BrowserLauncher;
  readonly flowLoader: FlowLoader;
  readonly outputStore: OutputStore;
  readonly clock: Clock;
  readonly logger: FlowRunLogger;
  readonly prompter: Prompter;
}

export interface RunAutomationOptions {
  readonly startDir: string;
  readonly automation: string;
  readonly profileDir: string;
  readonly paramOverrides: Readonly<Record<string, ParamValue>>;
  /** Headed + stdin is a TTY: re-login prompts and flow checkpoints are available. */
  readonly interactive: boolean;
  readonly headlessOverride?: boolean;
}

export interface RunAutomationResult {
  readonly status: 'succeeded' | 'failed' | 'login-required';
  readonly exitCode: ExitCode;
  readonly runFolder: string | null;
  readonly outputFile: string | null;
  readonly rowCount: number;
  readonly errorMessage: string | null;
  readonly durationMs: number;
}

function formatErrorText(error: unknown): string {
  if (error instanceof Error) {
    const lines = (error.stack ?? `${error.name}: ${error.message}`).split('\n');
    const flowLines = lines.filter((line) => !line.includes('node_modules')).slice(0, 10);
    return flowLines.join('\n');
  }
  return String(error);
}

async function formatStepText(
  stepLabel: string | null,
  stepIndex: number | null,
  callSite: { readonly file: string; readonly line: number } | null,
): Promise<string> {
  if (stepLabel === null) {
    return 'No step was active when the flow failed.';
  }
  const header = `Step ${String((stepIndex ?? 0) + 1)}: ${stepLabel}`;
  if (callSite === null) {
    return `${header}\n(source location unavailable)`;
  }
  try {
    const source = await readFile(callSite.file, 'utf8');
    const lines = source.split('\n');
    const start = Math.max(0, callSite.line - 4);
    const end = Math.min(lines.length, callSite.line + 15);
    const window = lines
      .slice(start, end)
      .map((line, i) => `${String(start + i + 1)}: ${line}`)
      .join('\n');
    return `${header}\n${callSite.file}:${String(callSite.line)}\n\n${window}`;
  } catch {
    return `${header}\n${callSite.file}:${String(callSite.line)}`;
  }
}

/** Runs one automation end to end (Section 9.4): resolves the workspace/site/manifest,
 * resolves params, launches the site's profile, checks the session, loads and executes the
 * flow, writes results/run.json (and a failure bundle on failure), and applies retention. */
export async function runAutomation(
  deps: RunAutomationDeps,
  options: RunAutomationOptions,
): Promise<RunAutomationResult> {
  const root = await deps.workspaceStore.findRoot(options.startDir);
  if (root === null) {
    throw new WorkspaceNotFoundError(
      `No ${PRODUCT_NAME}.config.json found in this directory or above.`,
      { hint: `Run "${PRODUCT_NAME} init" to create a workspace.` },
    );
  }

  const configResult = await deps.workspaceStore.readConfig(root);
  if (!configResult.ok) {
    throw new ConfigError(`${PRODUCT_NAME}.config.json is invalid.`, configResult.issues);
  }
  const config = configResult.value;

  const manifestResult = await deps.workspaceStore.readManifest(root, options.automation);
  if (manifestResult === null) {
    throw new ValidationError(`Automation "${options.automation}" was not found.`);
  }
  if (!manifestResult.ok) {
    throw new ConfigError(
      `automations/${options.automation}/manifest.json is invalid.`,
      manifestResult.issues,
    );
  }
  const manifest = manifestResult.value;

  const siteResult = await deps.workspaceStore.readSite(root, manifest.site);
  if (siteResult === null) {
    throw new ValidationError(`Site "${manifest.site}" was not found.`);
  }
  if (!siteResult.ok) {
    throw new ConfigError(`sites/${manifest.site}.json is invalid.`, siteResult.issues);
  }
  const site = siteResult.value;

  const resolution = resolveParams(manifest.params, options.paramOverrides);
  if (resolution.missing.length > 0 || resolution.issues.length > 0) {
    const problems = [
      ...resolution.missing.map((name) => `${name}: required and not provided`),
      ...resolution.issues.map((issue) => `${issue.param}: ${issue.message}`),
    ];
    throw new ValidationError(`Invalid parameters for "${options.automation}".`, {
      hint: problems.join('; '),
    });
  }

  const headless = options.headlessOverride ?? manifest.browser.headless ?? site.browser.headless;

  const runFolder = await deps.outputStore.createRunFolder(
    root,
    config.outputDir,
    options.automation,
  );
  const startedAt = deps.clock.now();

  const lock = await deps.browserLauncher.acquireLock(options.profileDir, site.name);
  try {
    let launch = await deps.browserLauncher.launchPersistent({
      profileDir: options.profileDir,
      headless,
      preferChrome: site.browser.channel === 'chrome',
    });

    if (config.trace === 'on-failure') {
      await launch.context.tracing.start({ snapshots: true, screenshots: true, sources: false });
    }

    let page = launch.context.pages()[0] ?? (await launch.context.newPage());

    const loggedInCheck = site.session.loggedInCheck;
    if (loggedInCheck !== undefined) {
      const loggedIn = await deps.browserLauncher.checkSession(
        page,
        loggedInCheck.url,
        loggedInCheck.indicator,
      );
      if (!loggedIn) {
        if (!options.interactive) {
          const finishedAt = deps.clock.now();
          const summary = buildSummary(
            options.automation,
            site.name,
            resolution.values,
            startedAt,
            finishedAt,
            'login-required',
            {
              rowCount: 0,
              outputFile: null,
              failedStep: null,
              error: null,
            },
          );
          await deps.outputStore.writeRunSummary(runFolder.path, summary);
          await launch.context.close();
          return {
            status: 'login-required',
            exitCode: EXIT_CODES.loginRequired,
            runFolder: runFolder.path,
            outputFile: null,
            rowCount: 0,
            errorMessage: null,
            durationMs: finishedAt.getTime() - startedAt.getTime(),
          };
        }
        await launch.context.close();
        const relogin = await loginSite(
          { browserLauncher: deps.browserLauncher, prompter: deps.prompter },
          options.profileDir,
          site,
          'expired',
        );
        if (!relogin.loggedIn) {
          await relogin.context.close();
          const finishedAt = deps.clock.now();
          const summary = buildSummary(
            options.automation,
            site.name,
            resolution.values,
            startedAt,
            finishedAt,
            'login-required',
            {
              rowCount: 0,
              outputFile: null,
              failedStep: null,
              error: null,
            },
          );
          await deps.outputStore.writeRunSummary(runFolder.path, summary);
          return {
            status: 'login-required',
            exitCode: EXIT_CODES.loginRequired,
            runFolder: runFolder.path,
            outputFile: null,
            rowCount: 0,
            errorMessage: null,
            durationMs: finishedAt.getTime() - startedAt.getTime(),
          };
        }
        launch = { context: relogin.context, channelUsed: launch.channelUsed };
        page = relogin.page;
        if (config.trace === 'on-failure') {
          await launch.context.tracing.start({
            snapshots: true,
            screenshots: true,
            sources: false,
          });
        }
      }
    }

    const flowPath = flowPathFor(root, options.automation);
    const flow = await deps.flowLoader.load(flowPath);

    const canCheckpoint = options.interactive && !headless;
    const result = await runFlow(flow, {
      page,
      context: launch.context,
      params: resolution.values,
      runDir: runFolder.path,
      pacing: site.pacing,
      log: deps.logger,
      ...(canCheckpoint
        ? { waitForEnter: (message: string) => deps.prompter.waitForEnter(message) }
        : {}),
    });

    for (const [name, data] of result.savedFiles) {
      await deps.outputStore.writeExtraFile(runFolder.path, name, data);
    }

    if (result.ok) {
      const outputFile = await deps.outputStore.writeResults(
        runFolder.path,
        manifest.output.format === 'csv'
          ? { format: 'csv', rows: result.rows }
          : manifest.output.format === 'json'
            ? { format: 'json', value: result.jsonValue }
            : { format: 'none' },
      );
      if (config.trace === 'on-failure') {
        await launch.context.tracing.stop();
      }
      const finishedAt = deps.clock.now();
      const summary = buildSummary(
        options.automation,
        site.name,
        resolution.values,
        startedAt,
        finishedAt,
        'succeeded',
        {
          rowCount: result.rowCount,
          outputFile,
          failedStep: null,
          error: null,
        },
      );
      await deps.outputStore.writeRunSummary(runFolder.path, summary);
      await launch.context.close();
      await deps.outputStore.applyRetention(
        root,
        config.outputDir,
        options.automation,
        config.keepRuns,
      );
      return {
        status: 'succeeded',
        exitCode: EXIT_CODES.success,
        runFolder: runFolder.path,
        outputFile,
        rowCount: result.rowCount,
        errorMessage: null,
        durationMs: finishedAt.getTime() - startedAt.getTime(),
      };
    }

    const errorText = formatErrorText(result.error);
    const stepText = await formatStepText(result.stepLabel, result.stepIndex, result.callSite);
    let snapshotText: string | null = null;
    try {
      const raw = await page.locator('body').ariaSnapshot();
      snapshotText = `${page.url()}\n${await page.title()}\n\n${pruneAriaSnapshot(raw)}`;
    } catch {
      snapshotText = null;
    }
    let screenshotPng: Uint8Array | null = null;
    try {
      screenshotPng = await page.screenshot({ fullPage: true });
    } catch {
      screenshotPng = null;
    }

    if (config.trace === 'on-failure') {
      await launch.context.tracing.stop({
        path: `${runFolder.path}/failure/trace.zip`,
      });
    }
    await deps.outputStore.writeFailureBundle(runFolder.path, {
      errorText,
      stepText,
      snapshotText,
      screenshotPng,
    });

    const errorMessage =
      result.error instanceof Error ? result.error.message : String(result.error);
    const finishedAt = deps.clock.now();
    const summary = buildSummary(
      options.automation,
      site.name,
      resolution.values,
      startedAt,
      finishedAt,
      'failed',
      {
        rowCount: 0,
        outputFile: null,
        failedStep: result.stepLabel,
        error: errorMessage,
      },
    );
    await deps.outputStore.writeRunSummary(runFolder.path, summary);
    await launch.context.close();
    await deps.outputStore.applyRetention(
      root,
      config.outputDir,
      options.automation,
      config.keepRuns,
    );

    return {
      status: 'failed',
      exitCode: EXIT_CODES.flowFailed,
      runFolder: runFolder.path,
      outputFile: null,
      rowCount: 0,
      errorMessage,
      durationMs: finishedAt.getTime() - startedAt.getTime(),
    };
  } finally {
    await lock.release();
  }
}

function flowPathFor(root: string, automation: string): string {
  return `${root}/automations/${automation}/flow.ts`;
}

function buildSummary(
  automation: string,
  site: string,
  params: Readonly<Record<string, ParamValue>>,
  startedAt: Date,
  finishedAt: Date,
  status: RunSummary['status'],
  extra: Pick<RunSummary, 'rowCount' | 'outputFile' | 'failedStep' | 'error'>,
): RunSummary {
  return {
    automation,
    site,
    status,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    params,
    ...extra,
  };
}
