/** Given the run folder names that exist for one automation (sortable lexically, oldest
 * first, since they are `YYYY-MM-DD_HH-mm-ss`) and how many to keep, returns the names to
 * delete. Pure — the caller performs the actual filesystem deletion. */
export function selectRunsToDelete(
  existingRunFolders: readonly string[],
  keepRuns: number,
): readonly string[] {
  if (keepRuns <= 0) return [];
  const sorted = [...existingRunFolders].sort();
  const excess = sorted.length - keepRuns;
  return excess > 0 ? sorted.slice(0, excess) : [];
}
