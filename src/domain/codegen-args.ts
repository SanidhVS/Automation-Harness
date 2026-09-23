/** Builds `playwright codegen`'s argument list for `rerun record` (Section 13): records
 * into the site's own profile via `--user-data-dir`, preferring the Chrome channel when the
 * site is configured for it. Pure — no process spawning. */
export function buildCodegenArgs(
  profileDir: string,
  outputFile: string,
  url: string,
  preferChrome: boolean,
): readonly string[] {
  const args = ['--user-data-dir', profileDir, '-o', outputFile];
  if (preferChrome) args.push('--channel', 'chrome');
  args.push(url);
  return args;
}
