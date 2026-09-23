import type { WorkspaceStore } from './ports/workspace-store.js';
import type { Manifest } from '../domain/schemas/manifest.js';
import { ValidationError } from '../domain/errors.js';
import { PRODUCT_NAME } from '../shared/product.js';

export interface CreateAutomationDeps {
  readonly store: WorkspaceStore;
  writeFile(path: string, content: string): Promise<void>;
  makeExecutable(path: string): Promise<void>;
}

function flowTemplate(): string {
  return `import { defineFlow } from '${PRODUCT_NAME}';

interface Params {
  // Declare your params here, matching manifest.json.
}

export default defineFlow<Params>(async ({ page, params, step, output, helpers, log }) => {
  await step('Open the site', async () => {
    await page.goto('https://example.com');
  });

  await step('Collect results', async () => {
    // helpers.collectUntil(...) for lists/pagination/infinite scroll; output.addRow(...)
    // or output.addRows(...) for CSV output, output.setJson(...) for JSON output.
  });

  await step('Verify', async () => {
    helpers.assert(output.rowCount > 0, 'Expected at least one result');
  });
});
`;
}

function runCmdTemplate(automationName: string): string {
  return `@echo off
setlocal
cd /d "%~dp0..\\.."
call npx ${PRODUCT_NAME} run ${automationName} %*
echo.
pause
`;
}

function runShTemplate(automationName: string): string {
  return `#!/usr/bin/env sh
cd "$(dirname "$0")/../.." || exit 1
npx ${PRODUCT_NAME} run ${automationName} "$@"
`;
}

/** Scaffolds `automations/<name>/`: manifest.json, flow.ts, and launchers — `rerun new`
 * (Section 13). */
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
  await deps.writeFile(`${dir}/flow.ts`, flowTemplate());
  await deps.writeFile(`${dir}/run.cmd`, runCmdTemplate(automationName));
  const runShPath = `${dir}/run.sh`;
  await deps.writeFile(runShPath, runShTemplate(automationName));
  await deps.makeExecutable(runShPath);
}
