import type { Clock } from '../application/ports/clock.js';

/** The real wall clock — the production `Clock` adapter. */
export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}
