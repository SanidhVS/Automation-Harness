import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Command } from 'commander';
import { chromium } from 'playwright';
import { render, runCommand, type GlobalOptions } from '../render.js';
import { FileWorkspaceStore } from '../../infrastructure/workspace/file-workspace-store.js';
import { appDataDir } from '../../infrastructure/paths/app-paths.js';
import { PRODUCT_NAME } from '../../shared/product.js';

interface CheckResult {
  readonly name: string;
  readonly status: 'ok' | 'warn' | 'fail';
  readonly message: string;
}

const MIN_NODE_MAJOR = 20;

function checkNodeVersion(): CheckResult {
  const major = Number(process.versions.node.split('.')[0]);
  return {
    name: 'Node.js version',
    status: major >= MIN_NODE_MAJOR ? 'ok' : 'fail',
    message:
      major >= MIN_NODE_MAJOR
        ? `v${process.versions.node}`
        : `v${process.versions.node} (requires >=${String(MIN_NODE_MAJOR)})`,
  };
}

function checkChromiumInstalled(): CheckResult {
  try {
    const path = chromium.executablePath();
    return {
      name: 'Chromium installed',
      status: existsSync(path) ? 'ok' : 'fail',
      message: path,
    };
  } catch (error) {
    return {
      name: 'Chromium installed',
      status: 'fail',
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

async function checkChromeChannel(): Promise<CheckResult> {
  try {
    const browser = await chromium.launch({ channel: 'chrome', headless: true });
    await browser.close();
    return { name: 'Google Chrome channel', status: 'ok', message: 'available' };
  } catch {
    return {
      name: 'Google Chrome channel',
      status: 'warn',
      message: 'not found; falling back to bundled Chromium',
    };
  }
}

async function checkProfilesDirWritable(profilesDir: string): Promise<CheckResult> {
  const probe = join(profilesDir, `.doctor-probe-${String(process.pid)}`);
  try {
    await mkdir(profilesDir, { recursive: true });
    await writeFile(probe, '');
    await rm(probe, { force: true });
    return { name: 'Profiles directory writable', status: 'ok', message: profilesDir };
  } catch (error) {
    return {
      name: 'Profiles directory writable',
      status: 'fail',
      message: `${profilesDir}: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM';
  }
}

async function checkStaleLocks(profilesDir: string): Promise<CheckResult> {
  const lockSuffix = `.${PRODUCT_NAME}.lock`;
  let siteDirs: string[];
  try {
    siteDirs = (await readdir(profilesDir, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
  } catch {
    return { name: 'Stale profile locks', status: 'ok', message: 'no profiles yet' };
  }

  let stale = 0;
  for (const site of siteDirs) {
    const lockPath = join(profilesDir, site, lockSuffix);
    try {
      const raw = await readFile(lockPath, 'utf8');
      const pid = (JSON.parse(raw) as { pid?: unknown }).pid;
      if (typeof pid === 'number' && !isProcessAlive(pid)) stale++;
    } catch {
      continue;
    }
  }
  return {
    name: 'Stale profile locks',
    status: stale > 0 ? 'warn' : 'ok',
    message: stale > 0 ? `${String(stale)} stale lock(s) found` : 'none',
  };
}

async function checkWorkspace(cwd: string): Promise<CheckResult> {
  const store = new FileWorkspaceStore();
  const root = await store.findRoot(cwd);
  if (root === null) {
    return { name: 'Workspace', status: 'warn', message: 'none found in this directory' };
  }

  const issues: string[] = [];
  const configResult = await store.readConfig(root);
  if (!configResult.ok) issues.push(...configResult.issues.map((i) => `config: ${i}`));

  for (const name of await store.listSites(root)) {
    const result = await store.readSite(root, name);
    if (result !== null && !result.ok) {
      issues.push(...result.issues.map((i) => `site ${name}: ${i}`));
    }
  }
  for (const name of await store.listAutomations(root)) {
    const result = await store.readManifest(root, name);
    if (result !== null && !result.ok) {
      issues.push(...result.issues.map((i) => `automation ${name}: ${i}`));
    }
  }

  return issues.length === 0
    ? { name: 'Workspace', status: 'ok', message: root }
    : { name: 'Workspace', status: 'fail', message: issues.join('; ') };
}

async function resolveProfilesDir(cwd: string): Promise<string> {
  const store = new FileWorkspaceStore();
  const root = await store.findRoot(cwd);
  if (root !== null) {
    const configResult = await store.readConfig(root);
    if (configResult.ok && configResult.value.profilesDir !== null) {
      return configResult.value.profilesDir;
    }
  }
  return join(appDataDir(), 'profiles');
}

async function runChecks(cwd: string): Promise<readonly CheckResult[]> {
  const profilesDir = await resolveProfilesDir(cwd);

  return [
    checkNodeVersion(),
    checkChromiumInstalled(),
    await checkChromeChannel(),
    await checkWorkspace(cwd),
    await checkProfilesDirWritable(profilesDir),
    await checkStaleLocks(profilesDir),
  ];
}

export function registerDoctorCommand(program: Command): void {
  program
    .command('doctor')
    .description('checks the environment and workspace')
    .action(() => {
      runCommand(async () => {
        const options = program.optsWithGlobals<GlobalOptions>();
        const results = await runChecks(options.cwd);
        const hasFailure = results.some((r) => r.status === 'fail');

        render(
          options,
          () => {
            for (const r of results) {
              const marker = r.status === 'ok' ? 'OK ' : r.status === 'warn' ? 'WARN' : 'FAIL';
              console.log(`${marker}  ${r.name}: ${r.message}`);
            }
          },
          () => ({ checks: results }),
        );

        if (hasFailure) process.exitCode = 6;
      });
    });
}
