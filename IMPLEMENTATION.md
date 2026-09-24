# Rerun: Implementation Plan

> **Audience:** an AI coding agent (Claude Code, running Sonnet) building this project from scratch.
> **Working name:** `Rerun` (CLI command `rerun`). The name is a placeholder. It must live in exactly one place (see Section 6.4) so renaming later is trivial.

---

## 0. How to use this document (read first, agent)

1. Read this entire document before writing any code. Every section contains requirements. Nothing here is optional unless it is explicitly marked "Out of scope" or "Future".
2. Execute the phases in Section 15 **in order**. Do not start a phase until the previous phase's acceptance criteria pass.
3. When a requirement is ambiguous or two requirements seem to conflict, **stop and ask the user**. Do not invent behavior silently.
4. Keep a running checklist of the Definition of Done (Section 16) and tick items as you finish them.
5. Be economical with your own tokens while building (Section 3.3). The product exists to save tokens; building it should not waste them.
6. If the repository is a git repository, make one commit at the end of each phase with a message like `phase 3: browser session management`. Never commit `.env` files or any secrets.

---

## 1. Product vision

**"Teach it once, run it forever."**

Rerun is a harness-agnostic, local-first toolkit that turns a one-time AI-assisted session into a reusable, deterministic browser automation that runs with **zero AI tokens** afterwards.

The lifecycle:

1. **Author (uses AI once):** A developer, inside an AI harness (Claude Code, GitHub Copilot, or any agent that can run shell commands and edit files), describes a task in plain language, for example: "Go to a job site, search jobs for a keyword and location, and collect the first N results." The harness, guided by instructions that Rerun installs, interviews the user, explores the site cheaply, and writes an automation.
2. **Compile:** The output is a plain Playwright TypeScript flow plus a JSON manifest describing its parameters. No proprietary DSL.
3. **Replay (zero tokens):** The user runs it from the CLI (`rerun run job-search --param keywords=".NET developer" --param count=50`) or by double-clicking a generated launcher. No AI is involved.
4. **Fix (uses AI only on failure, only when the user asks):** When a site changes and a run fails, Rerun saves a compact failure bundle. The user asks the harness to fix it, and the AI reads only that small bundle and edits only the broken step.

Rerun is **generic**. It contains no knowledge of any specific website, company, or business. Sites are user-defined data.

---

## 2. Core principles (non-negotiable)

| # | Principle | What it means in practice |
|---|---|---|
| P1 | **Zero runtime tokens** | The runner, the SDK, and generated flows must never call any LLM or AI API. Ever. There must be no AI SDK dependency in `package.json`. |
| P2 | **Token-lean authoring** | Every tool Rerun gives to the AI harness is designed to minimise context size. See Section 3. |
| P3 | **User owns credentials** | Rerun never asks for, stores, types, or logs passwords. The human logs in themselves in a real browser window. Rerun only reuses the resulting browser profile. |
| P4 | **Deterministic replay** | A flow is ordinary code. Same inputs, same steps. No hidden randomness except bounded, configurable human-like pacing. |
| P5 | **Harness-agnostic** | Rerun is a CLI plus instruction files. Any harness that can run shell commands and edit files can author flows. The authoring instructions have a single source of truth rendered into each harness's expected location. |
| P6 | **Generic** | No site-specific code anywhere in the tool. Examples and tests use a local fixture site (Section 13). |
| P7 | **Clean, scalable code** | Layered architecture, strict TypeScript, small units, explicit errors, tests. See Section 12. |
| P8 | **YAGNI with seams** | Build only v1 scope (Section 4), but keep clear boundaries (manifest, flow contract, application services) so future features plug in without rewrites. |

---

## 3. Token economy (critical, stressed on purpose)

Token cost is the main selling point. Treat every requirement in this section as a hard requirement.

### 3.1 Runtime: zero tokens
- `rerun run` executes a flow using Playwright only. No network calls other than those the flow makes to the target site.
- Add an automated test that asserts no dependency in `package.json` matches known AI SDK names (`@anthropic-ai/*`, `openai`, `@google/generative-ai`, `ai`, `langchain*`). This guards P1.

### 3.2 Authoring: minimal tokens
Rerun provides the AI with cheap tools, ordered by cost. The authoring instructions (Section 11) must tell the AI to use them in this order:

1. **Human demonstration (near-zero tokens):** `rerun record <site>` opens the Playwright recorder in the site's logged-in profile. The human performs the task once; Rerun saves the generated code to a file. The AI reads that one file and refactors it into a clean, parameterised flow.
2. **Compact page snapshots (low tokens):** `rerun inspect <site>` prints a **pruned accessibility (ARIA) snapshot** of a page or a scoped region, never raw HTML and never screenshots. Pruning rules in Section 9.6.
3. **Playwright MCP (last resort):** Only if 1 and 2 are insufficient. Use snapshot mode, never vision/screenshot mode.

Additional authoring rules the instructions must enforce:
- Never paste raw HTML, full DOM dumps, trace files, or screenshots into the AI context.
- Never read `node_modules`, `output/` result files larger than needed, or `trace.zip`.
- Scope snapshots to the region being worked on (`--scope`).
- Limit exploration loops: after 3 failed attempts on the same step, stop and ask the user for a hint or a demonstration.
- Verify flows with a small parameter (for example `count=3`) first.

### 3.3 CLI output is token-lean
Because AI harnesses read CLI output, every command's output counts as tokens:
- No ASCII banners, no decorative boxes, no spinners when stdout is not a TTY.
- Default output is short and factual. `--verbose` adds detail.
- Every command supports `--json` for compact machine-readable output.
- Errors print one line of cause plus one line of suggested next action. Stack traces only with `--verbose`.

