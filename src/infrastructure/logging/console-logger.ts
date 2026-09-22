import type { Logger } from '../../application/ports/logger.js';
import { RerunError } from '../../domain/errors.js';

export interface ConsoleLoggerOptions {
  readonly verbose: boolean;
}

/** Writes plain, factual lines to stdout/stderr — no banners, no spinners, no color unless
 * the terminal is a TTY. `debug` is silent unless `verbose` is set (Section 3.3). */
export class ConsoleLogger implements Logger {
  private readonly verbose: boolean;

  constructor(options: ConsoleLoggerOptions) {
    this.verbose = options.verbose;
  }

  info(message: string): void {
    console.log(message);
  }

  warn(message: string): void {
    console.error(message);
  }

  debug(message: string): void {
    if (this.verbose) console.error(message);
  }

  error(error: unknown): void {
    if (error instanceof RerunError) {
      console.error(error.message);
      if (error.hint !== undefined) console.error(error.hint);
    } else if (error instanceof Error) {
      console.error(error.message);
    } else {
      console.error(String(error));
    }
    if (this.verbose && error instanceof Error && error.stack !== undefined) {
      console.error(error.stack);
    }
  }
}
