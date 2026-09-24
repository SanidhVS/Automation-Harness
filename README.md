# Rerun

**Teach it once, run it forever.**

Rerun turns a browser task you describe once — with help from an AI coding assistant, or by
demonstrating it yourself — into a plain script that you can re-run any number of times
with **zero AI involved**. Search a job board, fill a form, collect a table of results,
play a video at a timestamp: describe it once, then run it from the terminal or by
double-clicking a file.

---

## Before you start: read this

Rerun drives a real browser with your logins in it. Please understand these points before
you use it.

- **This is an early version (0.1.0), installed from source only.** It is not published to
  npm, and the npm name `rerun` belongs to an **unrelated** package. Never run
  `npx rerun ...` on a machine where you haven't installed this project — you would be
  running someone else's code. Follow [Install](#install) instead.
- **Your logins are stored on your computer.** When you log in to a site through Rerun, the
  browser session is saved in a dedicated profile folder (see
  [Where things are stored](#where-things-are-stored)). Anyone who can use your computer
  account can use those sessions. Treat that folder like your browser's own data: don't
  copy, sync, or share it. `rerun site remove <site> --delete-profile` wipes one.
- **Rerun never sees your password.** You always type credentials yourself, in a normal
  browser window. Never type a password or one-time code into an AI assistant or into an
  automation's parameters.
- **Run results can contain personal data.** Each run saves results, and a failed run also
  saves a screenshot, a page snapshot and a browser trace — which can include whatever was
  on screen while you were logged in. They live in the workspace's `output/` folder, which
  is excluded from git. Don't commit or share them.
- **The AI sees page text while authoring and fixing.** When an AI assistant writes or
  repairs an automation, it reads trimmed text snapshots of the pages involved (never
  screenshots). Only use an assistant you trust with that content. Once an automation
  works, running it uses no AI at all.
- **Respect the websites you automate.** Many sites' terms of service restrict automated
  access. You are responsible for what you automate. Don't use Rerun to bypass paywalls,
  CAPTCHAs, rate limits or bans, or to send spam. Rerun doesn't disguise itself as a human,
  and some sites will block it — that's their right.
- **Websites change, and automations break.** That's normal. Rerun saves a small failure
  report so an AI assistant can repair the broken step quickly (see
  [When an automation breaks](#when-an-automation-breaks)).
- **A browser window will open and act on its own.** Don't click in it during a run unless
  the terminal asks you to (for example, to solve a CAPTCHA). Only one run per site can
  happen at a time.

## What it can and can't do

| It can                                                                                                   | It can't (yet)                                                                       |
| -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Automate websites in Chrome/Chromium: search, click, fill forms, paginate, infinite-scroll, read results | Automate desktop or mobile apps                                                      |
| Reuse a login you did once by hand (including Google)                                                    | Use your already-open everyday Chrome window                                         |
| Pause for you to solve a CAPTCHA or enter a 2FA code, then continue                                      | Solve CAPTCHAs itself                                                                |
| Take parameters (`--param keywords="nurse"`) and save results as CSV or JSON                             | Run on a schedule by itself (use cron / Task Scheduler with the `rerun run` command) |
| Run on macOS, Windows and Linux                                                                          | Use Firefox or Safari                                                                |

## How it works

1. **Author, once, with AI.** In Claude Code, GitHub Copilot, or any agent that can run
   commands, you describe the task. Rerun's instructions guide the AI: it asks you a few
   questions, looks at the site cheaply, and writes the automation.
2. **The result is ordinary code.** A Playwright script (`flow.ts`) plus a small settings
   file (`manifest.json`) listing its inputs. Any developer can read and edit it.
3. **Run it forever, with no AI.** From the terminal or by double-clicking. It costs
   nothing to run.
4. **Fix it only when it breaks.** A failed run leaves a ~1–2 KB report; you ask the AI to
   fix it, and it edits only the broken step.

---

## Install

You need **Node.js 20 or newer** ([nodejs.org](https://nodejs.org)) and **git**. Google
Chrome is recommended but optional (Rerun can download its own Chromium).

### macOS

```sh
git clone https://github.com/SanidhVS/Automation-Harness.git rerun
cd rerun
npm install
npm run build
npm link
rerun --version
```

If the last line says `command not found`, your Node install uses a non-standard location.
Add this line to your `~/.zshrc`, then open a new terminal:

```sh
export PATH="$(npm prefix -g)/bin:$PATH"
```

### Windows

In **Command Prompt** (or PowerShell):

```bat
git clone https://github.com/SanidhVS/Automation-Harness.git rerun
cd rerun
npm install
npm run build
npm link
rerun --version
```

If PowerShell says _"running scripts is disabled on this system"_, either use Command Prompt,
or run this once in PowerShell: `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.

### Create a workspace

A workspace is a folder that holds your sites and automations. Create it **outside** the
Rerun folder:

```sh
mkdir my-automations
cd my-automations
rerun init --link
rerun doctor
```

`init --link` sets up the folder, connects it to your local Rerun, and downloads the
browser. (`--link` is required until Rerun is published to npm.) `doctor` should print `OK`
for every line; a `WARN` for "Google Chrome channel" just means Chrome isn't installed.

---

## Your first automation (walkthrough)

This example opens YouTube, searches for a song, opens the first result and jumps to 1:15.
Run every command from inside your workspace folder.

### 1. Tell Rerun about the site

```sh
rerun site add youtube --base-url https://www.youtube.com
```

To use your installed Google Chrome for this site (recommended for Google/YouTube), open
`sites/youtube.json` and add `"channel": "chrome"` inside `"browser"`:

```json
"browser": { "headless": false, "channel": "chrome" }
```

### 2. Log in (only if the site needs it)

```sh
rerun site login youtube
```

A normal Chrome window opens. Log in yourself, return to the terminal and press **Enter**.
Rerun closes the window and keeps the session for all future runs. For sites where the
automation must be logged in, also tell Rerun how to recognize a logged-in page, so it can
warn you when the session expires:

```sh
rerun site set-check mysite --url https://mysite.com/account --text "Sign out"
```

### 3a. Create the automation with AI (recommended)

`rerun init` installed instructions for AI assistants in your workspace. Open the workspace
folder in your assistant and ask:

- **Claude Code:** `/rerun-automate` — then describe the task, for example: _"On the site
  youtube, search for 'Radhimaa Sai Abhyankkar', open the first video and seek to 1:15.
  The search text and the time should be changeable."_
- **GitHub Copilot (Chat):** `/automate` — same description.
- **Any other agent:** point it at `AGENTS.md`.

The assistant will ask a few questions, inspect the site, create
`automations/<name>/flow.ts` and `manifest.json`, and test-run it with small values.

### 3b. Or create it by hand

```sh
rerun new youtube-play-song --site youtube
```

This creates `automations/youtube-play-song/` with a starter `flow.ts`, `manifest.json`
and two launchers. See [Writing flows by hand](#writing-flows-by-hand). To discover what's
on a page without reading its HTML:

```sh
rerun inspect youtube --interactive-only
```

### 4. Run it

```sh
rerun run youtube-play-song
rerun run youtube-play-song --param query="Katchi Sera" --param seekSeconds=30
```

You'll see a line like:

```
✔ youtube-play-song: 1 rows -> results.csv (5s)
```

Results are saved in `output/youtube-play-song/<date_time>/`.

### 5. Or just double-click it

Every automation has launchers that anyone can double-click — no terminal knowledge needed:

- **Windows:** `automations\youtube-play-song\run.cmd`
- **macOS:** `automations/youtube-play-song/run.command` (opens in Terminal)
- **Linux:** `automations/youtube-play-song/run.sh`

If the automation has a required input that wasn't given, the launcher asks for it.

---

## Running automations

```sh
rerun list                                   # all automations, their inputs, last result
rerun run <name>                             # run with default inputs
rerun run <name> --param key=value           # override an input (repeatable)
rerun run <name> --params-file inputs.json   # inputs from a JSON file
rerun run <name> --headless                  # no visible window
rerun run <name> --headed                    # force a visible window
```

Each run creates `output/<name>/<date_time>/` containing:

- `results.csv` or `results.json` — the collected data
- `run.json` — status, inputs used, row count, duration, error
- `failure/` — only if the run failed (see below)

The newest 20 runs per automation are kept; change `keepRuns` in `rerun.config.json`.

**Exit codes**, for scripts and schedulers:

| Code | Meaning                                                      |
| ---- | ------------------------------------------------------------ |
| 0    | Success                                                      |
| 1    | The automation failed — run `rerun fix <name>`               |
| 2    | Wrong or missing inputs / command usage                      |
| 3    | Login required — run `rerun site login <site>`               |
| 4    | A settings file is invalid (the message lists every problem) |
| 5    | Another run is using this site right now                     |
| 6    | Environment problem (see `rerun doctor`)                     |
| 7    | This step needs a real terminal — run the command yourself, not through an AI tool call |

## When an automation breaks

Websites change, so this will happen. A failed run prints:

```
✖ job-search failed: expected 23 rows. Run "rerun fix job-search" for details.
```

Then either:

- **Ask your AI assistant:** `/rerun-automate fix job-search` (Claude Code) or
  `/automate fix job-search` (Copilot). It reads only the three small report files and
  edits only the broken step.
- **Look yourself:** `rerun fix job-search` shows the failed step, the error and the report
  files. `failure/screenshot.png` shows the page at the moment of failure, and
  `npx playwright show-trace output/<...>/failure/trace.zip` replays the whole run.

## Logins and sessions

- **Each site gets its own browser profile**, separate from your everyday Chrome. You log
  in once with `rerun site login <site>`; every run reuses it.
- **The login window is a normal browser** with nothing automated attached, so sign-in
  pages that block automation (such as Google's) work.
- **`rerun site login` needs a real terminal.** It waits for you to press Enter after logging
  in, so it exits immediately with code 7 if run somewhere that can't do that (for example, an
  AI assistant calling it as a background tool instead of a real terminal command). In Claude
  Code, run it with the `!` prefix so it gets a real terminal.
- **Sessions expire.** If a site has a login check (`rerun site set-check`), a run notices
  and either reopens the login window (when run from a terminal) or stops with exit
  code 3.
- **Profiles are shared by site name**: two workspaces that both have a site called
  `youtube` share one login.
- **Why not your everyday Chrome?** Chrome locks the profile while it's open, and since
  Chrome 136 it blocks automation of your default profile for security. Using it would also
  risk corrupting your real browser data.

### Where things are stored

| What                    | Where                                                                                                                                             |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sites and automations   | Your workspace: `sites/`, `automations/`                                                                                                          |
| Run results and reports | Your workspace: `output/` (not committed to git)                                                                                                  |
| Browser profiles/logins | macOS: `~/Library/Application Support/rerun/profiles/` · Windows: `%LOCALAPPDATA%\rerun\Data\profiles\` · Linux: `~/.local/share/rerun/profiles/` |

Set `"profilesDir"` in `rerun.config.json` to store profiles elsewhere.

## Workspace layout

```
my-automations/
  rerun.config.json        workspace settings
  sites/<site>.json        one file per website
  automations/<name>/
    flow.ts                the automation
    manifest.json          its inputs and output format
    run.cmd / run.command / run.sh   double-click launchers (Windows / macOS / Linux)
  output/                  run results (git-ignored)
  AGENTS.md, .claude/, .github/prompts/   instructions for AI assistants
```

Refresh the AI instructions after updating Rerun with `rerun init --update-agent-files`.

## Command reference

| Command                                                                                       | What it does                                                          |
| --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `rerun init [dir] --link`                                                                     | Create a workspace                                                    |
| `rerun doctor`                                                                                | Check that everything is set up                                       |
| `rerun site add <site> --base-url <url> [--login-url <url>]`                                  | Register a website                                                    |
| `rerun site login <site>`                                                                     | Log in by hand; the session is kept                                   |
| `rerun site set-check <site> --url <url> --role <role> --name <name>`                         | How to recognize a logged-in page (or `--text`, `--url-not-matching`) |
| `rerun site list` · `rerun site remove <site> [--delete-profile]`                             | List / remove sites                                                   |
| `rerun new <name> --site <site>`                                                              | Create an automation from the starter template                        |
| `rerun list`                                                                                  | List automations                                                      |
| `rerun run <name> [--param k=v]... [--headless\|--headed]`                                    | Run an automation                                                     |
| `rerun inspect <site> [--url u] [--scope "role=button:Search"] [--interactive-only] [--wait]` | Print a compact outline of a page (used when writing flows)           |
| `rerun record <site> --name <name>`                                                           | Record yourself doing the task; saves code to `.rerun/recordings/`    |
| `rerun fix <name> [--run <date_time>]`                                                        | Show the failure report of the latest failed run                      |

Every command accepts `--json` (machine-readable output), `--verbose`, `--no-input` (never
ask questions) and `--cwd <folder>`.

## Writing flows by hand

A flow is plain [Playwright](https://playwright.dev) code wrapped in `defineFlow`:

```ts
import { defineFlow } from 'rerun';

interface Params {
  keywords: string;
  count: number;
}

export default defineFlow<Params>(async ({ page, params, step, output, helpers }) => {
  await step('Search', async () => {
    await page.goto('https://jobs.example.com');
    await page.getByRole('textbox', { name: 'Search jobs' }).fill(params.keywords);
    await page.getByRole('button', { name: 'Search' }).click();
  });

  await step('Collect results', async () => {
    const rows = await helpers.collectUntil({
      count: params.count,
      extract: async () =>
        page
          .locator('.result')
          .evaluateAll((items) =>
            items.map((item) => ({ title: item.querySelector('a')?.textContent ?? '' })),
          ),
      next: () => helpers.clickIfVisible(page.getByRole('button', { name: 'Next' })),
    });
    output.addRows(rows);
  });

  await step('Verify', async () => {
    helpers.assert(output.rowCount > 0, 'Expected at least one result');
  });
});
```

Declare each input in `manifest.json`:

```json
"params": [
  { "name": "keywords", "type": "string", "required": true, "description": "Search text" },
  { "name": "count", "type": "number", "default": 25, "min": 1, "max": 500, "description": "How many" }
]
```

What a flow gets:

- `page`, `context` — Playwright's page and browser context.
- `params` — the checked, typed inputs.
- `step(label, fn)` — wrap every action; the label appears in failure reports.
- `output` — `addRow`, `addRows`, `setJson`, `rowCount`, `saveFile`.
- `helpers` — `collectUntil` (pagination and infinite scroll), `clickIfVisible`,
  `dismissIfVisible` (optional popups), `scrollToLoadMore`, `textOf`, `attrOf`, `pause`
  (the only allowed fixed wait), `assert`.
- `checkpoint(message)` — pause for a human (CAPTCHA, 2FA), then continue on Enter.

Tips: prefer `getByRole`/`getByLabel` over CSS selectors; never use `page.waitForTimeout`;
test with small inputs first (`--param count=3`).

## Troubleshooting

| Problem                                                     | What to do                                                                                       |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `rerun: command not found`                                  | See [Install](#install) (PATH note for macOS); on Windows, open a new terminal after `npm link`  |
| `npx rerun` does something unexpected                       | Don't use `npx rerun` outside a workspace — it downloads an unrelated package. Use `rerun`       |
| Google says the browser "may not be secure"                 | Update Rerun (`git pull`, `npm run build`); set `"channel": "chrome"` for the site; log in again |
| "Session ... expired" / exit code 3                         | `rerun site login <site>`                                                                        |
| "Site ... is in use by another Rerun process" / exit code 5 | Wait for the other run to finish. A lock left by a crashed run clears itself automatically       |
| A run succeeds but collects wrong data                      | Check `output/<name>/<date_time>/results.csv`; ask the AI to adjust the flow                     |
| Anything else                                               | `rerun doctor`, then re-run with `--verbose` for full details                                    |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the development setup, and
[docs/architecture.md](docs/architecture.md) for how the code is organized.
