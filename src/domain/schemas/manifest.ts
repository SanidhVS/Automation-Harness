import { z } from 'zod';
import { kebabCaseName } from './common.js';

const paramBase = {
  name: z.string().min(1),
  required: z.boolean().default(false),
  description: z.string().min(1),
};

const stringParam = z
  .object({ ...paramBase, type: z.literal('string'), default: z.string().optional() })
  .strict();

const numberParam = z
  .object({
    ...paramBase,
    type: z.literal('number'),
    default: z.number().optional(),
    min: z.number().optional(),
    max: z.number().optional(),
  })
  .strict();

const booleanParam = z
  .object({ ...paramBase, type: z.literal('boolean'), default: z.boolean().optional() })
  .strict();

const enumParam = z
  .object({
    ...paramBase,
    type: z.literal('enum'),
    options: z.array(z.string().min(1)).min(1),
    default: z.string().optional(),
  })
  .strict();

const paramSchema = z
  .discriminatedUnion('type', [stringParam, numberParam, booleanParam, enumParam])
  .superRefine((param, ctx) => {
    if (param.required && param.default !== undefined) {
      ctx.addIssue({
        code: 'custom',
        message: `param "${param.name}" cannot be both required and have a default`,
        path: ['default'],
      });
    }
    if (param.type === 'number' && param.min !== undefined && param.max !== undefined) {
      if (param.min > param.max) {
        ctx.addIssue({
          code: 'custom',
          message: `param "${param.name}": min must be less than or equal to max`,
          path: ['min'],
        });
      }
    }
    if (param.type === 'enum' && param.default !== undefined) {
      if (!param.options.includes(param.default)) {
        ctx.addIssue({
          code: 'custom',
          message: `param "${param.name}": default must be one of the declared options`,
          path: ['default'],
        });
      }
    }
  });

export type ManifestParam = z.infer<typeof paramSchema>;

/** `automations/<name>/manifest.json` (Section 8.3). */
export const manifestSchema = z
  .object({
    $schema: z.string().optional(),
    version: z.literal(1),
    name: kebabCaseName,
    description: z.string().min(1),
    site: kebabCaseName,
    params: z.array(paramSchema).default([]),
    output: z
      .object({
        format: z.enum(['csv', 'json', 'none']),
      })
      .strict(),
    browser: z
      .object({
        headless: z.boolean().nullable().default(null),
      })
      .strict()
      .default({ headless: null }),
  })
  .strict();

export type Manifest = z.infer<typeof manifestSchema>;
