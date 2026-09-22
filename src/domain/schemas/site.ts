import { z } from 'zod';
import { httpUrl, kebabCaseName } from './common.js';

const roleIndicator = z
  .object({
    type: z.literal('role'),
    role: z.string().min(1),
    name: z.string().min(1),
  })
  .strict();

const textIndicator = z
  .object({
    type: z.literal('text'),
    text: z.string().min(1),
  })
  .strict();

const urlNotMatchingIndicator = z
  .object({
    type: z.literal('urlNotMatching'),
    pattern: z.string().min(1),
  })
  .strict();

export const loggedInIndicatorSchema = z.discriminatedUnion('type', [
  roleIndicator,
  textIndicator,
  urlNotMatchingIndicator,
]);

export type LoggedInIndicator = z.infer<typeof loggedInIndicatorSchema>;

/** `sites/<site>.json` (Section 8.2). */
export const siteSchema = z
  .object({
    $schema: z.string().optional(),
    version: z.literal(1),
    name: kebabCaseName,
    baseUrl: httpUrl,
    loginUrl: httpUrl.optional(),
    session: z
      .object({
        loggedInCheck: z
          .object({
            url: httpUrl,
            indicator: loggedInIndicatorSchema,
          })
          .strict()
          .optional(),
      })
      .strict()
      .default({}),
    browser: z
      .object({
        headless: z.boolean().default(false),
        channel: z.enum(['chrome']).optional(),
      })
      .strict()
      .default({ headless: false }),
    pacing: z
      .object({
        minDelayMs: z.number().int().nonnegative().default(400),
        maxDelayMs: z.number().int().nonnegative().default(1200),
      })
      .strict()
      .refine((p) => p.minDelayMs <= p.maxDelayMs, {
        message: 'minDelayMs must be less than or equal to maxDelayMs',
      })
      .default({ minDelayMs: 400, maxDelayMs: 1200 }),
  })
  .strict();

export type Site = z.infer<typeof siteSchema>;
