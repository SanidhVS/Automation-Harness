import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Command } from 'commander';
import { render, runCommand, type GlobalOptions } from '../render.js';
import { loadWorkspace } from '../workspace-context.js';

interface AutomationSummary {
  readonly name: string;
  readonly site: string | null;
  readonly requiredParams: readonly string[];
  readonly lastRun: { readonly status: string; readonly finishedAt: string } | null;
}

async function latestRun(
  outputDir: string,
  automation: string,
): Promise<{ status: string; finishedAt: string } | null> {
  let entries: string[];
  try {
    entries = (await readdir(join(outputDir, automation), { withFileTypes: true }))
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort()
      .reverse();
  } catch {
    return null;
  }
  const latest = entries[0];
  if (latest === undefined) return null;
  try {
    const raw = await readFile(join(outputDir, automation, latest, 'run.json'), 'utf8');
    const parsed = JSON.parse(raw) as { status: string; finishedAt: string };
    return { status: parsed.status, finishedAt: parsed.finishedAt };
  } catch {
    return null;
  }
}

/** Registers `rerun list`. */
export function registerListCommand(program: Command): void {
  program
    .command('list')
    .description('lists automations')
    .action(() => {
      runCommand(async () => {
        const options = program.optsWithGlobals<GlobalOptions>();
        const { root, store, config } = await loadWorkspace(options.cwd);
        const names = await store.listAutomations(root);
        const outputDir = join(root, config.outputDir);

        const summaries: AutomationSummary[] = await Promise.all(
          names.map(async (name) => {
            const result = await store.readManifest(root, name);
            const manifest = result?.ok === true ? result.value : null;
            return {
              name,
              site: manifest?.site ?? null,
              requiredParams: manifest?.params.filter((p) => p.required).map((p) => p.name) ?? [],
              lastRun: await latestRun(outputDir, name),
            };
          }),
        );

        render(
          options,
          () => {
            if (summaries.length === 0) {
              console.log('No automations yet. Run "new <name> --site <site>" to create one.');
              return;
            }
            for (const s of summaries) {
              const required =
                s.requiredParams.length > 0 ? ` (required: ${s.requiredParams.join(', ')})` : '';
              const last =
                s.lastRun !== null
                  ? ` — last run: ${s.lastRun.status} at ${s.lastRun.finishedAt}`
                  : '';
              console.log(`${s.name}  site=${s.site ?? '?'}${required}${last}`);
            }
          },
          () => ({ automations: summaries }),
        );
      });
    });
}
