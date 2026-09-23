import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';
import type { ManualBrowser } from '../../application/ports/browser-launcher.js';

const CLOSE_TIMEOUT_MS = 10_000;

function installedChromePath(): string | null {
  const candidates =
    process.platform === 'darwin'
      ? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome']
      : process.platform === 'win32'
        ? [
            process.env['PROGRAMFILES'],
            process.env['PROGRAMFILES(X86)'],
            process.env['LOCALAPPDATA'],
          ]
            .filter((dir): dir is string => dir !== undefined)
            .map((dir) => join(dir, 'Google', 'Chrome', 'Application', 'chrome.exe'))
        : ['/opt/google/chrome/chrome', '/usr/bin/google-chrome'];
  return candidates.find((path) => existsSync(path)) ?? null;
}

function waitForExit(child: ChildProcess, timeoutMs: number): Promise<boolean> {
  if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve(true);
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      resolve(false);
    }, timeoutMs);
    child.once('exit', () => {
      clearTimeout(timer);
      resolve(true);
    });
  });
}

/** Asks the browser to shut down the way closing it normally would, so it writes cookies
 * to disk; falls back to a hard kill if it hangs. On Windows, taskkill without /F sends
 * the window a close request rather than terminating the process. */
async function closeGracefully(child: ChildProcess): Promise<void> {
  if (child.pid === undefined) return;
  if (process.platform === 'win32') {
    spawn('taskkill', ['/PID', String(child.pid), '/T']);
  } else {
    child.kill('SIGTERM');
  }
  if (!(await waitForExit(child, CLOSE_TIMEOUT_MS))) {
    if (process.platform === 'win32') spawn('taskkill', ['/PID', String(child.pid), '/T', '/F']);
    else child.kill('SIGKILL');
    await waitForExit(child, CLOSE_TIMEOUT_MS);
  }
}

/** Starts the site's profile in a normal browser process — no Playwright, no remote
 * debugging, no automation flags — so the human can log in on pages that block
 * automated browsers. Uses installed Google Chrome when preferred and available. */
export function openManualBrowser(options: {
  readonly profileDir: string;
  readonly url: string;
  readonly preferChrome: boolean;
}): ManualBrowser {
  const chromePath = options.preferChrome ? installedChromePath() : null;
  const executable = chromePath ?? chromium.executablePath();
  const child = spawn(
    executable,
    [
      `--user-data-dir=${options.profileDir}`,
      '--no-first-run',
      '--no-default-browser-check',
      // Match how Playwright launches this profile later: it stores cookies with a
      // stand-in encryption key instead of the OS keychain. Without these, cookies saved
      // here are unreadable to the automated runs. Not visible to websites.
      '--password-store=basic',
      '--use-mock-keychain',
      options.url,
    ],
    { stdio: 'ignore' },
  );
  return {
    browser: chromePath !== null ? 'chrome' : 'chromium',
    close: () => closeGracefully(child),
  };
}
