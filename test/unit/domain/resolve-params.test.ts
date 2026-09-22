import { describe, expect, it } from 'vitest';
import { resolveParams } from '../../../src/domain/params/resolve-params.js';
import type { ManifestParam } from '../../../src/domain/schemas/manifest.js';

const params: ManifestParam[] = [
  { name: 'keywords', type: 'string', required: true, description: 'Search keywords' },
  { name: 'location', type: 'string', required: false, default: 'Remote', description: 'Where' },
  {
    name: 'count',
    type: 'number',
    required: false,
    default: 25,
    min: 1,
    max: 500,
    description: 'How many',
  },
  {
    name: 'sort',
    type: 'enum',
    required: false,
    options: ['recent', 'relevant'],
    default: 'recent',
    description: 'Order',
  },
  { name: 'archived', type: 'boolean', required: false, default: false, description: 'Archived' },
];

describe('resolveParams', () => {
  it('applies defaults when nothing is overridden', () => {
    const result = resolveParams(params, { keywords: '.NET developer' });
    expect(result.values).toEqual({
      keywords: '.NET developer',
      location: 'Remote',
      count: 25,
      sort: 'recent',
      archived: false,
    });
    expect(result.missing).toEqual([]);
    expect(result.issues).toEqual([]);
  });

  it('coerces string overrides from the CLI', () => {
    const result = resolveParams(params, {
      keywords: 'nurse',
      count: '10',
      archived: 'yes',
      sort: 'relevant',
    });
    expect(result.values.count).toBe(10);
    expect(result.values.archived).toBe(true);
    expect(result.values.sort).toBe('relevant');
  });

  it('reports a missing required param with no override and no default', () => {
    const result = resolveParams(params, {});
    expect(result.missing).toEqual(['keywords']);
  });

  it('reports an out-of-range number', () => {
    const result = resolveParams(params, { keywords: 'x', count: '1000' });
    expect(result.issues).toEqual([{ param: 'count', message: 'must be <= 500' }]);
  });

  it('reports an invalid enum value', () => {
    const result = resolveParams(params, { keywords: 'x', sort: 'newest' });
    expect(result.issues).toEqual([{ param: 'sort', message: 'must be one of: recent, relevant' }]);
  });

  it('reports an unparseable boolean', () => {
    const result = resolveParams(params, { keywords: 'x', archived: 'maybe' });
    expect(result.issues).toEqual([
      { param: 'archived', message: 'must be true/false/yes/no/1/0' },
    ]);
  });
});
