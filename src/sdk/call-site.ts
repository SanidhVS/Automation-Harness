import { fileURLToPath } from 'node:url';

export interface CallSite {
  readonly file: string;
  readonly line: number;
  readonly column: number;
}

const STACK_FRAME = /at .*?\(?(?<file>[^()\s]+):(?<line>\d+):(?<column>\d+)\)?$/;

/** Stack frames for a `file://` URL loaded through tsx's `tsImport` carry a
 * `?tsx-namespace=<uuid>` query suffix. Strip it and convert to a plain filesystem path so
 * callers can `readFile` it directly. */
function toPlainPath(file: string): string {
  const withoutQuery = file.split('?')[0] ?? file;
  if (withoutQuery.startsWith('file://')) {
    try {
      return fileURLToPath(withoutQuery);
    } catch {
      return withoutQuery;
    }
  }
  return withoutQuery;
}

/** Reads the flow.ts line that invoked `step(...)` off a fresh `Error().stack`, for
 * step.txt in the failure bundle (Section 9.5). Must be called directly from within
 * `step()`'s body — best-effort, returns null rather than throwing if the stack doesn't
 * parse. */
export function captureCallSite(): CallSite | null {
  const stack = new Error().stack;
  if (stack === undefined) return null;
  const lines = stack.split('\n');
  // lines[0] = "Error", lines[1] = captureCallSite's own frame, lines[2] = step()'s frame
  // (its immediate caller), lines[3] = flow.ts's frame (the line that called step(...)).
  const frame = lines[3];
  if (frame === undefined) return null;
  const match = STACK_FRAME.exec(frame);
  const groups = match?.groups;
  if (groups?.file === undefined || groups.line === undefined || groups.column === undefined) {
    return null;
  }
  return {
    file: toPlainPath(groups.file),
    line: Number(groups.line),
    column: Number(groups.column),
  };
}
