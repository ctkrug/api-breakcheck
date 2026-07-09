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

## Planned features

- Shareable-link mode: encode a diff session into the URL so a teammate can open the exact same
  comparison without re-uploading either spec.
- Severity filters (show breaking-only, or everything).
- Export the diff tree as Markdown for pasting into a PR description.
- Support for OpenAPI 3.0 and 3.1 differences (e.g. nullable handling, webhooks).

## Stack

- **TypeScript**, compiled with `tsc` / bundled with [Vite](https://vitejs.dev/).
- Client-side only — no server component. Ships as a static site (`dist/`) deployable to any
  static host, including a subpath like `apps.charliekrug.com/api-breakcheck`.
- [Vitest](https://vitest.dev/) for unit tests of the diff engine.
- No runtime dependencies beyond a YAML parser for spec ingestion — the diff/ref-resolution
  engine is hand-rolled so the compatibility rules stay auditable.

## Status

Early scaffold. See [`docs/VISION.md`](docs/VISION.md) for the product vision and
[`docs/BACKLOG.md`](docs/BACKLOG.md) for the build plan.

## Development

```sh
npm install
npm run dev      # local dev server
npm test         # run the diff-engine test suite
npm run build    # produce the static dist/ bundle
```

## License

MIT — see [LICENSE](LICENSE).
