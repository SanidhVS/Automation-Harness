# {{WORKSPACE_NAME}}

A {{PRODUCT_DISPLAY_NAME}} workspace. See `sites/` for site definitions and `automations/` for automations.

Run an automation:

```sh
npx {{PRODUCT_NAME}} run <automation>
```

Or double-click `automations/<automation>/run.sh` (macOS/Linux) or `run.cmd` (Windows).

To create a new automation, use the `/automate` skill in an AI coding harness (Claude Code, GitHub Copilot, or any agent that reads `AGENTS.md`), or run `npx {{PRODUCT_NAME}} new <name> --site <site>` by hand.
