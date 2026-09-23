import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

/** The `templates/` directory shipped alongside `dist/` in the published package (Section
 * 12.1) — resolved relative to this module so it works whether running from `src/` (tsx,
 * during development) or `dist/` (the built CLI). */
export function templatesDir(): string {
  return fileURLToPath(new URL('../../../templates', import.meta.url));
}

/** Replaces every `{{KEY}}` placeholder with `vars[KEY]`. Throws if any placeholder has no
 * matching variable, so a template can never render with a `{{...}}` left in it. */
export function renderTemplateString(
  content: string,
  vars: Readonly<Record<string, string>>,
): string {
  return content.replace(/\{\{(\w+)\}\}/g, (whole, key: string) => {
    const value = vars[key];
    if (value === undefined) {
      throw new Error(`Template references unknown placeholder {{${key}}}.`);
    }
    return value;
  });
}

export async function renderTemplateFile(
  templatePath: string,
  vars: Readonly<Record<string, string>>,
): Promise<string> {
  const content = await readFile(templatePath, 'utf8');
  return renderTemplateString(content, vars);
}
