import { Command } from 'commander';
import { render, runCommand, type GlobalOptions } from '../render.js';
import { loadWorkspace } from '../workspace-context.js';
import { inspectPage } from '../../application/inspect-page.js';
import { ValidationError } from '../../domain/errors.js';
import { resolveProfileDir, ensureProfileDir } from '../../infrastructure/paths/app-paths.js';
import { PlaywrightBrowserLauncher } from '../../infrastructure/browser/playwright-launcher.js';
import { ConsoleLogger } from '../../infrastructure/logging/console-logger.js';
import { ReadlinePrompter } from '../../infrastructure/prompts/readline-prompter.js';

interface InspectOptions {
  readonly url?: string;
  readonly scope?: string;
  readonly interactiveOnly?: boolean;
  readonly maxLines?: string;
  readonly wait?: boolean;
}

const DEFAULT_MAX_LINES = 150;

/** Registers `rerun inspect`. */
export function registerInspectCommand(program: Command): void {
  program
    .command('inspect <site>')
    .description('prints a pruned ARIA snapshot of a page')
    .option('--url <url>', 'the URL to inspect (defaults to the site’s base URL)')
    .option('--scope <selector>', 'role=<role>[:<name>] or a CSS selector')
    .option('--interactive-only', 'keep only interactive elements and their ancestors')
    .option('--max-lines <n>', 'truncate the snapshot after this many lines')
    .option('--wait', 'open headed and wait for Enter before capturing')
    .action((siteName: string, cmdOptions: InspectOptions) => {
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
        const browserLauncher = new PlaywrightBrowserLauncher(
          new ConsoleLogger({ verbose: options.verbose }),
          siteName,
        );

        const inspected = await inspectPage(
          { browserLauncher, prompter: new ReadlinePrompter() },
          {
            profileDir,
            preferChrome: site.browser.channel === 'chrome',
            url: cmdOptions.url ?? site.baseUrl,
            ...(cmdOptions.scope !== undefined ? { scope: cmdOptions.scope } : {}),
            interactiveOnly: cmdOptions.interactiveOnly ?? false,
            maxLines:
              cmdOptions.maxLines !== undefined ? Number(cmdOptions.maxLines) : DEFAULT_MAX_LINES,
            wait: cmdOptions.wait ?? false,
          },
        );

        render(
          options,
          () => {
            console.log(inspected.snapshot);
          },
          () => inspected,
        );
      });
    });
}
