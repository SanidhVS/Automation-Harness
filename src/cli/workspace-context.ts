import { FileWorkspaceStore } from '../infrastructure/workspace/file-workspace-store.js';
import { ConfigError, WorkspaceNotFoundError } from '../domain/errors.js';
import type { WorkspaceConfig } from '../domain/schemas/workspace-config.js';
import { PRODUCT_NAME } from '../shared/product.js';

export interface WorkspaceContext {
  readonly root: string;
  readonly config: WorkspaceConfig;
  readonly store: FileWorkspaceStore;
}

/** Walks up from `cwd` for `<product>.config.json` and loads it — shared by every command
 * that operates on a workspace. */
export async function loadWorkspace(cwd: string): Promise<WorkspaceContext> {
  const store = new FileWorkspaceStore();
  const root = await store.findRoot(cwd);
  if (root === null) {
    throw new WorkspaceNotFoundError(
      `No ${PRODUCT_NAME}.config.json found in this directory or above.`,
      { hint: `Run "${PRODUCT_NAME} init" to create a workspace.` },
    );
  }
  const result = await store.readConfig(root);
  if (!result.ok) {
    throw new ConfigError(`${PRODUCT_NAME}.config.json is invalid.`, result.issues);
  }
  return { root, config: result.value, store };
}
