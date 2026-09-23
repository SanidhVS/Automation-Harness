import { EXIT_CODES, type ExitCode } from './exit-codes.js';

/** Base class for every error Rerun raises deliberately. `code` maps directly to the
 * process exit code; `hint` is the one-line "what to do next" shown to the user. */
export abstract class RerunError extends Error {
  abstract readonly code: ExitCode;
  readonly hint: string | undefined;

  constructor(message: string, options?: { hint?: string; cause?: unknown }) {
    super(message, options?.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = new.target.name;
    this.hint = options?.hint;
  }
}

/** A JSON config file (workspace config, site, or manifest) failed schema validation. */
export class ConfigError extends RerunError {
  readonly code = EXIT_CODES.invalidConfig;
  readonly issues: readonly string[];

  constructor(message: string, issues: readonly string[], options?: { hint?: string }) {
    super(message, options);
    this.issues = issues;
  }
}

/** User-supplied CLI arguments or parameters failed validation. */
export class ValidationError extends RerunError {
  readonly code = EXIT_CODES.usageError;
}

/** The site's session is not logged in and no interactive re-login was possible. */
export class SessionRequiredError extends RerunError {
  readonly code = EXIT_CODES.loginRequired;
}

/** Another Rerun process already holds the lock on a site's browser profile. */
export class ProfileLockedError extends RerunError {
  readonly code = EXIT_CODES.profileLocked;
}

/** A flow step threw while running. */
export class FlowStepError extends RerunError {
  readonly code = EXIT_CODES.flowFailed;
  readonly stepLabel: string;
  readonly stepIndex: number;

  constructor(
    message: string,
    stepLabel: string,
    stepIndex: number,
    options?: { hint?: string; cause?: unknown },
  ) {
    super(message, options);
    this.stepLabel = stepLabel;
    this.stepIndex = stepIndex;
  }
}

/** `helpers.assert` failed inside a flow. */
export class FlowAssertionError extends RerunError {
  readonly code = EXIT_CODES.flowFailed;
}

/** `checkpoint()` was called outside a headed, interactive run. */
export class CheckpointUnavailableError extends RerunError {
  readonly code = EXIT_CODES.usageError;
}

/** No `rerun.config.json` was found walking up from the current directory. */
export class WorkspaceNotFoundError extends RerunError {
  readonly code = EXIT_CODES.usageError;
}
