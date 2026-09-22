import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { parseWithSchema } from '../../../src/domain/validation.js';

const schema = z.object({ name: z.string().min(1), age: z.number().int() });

describe('parseWithSchema', () => {
  it('returns the parsed value on success', () => {
    const result = parseWithSchema(schema, { name: 'a', age: 1 });
    expect(result).toEqual({ ok: true, value: { name: 'a', age: 1 } });
  });

  it('collects every issue with its path, not just the first', () => {
    const result = parseWithSchema(schema, { name: '', age: 'x' });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected failure');
    expect(result.issues).toHaveLength(2);
    expect(result.issues[0]).toMatch(/^name:/);
    expect(result.issues[1]).toMatch(/^age:/);
  });

  it('prefixes root-level issues with no path', () => {
    const result = parseWithSchema(z.string(), 42);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected failure');
    expect(result.issues[0]).not.toMatch(/^:/);
  });
});
