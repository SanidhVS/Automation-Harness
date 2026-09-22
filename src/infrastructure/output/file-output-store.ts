import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type {
  FailureBundleInput,
  OutputStore,
  ResultsWrite,
  RunFolderHandle,
} from '../../application/ports/output-store.js';
import type { Clock } from '../../application/ports/clock.js';
import type { RunSummary } from '../../domain/schemas/run-summary.js';
import { runSummarySchema } from '../../domain/schemas/run-summary.js';
import { RunFolderManager } from './run-folder-manager.js';
import { rowsToCsv } from './csv-writer.js';
import { toJsonOutput } from './json-writer.js';

const RESULTS_CSV = 'results.csv';
const RESULTS_JSON = 'results.json';

/** File-backed `OutputStore`: wraps `RunFolderManager` for folder creation/retention and
 * writes results, run.json, the failure bundle, and extra artifacts as plain files. */
export class FileOutputStore implements OutputStore {
  private readonly runFolders: RunFolderManager;

  constructor(clock: Clock) {
    this.runFolders = new RunFolderManager(clock);
  }

  async createRunFolder(
    workspaceRoot: string,
    outputDir: string,
    automation: string,
  ): Promise<RunFolderHandle> {
    return this.runFolders.createRunFolder(workspaceRoot, outputDir, automation);
  }

  async writeResults(runFolder: string, results: ResultsWrite): Promise<string | null> {
    if (results.format === 'none') return null;
    if (results.format === 'csv') {
      await writeFile(join(runFolder, RESULTS_CSV), rowsToCsv(results.rows), 'utf8');
      return RESULTS_CSV;
    }
    await writeFile(join(runFolder, RESULTS_JSON), toJsonOutput(results.value), 'utf8');
    return RESULTS_JSON;
  }

  async writeRunSummary(runFolder: string, summary: RunSummary): Promise<void> {
    const validated = runSummarySchema.parse(summary);
    await writeFile(join(runFolder, 'run.json'), `${JSON.stringify(validated, null, 2)}\n`, 'utf8');
  }

  async writeFailureBundle(runFolder: string, bundle: FailureBundleInput): Promise<void> {
    const failureDir = join(runFolder, 'failure');
    await mkdir(failureDir, { recursive: true });

    const writes: Promise<void>[] = [
      writeFile(join(failureDir, 'error.txt'), bundle.errorText, 'utf8'),
      writeFile(join(failureDir, 'step.txt'), bundle.stepText, 'utf8'),
    ];
    if (bundle.snapshotText !== null) {
      writes.push(writeFile(join(failureDir, 'snapshot.txt'), bundle.snapshotText, 'utf8'));
    }
    if (bundle.screenshotPng !== null) {
      writes.push(writeFile(join(failureDir, 'screenshot.png'), bundle.screenshotPng));
    }
    // Best-effort: capturing the bundle must never itself fail the run (Section 9.5).
    await Promise.allSettled(writes);
  }

  async writeExtraFile(runFolder: string, name: string, data: string | Uint8Array): Promise<void> {
    const path = join(runFolder, name);
    await mkdir(join(path, '..'), { recursive: true });
    await writeFile(path, data);
  }

  async applyRetention(
    workspaceRoot: string,
    outputDir: string,
    automation: string,
    keepRuns: number,
  ): Promise<readonly string[]> {
    return this.runFolders.applyRetention(workspaceRoot, outputDir, automation, keepRuns);
  }
}
