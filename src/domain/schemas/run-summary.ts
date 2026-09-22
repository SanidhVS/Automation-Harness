import { z } from 'zod';
import { kebabCaseName } from './common.js';

const paramValue = z.union([z.string(), z.number(), z.boolean()]);

/** `output/<automation>/<timestamp>/run.json` (Section 8.5). */
export const runSummarySchema = z
  .object({
    automation: kebabCaseName,
    site: kebabCaseName,
    status: z.enum(['succeeded', 'failed', 'login-required']),
    startedAt: z.iso.datetime(),
    finishedAt: z.iso.datetime(),
    durationMs: z.number().int().nonnegative(),
    params: z.record(z.string(), paramValue),
    rowCount: z.number().int().nonnegative(),
    outputFile: z.string().nullable(),
    failedStep: z.string().nullable(),
    error: z.string().nullable(),
  })
  .strict();

export type RunSummary = z.infer<typeof runSummarySchema>;
