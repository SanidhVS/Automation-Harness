# {{WORKSPACE_NAME}}

A {{PRODUCT_DISPLAY_NAME}} workspace: browser automations that run with no AI involved.

## Run an automation

- Double-click the launcher in `automations/<name>/`: `run.cmd` on Windows, `run.command`
  on macOS, `run.sh` on Linux.
- Or, from this folder: `{{PRODUCT_NAME}} run <name>` (add `--param key=value` to change
  an input). `{{PRODUCT_NAME}} list` shows every automation and its inputs.

Results are saved in `output/<name>/<date_time>/`.

## Create or fix an automation

Ask your AI assistant — Claude Code: `/{{PRODUCT_NAME}}-automate`, GitHub Copilot:
`/automate`, other agents: `AGENTS.md` — and describe the task, or say "fix <name>".
By hand: `{{PRODUCT_NAME}} new <name> --site <site>`.

If a site needs a login: `{{PRODUCT_NAME}} site login <site>` opens a browser window, you
log in yourself, then press Enter in the terminal.

## Be careful

- Logins are saved on this computer in a dedicated browser profile. Don't share it.
- `output/` can contain screenshots and page contents from logged-in pages. It's excluded
  from git; don't share it.
- Never give a password to an AI assistant or put one in an automation's inputs.
- Only automate sites whose terms allow it.
- While a run is going, don't click in its browser window unless the terminal asks you to.
