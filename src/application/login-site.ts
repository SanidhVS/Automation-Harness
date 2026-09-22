import type { BrowserContext, Page } from 'playwright';
import type { BrowserLauncher } from './ports/browser-launcher.js';
import type { Prompter } from './ports/prompter.js';
import type { Site } from '../domain/schemas/site.js';

export interface LoginSiteDeps {
  readonly browserLauncher: BrowserLauncher;
  readonly prompter: Prompter;
}

export interface LoginResult {
  readonly context: BrowserContext;
  readonly page: Page;
  readonly loggedIn: boolean;
}

/** Opens the site's profile headed at its login URL, waits for the human to log in, and
 * re-runs the session check (Section 9.3). Returns the live context/page so a caller that
 * just re-authenticated mid-run can continue using them instead of relaunching; a caller
 * that only wants to log in (`rerun site login`) closes the context itself. */
export async function loginSite(
  deps: LoginSiteDeps,
  profileDir: string,
  site: Site,
): Promise<LoginResult> {
  const { context } = await deps.browserLauncher.launchPersistent({
    profileDir,
    headless: false,
    preferChrome: site.browser.channel === 'chrome',
  });
  const page = context.pages()[0] ?? (await context.newPage());
  await page.goto(site.loginUrl ?? site.baseUrl);

  await deps.prompter.waitForEnter(
    `Session for "${site.name}" expired. A browser window will open; log in, then press Enter here.`,
  );

  const loggedInCheck = site.session.loggedInCheck;
  const loggedIn =
    loggedInCheck === undefined
      ? true
      : await deps.browserLauncher.checkSession(page, loggedInCheck.url, loggedInCheck.indicator);

  return { context, page, loggedIn };
}
