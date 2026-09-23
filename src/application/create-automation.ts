import type { WorkspaceStore } from './ports/workspace-store.js';
import type { Manifest } from '../domain/schemas/manifest.js';
import { ValidationError } from '../domain/errors.js';

export interface CreateAutomationDeps {
  readonly store: WorkspaceStore;
  renderTemplate(templateRelativePath: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  makeExecutable(path: string): Promise<void>;
}

/** Scaffolds `automations/<name>/`: manifest.json, flow.ts, and launchers — `rerun new`
 * (Section 13). Template rendering is injected rather than done here, since reading
 * template files is infrastructure I/O this application-layer file can't do directly. */
export async function createAutomation(
  deps: CreateAutomationDeps,
  root: string,
  automationName: string,
  siteName: string,
): Promise<void> {
  const existing = await deps.store.readManifest(root, automationName);
  if (existing !== null) {
    throw new ValidationError(`Automation "${automationName}" already exists.`);
  }

  const manifest: Manifest = {
    version: 1,
    name: automationName,
    description: 'TODO: describe what this automation does.',
    site: siteName,
    params: [],
    output: { format: 'csv' },
    browser: { headless: null },
  };
  await deps.store.writeManifest(root, manifest);

  const dir = `${root}/automations/${automationName}`;
  await deps.writeFile(`${dir}/flow.ts`, await deps.renderTemplate('automation/flow.ts'));
  await deps.writeFile(`${dir}/run.cmd`, await deps.renderTemplate('launchers/run.cmd'));
  const runShPath = `${dir}/run.sh`;
  await deps.writeFile(runShPath, await deps.renderTemplate('launchers/run.sh'));
  await deps.makeExecutable(runShPath);
}
