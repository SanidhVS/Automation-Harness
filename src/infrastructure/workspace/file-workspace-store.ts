import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, parse } from 'node:path';
import type { WorkspaceStore } from '../../application/ports/workspace-store.js';
import { parseWithSchema, type ValidationResult } from '../../domain/validation.js';
import {
  workspaceConfigSchema,
  type WorkspaceConfig,
} from '../../domain/schemas/workspace-config.js';
import { siteSchema, type Site } from '../../domain/schemas/site.js';
import { manifestSchema, type Manifest } from '../../domain/schemas/manifest.js';

const CONFIG_FILE_NAME = 'rerun.config.json';

function parseJsonFile(raw: string): ValidationResult<unknown> {
  try {
    return { ok: true, value: JSON.parse(raw) as unknown };
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    return { ok: false, issues: [`invalid JSON: ${message}`] };
  }
}

async function readJsonFileOrNull(path: string): Promise<ValidationResult<unknown> | null> {
  let raw: string;
  try {
    raw = await readFile(path, 'utf8');
  } catch (cause) {
    if ((cause as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw cause;
  }
  return parseJsonFile(raw);
}

async function listDirNames(dir: string, filterSuffix?: string): Promise<readonly string[]> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (cause) {
    if ((cause as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw cause;
  }
  if (filterSuffix !== undefined) {
    return entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(filterSuffix))
      .map((entry) => entry.name.slice(0, -filterSuffix.length));
  }
  return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
}

async function writeJsonFile(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

/** Reads/writes workspace JSON files from the local filesystem. */
export class FileWorkspaceStore implements WorkspaceStore {
  findRoot(startDir: string): Promise<string | null> {
    let dir = startDir;
    for (;;) {
      if (existsSync(join(dir, CONFIG_FILE_NAME))) return Promise.resolve(dir);
      const parent = dirname(dir);
      if (parent === dir || parse(dir).root === dir) return Promise.resolve(null);
      dir = parent;
    }
  }

  async readConfig(root: string): Promise<ValidationResult<WorkspaceConfig>> {
    const parsed = await readJsonFileOrNull(join(root, CONFIG_FILE_NAME));
    if (parsed === null) return { ok: false, issues: [`${CONFIG_FILE_NAME}: not found`] };
    if (!parsed.ok) return parsed;
    return parseWithSchema(workspaceConfigSchema, parsed.value);
  }

  async listSites(root: string): Promise<readonly string[]> {
    return listDirNames(join(root, 'sites'), '.json');
  }

  async readSite(root: string, name: string): Promise<ValidationResult<Site> | null> {
    const parsed = await readJsonFileOrNull(join(root, 'sites', `${name}.json`));
    if (parsed === null) return null;
    if (!parsed.ok) return parsed;
    return parseWithSchema(siteSchema, parsed.value);
  }

  async writeSite(root: string, site: Site): Promise<void> {
    await writeJsonFile(join(root, 'sites', `${site.name}.json`), site);
  }

  async listAutomations(root: string): Promise<readonly string[]> {
    return listDirNames(join(root, 'automations'));
  }

  async readManifest(root: string, name: string): Promise<ValidationResult<Manifest> | null> {
    const parsed = await readJsonFileOrNull(join(root, 'automations', name, 'manifest.json'));
    if (parsed === null) return null;
    if (!parsed.ok) return parsed;
    return parseWithSchema(manifestSchema, parsed.value);
  }

  async writeManifest(root: string, manifest: Manifest): Promise<void> {
    await writeJsonFile(join(root, 'automations', manifest.name, 'manifest.json'), manifest);
  }
}
