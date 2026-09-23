import type { ValidationResult } from '../../domain/validation.js';
import type { WorkspaceConfig } from '../../domain/schemas/workspace-config.js';
import type { Site } from '../../domain/schemas/site.js';
import type { Manifest } from '../../domain/schemas/manifest.js';

/** Reads and writes the JSON files that make up a user workspace (Section 7.2), validating
 * every read against its schema and reporting every issue rather than the first. */
export interface WorkspaceStore {
  /** Walks up from `startDir` looking for `rerun.config.json`. Null if none is found. */
  findRoot(startDir: string): Promise<string | null>;

  readConfig(root: string): Promise<ValidationResult<WorkspaceConfig>>;

  listSites(root: string): Promise<readonly string[]>;
  /** Null when the site file does not exist; a validation result otherwise. */
  readSite(root: string, name: string): Promise<ValidationResult<Site> | null>;
  writeSite(root: string, site: Site): Promise<void>;
  removeSite(root: string, name: string): Promise<void>;

  listAutomations(root: string): Promise<readonly string[]>;
  /** Null when the manifest does not exist; a validation result otherwise. */
  readManifest(root: string, name: string): Promise<ValidationResult<Manifest> | null>;
  writeManifest(root: string, manifest: Manifest): Promise<void>;
}
