import type { FlowLoader } from '../../application/ports/flow-loader.js';
import { isDefinedFlow, type DefinedFlow } from '../../sdk/define-flow.js';
import { ValidationError } from '../../domain/errors.js';
import { PRODUCT_NAME, PRODUCT_DISPLAY_NAME } from '../../shared/product.js';

type TsImportFn = (specifier: string, parentUrl: string) => Promise<unknown>;

/** Resolves `tsx`'s programmatic ESM API (`tsImport`), falling back to `jiti` only if that
 * API is unavailable in the installed `tsx` version (Section 5.2). */
async function resolveTsImport(): Promise<TsImportFn | null> {
  try {
    const api: unknown = await import('tsx/esm/api');
    const candidate = (api as { tsImport?: unknown }).tsImport;
    return typeof candidate === 'function' ? (candidate as TsImportFn) : null;
  } catch {
    return null;
  }
}

async function importModule(flowPath: string): Promise<unknown> {
  const tsImport = await resolveTsImport();
  if (tsImport !== null) {
    return tsImport(flowPath, import.meta.url);
  }
  const { createJiti } = await import('jiti');
  return createJiti(import.meta.url).import(flowPath);
}

/** Loads `flow.ts` via `tsx`'s `tsImport` (or `jiti` if that API is missing) and rejects
 * anything whose default export isn't a `defineFlow()` result. */
export class TsxFlowLoader implements FlowLoader {
  async load(flowPath: string): Promise<DefinedFlow> {
    const mod = await importModule(flowPath);
    const candidate = (mod as { default?: unknown }).default;
    if (!isDefinedFlow(candidate)) {
      throw new ValidationError(
        `${flowPath}: default export is not a ${PRODUCT_DISPLAY_NAME} flow.`,
        {
          hint: `Wrap your flow function with defineFlow() from "${PRODUCT_NAME}".`,
        },
      );
    }
    return candidate;
  }
}
