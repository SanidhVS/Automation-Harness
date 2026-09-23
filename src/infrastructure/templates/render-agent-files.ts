import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { renderTemplateFile, templatesDir } from './render-template.js';
import { PRODUCT_NAME, PRODUCT_DISPLAY_NAME } from '../../shared/product.js';

export interface RenderedAgentFiles {
  readonly skillPath: string;
  readonly promptPath: string;
  readonly agentsPath: string;
}

const DESCRIPTION = `Author or fix a ${PRODUCT_DISPLAY_NAME} browser automation that runs later with zero AI tokens.`;

/** Renders `templates/agent/automate.md` (the single source of truth, Section 11.1) to the
 * three harness locations: a Claude Code skill, a GitHub Copilot prompt file, and a short
 * `AGENTS.md` pointer for any other harness. Safe to call again — `--update-agent-files`
 * just re-renders these three files and touches nothing else. */
export async function renderAgentFiles(workspaceRoot: string): Promise<RenderedAgentFiles> {
  const body = await renderTemplateFile(join(templatesDir(), 'agent', 'automate.md'), {
    PRODUCT_NAME,
    PRODUCT_DISPLAY_NAME,
  });

  const skillPath = join(
    workspaceRoot,
    '.claude',
    'skills',
    `${PRODUCT_NAME}-automate`,
    'SKILL.md',
  );
  const skillContent = `---\nname: ${PRODUCT_NAME}-automate\ndescription: ${DESCRIPTION}\n---\n\n${body}`;

  const promptPath = join(workspaceRoot, '.github', 'prompts', 'automate.prompt.md');
  const promptContent = `---\ndescription: ${DESCRIPTION}\n---\n\n${body}`;

  const agentsPath = join(workspaceRoot, 'AGENTS.md');
  const agentsContent = `# ${PRODUCT_DISPLAY_NAME} automations

This workspace uses ${PRODUCT_DISPLAY_NAME} to turn a one-time AI-assisted session into a
reusable browser automation that runs with zero AI tokens afterwards.

To author or fix an automation, follow the full instructions in
\`.claude/skills/${PRODUCT_NAME}-automate/SKILL.md\`.
`;

  await mkdir(dirname(skillPath), { recursive: true });
  await mkdir(dirname(promptPath), { recursive: true });
  await writeFile(skillPath, skillContent, 'utf8');
  await writeFile(promptPath, promptContent, 'utf8');
  await writeFile(agentsPath, agentsContent, 'utf8');

  return { skillPath, promptPath, agentsPath };
}
