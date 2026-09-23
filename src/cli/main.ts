#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Command } from 'commander';
import { PRODUCT_NAME, PRODUCT_DISPLAY_NAME } from '../shared/product.js';
import { registerInitCommand } from './commands/init.js';
import { registerSiteCommand } from './commands/site.js';
import { registerNewCommand } from './commands/new.js';
import { registerListCommand } from './commands/list.js';
import { registerRunCommand } from './commands/run.js';
import { registerInspectCommand } from './commands/inspect.js';
import { registerRecordCommand } from './commands/record.js';
import { registerFixCommand } from './commands/fix.js';
import { registerDoctorCommand } from './commands/doctor.js';

const packageJsonPath = fileURLToPath(new URL('../../package.json', import.meta.url));
const { version } = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as { version: string };

const program = new Command();
program
  .name(PRODUCT_NAME)
  .description(PRODUCT_DISPLAY_NAME)
  .version(version)
  .option('--json', 'machine-readable output', false)
  .option('--verbose', 'detailed output, including stack traces on error', false)
  .option('--no-input', 'never prompt interactively')
  .option('--cwd <path>', 'workspace directory (defaults to the current directory)', process.cwd());

registerInitCommand(program);
registerSiteCommand(program);
registerNewCommand(program);
registerListCommand(program);
registerRunCommand(program);
registerInspectCommand(program);
registerRecordCommand(program);
registerFixCommand(program);
registerDoctorCommand(program);

program.parse();
