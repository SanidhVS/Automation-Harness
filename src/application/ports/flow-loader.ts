import type { DefinedFlow } from '../../sdk/define-flow.js';

/** Loads and validates one `flow.ts` file at runtime (Section 5.2, 10.1). */
export interface FlowLoader {
  load(flowPath: string): Promise<DefinedFlow>;
}
