import { RerunError } from '../domain/errors.js';
import { EXIT_CODES } from '../domain/exit-codes.js';

export interface GlobalOptions {
  readonly json: boolean;
  readonly verbose: boolean;
  readonly input: boolean;
  readonly cwd: string;
}

/** Prints a command's result as either a human-readable summary or `--json`. */
export function render(options: GlobalOptions, human: () => void, json: () => unknown): void {
  if (options.json) {
    console.log(JSON.stringify(json()));
  } else {
    human();
  }
}

/** One line of cause, one line of hint; the stack only with `--verbose` (Section 3.3). */
export function renderError(error: unknown, verbose: boolean): void {
  if (error instanceof RerunError) {
    console.error(error.message);
    if (error.hint !== undefined) console.error(error.hint);
  } else if (error instanceof Error) {
    console.error(error.message);
  } else {
    console.error(String(error));
  }
  if (verbose && error instanceof Error && error.stack !== undefined) {
    console.error(error.stack);
  }
}

export function exitCodeFor(error: unknown): number {
  if (error instanceof RerunError) return error.code;
  return EXIT_CODES.flowFailed;
}

/** Wraps a command action: renders the error and exits with the right code, so every
 * command file only needs to write its happy path. */
export function runCommand(action: () => Promise<void>): void {
  action().catch((error: unknown) => {
    const options = getGlobalOptionsFallback();
    renderError(error, options.verbose);
    process.exit(exitCodeFor(error));
  });
}

// `runCommand` catches before we know the parsed --verbose flag in edge cases (e.g. option
// parsing itself throws); default to non-verbose in that narrow case.
function getGlobalOptionsFallback(): { verbose: boolean } {
  return { verbose: process.argv.includes('--verbose') };
}
