import { readFile } from 'node:fs/promises';
import { confirm, input, number, select } from '@inquirer/prompts';
import { Command } from 'commander';
import { render, runCommand, type GlobalOptions } from '../render.js';
import { loadWorkspace } from '../workspace-context.js';
import { runAutomation } from '../../application/run-automation.js';
import type { ParamValue } from '../../domain/params/resolve-params.js';
import type { ManifestParam } from '../../domain/schemas/manifest.js';
import { ConfigError, ValidationError } from '../../domain/errors.js';
import { PRODUCT_NAME } from '../../shared/product.js';
import { resolveProfileDir, ensureProfileDir } from '../../infrastructure/paths/app-paths.js';
import { PlaywrightBrowserLauncher } from '../../infrastructure/browser/playwright-launcher.js';
import { TsxFlowLoader } from '../../infrastructure/flow-loader/tsx-flow-loader.js';
import { FileOutputStore } from '../../infrastructure/output/file-output-store.js';
import { SystemClock } from '../../infrastructure/system-clock.js';
import { ConsoleLogger } from '../../infrastructure/logging/console-logger.js';
import { ReadlinePrompter } from '../../infrastructure/prompts/readline-prompter.js';

interface RunOptions {
  readonly param?: readonly string[];
  readonly paramsFile?: string;
  readonly headed?: boolean;
  readonly headless?: boolean;
}

function parseParamFlag(raw: string): readonly [string, string] {
  const eq = raw.indexOf('=');
  if (eq === -1) {
    throw new ValidationError(`--param must be key=value, got "${raw}".`);
  }
  return [raw.slice(0, eq), raw.slice(eq + 1)];
}

async function promptForMissingParams(
  params: readonly ManifestParam[],
  overrides: Record<string, ParamValue>,
): Promise<void> {
  for (const param of params) {
    if (overrides[param.name] !== undefined || param.default !== undefined || !param.required) {
      continue;
    }
    if (param.type === 'enum') {
      overrides[param.name] = await select({
        message: param.description,
        choices: param.options.map((o) => ({ value: o })),
      });
    } else if (param.type === 'boolean') {
      overrides[param.name] = await confirm({ message: param.description });
    } else if (param.type === 'number') {
      const value = await number({
        message: param.description,
        ...(param.min !== undefined ? { min: param.min } : {}),
        ...(param.max !== undefined ? { max: param.max } : {}),
      });
      overrides[param.name] = value ?? 0;
    } else {
      overrides[param.name] = await input({ message: param.description });
    }
  }
}

export function registerRunCommand(program: Command): void {
  program
    .command('run <automation>')
    .description('runs an automation')
    .option(
      '--param <k=v>',
      'a parameter override, repeatable',
      (v, acc: string[]) => [...acc, v],
      [],
    )
    .option('--params-file <file>', 'a JSON file of parameter overrides')
    .option('--headed', 'force a headed run')
    .option('--headless', 'force a headless run')
    .action((automation: string, cmdOptions: RunOptions) => {
      runCommand(async () => {
        const options = program.optsWithGlobals<GlobalOptions>();
        const { root, store, config } = await loadWorkspace(options.cwd);

        const manifestResult = await store.readManifest(root, automation);
        if (manifestResult === null) {
          throw new ValidationError(`Automation "${automation}" was not found.`);
        }
        if (!manifestResult.ok) {
          throw new ConfigError(
            `automations/${automation}/manifest.json is invalid.`,
            manifestResult.issues,
          );
        }
        const manifest = manifestResult.value;

        const overrides: Record<string, ParamValue> = {};
        if (cmdOptions.paramsFile !== undefined) {
          const fileValues = JSON.parse(await readFile(cmdOptions.paramsFile, 'utf8')) as Record<
            string,
            ParamValue
          >;
          Object.assign(overrides, fileValues);
        }
        for (const raw of cmdOptions.param ?? []) {
          const [key, value] = parseParamFlag(raw);
          overrides[key] = value;
        }

        const interactive = options.input && process.stdin.isTTY;
        if (interactive) {
          await promptForMissingParams(manifest.params, overrides);
        }

        const profileDir = resolveProfileDir(manifest.site, config.profilesDir);
        await ensureProfileDir(profileDir);
        const logger = new ConsoleLogger({ verbose: options.verbose });

        const result = await runAutomation(
          {
            workspaceStore: store,
            browserLauncher: new PlaywrightBrowserLauncher(logger, manifest.site),
            flowLoader: new TsxFlowLoader(),
            outputStore: new FileOutputStore(new SystemClock()),
            clock: new SystemClock(),
            logger,
            prompter: new ReadlinePrompter(),
          },
          {
            startDir: options.cwd,
            automation,
            profileDir,
            paramOverrides: overrides,
            interactive,
            ...(cmdOptions.headed === true
              ? { headlessOverride: false }
              : cmdOptions.headless === true
                ? { headlessOverride: true }
                : {}),
          },
        );

        render(
          options,
          () => {
            const seconds = (result.durationMs / 1000).toFixed(0);
            const supportsUnicode = process.platform !== 'win32' && process.stdout.isTTY;
            if (result.status === 'succeeded') {
              const marker = supportsUnicode ? '✔' : 'OK';
              console.log(
                `${marker} ${automation}: ${String(result.rowCount)} rows -> ${result.outputFile ?? '(no output)'} (${seconds}s)`,
              );
            } else if (result.status === 'failed') {
              const marker = supportsUnicode ? '✖' : 'FAIL';
              console.log(
                `${marker} ${automation} failed: ${result.errorMessage ?? 'unknown error'}. Run "${PRODUCT_NAME} fix ${automation}" for details.`,
              );
            } else {
              console.log(`Run "${PRODUCT_NAME} site login ${manifest.site}" and try again.`);
            }
          },
          () => result,
        );

        process.exitCode = result.exitCode;
      });
    });
}
