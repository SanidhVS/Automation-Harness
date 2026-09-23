import { mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const CLI_PATH = join(process.cwd(), 'dist', 'cli', 'main.js');

interface CliResult {
  readonly code: number | null;
  readonly stdout: string;
}

function cli(args: readonly string[], cwd: string): Promise<CliResult> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn('node', [CLI_PATH, ...args], { cwd });
    let stdout = '';
    child.stdout.on('data', (chunk: Buffer) => (stdout += chunk.toString()));
    child.on('error', reject);
    child.on('exit', (code) => resolvePromise({ code, stdout }));
  });
}

async function listAllFiles(dir: string, base = dir): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listAllFiles(full, base)));
    } else {
      files.push(full.slice(base.length + 1).replaceAll('\\', '/'));
    }
  }
  return files.sort();
}

describe('rerun init produces the Section 7.2 layout', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'rerun-init-e2e-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('creates exactly the expected files with no unrendered {{placeholders}}', async () => {
    const result = await cli(['init', '.', '--skip-install'], dir);
    expect(result.code).toBe(0);

    const files = await listAllFiles(dir);
    expect(files).toEqual(
      [
        '.claude/skills/rerun-automate/SKILL.md',
        '.github/prompts/automate.prompt.md',
        '.gitignore',
        'AGENTS.md',
        'README.md',
        'package.json',
        'rerun.config.json',
      ].sort(),
    );

    for (const relativePath of files) {
      const content = await readFile(join(dir, relativePath), 'utf8');
      expect(content, `${relativePath} has an unrendered placeholder`).not.toMatch(/\{\{\w+\}\}/);
    }
  });

  it('--update-agent-files re-renders only the three agent files', async () => {
    await cli(['init', '.', '--skip-install'], dir);
    await writeFile(join(dir, 'README.md'), 'do not touch me');

    const result = await cli(['init', '--update-agent-files'], dir);
    expect(result.code).toBe(0);

    expect(await readFile(join(dir, 'README.md'), 'utf8')).toBe('do not touch me');
    const skill = await readFile(join(dir, '.claude/skills/rerun-automate/SKILL.md'), 'utf8');
    expect(skill).not.toMatch(/\{\{\w+\}\}/);
    expect(skill).toContain('name: rerun-automate');
  });

  it('scaffolds an automation with an executable run.sh and no unrendered placeholders', async () => {
    await cli(['init', '.', '--skip-install'], dir);
    await cli(['site', 'add', 'example', '--base-url', 'https://example.com'], dir);
    const created = await cli(['new', 'job-search', '--site', 'example'], dir);
    expect(created.code).toBe(0);

    const automationDir = join(dir, 'automations', 'job-search');
    for (const name of ['flow.ts', 'run.cmd', 'run.sh', 'run.command', 'manifest.json']) {
      const content = await readFile(join(automationDir, name), 'utf8');
      expect(content, `${name} has an unrendered placeholder`).not.toMatch(/\{\{\w+\}\}/);
    }

    if (process.platform !== 'win32') {
      for (const name of ['run.sh', 'run.command']) {
        const launcherStat = await stat(join(automationDir, name));
        expect(launcherStat.mode & 0o111, `${name} is not executable`).not.toBe(0);
      }
    }
  });
});
