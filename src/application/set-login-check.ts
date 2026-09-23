import type { WorkspaceStore } from './ports/workspace-store.js';
import type { BrowserLauncher } from './ports/browser-launcher.js';
import type { LoggedInIndicator, Site } from '../domain/schemas/site.js';
import { ConfigError, ValidationError } from '../domain/errors.js';

export interface SetLoginCheckDeps {
  readonly store: WorkspaceStore;
  readonly browserLauncher: BrowserLauncher;
}

export interface SetLoginCheckResult {
  readonly site: Site;
  readonly passed: boolean;
}

/** Writes `session.loggedInCheck` on a site and immediately tests it — `rerun site
 * set-check` (Section 13). */
export async function setLoginCheck(
  deps: SetLoginCheckDeps,
  root: string,
  profileDir: string,
  siteName: string,
  checkUrl: string,
  indicator: LoggedInIndicator,
): Promise<SetLoginCheckResult> {
  const existing = await deps.store.readSite(root, siteName);
  if (existing === null) {
    throw new ValidationError(`Site "${siteName}" was not found.`);
  }
  if (!existing.ok) {
    throw new ConfigError(`sites/${siteName}.json is invalid.`, existing.issues);
  }

  const updated: Site = {
    ...existing.value,
    session: { loggedInCheck: { url: checkUrl, indicator } },
  };
  await deps.store.writeSite(root, updated);

  const launch = await deps.browserLauncher.launchPersistent({
    profileDir,
    headless: true,
    preferChrome: updated.browser.channel === 'chrome',
  });
  let passed: boolean;
  try {
    const page = launch.context.pages()[0] ?? (await launch.context.newPage());
    passed = await deps.browserLauncher.checkSession(page, checkUrl, indicator);
  } finally {
    await launch.context.close();
  }

  return { site: updated, passed };
}
