import type { FlowContext } from './types.js';
import { PRODUCT_NAME } from '../shared/product.js';

export type FlowFn<P> = (ctx: FlowContext<P>) => Promise<void>;

// A global (registry) symbol, not a local one: the runner loads flow.ts through tsx's
// isolated tsImport() namespace, which re-evaluates this module separately from the
// runner's own import of it. Symbol(...) would mint a fresh, distinct symbol on each
// evaluation and the brand check would always fail; Symbol.for() returns the same symbol
// value everywhere in the process.
const FLOW_BRAND: unique symbol = Symbol.for(`${PRODUCT_NAME}.flow`);

export interface DefinedFlow<P = unknown> {
  readonly [FLOW_BRAND]: true;
  readonly run: FlowFn<P>;
}

/** Wraps a flow function so the runner can recognize it and reject anything else
 * `flow.ts` might default-export (Section 10.1). */
export function defineFlow<P = Record<string, never>>(fn: FlowFn<P>): DefinedFlow<P> {
  return { [FLOW_BRAND]: true, run: fn };
}

export function isDefinedFlow(value: unknown): value is DefinedFlow {
  return (
    typeof value === 'object' &&
    value !== null &&
    FLOW_BRAND in value &&
    (value as Record<symbol, unknown>)[FLOW_BRAND] === true
  );
}
