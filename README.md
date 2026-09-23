# Rerun

**Teach it once, run it forever.**

Rerun is a harness-agnostic, local-first toolkit that turns a one-time AI-assisted browser
session into a reusable, deterministic automation that runs with **zero AI tokens**
afterwards.

## The lifecycle

1. **Author (uses AI once).** Inside an AI coding harness (Claude Code, GitHub Copilot, or
   any agent that can run shell commands and edit files), describe a task in plain
   language — "go to this job site, search for a keyword, collect the first 50 results."
   The harness, guided by instructions Rerun installs, interviews you, explores the site
   cheaply, and writes an automation.
2. **Compile.** The output is a plain Playwright TypeScript flow (`flow.ts`) plus a JSON
   manifest (`manifest.json`) describing its parameters. No proprietary DSL.
3. **Replay (zero tokens).** Run it from the CLI (`rerun run job-search --param
keywords=".NET developer"`) or by double-clicking its generated launcher. No AI is
   involved.
4. **Fix (uses AI only on failure, only when you ask).** When a site changes and a run
   fails, Rerun saves a compact failure bundle. Ask the harness to fix it, and the AI reads
   only that small bundle and edits only the broken step.

Rerun is **generic**: it contains no knowledge of any specific website, company, or
business. Sites are user-defined data.

## Install (from source)

Rerun is not published to npm yet, and the npm name `rerun` belongs to an unrelated
package, so **`npx rerun ...` from a machine without a local install runs the wrong
tool.** Install from a clone instead. You need Node.js 20+ and git.

```sh
git clone <this repo> rerun && cd rerun
npm install
npm run build
npm link                 # puts the `rerun` command on your PATH
```

Then create a workspace anywhere (outside the repo):

```sh
mkdir my-automations && cd my-automations
rerun init --link        # scaffolds the workspace, links rerun in, installs Chromium
```

`--link` is required until Rerun is published; without it `init` tries `npm install`,
which can't find this package on the registry.

**Windows:** run the same commands in PowerShell or Command Prompt. `npm link` puts
`rerun` in `%APPDATA%\npm`, which the Node.js installer already adds to PATH.
**macOS:** if `rerun` is "not found" after `npm link`, add `$(npm prefix -g)/bin` to your
PATH (some Node installs, e.g. version managers, use a non-default prefix).

## Quick start

```sh
rerun site add jobs-example --base-url https://jobs.example.com
rerun site login jobs-example        # opens a real browser; you log in yourself
rerun inspect jobs-example --url https://jobs.example.com/feed --interactive-only
rerun site set-check jobs-example --url https://jobs.example.com/feed --role button --name "Account menu"
rerun new job-search --site jobs-example
# edit automations/job-search/manifest.json and flow.ts, or use the AI skill below
rerun run job-search --param count=3    # verify with a small value first
```

Or let an AI write it: in Claude Code run `/rerun-automate`, in GitHub Copilot `/automate`,
and describe what you want. Any other agent can follow `AGENTS.md`.

Browser profiles (your saved logins) are stored per **site name** in your OS app-data
folder, not in the workspace. Two workspaces that both define a site called `shop` share
one login.

Once an automation exists, anyone can run it without touching AI at all — from the CLI or
by double-clicking `automations/<name>/run.sh` (macOS/Linux) or `run.cmd` (Windows).

## Why it saves tokens

Token cost is the whole point. Every piece of the design reflects it:

- **The runner never calls an LLM.** No AI SDK is a dependency of the published package —
  enforced by an automated guard test.
- **Authoring tools are cheap, in order:** a human demonstration via `rerun record` (near
  zero tokens) beats a pruned ARIA snapshot via `rerun inspect` (low tokens) beats
  Playwright MCP in snapshot mode (last resort, still text-only — never screenshots).
- **CLI output is terse by default.** No banners, no spinners outside a TTY, `--verbose`
  for detail, `--json` on every command for exact machine parsing.
- **Fixing a broken automation reads three small text files** — `error.txt`, `step.txt`,
  `snapshot.txt` — never the screenshot or trace, which exist for humans.

