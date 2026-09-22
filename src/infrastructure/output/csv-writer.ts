import { stringify } from 'csv-stringify/sync';
import type { CsvRow } from '../../domain/output.js';

export type { CsvRow, CsvValue } from '../../domain/output.js';

/** Serializes flat rows to RFC 4180 CSV. Columns are the union of keys across all rows, in
 * first-seen order — matching how `output.addRow` builds up columns in the flow SDK. */
export function rowsToCsv(rows: readonly CsvRow[]): string {
  const columns: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!seen.has(key)) {
        seen.add(key);
        columns.push(key);
      }
    }
  }
  return stringify([...rows], {
    columns,
    header: true,
    cast: { boolean: (v) => (v ? 'true' : 'false') },
  });
}
