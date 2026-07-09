# API Breakcheck

[![CI](https://github.com/ctkrug/api-breakcheck/actions/workflows/ci.yml/badge.svg)](https://github.com/ctkrug/api-breakcheck/actions/workflows/ci.yml)

Drop in two versions of an OpenAPI spec, get an instant red/green diff tree that marks every
change **breaking** or **safe** — with a one-line reason for each. No config, no CI pipeline,
no install.

## Why

Most "OpenAPI diff" tooling lives inside a CI step: you write a config file, wire up a GitHub
Action, and wait for a pipeline run to tell you what changed. That's the right long-term setup,
but it's overkill for the moment that actually matters most — the ten seconds before you hit
"merge" on an API change, when you just want to know _"did I just break someone?"_

API Breakcheck skips all of that. Paste your old spec, paste your new spec, and get the answer
immediately, in the browser, with nothing installed and nothing configured. It's the pre-release
gut-check tool, not the enforcement tool.

## What it does

- Parses two OpenAPI 3.x documents (JSON or YAML) entirely client-side.
- Resolves `$ref` pointers (including nested and circular refs) so the diff compares fully
  realized schemas, not raw pointer text.
- Walks paths, operations, parameters, request bodies, and response schemas to produce a
  structural diff tree.
- Classifies every change as **breaking** or **safe** using real API-compatibility semantics
  (see [`docs/VISION.md`](docs/VISION.md) for the full rule set) — for example:
  - Removing an endpoint or operation → breaking.
  - Adding a new required request field → breaking.
  - Adding a new optional field or a new endpoint → safe.
  - Narrowing a response field's type → breaking; widening it → safe.
- Renders the result as a collapsible red/green tree with a one-line reason attached to every
  leaf node, so you can scan a large diff in seconds.
- Runs entirely in the browser — no backend, no data leaves your machine, and the whole thing
  can be shared as a static link.

## Using it

1. Open the app and paste your current spec into the left pane and the proposed spec into the
   right — or **drop a `.json`/`.yaml` file** onto either pane, or use **Upload file**. In a
   hurry? Hit **Load example** to compare a sample Pet Store v1 → v2.
2. Click **Compare** (or press ⌘/Ctrl+Enter). The input bar collapses to a summary strip and the
   diff tree fills the screen.
3. Scan the tree: red = breaking, green = safe, each leaf with a one-line reason. Use the
   **Breaking only** filter to hide the noise, **Share** to copy a link that reproduces the exact
   comparison, or **Export Markdown** to paste a report into a PR description.

Malformed JSON/YAML or a non-OpenAPI document produces a clear, pane-scoped error — never a blank
screen or a thrown stack trace.

## Roadmap

- Wider OpenAPI 3.1 coverage (nullable handling, webhooks, `oneOf`/`allOf` composition).
- Deep-linking to a specific node in a large tree.

## Stack

- **TypeScript**, compiled with `tsc` / bundled with [Vite](https://vitejs.dev/).
- Client-side only — no server component. Ships as a static site (`dist/`) deployable to any
  static host, including a subpath like `apps.charliekrug.com/api-breakcheck`.
- [Vitest](https://vitest.dev/) for unit tests of the diff engine.
- No runtime dependencies beyond a YAML parser for spec ingestion — the diff/ref-resolution
  engine is hand-rolled so the compatibility rules stay auditable.

## Status

Core is functional end to end: paste/upload two specs → semantic diff tree with breaking/safe
verdicts, `$ref` resolution, breaking-only filter, shareable links, and Markdown export. See
[`docs/VISION.md`](docs/VISION.md) for the product vision, [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
for the code map, and [`docs/BACKLOG.md`](docs/BACKLOG.md) for the build plan.

## Development

```sh
npm install
npm run dev      # local dev server
npm test         # run the diff-engine test suite
npm run build    # produce the static dist/ bundle
```

## License

MIT — see [LICENSE](LICENSE).