## Sessions and security

Rerun never asks for, stores, types, or logs a password or one-time code. You log in
yourself, once, in a real browser window. That window has no automation attached, so
sign-in pages that block automated browsers (Google, for one) work normally; set
`"channel": "chrome"` in the site file to log in with your installed Google Chrome. Rerun
reuses the resulting **dedicated** browser
profile (never your everyday Chrome profile, never attached via CDP) stored outside the
workspace in your OS's app-data directory. Only one process can use a profile at a time —
Rerun locks it and recovers automatically from a stale lock left by a crashed process.

## CLI reference

| Command                                                                    | What it does                                                                        |
| -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `rerun init [dir]`                                                         | Creates a workspace. `--link`, `--force`, `--skip-install`, `--update-agent-files`. |
| `rerun site add <name> --base-url <url>`                                   | Registers a site.                                                                   |
| `rerun site login <name>`                                                  | Opens a headed browser for you to log in.                                           |
| `rerun site set-check <name> --url <url> --role <r> --name <n>`            | Configures and tests the logged-in indicator (also `--text`, `--url-not-matching`). |
| `rerun site list` / `rerun site remove <name>`                             | Lists or removes a site.                                                            |
| `rerun new <automation> --site <site>`                                     | Scaffolds an automation.                                                            |
| `rerun run <automation> [--param k=v]... [--headed\|--headless]`           | Runs one.                                                                           |
| `rerun list`                                                               | Lists automations and their last run status.                                        |
| `rerun inspect <site> [--url u] [--scope s] [--interactive-only] [--wait]` | Prints a pruned ARIA snapshot.                                                      |
| `rerun record <site> --name <automation>`                                  | Opens Playwright's recorder against the site's own profile.                         |
| `rerun fix <automation> [--run <timestamp>]`                               | Points at the failure bundle for a failed run.                                      |
| `rerun doctor`                                                             | Checks the environment and workspace.                                               |

Every command supports `--json`, `--verbose`, `--no-input`, and `--cwd <path>`.

## SDK reference

A flow is a plain async function wrapped in `defineFlow`:

```ts
import { defineFlow } from 'rerun';

export default defineFlow<{ keywords: string; count: number }>(
  async ({ page, params, step, output, helpers }) => {
    await step('Search', async () => {
      await page.goto('https://jobs.example.com/jobs');
      await page.getByRole('textbox', { name: 'Search jobs' }).fill(params.keywords);
    });

    await step('Collect', async () => {
      const rows = await helpers.collectUntil({
        count: params.count,
        extract: async () => [], // read visible rows
        next: async () => helpers.clickIfVisible(page.getByRole('button', { name: 'Next' })),
      });
      output.addRows(rows);
    });
  },
);
```

`FlowContext` gives you `page`/`context` (Playwright), `params` (validated, typed),
`step`, `output` (`addRow`/`addRows`/`setJson`/`rowCount`/`saveFile`), `helpers`
(`pause`, `clickIfVisible`, `dismissIfVisible`, `collectUntil`, `scrollToLoadMore`,
`textOf`, `attrOf`, `assert`), `checkpoint(message)` for CAPTCHA/MFA pauses, `log`, and
`runDir`.

## Responsible use

Some websites' terms of service prohibit automation. You are responsible for which sites
you automate and how.

## Troubleshooting

Run `rerun doctor` first — it checks Node's version, Chromium/Chrome availability, the
workspace's JSON files, profile-directory permissions, and stale locks. A run that exits
saying login is required means `rerun site login <site>` — sessions expire; that's normal.

## Contributing

See [`docs/architecture.md`](docs/architecture.md) for the layered architecture (domain →
application → infrastructure/sdk → cli) and the rules enforced by lint. In short: `domain`
has zero dependencies, `application` depends only on `domain` and its own port interfaces
plus the `sdk`, `infrastructure` implements those ports, and `cli` is the composition root
that wires concrete adapters into use cases.

```sh
npm install
npm run build
npm run lint
npm test              # unit + integration + e2e, all against a local fixture site
```
