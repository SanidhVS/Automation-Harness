import type { CsvRow } from '../../domain/output.js';
import type { RunSummary } from '../../domain/schemas/run-summary.js';

export interface RunFolderHandle {
  readonly path: string;
  readonly timestamp: string;
}

export type ResultsWrite =
  | { readonly format: 'csv'; readonly rows: readonly CsvRow[] }
  | { readonly format: 'json'; readonly value: unknown }
  | { readonly format: 'none' };

export interface FailureBundleInput {
  readonly errorText: string;
  readonly stepText: string;
  readonly snapshotText: string | null;
  readonly screenshotPng: Uint8Array | null;
}

/** Owns everything written under `output/<automation>/<timestamp>/` — results, run.json,
 * the failure bundle, extra artifacts saved by the flow, and `keepRuns` retention
 * (Section 8.1, 9.4, 9.5). */
export interface OutputStore {
  createRunFolder(
    workspaceRoot: string,
    outputDir: string,
    automation: string,
  ): Promise<RunFolderHandle>;
  /** Writes the run's results file; returns its name, or null for `format: 'none'`. */
  writeResults(runFolder: string, results: ResultsWrite): Promise<string | null>;
  writeRunSummary(runFolder: string, summary: RunSummary): Promise<void>;
  writeFailureBundle(runFolder: string, bundle: FailureBundleInput): Promise<void>;
  writeExtraFile(runFolder: string, name: string, data: string | Uint8Array): Promise<void>;
  applyRetention(
    workspaceRoot: string,
    outputDir: string,
    automation: string,
    keepRuns: number,
  ): Promise<readonly string[]>;
}
