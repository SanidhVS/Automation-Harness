import type { WorkspaceStore } from './ports/workspace-store.js';
import { siteSchema, type Site } from '../domain/schemas/site.js';
import { parseWithSchema } from '../domain/validation.js';
import { ValidationError } from '../domain/errors.js';

export interface AddSiteInput {
  readonly name: string;
  readonly baseUrl: string;
  readonly loginUrl?: string;
  readonly headless: boolean;
}

/** Validates and writes a new `sites/<name>.json` — `rerun site add` (Section 13). */
export async function addSite(
  store: WorkspaceStore,
  root: string,
  input: AddSiteInput,
): Promise<Site> {
  const candidate = {
    version: 1,
    name: input.name,
    baseUrl: input.baseUrl,
    ...(input.loginUrl !== undefined ? { loginUrl: input.loginUrl } : {}),
    browser: { headless: input.headless },
  };
  const result = parseWithSchema(siteSchema, candidate);
  if (!result.ok) {
    throw new ValidationError('Invalid site.', { hint: result.issues.join('; ') });
  }
  await store.writeSite(root, result.value);
  return result.value;
}
