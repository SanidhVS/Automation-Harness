import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { startFixtureSite, type FixtureSite } from '../fixture-site/server.js';
import { inspectPage } from '../../src/application/inspect-page.js';
import { PlaywrightBrowserLauncher } from '../../src/infrastructure/browser/playwright-launcher.js';
import { ConsoleLogger } from '../../src/infrastructure/logging/console-logger.js';
import type { Prompter } from '../../src/application/ports/prompter.js';

const neverCalledPrompter: Prompter = {
  waitForEnter: () => {
    throw new Error('prompter should not be called when --wait is not set');
  },
};

async function seedLogin(url: string, profileDir: string): Promise<void> {
  // Goes through the real /login form rather than context.addCookies(), which defaults to
  // a session cookie that Chrome discards on close — the fixture's login form sets
  // Max-Age so the cookie actually survives the relaunch inside inspectPage().
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

describe('inspectPage integration (fixture site, real Chromium)', () => {
  let fixture: FixtureSite;
  let profileDir: string;

  beforeAll(async () => {
    fixture = await startFixtureSite();
  });

  afterAll(async () => {
    await fixture.close();
  });

  beforeEach(async () => {
    profileDir = await mkdtemp(join(tmpdir(), 'rerun-inspect-profile-'));
    await seedLogin(fixture.url, profileDir);
  });

  afterEach(async () => {
    await rm(profileDir, { recursive: true, force: true });
  });

  function deps() {
    return {
      browserLauncher: new PlaywrightBrowserLauncher(
        new ConsoleLogger({ verbose: false }),
        'fixture',
      ),
      prompter: neverCalledPrompter,
    };
  }

  it('stays under 150 lines and collapses the repeated result cards with default options', async () => {
    const result = await inspectPage(deps(), {
      profileDir,
      preferChrome: false,
      url: `${fixture.url}/search?total=25`,
      interactiveOnly: false,
      maxLines: 150,
      wait: false,
    });

    const lines = result.snapshot.split('\n');
    expect(lines.length).toBeLessThanOrEqual(150);
    expect(result.snapshot).toMatch(/more similar \w+ items/);
    expect(result.url).toBe(`${fixture.url}/search?total=25`);
  });

  it('scopes the snapshot to a CSS selector', async () => {
    const result = await inspectPage(deps(), {
      profileDir,
      preferChrome: false,
      url: `${fixture.url}/search?total=25`,
      scope: '#results',
      interactiveOnly: false,
      maxLines: 150,
      wait: false,
    });

    expect(result.snapshot).not.toContain('Search jobs');
    expect(result.snapshot).toContain('listitem');
  });

  it('scopes the snapshot to a role selector', async () => {
    const result = await inspectPage(deps(), {
      profileDir,
      preferChrome: false,
      url: `${fixture.url}/search?total=25`,
      scope: 'role=button:Search',
      interactiveOnly: false,
      maxLines: 150,
      wait: false,
    });

    expect(result.snapshot).toContain('button "Search"');
    expect(result.snapshot).not.toContain('listitem');
  });

  it('keeps only interactive elements with --interactive-only', async () => {
    const result = await inspectPage(deps(), {
      profileDir,
      preferChrome: false,
      url: `${fixture.url}/search?total=25`,
      interactiveOnly: true,
      maxLines: 150,
      wait: false,
    });

    expect(result.snapshot).not.toContain('company');
    expect(result.snapshot).toMatch(/textbox|link|button/);
  });
});
