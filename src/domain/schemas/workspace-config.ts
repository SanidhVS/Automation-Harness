import { z } from 'zod';

/** `rerun.config.json` — workspace-wide settings (Section 8.1). */
export const workspaceConfigSchema = z
  .object({
    $schema: z.string().optional(),
    version: z.literal(1),
    outputDir: z.string().min(1).default('output'),
    keepRuns: z.number().int().positive().default(20),
    trace: z.enum(['on-failure', 'off']).default('on-failure'),
    profilesDir: z.string().nullable().default(null),
  })
  .strict();

export type WorkspaceConfig = z.infer<typeof workspaceConfigSchema>;