### 3.4 Fix mode: minimal tokens
- On failure, the runner writes a failure bundle (Section 9.5) whose AI-relevant parts are small text files: `error.txt`, `step.txt`, `snapshot.txt` (pruned, scoped near the failure where possible).
- `rerun fix <automation>` prints only the paths and a short summary. The instructions tell the AI to read those three files and nothing else, then edit only the failing step.
- Screenshots and traces are saved for **humans**, and the instructions forbid the AI from reading them unless the user explicitly asks.

### 3.5 Agent (you, while building) token hygiene
- Read files once; avoid re-reading unchanged files.
- Run targeted tests (`vitest run path/to/test`) during development and the full suite at phase end.
- Use quiet reporters (`--reporter=dot`) and do not paste long logs back into context.

---

## 4. Scope

### 4.1 In scope for v1
- Browser automation of websites, Chromium-based (installed Google Chrome preferred, bundled Chromium fallback).
- User-defined sites with persistent, per-site browser profiles.
- Login once per site by the human; session reuse across runs; logged-out detection; re-login prompt.
- Flow SDK with helpers for pagination, infinite scroll, extraction, popups, human checkpoints, and pacing.
- CLI: `init`, `site add|list|login|remove`, `new`, `list`, `run`, `inspect`, `record`, `fix`, `doctor`.
- Outputs to CSV/JSON per run with a run summary.
- Double-click launchers (`run.cmd` for Windows, `run.sh` for macOS/Linux).
- Authoring instructions installed for Claude Code, GitHub Copilot, and generic agents (`AGENTS.md`).
- Failure bundles for AI-assisted fixing on request.
- Local fixture website and full test suite.

### 4.2 Out of scope for v1 (do not build; keep seams)
- Automatic self-healing without the user asking.
- Converting UI flows into direct API calls.
- Desktop application automation.
- Built-in scheduler (users can use Task Scheduler/cron with the CLI).
- A browser-extension runtime that replays inside the user's everyday browser.
- A custom step DSL or visual editor.
- "AI step" nodes that call an LLM at runtime (would violate P1).
- QA assertion toolkit / test-report features.
- Firefox/WebKit support.

---

## 5. Key technical decisions and why

### 5.1 Browser sessions: dedicated persistent profiles
- Playwright's default `launch()` gives a fresh incognito-like context every time. That is why sessions do not persist by default. Rerun must use `chromium.launchPersistentContext(profileDir, options)` instead.
- **Never** point Rerun at the user's default/everyday Chrome profile. Reasons: Chrome locks the profile while it is open, and recent Chrome versions (136+) refuse remote debugging on the default user data directory for security reasons. Using the default profile would also risk corrupting the user's real profile.
- **Never** use `connectOverCDP` to attach to the user's everyday browser in v1.
- Instead: one dedicated profile directory **per site**, stored outside the workspace in the OS application-data directory (Section 9.1). The human logs in once in that profile; cookies persist there.
- Launch with `channel: 'chrome'` when Google Chrome is installed (more realistic, fewer bot-detection issues); fall back to Playwright's bundled Chromium, and say so once in the output.
- Only one process can use a profile at a time. Detect the lock error and report it clearly (Section 9.2).

### 5.2 Flows are plain Playwright TypeScript
- Flows are readable and editable by any developer, debuggable with standard tools, and require no engine of our own beyond a thin runner.
- The runner loads `flow.ts` at runtime using `tsx`'s programmatic ESM API (`tsImport` from `tsx/esm/api`). If that API is unavailable in the installed version, use `jiti`. Verify against the installed package's docs; do not guess.

### 5.3 Manifest is the single source of truth for metadata
- `manifest.json` holds name, description, site, parameters, output format, and browser preferences.
- The CLI reads manifests without executing TypeScript (fast `list`, parameter prompting, validation).
- The flow receives already-validated, typed parameters.

### 5.4 Versions
- Do not pin package versions from memory. Use `npm view <pkg> version` or install latest stable and let `package-lock.json` pin them.
- Node.js: require the current LTS or the previous LTS (declare in `engines`, check in `doctor`).

---

## 6. Technology stack

| Concern | Choice |
|---|---|
| Language | TypeScript, `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true` |
| Module system | ESM (`"type": "module"`) |
| Runtime | Node.js LTS |
| Browser automation | `playwright` (library package, not `@playwright/test`, for runtime) |
| CLI framework | `commander` |
| Interactive prompts | `@inquirer/prompts` (only when stdin is a TTY) |
| Schema validation | `zod` |
| Loading TS flows | `tsx` (`tsImport`), fallback `jiti` |
| OS app-data paths | `env-paths` |
| CSV writing | a small internal writer (RFC 4180 quoting) or `csv-stringify` |
| Testing | `vitest` |
| Lint / format | `eslint` (typescript-eslint, strict config) + `prettier` |
| Package manager | `npm` |

### 6.4 Naming
- Define `PRODUCT_NAME = 'rerun'` and `PRODUCT_DISPLAY_NAME = 'Rerun'` in `src/shared/product.ts`.
- All user-facing strings, paths (for example the app-data folder name), and template rendering must use these constants.
- Renaming later must require changing only: `package.json` (`name`, `bin`), `src/shared/product.ts`, and nothing else. Add a test that greps the source (excluding `product.ts`, `package.json`, docs, and tests) for the literal string `rerun` in user-facing messages to catch hardcoding. Keep the test pragmatic (allow the SDK import specifier in templates to be rendered from the constant).

---

## 7. Two different things: the tool repo vs the user workspace

Do not confuse these.

### 7.1 The tool repository (this project)
The source code of Rerun: CLI, SDK, templates, tests. Published later as an npm package. During development it is used via `npm link`.

### 7.2 A user workspace (created by `rerun init`)
A folder where a user keeps their automations. Example layout:

