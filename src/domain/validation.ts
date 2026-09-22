import type { z } from 'zod';

export type ValidationResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly issues: readonly string[] };

/** Parses `data` against `schema`, returning every issue (path + message) rather than
 * throwing on the first one. Pure — the schema and data are the only inputs. */
export function parseWithSchema<T>(schema: z.ZodType<T>, data: unknown): ValidationResult<T> {
  const result = schema.safeParse(data);
  if (result.success) {
    return { ok: true, value: result.data };
  }
  const issues = result.error.issues.map((issue) => {
    const path = issue.path.join('.');
    return path.length > 0 ? `${path}: ${issue.message}` : issue.message;
  });
  return { ok: false, issues };
}
