# Changelog

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