```
my-automations/
  package.json              # depends on rerun and playwright
  rerun.config.json         # workspace settings
  .gitignore                # ignores output/, .rerun/, .env*, recordings
  AGENTS.md                 # generic agent instructions (pointer + summary)
  .claude/
    skills/
      rerun-automate/
        SKILL.md            # Claude Code authoring skill
  .github/
    prompts/
      automate.prompt.md    # GitHub Copilot prompt file
  sites/
    jobs-example.json       # one file per site
  automations/
    job-search/
      manifest.json
      flow.ts
      run.cmd               # Windows double-click launcher
      run.sh                # macOS/Linux launcher
  output/                   # run results (gitignored)
    job-search/
      2026-09-23_14-05-11/
        results.csv
        run.json
        failure/            # only if the run failed
  .rerun/                   # local state (gitignored)
    recordings/
```

Browser profiles are **not** in the workspace. They live in the OS app-data directory (Section 9.1).

---

## 8. Data contracts

Define every contract as a `zod` schema in `src/domain/schemas/`, export inferred types, and generate a JSON Schema file for each (via `zod-to-json-schema` or zod's built-in JSON schema support, whichever the installed version provides) into `schemas/` so editors can validate JSON files through a `$schema` reference.

### 8.1 `rerun.config.json` (workspace)
```json
{
  "$schema": "./node_modules/rerun/schemas/workspace-config.schema.json",
  "version": 1,
  "outputDir": "output",
  "keepRuns": 20,
  "trace": "on-failure",
  "profilesDir": null
}
```
- `keepRuns`: retain the most recent N run folders per automation; delete older ones after each run.
- `trace`: `"on-failure"` (default) or `"off"`.
- `profilesDir`: optional override for where browser profiles live; `null` means OS default.

### 8.2 `sites/<site>.json`
```json
{
  "$schema": "../node_modules/rerun/schemas/site.schema.json",
  "version": 1,
  "name": "jobs-example",
  "baseUrl": "https://jobs.example.com",
  "loginUrl": "https://jobs.example.com/login",
  "session": {
    "loggedInCheck": {
      "url": "https://jobs.example.com/feed",
      "indicator": { "type": "role", "role": "button", "name": "Account menu" }
    }
  },
  "browser": {
    "headless": false,
    "channel": "chrome"
  },
  "pacing": {
    "minDelayMs": 400,
    "maxDelayMs": 1200
  }
}
```
- `name`: kebab-case, unique, matches file name.
- `loginUrl`: optional; defaults to `baseUrl`.
- `session.loggedInCheck`: optional. If absent, the session is assumed valid and failures surface during the flow. `indicator.type` is one of:
  - `"role"`: an element with this ARIA role and accessible name must be visible.
  - `"text"`: this text must be visible.
  - `"urlNotMatching"`: after navigating to `url`, the final URL must not match this regex (catches redirects to login pages).
- `browser.headless`: default `false` for sites (headed is less likely to trigger bot detection). CLI flags override.
- `pacing`: bounds for `helpers.pause()` (Section 10.3).

### 8.3 `automations/<name>/manifest.json`
```json
{
  "$schema": "../../node_modules/rerun/schemas/manifest.schema.json",
  "version": 1,
  "name": "job-search",
  "description": "Search jobs by keyword and location and collect the first N results.",
  "site": "jobs-example",
  "params": [
    { "name": "keywords", "type": "string", "required": true, "description": "Search keywords" },
    { "name": "location", "type": "string", "required": false, "default": "Remote", "description": "Location filter" },
    { "name": "count", "type": "number", "required": false, "default": 25, "min": 1, "max": 500, "description": "Number of results to collect" },
    { "name": "sort", "type": "enum", "options": ["recent", "relevant"], "default": "recent", "description": "Sort order" }
  ],
  "output": { "format": "csv" },
  "browser": { "headless": null }
}
```
- Param types: `string`, `number`, `boolean`, `enum`. Each supports `required`, `default`, `description`; `number` supports `min`, `max`; `enum` requires `options`.
- A param cannot be both `required: true` and have a `default` (schema rule).
- `output.format`: `csv`, `json`, or `none`.
- `browser.headless`: `null` means inherit from the site.

### 8.4 `automations/<name>/flow.ts`
```ts
import { defineFlow } from 'rerun';

interface Params {
  keywords: string;
  location: string;
  count: number;
  sort: 'recent' | 'relevant';
}

export default defineFlow<Params>(async ({ page, params, step, output, helpers, log }) => {
  await step('Open job search', async () => {
    await page.goto('https://jobs.example.com/jobs');
  });

  await step('Search', async () => {
    await page.getByRole('combobox', { name: 'Search jobs' }).fill(params.keywords);
    await page.getByRole('combobox', { name: 'Location' }).fill(params.location);
    await page.getByRole('button', { name: 'Search' }).click();
  });

  await step('Collect results', async () => {
    const rows = await helpers.collectUntil({
      count: params.count,
      dedupeBy: (row) => row.link,
      extract: async () => { /* read visible result cards into rows */ return []; },
      next: async () => helpers.clickIfVisible(page.getByRole('button', { name: 'Next' })),
    });
    await output.addRows(rows);
  });

  await step('Verify', async () => {
    helpers.assert(output.rowCount > 0, 'Expected at least one result');
  });
});
```

### 8.5 Run summary `output/<automation>/<timestamp>/run.json`
```json
{
  "automation": "job-search",
  "site": "jobs-example",
  "status": "succeeded",
  "startedAt": "2026-09-23T14:05:11.000Z",
  "finishedAt": "2026-09-23T14:05:48.000Z",
  "durationMs": 37000,
  "params": { "keywords": ".NET developer", "location": "Remote", "count": 25, "sort": "recent" },
  "rowCount": 25,
  "outputFile": "results.csv",
  "failedStep": null,
  "error": null
}
```
`status` is `succeeded`, `failed`, or `login-required`.

---

## 9. Runtime behaviour

### 9.1 Profile storage
- Default location: `env-paths(PRODUCT_NAME).data + '/profiles/<site>'`. On Windows this resolves under `%LOCALAPPDATA%`; on macOS under `~/Library/Application Support`; on Linux under `~/.local/share`.
- Overridable by `rerun.config.json` `profilesDir`.
- Profile folders are created with user-only permissions where the OS supports it (`0o700` on POSIX).
- Profiles are never copied, uploaded, or logged.

### 9.2 Profile locking
- Before launching, acquire a lock file `<profileDir>/.rerun.lock` containing the PID and timestamp. Release it on exit, including on SIGINT/SIGTERM and uncaught errors.
- If the lock exists and its PID is alive, fail with: `Site "<site>" is in use by another Rerun process (pid N). Wait for it to finish.` Exit code 5.
- If the PID is dead, remove the stale lock and continue.
- Also map Playwright's "user data directory is already in use" launch error to the same friendly message.

### 9.3 Session check and re-login
Before running a flow:
1. If the site has `session.loggedInCheck`, navigate to its `url` and evaluate the indicator (short timeout, configurable, default 10s).
2. If logged in: proceed.
3. If logged out:
   - If stdin is a TTY and not `--no-input`: print `Session for "<site>" expired. A browser window will open; log in, then press Enter here.` Close the current context, relaunch the same profile **headed** at `loginUrl`, wait for Enter, re-run the check. If it passes, continue the run in the same headed context. If it still fails, exit with code 3.
   - Otherwise: write `run.json` with `status: "login-required"`, print `Run "rerun site login <site>" and try again.`, exit code 3.

`rerun site login <site>` performs the same headed login loop on demand.

### 9.4 Run execution
1. Resolve workspace root (walk up from cwd to find `rerun.config.json`; error if none).
2. Load and validate config, manifest, and site. Validation errors list every issue (path + message) and exit with code 4.
3. Resolve params: CLI `--param k=v` (repeatable) and `--params-file <json>` override manifest defaults. Missing required params are prompted interactively when TTY; otherwise exit code 2 listing missing params. Coerce and validate types (number range, enum membership, boolean parsing of `true/false/yes/no/1/0`).
4. Create run folder `output/<automation>/<YYYY-MM-DD_HH-mm-ss>/`.
5. Acquire the profile lock, launch the persistent context with resolved headless/channel.
6. If `trace` is `on-failure`, start tracing (snapshots on, screenshots on, sources off).
7. Session check (9.3).
8. Import `flow.ts`, build the `FlowContext`, execute.
9. On success: finalise output file, stop tracing without saving, write `run.json`, print a one-line summary: `✔ job-search: 25 rows -> output/job-search/2026-09-23_14-05-11/results.csv (37s)` (plain ASCII `OK` instead of the check mark when not a TTY or on Windows consoles without Unicode support). Exit 0.
10. On failure: write the failure bundle (9.5), write `run.json`, print `✖ job-search failed at step "Search": <one-line error>. Run "rerun fix job-search" for details.` Exit 1.
11. Always: close the context, release the lock, apply `keepRuns` retention.

### 9.5 Failure bundle `output/<automation>/<timestamp>/failure/`
| File | For | Content |
|---|---|---|
| `error.txt` | AI + human | Error name, message, and the top 10 stack lines that point into `flow.ts` (filter out node_modules frames). |
| `step.txt` | AI + human | Failing step label, step index, the source lines of `flow.ts` for that step (use the step's call-site location). |
| `snapshot.txt` | AI + human | Pruned ARIA snapshot of the page at failure (Section 9.6), plus the current URL and page title on the first two lines. |
| `screenshot.png` | Human only | Full-page screenshot. |
| `trace.zip` | Human only | Playwright trace (view with `npx playwright show-trace`). |

Capturing the bundle must never throw; each artifact is best-effort and missing artifacts are noted in `error.txt`.

### 9.6 ARIA snapshot pruning
Implement `AriaSnapshotPruner` as a pure, well-tested module operating on the YAML text produced by Playwright's `locator.ariaSnapshot()`:
- Input: raw snapshot text and options `{ maxLines (default 150), maxTextLength (default 80), collapseRepeatedAfter (default 3), interactiveOnly (default false) }`.
- Truncate text values longer than `maxTextLength` with `…`.
- For sibling nodes with the same role and structure (for example list items, table rows), keep the first `collapseRepeatedAfter` and replace the rest with one line: `- … (N more similar <role> items)`.
- `interactiveOnly`: keep only nodes with interactive roles (button, link, textbox, combobox, checkbox, radio, tab, menuitem, option, searchbox, switch, slider) plus their ancestor chain for context.
- If the result still exceeds `maxLines`, cut at `maxLines` and append `- … (truncated, use --scope to narrow)`.
- Output is deterministic for the same input.

---

## 10. Flow SDK (`import { defineFlow } from 'rerun'`)

The package's main export is the SDK only. It must be small, documented with TSDoc, and stable.

### 10.1 `defineFlow<P>(fn)`
Returns a branded object the runner recognises. The runner rejects `flow.ts` files whose default export is not a defined flow, with a clear message.

### 10.2 `FlowContext<P>`
| Member | Purpose |
|---|---|
| `page: Page` | The Playwright page (already logged in). |
| `context: BrowserContext` | For flows that need extra tabs. |
| `params: Readonly<P>` | Validated parameters. |
| `step(label, fn)` | Runs `fn`, records the step label, index, and call-site for failure reporting. Logs `→ <label>` in verbose mode. Steps may not be nested (throw a clear error if attempted). |
| `output.addRow(row)` / `output.addRows(rows)` | Append flat records (`Record<string, string \| number \| boolean \| null>`). CSV headers are the union of keys in first-seen order. |
| `output.setJson(value)` | For `json` format: set the result document. |
| `output.rowCount` | Rows added so far. |
| `output.saveFile(name, data)` | Save an extra artifact into the run folder (for example a downloaded file). |
| `helpers` | See 10.3. |
| `log.info/warn(msg)` | Human-facing log lines (respect quiet mode). |
| `checkpoint(message)` | Human-in-the-loop pause (10.4). |
| `runDir: string` | Absolute path of the current run folder. |

### 10.3 `helpers`
Every helper must be generic, small, tested against the fixture site, and documented.

- `pause()`: random delay between the site's `pacing.minDelayMs` and `maxDelayMs`. This is the **only** sanctioned fixed wait. Flows must not call `page.waitForTimeout`.
- `clickIfVisible(locator, { timeoutMs = 2000 })`: clicks if visible within the timeout; returns `true` if clicked, `false` otherwise. Used for optional buttons ("Next", "Accept cookies").
- `dismissIfVisible(locator, opts)`: alias semantics for popups/modals; returns boolean.
- `collectUntil<Row>({ count, extract, next, dedupeBy?, maxRounds = 50 })`: repeatedly calls `extract()` to read visible rows, dedupes with `dedupeBy`, stops when `count` rows are collected, when `next()` returns `false`, when a round adds no new rows twice in a row, or when `maxRounds` is reached. Returns at most `count` rows. Calls `pause()` between rounds. Works for both pagination (`next` clicks Next) and infinite scroll (`next` scrolls).
- `scrollToLoadMore(page, { timeoutMs = 5000 })`: scrolls to the bottom and waits until the document height grows or the timeout passes; returns `true` if more content loaded.
- `textOf(locator)`: trimmed inner text or `null` if absent (no throw).
- `attrOf(locator, name)`: attribute or `null`.
- `assert(condition, message)`: throws a `FlowAssertionError` with the message.

### 10.4 `checkpoint(message)`
- If headed and stdin is a TTY: print `⏸ <message>. Press Enter to continue.` and wait.
- Otherwise: throw `CheckpointUnavailableError` explaining the run must be headed and interactive. Flows use this for CAPTCHAs, MFA prompts, or manual confirmations.

---

## 11. Authoring integration (the AI-facing part)

### 11.1 Single source of truth
- Write the authoring instructions once in `templates/agent/automate.md` using simple placeholders (`{{PRODUCT_NAME}}`, `{{PRODUCT_DISPLAY_NAME}}`).
- `rerun init` renders them to:
  - `.claude/skills/{{PRODUCT_NAME}}-automate/SKILL.md` with frontmatter `name` and `description` (Claude Code skill).
  - `.github/prompts/automate.prompt.md` with a `description` frontmatter field (GitHub Copilot prompt file; verify the current frontmatter fields against GitHub's docs at build time and keep them minimal).
  - `AGENTS.md` containing a short summary and a pointer to the full instructions (for any other harness).
- `rerun init --update-agent-files` re-renders these files without touching anything else.

### 11.2 Required content of `templates/agent/automate.md`
Write this file carefully; it is the heart of the authoring experience. It must contain the following sections, in this order, written as direct instructions to the harness AI:

**A. Purpose and golden rule.** You are helping the user create a reusable browser automation that will run later with zero AI. Spend as few tokens as possible. Prefer asking the user one precise question over exploring blindly.

**B. Modes.** `/automate` (create) and `/automate fix <name>` (repair). Detect which from the user's message.

**C. Create mode steps:**
1. **Interview (one message, all questions together, concise):** goal in one sentence; the site URL; which values change between runs (these become params, with types and defaults); what to collect and in which format; how many items / when to stop; what proves success; anything unusual (popups, MFA, CAPTCHA).
2. **Site:** run `rerun site list --json`. If the site is missing, run `rerun site add <name> --base-url <url> [--login-url <url>]`.
3. **Session:** run `rerun site login <site>`. Tell the user a browser window will open and they must log in themselves. **Never** ask for, type, or store passwords or one-time codes.
4. **Logged-in indicator:** after login, run `rerun inspect <site> --url <a page only visible when logged in> --interactive-only` and choose a stable indicator (role + name preferred). Save it with `rerun site set-check <site> --url <url> --role <role> --name <name>` (or `--text`, or `--url-not-matching`).
5. **Explore, cheapest first:**
   a. Offer the user a demonstration: `rerun record <site> --name <automation>`. The user performs the task once and closes the recorder; the recording is saved to `.rerun/recordings/<automation>.ts`. Read that file only.
   b. If no demonstration: use `rerun inspect <site> --url <url> [--scope "<role>=<name>"] [--interactive-only]` to see only what you need.
   c. Only if a and b fail: use Playwright MCP in snapshot mode. Never request screenshots.
6. **Scaffold:** `rerun new <automation> --site <site>` creates the folder, manifest, flow template, and launchers.
7. **Write the manifest params and the flow** following the conventions in section E.
8. **Verify:** `rerun run <automation> --param count=3 ...` (small values first). On failure read only `failure/error.txt`, `failure/step.txt`, `failure/snapshot.txt`. Fix and retry. After 3 failed attempts on the same step, stop and ask the user for help or a demonstration.
9. **Finish:** tell the user in a few lines how to run it (CLI example and the double-click launcher path), its params, and where outputs go.

**D. Fix mode steps:** run `rerun fix <name> --json`; read only the three text files it lists; edit only the failing step (and shared locators if clearly the cause); re-run with small params; report the change in one or two sentences.

**E. Flow conventions (must follow):**
- Wrap every logical action in `step('<clear label>', ...)`.
- Locators: `getByRole` > `getByLabel` > `getByPlaceholder` > `getByText` > `getByTestId`. CSS/XPath only when nothing else works, with a comment explaining why.
- Never hardcode values that the user said can change; read them from `params`.
- Never use `page.waitForTimeout`; rely on Playwright auto-waiting, `expect`-style waits via locators, or `helpers.pause()` for pacing.
- Use `helpers.collectUntil` for lists, pagination, and infinite scroll.
- Use `helpers.dismissIfVisible` for optional popups; `checkpoint()` for CAPTCHA/MFA.
- End with a verification step using `helpers.assert`.
- Output flat rows with stable, human-readable column names.
- No site-specific code outside `automations/<name>/`.

**F. Hard don'ts:** never read screenshots, `trace.zip`, raw HTML, or `node_modules`; never dump full-page snapshots without `--scope` or `--interactive-only` when a page is large; never handle credentials; never add AI calls to flows; never modify files outside the workspace.

**G. Responsible use note:** Remind the user once (briefly, at site creation) that some websites' terms prohibit automation and that they are responsible for which sites they automate.

---

## 12. Architecture and clean code standards

### 12.1 Layered structure (tool repo)
```
src/
  index.ts                  # public SDK exports only (defineFlow, types)
  shared/
    product.ts              # PRODUCT_NAME and display name
    result.ts               # small helpers only if genuinely shared
  domain/                   # pure: no I/O, no Playwright, no Node fs
    schemas/                # zod schemas + inferred types
    params/                 # param parsing, coercion, validation
    errors.ts               # error hierarchy with codes
    exit-codes.ts
  application/              # use cases; orchestrate domain + ports
    ports/                  # interfaces: BrowserLauncher, WorkspaceStore, Prompter, Clock, Logger
    init-workspace.ts
    add-site.ts
    login-site.ts
    set-login-check.ts
    create-automation.ts
    list-automations.ts
    run-automation.ts
    inspect-page.ts
    record-flow.ts
    prepare-fix.ts
    doctor.ts
  infrastructure/           # adapters implementing ports
    browser/                # persistent context launcher, profile lock, session checker
    workspace/              # file-based repositories for config, sites, manifests
    output/                 # csv/json writers, run folder manager, retention
    snapshot/               # AriaSnapshotPruner
    flow-loader/            # tsx/jiti import + defineFlow validation
    prompts/                # inquirer adapter
    logging/                # console logger honoring --json/--verbose/TTY
    paths/                  # env-paths wrapper
  sdk/                      # FlowContext implementation, helpers, defineFlow
  cli/
    main.ts                 # commander setup, global flags, error-to-exit-code mapping
    commands/               # one file per command; thin: parse -> call use case -> render
    render/                 # human and --json renderers
templates/
  workspace/                # package.json, rerun.config.json, .gitignore, README.md
  agent/automate.md
  automation/               # manifest.json, flow.ts templates
  launchers/                # run.cmd, run.sh
schemas/                    # generated JSON Schemas (build output, committed)
test/
  unit/
  integration/
  e2e/
  fixture-site/
```

### 12.2 Dependency rules
- `domain` imports nothing from other layers.
- `application` imports `domain` and its own `ports` only.
- `infrastructure` implements `application/ports`.
- `cli` wires concrete adapters into use cases (a single composition root in `cli/main.ts` or `cli/container.ts`).
- `sdk` may use Playwright types and is exported publicly; it must not import `cli`.
- Enforce with an ESLint rule (`import/no-restricted-paths` or equivalent) and add it to CI lint.

### 12.3 Code standards
- Strict TypeScript, no `any` (use `unknown` + narrowing), no non-null assertions except in tests.
- Functions small and single-purpose; files focused. Prefer composition over inheritance except for the error hierarchy.
- Dependency injection through constructors/function parameters; no hidden singletons.
- No `console.log` outside the logging adapter and CLI renderers.
- Errors: a base `RerunError` with `code` (maps to exit code), `message` (one line, user-facing), `hint` (next action), and optional `cause`. Subclasses: `ConfigError`, `ValidationError`, `SessionRequiredError`, `ProfileLockedError`, `FlowStepError`, `FlowAssertionError`, `CheckpointUnavailableError`, `WorkspaceNotFoundError`.
- Every public function and SDK member has TSDoc.
- No `.env` files are needed. The project must not create, read, or commit `.env*` files. Add `.env*` to `.gitignore` in both the tool repo and generated workspaces.

### 12.4 Exit codes
| Code | Meaning |
|---|---|
| 0 | Success |
| 1 | Flow failed |
| 2 | Usage error (bad arguments, missing params in non-interactive mode) |
| 3 | Login required |
| 4 | Invalid configuration (schema validation failed) |
| 5 | Profile locked |
| 6 | Environment problem (Node too old, browser missing) |
| 7 | A step needs stdin to be a TTY (e.g. `waitForEnter`) but it isn't |

---

## 13. CLI specification

Global flags on every command: `--json`, `--verbose`, `--no-input`, `--cwd <path>`.

| Command | Behaviour |
|---|---|
| `rerun init [dir] [--link]` | Creates the workspace (Section 7.2) in `dir` (default cwd). Refuses to overwrite existing files unless `--force`. Renders agent files. Runs `npm install` (or `npm link <PRODUCT_NAME>` with `--link` for local development) and `npx playwright install chromium` unless `--skip-install`. Prints next steps in 3 to 5 lines. |
| `rerun init --update-agent-files` | Re-renders only the agent instruction files. |
| `rerun site add <name> --base-url <url> [--login-url <url>] [--headless]` | Validates name (kebab-case) and URLs, writes `sites/<name>.json`. |
| `rerun site list` | Lists sites with login-check status (configured or not). |
| `rerun site login <name>` | Headed login loop (Section 9.3). |
| `rerun site set-check <name> --url <url> (--role <r> --name <n> \| --text <t> \| --url-not-matching <regex>)` | Writes `session.loggedInCheck`. Immediately tests it and reports pass/fail. |
| `rerun site remove <name> [--delete-profile]` | Removes the site file; deletes the profile only with the flag and a confirmation prompt. |
| `rerun new <automation> --site <site>` | Scaffolds `automations/<automation>/` from templates, including launchers. `run.sh` gets executable permission on POSIX. |
| `rerun list` | Lists automations: name, site, params (required ones marked), last run status and time. |
| `rerun run <automation> [--param k=v]... [--params-file f] [--headed\|--headless]` | Section 9.4. |
| `rerun inspect <site> [--url <url>] [--scope <sel>] [--interactive-only] [--max-lines n] [--wait]` | Opens the site's profile, navigates, prints the pruned snapshot (Section 9.6). `--scope` accepts `role=<role>[:<name>]` or a CSS selector. `--wait` opens headed and waits for Enter so the user can navigate to the right state first. |
| `rerun record <site> --name <automation> [--url <url>]` | Opens the Playwright recorder with the site's profile and saves generated code to `.rerun/recordings/<automation>.ts`. Prefer `npx playwright codegen --channel chrome --user-data-dir <profile> -o <file> <url>`; verify the flags with `npx playwright codegen --help` at build time. If `--user-data-dir` is unsupported, implement the fallback: launch the persistent context headed and call `page.pause()` to open the Inspector with recording, and instruct the user to copy the code into the recording file. |
| `rerun fix <automation> [--run <timestamp>]` | Finds the latest failed run (or the given one) and prints: failed step, one-line error, and the three AI-relevant file paths. With `--json`, prints those as an object. |
| `rerun doctor` | Checks Node version, Playwright installed, Chromium installed, Chrome channel available (warn only), workspace valid (all JSON files validate), profiles directory writable, stale locks. Prints one line per check. |

### 13.1 Launchers
`templates/launchers/run.cmd`:
```bat
@echo off
setlocal
cd /d "%~dp0..\.."
call npx {{PRODUCT_NAME}} run {{AUTOMATION_NAME}} %*
echo.
pause
```
`templates/launchers/run.sh`:
```sh
#!/usr/bin/env sh
cd "$(dirname "$0")/../.." || exit 1
npx {{PRODUCT_NAME}} run {{AUTOMATION_NAME}} "$@"
```
Double-clicking runs with defaults and prompts for missing required params (the console is a TTY).

---

## 14. Testing strategy

No test may touch a real public website.

### 14.1 Fixture site (`test/fixture-site/`)
A tiny Node HTTP server (no framework needed) started and stopped by tests on a random free port. Pages:
- `/login`: a form (username/password, any non-empty values accepted) that sets a session cookie and redirects to `/feed`.
- `/feed`: requires the cookie, otherwise redirects to `/login`. Contains an "Account menu" button (logged-in indicator).
- `/search?q=&location=&page=`: requires the cookie. Search inputs with proper labels; results as a list of cards (title, company, location, link); 10 results per page; "Next" button until the last page; total results configurable.
- `/infinite`: requires the cookie. Loads 10 more items on scroll until a configured total.
- A cookie-consent modal that appears on first visit to `/search` with a "Accept" button.
- `/flaky`: a page whose button label changes based on a query param (used to test failure bundles and fix flow).

### 14.2 Unit tests
Schemas (valid and invalid cases), param parsing and coercion, CSV writer quoting, snapshot pruner (every rule), retention logic, lock file logic, error-to-exit-code mapping, template rendering, the "no AI SDK dependency" guard, the product-name hardcoding guard.

### 14.3 Integration tests
Using the fixture site and a temporary profiles directory: persistent profile keeps the login between two launches; session check pass/fail; `collectUntil` with pagination, infinite scroll, dedupe, and early stop; `dismissIfVisible`; failure bundle contents; profile lock contention.

### 14.4 End-to-end tests
In a temporary directory: `rerun init --link --skip-install` (install Playwright browsers once globally in CI setup), `site add` pointing at the fixture, programmatic login (seed the profile by driving the login form in a setup helper, simulating the human), `new`, write a sample flow into `flow.ts`, `run` with params, assert CSV content and `run.json`; break the flow, assert exit code 1 and the failure bundle; `fix --json` output shape; `list` and `doctor` output.

### 14.5 Scripts
`npm run build`, `npm run lint`, `npm run format:check`, `npm test` (all), `npm run test:unit`, `npm run test:integration`, `npm run test:e2e`.

---

## 15. Implementation phases

Each phase ends with its acceptance criteria passing plus `npm run lint` and the relevant tests.

### Phase 0: Clean slate (requires user confirmation)
The user has partial earlier work in this folder that must be removed so the project is built from scratch.
1. List everything in the repository root (top level and one level down) and show it to the user.
2. Propose deleting everything **except**: `.git/`, any `.env*` files, `.claude/settings.json` and `.claude/settings.local.json`, and this `IMPLEMENTATION.md`.
3. **Wait for explicit user confirmation** before deleting anything. If the user wants to keep additional items, keep them.
4. Delete the confirmed items. Do not read the contents of `.env*` files at any point.

**Accept:** only the preserved items remain.

### Phase 1: Project scaffold
`package.json` (name from the product constant, `type: module`, `bin`, `exports` for the SDK entry, `engines`, `files`), `tsconfig.json` (strict options from Section 6), ESLint + Prettier configs with the layer-boundary rule, Vitest config, `.gitignore` (node_modules, dist, coverage, output, .rerun, test artifacts, `.env*`), `.editorconfig`, `src/shared/product.ts`, empty layer folders with an `index.ts` where useful, a minimal `cli/main.ts` that prints version.

**Accept:** `npm run build`, `npm run lint`, `npm test` (one trivial test) all pass; `node dist/cli/main.js --version` prints the version.

### Phase 2: Domain
Schemas for workspace config, site, manifest, run summary; JSON Schema generation script into `schemas/`; param parsing/coercion/validation; error hierarchy; exit codes.

**Accept:** unit tests for all schemas and param rules pass; `schemas/*.json` generated.

### Phase 3: Workspace and output infrastructure
Workspace root discovery, repositories for config/sites/manifests (read, write, validate with full error lists), run folder manager, CSV/JSON writers, retention, logger with `--json`/`--verbose`/TTY handling.

**Accept:** unit tests pass; retention and writers covered.

### Phase 4: Browser and sessions
`env-paths` wrapper, profile directory resolution, lock file with stale detection and signal cleanup, persistent context launcher with Chrome channel fallback, session checker for all indicator types, headed re-login loop, Playwright "profile in use" error mapping.

**Accept:** integration tests against the fixture site: login persists across launches; checker passes when logged in and fails when cookies are cleared; lock contention reports exit code 5.

### Phase 5: SDK and runner
`defineFlow`, `FlowContext`, `step` with call-site capture, output API, all helpers, `checkpoint`, flow loader (`tsx`/`jiti`), `run-automation` use case including tracing, failure bundle, `run.json`, summary line.

**Accept:** integration tests for every helper; a sample flow against the fixture collects exactly N rows across pages and via infinite scroll; a broken flow produces a complete failure bundle.

### Phase 6: Snapshot tooling
`AriaSnapshotPruner`, `inspect-page` use case with `--scope`, `--interactive-only`, `--max-lines`, `--wait`.

**Accept:** unit tests for every pruning rule; `inspect` on the fixture search page with default options stays under 150 lines and collapses the result list.

### Phase 7: CLI commands
All commands in Section 13 with global flags, human and `--json` renderers, error-to-exit-code mapping, interactive prompts only on TTY.

**Accept:** e2e tests from Section 14.4 pass; every command's `--help` is accurate and concise.

### Phase 8: Init, templates, and agent files
Workspace templates, automation templates, launchers, `templates/agent/automate.md` with every section in 11.2, rendering to all three harness locations, `--update-agent-files`, `--link`, `--skip-install`, `--force`.

**Accept:** `rerun init` in a temp dir produces exactly the layout in Section 7.2; rendered agent files contain no unrendered `{{` placeholders; launchers work on the current OS (test `run.sh` on POSIX; unit-test the `run.cmd` render on all OSes).

### Phase 9: Record and fix
`record` with codegen (verify flags) and the `page.pause()` fallback; `prepare-fix` use case and `fix` command.

**Accept:** `fix --json` on a failed fixture run returns the three paths and the step label; `record` launches with the site profile (manual verification step documented in README; automated test only checks argument construction).

### Phase 10: Documentation and polish
- `README.md` for the tool repo: what it is, the lifecycle, install, quick start (init, site add, login, `/automate`, run, double-click), the token-saving philosophy, CLI reference, SDK reference, sessions and security, responsible use, troubleshooting, contributing (architecture overview and layer rules).
- Workspace `README.md` template: short, user-focused.
- `docs/architecture.md`: layers, ports, data contracts, extension points for Future items (Section 17).
- `CHANGELOG.md` starting at `0.1.0`.
- Run the full suite, fix lint warnings, remove dead code.

**Accept:** Definition of Done (Section 16) fully checked.

---

## 16. Definition of Done (every item must be true)

**Product**
- [ ] Generic: no site- or company-specific code or strings in the tool.
- [ ] Runner never calls any AI; no AI SDK in dependencies (guard test passes).
- [ ] Credentials are never requested, typed, stored, or logged by Rerun.
- [ ] Per-site persistent profiles in the OS app-data directory; default Chrome profile never used; no CDP attachment.
- [ ] Logged-out detection with interactive re-login and non-interactive exit code 3.
- [ ] Profile locking with stale-lock recovery.
- [ ] Flows are plain Playwright TypeScript using `defineFlow`; manifest is the metadata source of truth.
- [ ] Params: types, defaults, validation, CLI and file input, interactive prompting on TTY.
- [ ] Helpers: `pause`, `clickIfVisible`, `dismissIfVisible`, `collectUntil`, `scrollToLoadMore`, `textOf`, `attrOf`, `assert`; `checkpoint` works.
- [ ] Outputs per run in timestamped folders with `run.json`; retention applied.
- [ ] Failure bundle with the three small AI files plus screenshot and trace for humans.
- [ ] Double-click launchers for Windows and macOS/Linux.

**Token economy**
- [ ] `inspect` returns pruned ARIA snapshots, supports scope and interactive-only, and never outputs HTML or screenshots.
- [ ] `record` enables near-zero-token authoring by demonstration.
- [ ] CLI output is terse by default; `--json` on every command; no decorations in non-TTY.
- [ ] Agent instructions enforce the cost ladder, small verification runs, the 3-attempt limit, and the list of forbidden reads.
- [ ] `fix` points the AI at only three small files.

**Harness integration**
- [ ] One source template rendered to Claude Code skill, Copilot prompt file, and `AGENTS.md`.
- [ ] Agent instructions contain every section in 11.2.

**Engineering**
- [ ] Layer boundaries enforced by lint; strict TS; no `any`; TSDoc on public APIs.
- [ ] Unit, integration, and e2e suites pass against the fixture site only.
- [ ] Product name defined in one place; renaming touches only `package.json` and `src/shared/product.ts`.
- [ ] `.env*` ignored everywhere and never read.
- [ ] README, architecture doc, and changelog complete.

---

## 17. Future (do not build now; keep seams)
- Opt-in automatic self-healing using the failure bundle.
- Network capture during authoring to compile UI flows into direct API calls.
- Desktop automation adapters (a second `BrowserLauncher`-like port for other engines).
- Scheduler integration and run history dashboard.
- Extension-based replay inside the user's everyday browser.
- Optional step DSL for non-developers, with Playwright code generation from it.
- Assertion and reporting toolkit for QA/automation engineers.
- Firefox and WebKit support.
