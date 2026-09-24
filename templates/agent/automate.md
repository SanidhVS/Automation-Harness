# {{PRODUCT_DISPLAY_NAME}}: authoring a browser automation

## A. Purpose and golden rule

You are helping the user create a reusable browser automation that will run later with
**zero AI tokens**. Spend as few tokens as possible while doing this. Prefer asking the
user one precise question over exploring blindly — a wrong guess costs more tokens than
a question.

## B. Modes

- `/automate` — create a new automation.
- `/automate fix <name>` — repair a broken one.

(In Claude Code these instructions are the `/{{PRODUCT_NAME}}-automate` skill; in GitHub
Copilot they are the `/automate` prompt. The modes are the same either way.)

Detect which mode from the user's message: if they name an existing automation and
describe a failure, use fix mode; otherwise use create mode.

## C. Create mode steps

1. **Interview (one message, all questions together, concise).** Ask for: the goal in one
   sentence; the site URL; whether the task needs a login; which values change between runs
   (these become params, with types and defaults); what to collect and in what format; how
   many items / when to stop; what proves success; anything unusual (popups, MFA, CAPTCHA).
2. **Site.** Run `{{PRODUCT_NAME}} site list --json`. If the site is missing, run
   `{{PRODUCT_NAME}} site add <name> --base-url <url> [--login-url <url>]`.
3. **Session — only if the interview said this task needs a login.** Run
   `{{PRODUCT_NAME}} site login <site>`. This opens a real browser window and blocks until a
   person presses Enter, so it only works when you have a live terminal to run it in (in
   Claude Code, run it with the `!` prefix so the user gets a real terminal, not through a
   background shell tool call, which will hang). Tell the user a browser window will open and
   they must log in themselves. **Never** ask for, type, or store passwords or one-time codes.
   Skip this step entirely for a task that needs no login.
4. **Logged-in indicator (only if step 3 ran).** After login, run
   `{{PRODUCT_NAME}} inspect <site> --url <a page only visible when logged in> --interactive-only`
   and choose a stable indicator (role + name preferred). Save it with
   `{{PRODUCT_NAME}} site set-check <site> --url <url> --role <role> --name <name>`
   (or `--text <text>`, or `--url-not-matching <regex>`).
5. **Explore, cheapest first:**
   a. Use `{{PRODUCT_NAME}} inspect <site> --url <url> [--scope "role=<role>:<name>"]
   [--interactive-only]` (`--scope` also accepts a CSS selector, e.g. `--scope "#results"`)
   to see only what you need. This runs headless, with no wait on the user — prefer it.
   b. If `inspect` can't get you far enough (the flow depends on exact interaction timing,
   or the target state is hard to reach by URL), offer the user a demonstration instead:
   `{{PRODUCT_NAME}} record <site> --name <automation>`. The user performs the task once and
   closes the recorder; the recording is saved to `.{{PRODUCT_NAME}}/recordings/<automation>.ts`.
   Read that file only.
   c. Only if a and b fail: use Playwright MCP in snapshot mode. Never request screenshots.
6. **Scaffold.** `{{PRODUCT_NAME}} new <automation> --site <site>` creates the folder,
   manifest, flow template, and launchers.
7. **Write the manifest params and the flow**, following the conventions in Section E.
8. **Verify.** `{{PRODUCT_NAME}} run <automation> --param count=3 ...` (small values first).
   On failure, read only `failure/error.txt`, `failure/step.txt`, `failure/snapshot.txt`.
   Fix and retry. After 3 failed attempts on the same step, stop and ask the user for help
   or a demonstration.
9. **Finish.** Tell the user in a few lines how to run it (CLI example and the double-click
   launcher path), its params, and where outputs go.

## D. Fix mode steps

Run `{{PRODUCT_NAME}} fix <name> --json`; read only the three text files it lists; edit
only the failing step (and shared locators if clearly the cause); re-run with small
params; report the change in one or two sentences.

## E. Flow conventions (must follow)

- Wrap every logical action in `step('<clear label>', ...)`.
- Locators, in order of preference: `getByRole` > `getByLabel` > `getByPlaceholder` >
  `getByText` > `getByTestId`. CSS/XPath only when nothing else works, with a comment
  explaining why.
- Never hardcode values the user said can change — read them from `params`.
- Never use `page.waitForTimeout`; rely on Playwright's auto-waiting, `expect`-style waits
  via locators, or `helpers.pause()` for pacing.
- Use `helpers.collectUntil` for lists, pagination, and infinite scroll.
- Use `helpers.dismissIfVisible` for optional popups; `checkpoint()` for CAPTCHA/MFA.
- End with a verification step using `helpers.assert`.
- Output flat rows with stable, human-readable column names.
- No site-specific code outside `automations/<name>/`.

## F. Hard don'ts

Never read screenshots, `trace.zip`, raw HTML, or `node_modules`. Never dump full-page
snapshots without `--scope` or `--interactive-only` when a page is large. Never handle
credentials. Never add AI calls to flows — that would make them cost tokens to run, which
defeats the entire point. Never modify files outside the workspace.

## G. Responsible use

Remind the user once, briefly, at site creation: some websites' terms prohibit automation,
and they are responsible for which sites they automate.
