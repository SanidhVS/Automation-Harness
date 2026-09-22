/** Seam over the wall-clock so timestamped paths and durations are testable. */
export interface Clock {
  now(): Date;
}
