/** Human-facing output. Never prints decoration (banners, spinners) — commands stay
 * token-lean by default and add detail only when `verbose` is on (Section 3.3). */
export interface Logger {
  info(message: string): void;
  warn(message: string): void;
  /** Printed only when the logger was constructed with `verbose: true`. */
  debug(message: string): void;
  /** One line of cause, one line of hint; the stack only when `verbose` is on. */
  error(error: unknown): void;
}
