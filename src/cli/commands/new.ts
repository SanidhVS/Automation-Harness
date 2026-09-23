import { mkdir, writeFile, chmod } from 'node:fs/promises';
import { dirname } from 'node:path';
import { platform } from 'node:process';
import { Command } from 'commander';
import { render, runCommand, type GlobalOptions } from '../render.js';
import { loadWorkspace } from '../workspace-context.js';
import { createAutomation } from '../../application/create-automation.js';

interface NewOptions {
  readonly site: string;
}

export function registerNewCommand(program: Command): void {
  program
    .command('new <automation>')
    .description('scaffolds a new automation')
    .requiredOption('--site <site>', 'the site this automation runs against')
    .action((automation: string, cmdOptions: NewOptions) => {
      runCommand(async () => {
        const options = program.optsWithGlobals<GlobalOptions>();
        const { root, store } = await loadWorkspace(options.cwd);

        await createAutomation(
          {
            store,
            writeFile: async (path, content) => {
              await mkdir(dirname(path), { recursive: true });
              await writeFile(path, content, 'utf8');
            },
            makeExecutable: async (path) => {
              if (platform !== 'win32') await chmod(path, 0o755);
            },
          },
          root,
          automation,
          cmdOptions.site,
        );

        render(
          options,
          () => {
            console.log(`Created automations/${automation}/`);
          },
          () => ({ automation, site: cmdOptions.site }),
        );
      });
    });
}
