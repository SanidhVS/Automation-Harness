import type { BrowserContext, Page } from 'playwright';
import type { LoggedInIndicator } from '../../domain/schemas/site.js';

export interface LaunchProfileOptions {
  readonly profileDir: string;
  readonly headless: boolean;
  /** Prefer the installed Google Chrome build over bundled Chromium (Section 5.1). */
  readonly preferChrome: boolean;
}

export interface LaunchResult {
  readonly context: BrowserContext;
  readonly channelUsed: 'chrome' | 'chromium';
}

/** Launches a dedicated persistent browser context for one site's profile. Never the
 * user's default browser profile, never CDP-attached (Section 5.1). */
export interface BrowserLauncher {
  launchPersistent(options: LaunchProfileOptions): Promise<LaunchResult>;
  /** Navigates to `url` and evaluates the site's logged-in indicator (Section 9.3). */
  checkSession(
    page: Page,
    url: string,
    indicator: LoggedInIndicator,
    timeoutMs?: number,
  ): Promise<boolean>;
}
