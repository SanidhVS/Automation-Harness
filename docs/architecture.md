# Architecture

## Layers

```
domain          pure logic, zero dependencies on anything else in this repo
  ↑
application     use cases; depends on domain, its own ports, and sdk
  ↑
infrastructure  implements application's ports; adapters for fs, Playwright, network
sdk             the published package's public surface (defineFlow, FlowContext, helpers)
  ↑
cli             composition root; wires concrete infrastructure into application use cases
```

Enforced by `eslint.config.js`'s `import/no-restricted-paths` zones (with
`eslint-import-resolver-typescript` configured — without a resolver that understands this
repo's `.js`-imports-`.ts`-files convention, the rule silently resolves nothing and
reports no violations; see the "fix: layering ESLint rule was a silent no-op" commit for
how that was caught):

- `domain` may import nothing from `application`, `infrastructure`, `cli`, or `sdk`.
- `application` may import `domain`, its own `ports/`, and `sdk` — never `infrastructure`
  or `cli` directly. This is why `run-automation.ts` calls the SDK's `runFlow` directly
  (an intentional, documented exception to "sdk is only for flow.ts authors") but reaches
  browser launching, workspace I/O, and output writing only through ports.
- `infrastructure` may import anything except `cli`.
- `sdk` may import `domain` (pure, so safe) but never `cli`.
- `cli` has no restrictions — it is the only place concrete adapters and use cases meet.

A few commands (`doctor`, `fix`, `init`'s scaffolding) bypass ports for direct
`fs`/`child_process` access. This is a deliberate, narrow exception: they are
self-contained read/report/scaffold operations with no reuse elsewhere, not core
run/session/output logic. Forcing them through a port would have meant inventing
single-caller abstractions for no benefit.

## Ports (`src/application/ports/`)

| Port              | Purpose                                                          | Implementation              |
| ----------------- | ---------------------------------------------------------------- | --------------------------- |
| `WorkspaceStore`  | Read/write/validate workspace JSON (config, sites, manifests)    | `FileWorkspaceStore`        |
| `BrowserLauncher` | Launch a persistent profile, check a session, acquire its lock   | `PlaywrightBrowserLauncher` |
| `FlowLoader`      | Load and validate one `flow.ts` at runtime                       | `TsxFlowLoader`             |
| `OutputStore`     | Run folders, results files, run.json, failure bundles, retention | `FileOutputStore`           |
| `Prompter`        | Block on Enter for headed re-login / checkpoints                 | `ReadlinePrompter`          |
| `Clock`           | The current time, for testable timestamps                        | `SystemClock`               |
| `Logger`          | Human-facing output honoring `--verbose`                         | `ConsoleLogger`             |

`BrowserLauncher` carries `checkSession`, `acquireLock`, and `openForManualLogin` alongside
`launchPersistent` rather than being separate ports — they're all facets of "one browser
session lifecycle for one site," and application code (`login-site.ts`,
`run-automation.ts`) needs them together.

`openForManualLogin` deliberately starts a plain browser process with no Playwright or
remote debugging attached: sign-in pages such as Google's refuse automated browsers. It
passes `--password-store=basic --use-mock-keychain`, the same flags Playwright uses, so the
cookies saved during login are encrypted with the same key the automated runs read with.

## Data contracts (`src/domain/schemas/`)

Every on-disk JSON contract is a Zod schema with an inferred TypeScript type and a
generated JSON Schema file (`schemas/*.json`, built via Zod v4's native
`z.toJSONSchema`, referenced by workspace files' `$schema` field for editor validation):

- `workspace-config.ts` — `rerun.config.json`
- `site.ts` — `sites/<name>.json`, including the three logged-in indicator shapes
  (`role`, `text`, `urlNotMatching`)
- `manifest.ts` — `automations/<name>/manifest.json`, including the four param types
  (`string`, `number`, `boolean`, `enum`) with the "required and default are mutually
  exclusive" rule enforced via `superRefine`
- `run-summary.ts` — `output/<automation>/<timestamp>/run.json`

`domain/validation.ts`'s `parseWithSchema` turns any Zod failure into every issue (path +
message), not just the first, since config errors should tell the user everything wrong at
once.

## The SDK and runner

`src/sdk/` is what `flow.ts` files import as `'rerun'`. It has one intentional, subtle
piece of plumbing: `defineFlow`'s brand uses `Symbol.for('rerun.flow')` — the _global_
symbol registry, not a local `Symbol()`. The `TsxFlowLoader` loads `flow.ts` through tsx's
`tsImport`, which re-evaluates `sdk/define-flow.ts` in an isolated module namespace
separate from the runner's own copy of it. A local symbol would mint a different value on
each evaluation and the brand check would silently always fail; `Symbol.for` is designed
for exactly this cross-instance case.

`sdk/runner.ts`'s `runFlow` builds the `FlowContext`, tracks which step is active (for the
failure bundle's step label/index/call-site), and never throws itself — failures come back
as `{ ok: false, ... }` for the caller (`application/run-automation.ts`) to turn into a
run.json and failure bundle.

`domain/snapshot/aria-snapshot-pruner.ts` lives in `domain/` rather than `infrastructure/`
(where the implementation plan's file layout originally placed it) because it's genuinely
pure — no I/O, no Playwright — and `run-automation.ts` (application layer) needs to call it
directly for the failure bundle's `snapshot.txt`.

## Extension points (Section 17 — not built, seams kept)

- **Automatic self-healing.** `run-automation.ts` already produces a structured
  `RunFlowFailure` with step/call-site/snapshot; a future opt-in mode could feed that to an
  LLM without touching the runner's core contract.
- **UI-to-API compilation.** Nothing here assumes flows stay UI-driven; a network-capture
  mode during `record` could emit direct API calls as an alternate flow body.
- **Other automation engines.** `BrowserLauncher` is the only port that's Playwright-typed
  in its return values; a second `BrowserLauncher` implementation (e.g. a native-app
  driver) would need the same three methods and nothing else in `application/` would
  change.
- **Scheduler / run history dashboard.** `run.json` already has everything a dashboard
  would read; nothing in the runner assumes CLI-only invocation.
- **A step DSL for non-developers.** Would compile to the same `defineFlow` contract flows
  already use, not a new runtime.
