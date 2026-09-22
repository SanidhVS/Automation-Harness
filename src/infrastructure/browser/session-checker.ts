import type { Page } from 'playwright';
import type { LoggedInIndicator } from '../../domain/schemas/site.js';

const DEFAULT_TIMEOUT_MS = 10_000;

/** Navigates to `url` and evaluates whether the session is logged in, per the site's
 * `loggedInCheck.indicator` (Section 9.3). */
export async function checkSession(
  page: Page,
  url: string,
  indicator: LoggedInIndicator,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<boolean> {
  await page.goto(url);

  switch (indicator.type) {
    case 'role': {
      const locator = page.locator(
        `role=${indicator.role}[name=${JSON.stringify(indicator.name)}]`,
      );
      try {
        await locator.waitFor({ state: 'visible', timeout: timeoutMs });
        return true;
      } catch {
        return false;
      }
    }
    case 'text': {
      try {
        await page
          .getByText(indicator.text)
          .first()
          .waitFor({ state: 'visible', timeout: timeoutMs });
        return true;
      } catch {
        return false;
      }
    }
    case 'urlNotMatching': {
      const regex = new RegExp(indicator.pattern);
      return !regex.test(page.url());
    }
  }
}
