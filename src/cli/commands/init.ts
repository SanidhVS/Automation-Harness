import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { Command } from 'commander';
import { render, runCommand, type GlobalOptions } from '../render.js';
import { ValidationError } from '../../domain/errors.js';
import { PRODUCT_NAME } from '../../shared/product.js';

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

function workspacePackageJson(dirName: string): string {
  return `${JSON.stringify(
    {
      name: dirName,
      private: true,
      type: 'module',
      dependencies: {
        [PRODUCT_NAME]: '^0.1.0',
        playwright: '^1.63.0',
      },
    },
    null,
    2,
  )}\n`;
}

function workspaceConfigJson(): string {
  return `${JSON.stringify(
    {
      $schema: `./node_modules/${PRODUCT_NAME}/schemas/workspace-config.schema.json`,
      version: 1,
      outputDir: 'output',
      keepRuns: 20,
      trace: 'on-failure',
      profilesDir: null,
    },
    null,
    2,
  )}\n`;
}

function workspaceGitignore(): string {
  return `node_modules/\noutput/\n.${PRODUCT_NAME}/\n.env\n.env.*\n`;
}

function workspaceReadme(dirName: string): string {
  return `# ${dirName}\n\nA ${PRODUCT_NAME} workspace. See \`sites/\` for site definitions and \`automations/\` for automations.\n\nRun an automation:\n\n\`\`\`sh\nnpx ${PRODUCT_NAME} run <automation>\n\`\`\`\n`;
}

async function scaffoldWorkspace(dir: string, force: boolean): Promise<void> {
  const files: Record<string, string> = {
    'package.json': workspacePackageJson(basename(dir)),
    [`${PRODUCT_NAME}.config.json`]: workspaceConfigJson(),
    '.gitignore': workspaceGitignore(),
    'README.md': workspaceReadme(basename(dir)),
  };

  if (!force) {
    const existing = Object.keys(files).filter((name) => existsSync(`${dir}/${name}`));
    if (existing.length > 0) {
      throw new ValidationError(`Refusing to overwrite existing files: ${existing.join(', ')}.`, {
        hint: 'Pass --force to overwrite.',
      });
    }
  }

  await mkdir(dir, { recursive: true });
  await mkdir(`${dir}/sites`, { recursive: true });
  await mkdir(`${dir}/automations`, { recursive: true });
  for (const [name, content] of Object.entries(files)) {
    await writeFile(`${dir}/${name}`, content, 'utf8');
  }
}

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
          console.log(
            'Agent instruction file rendering is not yet available (targeted for a later release); nothing to update.',
          );
          return;
        }

        await scaffoldWorkspace(dir, cmdOptions.force === true);

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
