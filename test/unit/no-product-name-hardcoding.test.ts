import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC_DIR = fileURLToPath(new URL('../../src', import.meta.url));
const EXCLUDED_FILES = new Set(['product.ts']);

async function listTsFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listTsFiles(path)));
    } else if (entry.name.endsWith('.ts') && !EXCLUDED_FILES.has(entry.name)) {
      files.push(path);
    }
  }
  return files;
}

const STRING_LITERAL = /(["'`])(?:(?!\1)[^\\]|\\.)*\1/g;

/** Strips `//` and `/* ... *‍/` comments (including JSDoc's backtick code-spans, which
 * would otherwise look like string literals) — a doc comment mentioning the product name
 * is fine; renaming just makes it slightly stale, not incorrect. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

/** Extracts the contents of every quoted/template string literal in real code —
 * deliberately ignoring identifiers (a class named `RerunError` isn't a user-facing
 * message). */
function extractStringLiterals(source: string): string[] {
  return [...stripComments(source).matchAll(STRING_LITERAL)].map((m) => m[0]);
}

/** Guards Section 6.4: renaming the product must touch only package.json and
 * src/shared/product.ts. Every other file's string literals must route the product name
 * through PRODUCT_NAME/PRODUCT_DISPLAY_NAME rather than hardcoding "rerun"/"Rerun". */
describe('no hardcoded product name outside product.ts', () => {
  it('finds no literal "rerun" (case-insensitive) inside string literals outside product.ts', async () => {
    const files = await listTsFiles(SRC_DIR);
    const offenders: string[] = [];
    for (const file of files) {
      const literals = extractStringLiterals(await readFile(file, 'utf8'));
      if (literals.some((literal) => /rerun/i.test(literal))) {
        offenders.push(file.replace(`${SRC_DIR}/`, ''));
      }
    }
    expect(offenders).toEqual([]);
  });
});
