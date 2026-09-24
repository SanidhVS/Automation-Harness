# Changelog

## Unreleased

- Fixed: `rerun site login` (and any other prompt that waits for Enter) hung forever when
  stdin wasn't a TTY — for example, run as a background tool call by an AI assistant rather
  than in a real terminal. It now fails fast with a clear message and exit code 7.
- Fixed: the `/rerun-automate` (`/automate`) skill ran `rerun site login` unconditionally on
  every automation, even when the task needs no login, and offered `rerun record` (a manual
  demonstration) before `rerun inspect` (headless, no waiting). Login is now gated on what the
  interview established, and `inspect` is tried first.
- The automated browser now opens with `viewport: null` so it fills the actual window instead
  of a fixed 1280x720 area inside it.

## 0.1.0

Initial implementation.

- Domain schemas (workspace config, site, manifest, run summary) with generated JSON
  Schemas for editor validation.
- Per-site persistent browser profiles with stale-lock recovery, Chrome-channel-first
  launching, and session checking (role/text/url-not-matching indicators).
- Flow SDK (`defineFlow`, `FlowContext`, all Section 10.3 helpers, `checkpoint`) and a
  runner that never itself throws, producing structured success/failure results.
- Full `rerun run` pipeline: workspace/site/manifest resolution, param resolution,
  session check with headed re-login, flow execution, CSV/JSON output, `run.json`,
  failure bundles (`error.txt`, `step.txt`, pruned `snapshot.txt`, screenshot, trace),
  and `keepRuns` retention.
- ARIA snapshot pruning (truncation, sibling collapsing, interactive-only filtering,
  line capping) and `rerun inspect`.
- Every CLI command in the implementation plan's Section 13: `init`, `site
add/list/login/set-check/remove`, `new`, `list`, `run`, `inspect`, `record`, `fix`,
  `doctor` — all with `--json` support and consistent error-to-exit-code mapping.
- Template-based workspace/automation/launcher scaffolding and the `/automate` agent
  skill rendered to Claude Code, GitHub Copilot, and a generic `AGENTS.md`.
- Unit, integration (real Chromium against a local fixture site), and end-to-end
  (spawns the built CLI) test suites, plus guard tests for "no AI SDK dependency" and
  "no hardcoded product name outside `product.ts`."
