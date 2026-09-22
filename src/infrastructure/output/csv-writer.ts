import { stringify } from 'csv-stringify/sync';

export type CsvValue = string | number | boolean | null;
export type CsvRow = Record<string, CsvValue>;

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
