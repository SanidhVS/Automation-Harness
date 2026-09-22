import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { startFixtureSite, type FixtureSite } from '../fixture-site/server.js';
import { PlaywrightBrowserLauncher } from '../../src/infrastructure/browser/playwright-launcher.js';
import { ConsoleLogger } from '../../src/infrastructure/logging/console-logger.js';
import type { LoggedInIndicator } from '../../src/domain/schemas/site.js';

const roleIndicator: LoggedInIndicator = { type: 'role', role: 'button', name: 'Account menu' };
const textIndicator: LoggedInIndicator = { type: 'text', text: 'Welcome back' };
const urlNotMatchingIndicator: LoggedInIndicator = { type: 'urlNotMatching', pattern: '/login$' };

async function logIn(url: string, profileDir: string): Promise<void> {
  const launcher = new PlaywrightBrowserLauncher(new ConsoleLogger({ verbose: false }), 'fixture');
  const { context } = await launcher.launchPersistent({
    profileDir,
    headless: true,
    preferChrome: false,
  });
  const page = context.pages()[0] ?? (await context.newPage());
  await page.goto(`${url}/login`);
  await page.fill('input[name=username]', 'alice');
  await page.fill('input[name=password]', 'hunter2');
  await page.click('button[type=submit]');
  await page.waitForURL(`${url}/feed`);
  await context.close();
}

describe('session integration (fixture site, real Chromium)', () => {
  let fixture: FixtureSite;
  let profileDir: string;

  beforeAll(async () => {
    fixture = await startFixtureSite();
  });

  afterAll(async () => {
    await fixture.close();
  });

  beforeEach(async () => {
    profileDir = await mkdtemp(join(tmpdir(), 'rerun-profile-'));
  });

  afterEach(async () => {
    await rm(profileDir, { recursive: true, force: true });
  });

  it('keeps the login session across two separate launches of the same profile', async () => {
    await logIn(fixture.url, profileDir);

    const launcher = new PlaywrightBrowserLauncher(
      new ConsoleLogger({ verbose: false }),
      'fixture',
    );
    const { context } = await launcher.launchPersistent({
      profileDir,
      headless: true,
      preferChrome: false,
    });
    const page = context.pages()[0] ?? (await context.newPage());

    const loggedIn = await launcher.checkSession(page, `${fixture.url}/feed`, roleIndicator);
    expect(loggedIn).toBe(true);
    await context.close();
  });

  it.each([
    ['role', roleIndicator],
    ['text', textIndicator],
    ['urlNotMatching', urlNotMatchingIndicator],
  ] as const)(
    '%s indicator passes when logged in and fails after cookies are cleared',
    async (_name, indicator) => {
      await logIn(fixture.url, profileDir);

      const launcher = new PlaywrightBrowserLauncher(
        new ConsoleLogger({ verbose: false }),
        'fixture',
      );
      const { context } = await launcher.launchPersistent({
        profileDir,
        headless: true,
        preferChrome: false,
      });
      const page = context.pages()[0] ?? (await context.newPage());

      await expect(launcher.checkSession(page, `${fixture.url}/feed`, indicator)).resolves.toBe(
        true,
      );

      await context.clearCookies();
      await expect(launcher.checkSession(page, `${fixture.url}/feed`, indicator)).resolves.toBe(
        false,
      );

      await context.close();
    },
  );
});
