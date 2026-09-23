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

/** Opens the site's profile in a plain, non-automated browser at its login URL, waits for
 * the human to log in, closes that browser so the session is saved, then reopens the
 * profile under automation and re-runs the session check (Section 9.3). The login window
 * must not be automated: sign-in pages such as Google's refuse automated browsers.
 *
 * Returns the live context/page so a caller that just re-authenticated mid-run can
 * continue with them; a caller that only wants to log in (`rerun site login`) closes the
 * context itself. */
export async function loginSite(
  deps: LoginSiteDeps,
  profileDir: string,
  site: Site,
  reason: 'expired' | 'requested',
): Promise<LoginResult> {
  const preferChrome = site.browser.channel === 'chrome';
  const manual = await deps.browserLauncher.openForManualLogin({
    profileDir,
    url: site.loginUrl ?? site.baseUrl,
    preferChrome,
  });
  const lead = reason === 'expired' ? `Session for "${site.name}" expired. ` : '';
  try {
    await deps.prompter.waitForEnter(
      `${lead}Log in to "${site.name}" in the browser window, then press Enter here.`,
    );
  } finally {
    await manual.close();
  }

  const { context } = await deps.browserLauncher.launchPersistent({
    profileDir,
    headless: false,
    preferChrome,
  });
  const page = context.pages()[0] ?? (await context.newPage());

  const loggedInCheck = site.session.loggedInCheck;
  const loggedIn =
    loggedInCheck === undefined
      ? true
      : await deps.browserLauncher.checkSession(page, loggedInCheck.url, loggedInCheck.indicator);

  return { context, page, loggedIn };
}
