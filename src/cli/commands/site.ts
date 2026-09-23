import { rm } from 'node:fs/promises';
import { Command } from 'commander';
import { render, runCommand, type GlobalOptions } from '../render.js';
import { loadWorkspace } from '../workspace-context.js';
import { addSite } from '../../application/add-site.js';
import { setLoginCheck } from '../../application/set-login-check.js';
import { loginSite } from '../../application/login-site.js';
import type { LoggedInIndicator } from '../../domain/schemas/site.js';
import { ValidationError } from '../../domain/errors.js';
import { resolveProfileDir, ensureProfileDir } from '../../infrastructure/paths/app-paths.js';
import { PlaywrightBrowserLauncher } from '../../infrastructure/browser/playwright-launcher.js';
import { ConsoleLogger } from '../../infrastructure/logging/console-logger.js';
import { ReadlinePrompter } from '../../infrastructure/prompts/readline-prompter.js';
import { PRODUCT_NAME } from '../../shared/product.js';

interface AddOptions {
  readonly baseUrl: string;
  readonly loginUrl?: string;
  readonly headless?: boolean;
}

interface SetCheckOptions {
  readonly url: string;
  readonly role?: string;
  readonly name?: string;
  readonly text?: string;
  readonly urlNotMatching?: string;
}

interface RemoveOptions {
  readonly deleteProfile?: boolean;
}

function parseIndicator(options: SetCheckOptions): LoggedInIndicator {
  if (options.role !== undefined) {
    if (options.name === undefined) {
      throw new ValidationError('--role requires --name.');
    }
    return { type: 'role', role: options.role, name: options.name };
  }
  if (options.text !== undefined) {
    return { type: 'text', text: options.text };
  }
  if (options.urlNotMatching !== undefined) {
    return { type: 'urlNotMatching', pattern: options.urlNotMatching };
  }
  throw new ValidationError('One of --role/--name, --text, or --url-not-matching is required.');
}

/** Registers `rerun site` and its subcommands (add, list, login, set-check, remove). */
export function registerSiteCommand(program: Command): void {
  const site = program.command('site').description('manage site definitions');

  site
    .command('add <name>')
    .requiredOption('--base-url <url>', 'the site’s base URL')
    .option('--login-url <url>', 'the login page URL, if different from --base-url')
    .option('--headless', 'launch this site headless by default')
    .action((name: string, cmdOptions: AddOptions) => {
      runCommand(async () => {
        const options = program.optsWithGlobals<GlobalOptions>();
        const { root, store } = await loadWorkspace(options.cwd);
        const created = await addSite(store, root, {
          name,
          baseUrl: cmdOptions.baseUrl,
          ...(cmdOptions.loginUrl !== undefined ? { loginUrl: cmdOptions.loginUrl } : {}),
          headless: cmdOptions.headless ?? false,
        });
        render(
          options,
          () => {
            console.log(`Added site "${created.name}".`);
          },
          () => ({ site: created }),
        );
      });
    });

  site
    .command('list')
    .description('lists site definitions')
    .action(() => {
      runCommand(async () => {
        const options = program.optsWithGlobals<GlobalOptions>();
        const { root, store } = await loadWorkspace(options.cwd);
        const names = await store.listSites(root);
        const summaries = await Promise.all(
          names.map(async (name) => {
            const result = await store.readSite(root, name);
            const hasCheck =
              result?.ok === true && result.value.session.loggedInCheck !== undefined;
            return { name, loginCheckConfigured: hasCheck };
          }),
        );
        render(
          options,
          () => {
            if (summaries.length === 0) {
              console.log('No sites yet. Run "site add" to create one.');
              return;
            }
            for (const s of summaries) {
              console.log(
                `${s.name}${s.loginCheckConfigured ? '' : '  (no login check configured)'}`,
              );
            }
          },
          () => ({ sites: summaries }),
        );
      });
    });

  site
    .command('login <name>')
    .description('opens a headed browser for the human to log in')
    .action((name: string) => {
      runCommand(async () => {
        const options = program.optsWithGlobals<GlobalOptions>();
        const { root, store, config } = await loadWorkspace(options.cwd);
        const result = await store.readSite(root, name);
        if (result === null) throw new ValidationError(`Site "${name}" was not found.`);
        if (!result.ok) {
          throw new ValidationError(`sites/${name}.json is invalid.`, {
            hint: result.issues.join('; '),
          });
        }

        const profileDir = resolveProfileDir(name, config.profilesDir);
        await ensureProfileDir(profileDir);
        const browserLauncher = new PlaywrightBrowserLauncher(
          new ConsoleLogger({ verbose: options.verbose }),
          name,
        );
        const lock = await browserLauncher.acquireLock(profileDir, name);
        try {
          const relogin = await loginSite(
            { browserLauncher, prompter: new ReadlinePrompter() },
            profileDir,
            result.value,
            'requested',
          );
          await relogin.context.close();
          const checkConfigured = result.value.session.loggedInCheck !== undefined;
          render(
            options,
            () => {
              if (!checkConfigured) {
                console.log(
                  `Browser session saved. No login check is configured, so it can't be verified; run "${PRODUCT_NAME} site set-check ${name} ..." to add one.`,
                );
              } else {
                console.log(relogin.loggedIn ? 'Login verified.' : 'Login check still failing.');
              }
            },
            () => ({ loggedIn: checkConfigured ? relogin.loggedIn : null, checkConfigured }),
          );
        } finally {
          await lock.release();
        }
      });
    });

  site
    .command('set-check <name>')
    .requiredOption('--url <url>', 'the URL to check')
    .option('--role <role>', 'ARIA role of the logged-in indicator')
    .option('--name <name>', 'accessible name of the logged-in indicator')
    .option('--text <text>', 'text that must be visible when logged in')
    .option('--url-not-matching <regex>', 'regex the final URL must not match')
    .action((name: string, cmdOptions: SetCheckOptions) => {
      runCommand(async () => {
        const options = program.optsWithGlobals<GlobalOptions>();
        const { root, store, config } = await loadWorkspace(options.cwd);
        const indicator = parseIndicator(cmdOptions);
        const profileDir = resolveProfileDir(name, config.profilesDir);
        await ensureProfileDir(profileDir);
        const browserLauncher = new PlaywrightBrowserLauncher(
          new ConsoleLogger({ verbose: options.verbose }),
          name,
        );
        const result = await setLoginCheck(
          { store, browserLauncher },
          root,
          profileDir,
          name,
          cmdOptions.url,
          indicator,
        );
        render(
          options,
          () => {
            console.log(result.passed ? 'Login check passed.' : 'Login check did not pass.');
          },
          () => ({ passed: result.passed }),
        );
      });
    });

  site
    .command('remove <name>')
    .option('--delete-profile', 'also delete the browser profile')
    .action((name: string, cmdOptions: RemoveOptions) => {
      runCommand(async () => {
        const options = program.optsWithGlobals<GlobalOptions>();
        const { root, store, config } = await loadWorkspace(options.cwd);
        await store.removeSite(root, name);
        if (cmdOptions.deleteProfile === true) {
          await rm(resolveProfileDir(name, config.profilesDir), { recursive: true, force: true });
        }
        render(
          options,
          () => {
            console.log(`Removed site "${name}".`);
          },
          () => ({ removed: name }),
        );
      });
    });
}
