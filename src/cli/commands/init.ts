import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { Command } from 'commander';
import { render, runCommand, type GlobalOptions } from '../render.js';
import { ValidationError } from '../../domain/errors.js';
import { PRODUCT_NAME, PRODUCT_DISPLAY_NAME } from '../../shared/product.js';
import {
  renderTemplateFile,
  templatesDir,
} from '../../infrastructure/templates/render-template.js';
import { renderAgentFiles } from '../../infrastructure/templates/render-agent-files.js';

interface InitCommandOptions {
  readonly link?: boolean;
  readonly force?: boolean;
  readonly skipInstall?: boolean;
  readonly updateAgentFiles?: boolean;
}

function run(cmd: string, args: readonly string[], cwd: string): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(cmd, args, { cwd, stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolvePromise();
      else reject(new Error(`${cmd} ${args.join(' ')} exited with code ${String(code)}`));
    });
  });
}

const WORKSPACE_FILES: ReadonlyArray<readonly [string, string]> = [
  ['package.json', 'package.json'],
  [`${PRODUCT_NAME}.config.json`, 'config.json'],
  ['.gitignore', 'gitignore'],
  ['README.md', 'README.md'],
];

async function scaffoldWorkspace(dir: string, force: boolean): Promise<void> {
  const vars = { WORKSPACE_NAME: basename(dir), PRODUCT_NAME, PRODUCT_DISPLAY_NAME };

  if (!force) {
    const existing = WORKSPACE_FILES.filter(([target]) => existsSync(join(dir, target)));
    if (existing.length > 0) {
      throw new ValidationError(
        `Refusing to overwrite existing files: ${existing.map(([target]) => target).join(', ')}.`,
        { hint: 'Pass --force to overwrite.' },
      );
    }
  }

  await mkdir(dir, { recursive: true });
  await mkdir(join(dir, 'sites'), { recursive: true });
  await mkdir(join(dir, 'automations'), { recursive: true });
  for (const [target, templateName] of WORKSPACE_FILES) {
    const content = await renderTemplateFile(join(templatesDir(), 'workspace', templateName), vars);
    await writeFile(join(dir, target), content, 'utf8');
  }
}

/** Registers `rerun init`. */
export function registerInitCommand(program: Command): void {
  program
    .command('init [dir]')
    .description('creates a new workspace')
    .option(
      '--link',
      `npm link the local ${PRODUCT_NAME} package instead of installing from the registry`,
    )
    .option('--force', 'overwrite existing files')
    .option('--skip-install', 'skip npm install and playwright install')
    .option('--update-agent-files', 're-renders only the AI-harness instruction files')
    .action((dirArg: string | undefined, cmdOptions: InitCommandOptions) => {
      runCommand(async () => {
        const options = program.optsWithGlobals<GlobalOptions>();
        const dir = resolve(options.cwd, dirArg ?? '.');

        if (cmdOptions.updateAgentFiles === true) {
          const rendered = await renderAgentFiles(dir);
          render(
            options,
            () => {
              console.log(`Updated ${rendered.skillPath}`);
              console.log(`Updated ${rendered.promptPath}`);
              console.log(`Updated ${rendered.agentsPath}`);
            },
            () => rendered,
          );
          return;
        }

        await scaffoldWorkspace(dir, cmdOptions.force === true);
        await renderAgentFiles(dir);

        if (cmdOptions.skipInstall !== true) {
          if (cmdOptions.link === true) {
            await run('npm', ['link', PRODUCT_NAME], dir);
          } else {
            await run('npm', ['install'], dir);
          }
          await run('npx', ['playwright', 'install', 'chromium'], dir);
        }

        render(
          options,
          () => {
            console.log(`Created workspace in ${dir}`);
            console.log(`Next: cd ${dir} && npx ${PRODUCT_NAME} site add <name> --base-url <url>`);
          },
          () => ({ workspaceRoot: dir }),
        );
      });
    });
}
