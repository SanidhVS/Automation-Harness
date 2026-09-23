import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { spawn } from 'node:child_process';
import { Command } from 'commander';
import { render, runCommand, type GlobalOptions } from '../render.js';
import { loadWorkspace } from '../workspace-context.js';
import { ValidationError } from '../../domain/errors.js';
import { resolveProfileDir, ensureProfileDir } from '../../infrastructure/paths/app-paths.js';
import { PlaywrightBrowserLauncher } from '../../infrastructure/browser/playwright-launcher.js';
import { ConsoleLogger } from '../../infrastructure/logging/console-logger.js';
import { PRODUCT_NAME } from '../../shared/product.js';

interface RecordOptions {
  readonly name: string;
  readonly url?: string;
}

function runCodegen(args: readonly string[]): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn('npx', ['playwright', 'codegen', ...args], { stdio: 'inherit' });
    let stderr = '';
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0 || code === null) resolvePromise();
      else reject(new Error(`playwright codegen exited with code ${String(code)}: ${stderr}`));
    });
  });
}

/** Playwright's recorder normally works via `--user-data-dir` (verified against `playwright
 * codegen --help` while building this command). If a future Playwright version drops that
 * flag, this falls back to a headed `page.pause()` session and tells the user to copy the
 * generated code themselves (Section 13). */
async function recordWithFallback(
  profileDir: string,
  outputFile: string,
  url: string,
  preferChrome: boolean,
  logger: ConsoleLogger,
): Promise<'codegen' | 'pause-fallback'> {
  const args = ['--user-data-dir', profileDir, '-o', outputFile];
  if (preferChrome) args.push('--channel', 'chrome');
  args.push(url);
  try {
    await runCodegen(args);
    return 'codegen';
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.toLowerCase().includes('unknown option')) throw error;
    logger.warn(
      'playwright codegen does not support --user-data-dir; falling back to page.pause().',
    );
    const launcher = new PlaywrightBrowserLauncher(logger, 'record');
    const { context } = await launcher.launchPersistent({
      profileDir,
      headless: false,
      preferChrome,
    });
    const page = context.pages()[0] ?? (await context.newPage());
    await page.goto(url);
    await page.pause();
    await context.close();
    return 'pause-fallback';
  }
}

export function registerRecordCommand(program: Command): void {
  program
    .command('record <site>')
    .description('opens the Playwright recorder against the site’s profile')
    .requiredOption('--name <automation>', 'the automation name to save the recording under')
    .option('--url <url>', 'the URL to open (defaults to the site’s base URL)')
    .action((siteName: string, cmdOptions: RecordOptions) => {
      runCommand(async () => {
        const options = program.optsWithGlobals<GlobalOptions>();
        const { root, store, config } = await loadWorkspace(options.cwd);
        const result = await store.readSite(root, siteName);
        if (result === null) throw new ValidationError(`Site "${siteName}" was not found.`);
        if (!result.ok) {
          throw new ValidationError(`sites/${siteName}.json is invalid.`, {
            hint: result.issues.join('; '),
          });
        }
        const site = result.value;

        const profileDir = resolveProfileDir(siteName, config.profilesDir);
        await ensureProfileDir(profileDir);

        const recordingPath = join(root, `.${PRODUCT_NAME}`, 'recordings', `${cmdOptions.name}.ts`);
        await mkdir(dirname(recordingPath), { recursive: true });

        const logger = new ConsoleLogger({ verbose: options.verbose });
        const mode = await recordWithFallback(
          profileDir,
          recordingPath,
          cmdOptions.url ?? site.baseUrl,
          site.browser.channel === 'chrome',
          logger,
        );

        render(
          options,
          () => {
            if (mode === 'codegen') {
              console.log(`Recording saved to ${recordingPath}`);
            } else {
              console.log(`Copy the generated code from the Inspector into ${recordingPath}`);
            }
          },
          () => ({ recordingPath, mode }),
        );
      });
    });
}
