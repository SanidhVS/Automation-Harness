# Contributing

## Setup

```sh
npm install
npx playwright install chromium   # the integration and e2e tests drive a real browser
npm run build
npm link                          # optional: puts your working copy on PATH as `rerun`
```

## Checks

```sh
npm run lint           # ESLint, including the layer-boundary rules
npm run format:check   # Prettier
npm test               # builds, then runs unit + integration + e2e tests
npm run test:unit      # fast, no browser
```

All tests run against a small local fixture website (`test/fixture-site/`); none touch a
real website. The e2e tests spawn the built CLI (`dist/cli/main.js`), which is why
`npm test` builds first.

## How the code is organized

See [docs/architecture.md](docs/architecture.md). In short:

- `src/domain` — pure logic and schemas, no dependencies on the rest of the code.
- `src/application` — use cases; talks to the outside world only through the interfaces in
  `application/ports/`.
- `src/infrastructure` — implementations of those ports (files, Playwright, processes).
- `src/sdk` — what `flow.ts` files import (`defineFlow`, helpers).
- `src/cli` — the commands; wires everything together.

ESLint enforces these boundaries; a lint error saying "imported in restricted zone" means an
import crosses a layer it shouldn't.

## Rules that tests enforce

- **No AI SDK dependency.** Running an automation must never call an AI service.
- **The product name lives in one place.** Use `PRODUCT_NAME` / `PRODUCT_DISPLAY_NAME` from
  `src/shared/product.ts` instead of writing "rerun" in strings. Renaming the product should
  only require editing that file and `package.json`.
- **No site-specific code in the tool.** Sites are user data; tests use the fixture site.
- **Never handle credentials.** Users log in themselves in a browser window.

## Templates

Workspace files, the automation starter, launchers and the AI instructions
(`templates/agent/automate.md`) live in `templates/`. `{{PLACEHOLDER}}` values are filled in
at render time; rendering fails loudly if a placeholder has no value.
