import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const AI_SDK_PATTERNS = [
  /^@anthropic-ai\//,
  /^openai$/,
  /^@google\/generative-ai$/,
  /^ai$/,
  /^langchain/,
];

/** Guards P1 (Section 3.1): the runner must never call any LLM, so no AI SDK may appear as
 * a dependency of the published package. */
describe('package.json has no AI SDK dependency', () => {
  it('matches no known AI SDK package name in dependencies or devDependencies', async () => {
    const pkg = JSON.parse(
      await readFile(new URL('../../package.json', import.meta.url), 'utf8'),
    ) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const names = [
      ...Object.keys(pkg.dependencies ?? {}),
      ...Object.keys(pkg.devDependencies ?? {}),
    ];
    const offenders = names.filter((name) => AI_SDK_PATTERNS.some((pattern) => pattern.test(name)));
    expect(offenders).toEqual([]);
  });
});
