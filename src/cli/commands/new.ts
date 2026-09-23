import { mkdir, writeFile, chmod } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { platform } from 'node:process';
import { Command } from 'commander';
import { render, runCommand, type GlobalOptions } from '../render.js';
import { loadWorkspace } from '../workspace-context.js';
import { createAutomation } from '../../application/create-automation.js';
import {
  renderTemplateFile,
  templatesDir,
} from '../../infrastructure/templates/render-template.js';
import { PRODUCT_NAME } from '../../shared/product.js';

interface NewOptions {
  readonly site: string;
}

/** Registers `rerun new`. */
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
            renderTemplate: (relativePath) =>
              renderTemplateFile(join(templatesDir(), relativePath), {
                PRODUCT_NAME,
                AUTOMATION_NAME: automation,
                SITE_NAME: cmdOptions.site,
              }),
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
