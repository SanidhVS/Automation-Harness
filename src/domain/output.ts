/** Shape of a flat output row, shared by the SDK's `output` API and the CSV writer
 * (Section 10.2, 10.3). */
export type CsvValue = string | number | boolean | null;
export type CsvRow = Record<string, CsvValue>;
