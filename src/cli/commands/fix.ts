import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Command } from 'commander';
import { render, runCommand, type GlobalOptions } from '../render.js';
import { loadWorkspace } from '../workspace-context.js';
import { ValidationError } from '../../domain/errors.js';

interface FixOptions {
  readonly run?: string;
}

interface RunSummaryFields {
  readonly status: string;
  readonly failedStep: string | null;
  readonly error: string | null;
}

async function findRunFolder(
  outputDir: string,
  automation: string,
  timestamp: string | undefined,
): Promise<string> {
  const automationDir = join(outputDir, automation);
  if (timestamp !== undefined) {
    return join(automationDir, timestamp);
  }
  let entries: string[];
  try {
    entries = (await readdir(automationDir, { withFileTypes: true }))
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort()
      .reverse();
  } catch {
    throw new ValidationError(`No runs found for "${automation}".`);
  }
  for (const name of entries) {
    try {
      const raw = await readFile(join(automationDir, name, 'run.json'), 'utf8');
      const summary = JSON.parse(raw) as RunSummaryFields;
      if (summary.status === 'failed') return join(automationDir, name);
    } catch {
      continue;
    }
  }
  throw new ValidationError(`No failed runs found for "${automation}".`);
}

export function registerFixCommand(program: Command): void {
  program
    .command('fix <automation>')
    .description('points to the failure bundle for the latest (or a given) failed run')
    .option('--run <timestamp>', 'inspect a specific run instead of the latest failure')
    .action((automation: string, cmdOptions: FixOptions) => {
      runCommand(async () => {
        const options = program.optsWithGlobals<GlobalOptions>();
        const { root, config } = await loadWorkspace(options.cwd);
        const outputDir = join(root, config.outputDir);
        const runFolder = await findRunFolder(outputDir, automation, cmdOptions.run);

        const summary = JSON.parse(
          await readFile(join(runFolder, 'run.json'), 'utf8'),
        ) as RunSummaryFields;

        const files = {
          error: join(runFolder, 'failure', 'error.txt'),
          step: join(runFolder, 'failure', 'step.txt'),
          snapshot: join(runFolder, 'failure', 'snapshot.txt'),
        };

        render(
          options,
          () => {
            console.log(`Failed step: ${summary.failedStep ?? '(unknown)'}`);
            console.log(`Error: ${summary.error ?? '(unknown)'}`);
            console.log(files.error);
            console.log(files.step);
            console.log(files.snapshot);
          },
          () => ({ failedStep: summary.failedStep, error: summary.error, files }),
        );
      });
    });
}
