/** Serializes a run's JSON output document (`output.setJson`) for writing to a results file. */
export function toJsonOutput(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}
