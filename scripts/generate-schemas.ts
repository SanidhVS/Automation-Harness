import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { workspaceConfigSchema } from '../src/domain/schemas/workspace-config.js';
import { siteSchema } from '../src/domain/schemas/site.js';
import { manifestSchema } from '../src/domain/schemas/manifest.js';
import { runSummarySchema } from '../src/domain/schemas/run-summary.js';

const schemasDir = fileURLToPath(new URL('../schemas', import.meta.url));

const targets: ReadonlyArray<readonly [string, z.core.$ZodType]> = [
  ['workspace-config.schema.json', workspaceConfigSchema],
  ['site.schema.json', siteSchema],
  ['manifest.schema.json', manifestSchema],
  ['run-summary.schema.json', runSummarySchema],
];

for (const [fileName, schema] of targets) {
  const jsonSchema = z.toJSONSchema(schema);
  writeFileSync(`${schemasDir}/${fileName}`, `${JSON.stringify(jsonSchema, null, 2)}\n`);
  console.log(`wrote schemas/${fileName}`);
}
