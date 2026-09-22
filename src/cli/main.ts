#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Command } from 'commander';
import { PRODUCT_NAME, PRODUCT_DISPLAY_NAME } from '../shared/product.js';

const packageJsonPath = fileURLToPath(new URL('../../package.json', import.meta.url));
const { version } = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as { version: string };

const program = new Command();
program.name(PRODUCT_NAME).description(PRODUCT_DISPLAY_NAME).version(version);

program.parse();
