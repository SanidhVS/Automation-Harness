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
export interface ProfileLock {
  release(): Promise<void>;
}

export interface ManualBrowser {
  readonly browser: 'chrome' | 'chromium';
  /** Closes the window gracefully so the browser flushes cookies to the profile. */
  close(): Promise<void>;
}

export interface BrowserLauncher {
  launchPersistent(options: LaunchProfileOptions): Promise<LaunchResult>;
  /** Opens the profile in a plain browser process with no automation attached, for a
   * human to log in. Sign-in pages such as Google's refuse automated browsers. */
  openForManualLogin(options: {
    readonly profileDir: string;
    readonly url: string;
    readonly preferChrome: boolean;
  }): Promise<ManualBrowser>;
  /** Navigates to `url` and evaluates the site's logged-in indicator (Section 9.3). */
  checkSession(
    page: Page,
    url: string,
    indicator: LoggedInIndicator,
    timeoutMs?: number,
  ): Promise<boolean>;
  /** Acquires `<profileDir>/.rerun.lock`, rejecting with `ProfileLockedError` if another
   * live process holds it (Section 9.2). */
  acquireLock(profileDir: string, siteName: string): Promise<ProfileLock>;
}
