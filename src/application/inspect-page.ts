import type { BrowserLauncher } from './ports/browser-launcher.js';
import type { Prompter } from './ports/prompter.js';
import { parseScope, scopeToLocatorSelector } from '../domain/scope.js';
import { pruneAriaSnapshot } from '../domain/snapshot/aria-snapshot-pruner.js';

export interface InspectPageDeps {
  readonly browserLauncher: BrowserLauncher;
  readonly prompter: Prompter;
}

export interface InspectPageOptions {
  readonly profileDir: string;
  readonly preferChrome: boolean;
  readonly url: string;
  /** Raw `--scope` value: `role=<role>[:<name>]` or a CSS selector. Defaults to `body`. */
  readonly scope?: string;
  readonly interactiveOnly: boolean;
  readonly maxLines: number;
  /** Opens headed and waits for Enter so the user can navigate to the right state first. */
  readonly wait: boolean;
}

export interface InspectPageResult {
  readonly url: string;
  readonly snapshot: string;
}

/** Opens the site's profile, navigates to `url`, and prints a pruned ARIA snapshot of the
 * page (or a scoped region within it) — `rerun inspect` (Section 13). */
export async function inspectPage(
  deps: InspectPageDeps,
  options: InspectPageOptions,
): Promise<InspectPageResult> {
  const { context } = await deps.browserLauncher.launchPersistent({
    profileDir: options.profileDir,
    headless: !options.wait,
    preferChrome: options.preferChrome,
  });

  try {
    const page = context.pages()[0] ?? (await context.newPage());
    await page.goto(options.url);

    if (options.wait) {
      await deps.prompter.waitForEnter(
        'Navigate to the page/state you want to inspect, then press Enter here.',
      );
    }

    const selector =
      options.scope !== undefined ? scopeToLocatorSelector(parseScope(options.scope)) : 'body';
    const raw = await page.locator(selector).ariaSnapshot();
    const snapshot = pruneAriaSnapshot(raw, {
      maxLines: options.maxLines,
      interactiveOnly: options.interactiveOnly,
    });

    return { url: page.url(), snapshot };
  } finally {
    await context.close();
  }
}
