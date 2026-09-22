import { describe, expect, it } from 'vitest';
import { rowsToCsv } from '../../../src/infrastructure/output/csv-writer.js';

describe('rowsToCsv', () => {
  it('writes headers as the union of keys in first-seen order', () => {
    const csv = rowsToCsv([
      { title: 'A', company: 'Acme' },
      { title: 'B', company: 'Acme', location: 'Remote' },
    ]);
    expect(csv.split('\n')[0]).toBe('title,company,location');
  });

  it('quotes fields containing commas and quotes per RFC 4180', () => {
    const csv = rowsToCsv([{ a: 'x,y', b: 'say "hi"' }]);
    expect(csv).toContain('"x,y"');
    expect(csv).toContain('"say ""hi"""');
  });

  it('renders null as an empty field and booleans as true/false', () => {
    const csv = rowsToCsv([{ a: null, b: true, c: false }]);
    const dataLine = csv.split('\n')[1];
    expect(dataLine).toBe(',true,false');
  });

  it('returns just the header line for no rows', () => {
    expect(rowsToCsv([])).toBe('\n');
  });
});
