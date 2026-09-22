import type { BrowserContext, Page } from 'playwright';
import { CheckpointUnavailableError } from '../domain/errors.js';
import type { CsvRow } from '../domain/output.js';
import { captureCallSite, type CallSite } from './call-site.js';
import type { DefinedFlow } from './define-flow.js';
import { createHelpers } from './helpers.js';
import type { FlowContext, OutputApi, StepFn } from './types.js';

export interface FlowRunLogger {
  info(message: string): void;
  warn(message: string): void;
  /** Announces each step's start — only shown when the host logger is in verbose mode. */
  debug(message: string): void;
}

export interface RunFlowDeps<P> {
  readonly page: Page;
  readonly context: BrowserContext;
  readonly params: Readonly<P>;
  readonly runDir: string;
  readonly pacing: { readonly minDelayMs: number; readonly maxDelayMs: number };
  readonly log: FlowRunLogger;
  /** Present only for headed, interactive runs; `checkpoint()` throws without it. */
  readonly waitForEnter?: (message: string) => Promise<void>;
}

export interface RunFlowSuccess {
  readonly ok: true;
  readonly rows: readonly CsvRow[];
  readonly jsonValue: unknown;
  readonly rowCount: number;
  readonly savedFiles: ReadonlyMap<string, string | Uint8Array>;
}

export interface RunFlowFailure {
  readonly ok: false;
  readonly error: unknown;
  readonly stepLabel: string | null;
  readonly stepIndex: number | null;
  readonly callSite: CallSite | null;
  readonly savedFiles: ReadonlyMap<string, string | Uint8Array>;
}

export type RunFlowResult = RunFlowSuccess | RunFlowFailure;

/** Constructs a `FlowContext` around `deps` and executes `flow`, collecting output and
 * tracking which step (if any) failed for the failure bundle. Never throws — failures come
 * back as `{ ok: false, ... }`. */
export async function runFlow<P>(
  flow: DefinedFlow<P>,
  deps: RunFlowDeps<P>,
): Promise<RunFlowResult> {
  const rows: CsvRow[] = [];
  let jsonValue: unknown;
  const savedFiles = new Map<string, string | Uint8Array>();

  const output: OutputApi = {
    addRow: (row) => rows.push(row),
    addRows: (newRows) => rows.push(...newRows),
    setJson: (value) => {
      jsonValue = value;
    },
    get rowCount() {
      return rows.length;
    },
    saveFile: (name, data) => {
      savedFiles.set(name, data);
    },
  };

  const helpers = createHelpers(deps.pacing);

  let activeStep = false;
  let stepIndex = -1;
  let lastStepLabel: string | null = null;
  let lastStepIndex: number | null = null;
  let lastCallSite: CallSite | null = null;

  const step: StepFn = async (label, fn) => {
    if (activeStep) {
      throw new Error('step() calls cannot be nested');
    }
    const callSite = captureCallSite();
    activeStep = true;
    stepIndex += 1;
    lastStepLabel = label;
    lastStepIndex = stepIndex;
    lastCallSite = callSite;
    deps.log.debug(`→ ${label}`);
    try {
      await fn();
    } finally {
      activeStep = false;
    }
  };

  const checkpoint = async (message: string): Promise<void> => {
    if (deps.waitForEnter === undefined) {
      throw new CheckpointUnavailableError('checkpoint() requires a headed, interactive run.');
    }
    await deps.waitForEnter(`⏸ ${message}. Press Enter to continue.`);
  };

  const ctx: FlowContext<P> = {
    page: deps.page,
    context: deps.context,
    params: deps.params,
    step,
    output,
    helpers,
    log: {
      info: (message) => {
        deps.log.info(message);
      },
      warn: (message) => {
        deps.log.warn(message);
      },
    },
    checkpoint,
    runDir: deps.runDir,
  };

  try {
    await flow.run(ctx);
    return { ok: true, rows, jsonValue, rowCount: rows.length, savedFiles };
  } catch (error) {
    return {
      ok: false,
      error,
      stepLabel: lastStepLabel,
      stepIndex: lastStepIndex,
      callSite: lastCallSite,
      savedFiles,
    };
  }
}
