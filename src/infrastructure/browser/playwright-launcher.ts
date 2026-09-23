import { chromium, type Page } from 'playwright';
import type {
  BrowserLauncher,
  LaunchProfileOptions,
  LaunchResult,
  ProfileLock,
  ManualBrowser,
} from '../../application/ports/browser-launcher.js';
import type { Logger } from '../../application/ports/logger.js';
import type { LoggedInIndicator } from '../../domain/schemas/site.js';
import { ProfileLockedError } from '../../domain/errors.js';
import { checkSession } from './session-checker.js';
import { acquireProfileLock } from './profile-lock.js';
import { openManualBrowser } from './manual-login-browser.js';
import { PRODUCT_DISPLAY_NAME } from '../../shared/product.js';

const PROFILE_IN_USE_MARKERS = ['already in use', 'singletonlock', 'profile appears to be in use'];

/** True if Playwright's launch failure is Chrome refusing to reuse a profile another
 * process already has open — a race the profile lock file didn't catch (Section 9.2). */
export function isProfileInUseError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return PROFILE_IN_USE_MARKERS.some((marker) => message.includes(marker));
}

function toProfileLockedError(siteName: string, cause: unknown): ProfileLockedError {
  return new ProfileLockedError(
    `Site "${siteName}" is in use by another ${PRODUCT_DISPLAY_NAME} process. Wait for it to finish.`,
    { cause },
  );
}

/** Launches Chromium-family browsers via `chromium.launchPersistentContext`. Prefers the
 * installed Google Chrome channel and falls back to bundled Chromium, logging the fallback
 * once (Section 5.1). */
export class PlaywrightBrowserLauncher implements BrowserLauncher {
  constructor(
    private readonly logger: Logger,
    private readonly siteName: string,
  ) {}

  async launchPersistent(options: LaunchProfileOptions): Promise<LaunchResult> {
    if (options.preferChrome) {
      try {
        const context = await chromium.launchPersistentContext(options.profileDir, {
          headless: options.headless,
          channel: 'chrome',
        });
        return { context, channelUsed: 'chrome' };
      } catch (cause) {
        if (isProfileInUseError(cause)) throw toProfileLockedError(this.siteName, cause);
        this.logger.debug(
          `Chrome channel unavailable, falling back to bundled Chromium: ${cause instanceof Error ? cause.message : String(cause)}`,
        );
        this.logger.info('Google Chrome not found; using bundled Chromium.');
      }
    }

    try {
      const context = await chromium.launchPersistentContext(options.profileDir, {
        headless: options.headless,
      });
      return { context, channelUsed: 'chromium' };
    } catch (cause) {
      if (isProfileInUseError(cause)) throw toProfileLockedError(this.siteName, cause);
      throw cause;
    }
  }

  async checkSession(
    page: Page,
    url: string,
    indicator: LoggedInIndicator,
    timeoutMs?: number,
  ): Promise<boolean> {
    return checkSession(page, url, indicator, timeoutMs);
  }

  openForManualLogin(options: {
    readonly profileDir: string;
    readonly url: string;
    readonly preferChrome: boolean;
  }): Promise<ManualBrowser> {
    return Promise.resolve(openManualBrowser(options));
  }

  async acquireLock(profileDir: string, siteName: string): Promise<ProfileLock> {
    return acquireProfileLock(profileDir, siteName);
  }
}
