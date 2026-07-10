# Redline

**▶ Live demo: [apps.charliekrug.com/api-breakcheck](https://apps.charliekrug.com/api-breakcheck/)**

Catch breaking API changes before you merge. Paste two versions of an OpenAPI spec and get an
instant red/green tree that marks every change **breaking** or **safe**, with a one-line reason for
each. No CLI, no config, nothing leaves your browser.

[![CI](https://github.com/ctkrug/api-breakcheck/actions/workflows/ci.yml/badge.svg)](https://github.com/ctkrug/api-breakcheck/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-informational.svg)](LICENSE)

## Who it's for

API developers and small platform teams at the exact moment they've changed a spec and want the
blast radius before anyone else looks at the PR. It's the pre-flight gut-check, not the CI gate.

## Why

The tools that answer "did I just break a client?" properly (`oasdiff`, `openapi-diff`) are built
for CI: install a binary or action, write a config file, wire it into a pipeline, wait for a run.
That's the right tool for enforcement, but it's overkill for the ten seconds right before you open
the PR. And a raw text diff of two YAML files is worse than useless here: it buries the one
one-line breaking change under hundreds of lines of `$ref` and key-reordering noise.

Redline skips all of that. Paste the old spec, paste the new spec, read the tree.

## What it does

- Parses two OpenAPI 3.0 / 3.1 documents (JSON or YAML) entirely client-side.
- Resolves local `$ref` pointers (nested and circular) so the diff compares fully realized
  schemas, not raw pointer text. Two specs organized differently but structurally identical
  produce zero noise.
- Walks paths, operations, parameters, request bodies, and response schemas and classifies every
  change with real compatibility semantics, for example:
  - Removing a path or operation, or a new required request field/parameter, is **breaking**.
  - Narrowing a type, tightening a `format`, or dropping an `enum` value is **breaking**.
  - A response field that's no longer guaranteed is **breaking**.
  - A new path, a new optional field, or a relaxed constraint is **safe**.

  Every verdict traces to a single named rule in [`src/diff/compat.ts`](src/diff/compat.ts), so the
  reasoning behind "breaking" vs "safe" is auditable, not a heuristic. See
  [`docs/VISION.md`](docs/VISION.md) for the full rule set.

- Renders a collapsible red/green tree with a plain-English reason on every leaf, a breaking-only
  filter, a shareable link (the comparison is encoded in the URL, not a server session), and a
  Markdown export for pasting into a PR.

## Sample output

Loading the built-in Pet Store example (v1 → v2) and clicking **Export Markdown** produces:

```markdown
# Redline report

**4 breaking** · **2 safe** change(s).

## Breaking changes

- New required query parameter `tag`; existing clients do not send it. _(/pets › GET /pets › parameters)_
- Response field `status` is no longer guaranteed; clients relying on it may break. _(/pets › GET /pets › responses)_
- `status` no longer accepts "pending"; clients using those values break. _(/pets › GET /pets › responses)_
- DELETE /pets/{id} was removed; clients calling it will fail. _(/pets/{id})_

## Safe changes

- New optional request field `photoUrl`; existing clients are unaffected. _(/pets › POST /pets › requestBody)_
- Path is new; existing clients are unaffected.
```

## Using it

1. Open the [live demo](https://apps.charliekrug.com/api-breakcheck/). Paste your current spec into
   the left pane and the proposed spec into the right, or drop a `.json`/`.yaml` file onto either
   pane. In a hurry? Hit **Load example** to compare a sample Pet Store v1 → v2.
2. Click **Compare** (or press ⌘/Ctrl+Enter). The input bar collapses to a summary strip and the
   diff tree fills the screen.
3. Scan the tree: red = breaking, green = safe, each leaf with a one-line reason. Use **Breaking
   only** to hide the noise, **Share** to copy a link that reproduces the exact comparison, or
   **Export Markdown** to paste a report into a PR description.

Malformed JSON/YAML or a non-OpenAPI document produces a clear, pane-scoped error, never a blank
screen or a thrown stack trace.

## Stack

- **TypeScript**, bundled with [Vite](https://vitejs.dev/). Client-side only, no backend. Ships as
  a static site deployable under any subpath.
- [Vitest](https://vitest.dev/) for the test suite (150 tests, including property-based checks of
  the compatibility rules and full happy-dom app tests).
- No runtime dependencies beyond a YAML parser. The diff and `$ref`-resolution engine is
  hand-rolled so the compatibility rules stay in one auditable place.

## Development

```sh
npm install
npm run dev      # local dev server
npm test         # run the test suite
npm run build    # produce the static dist/ bundle
```

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the code map and
[`docs/BACKLOG.md`](docs/BACKLOG.md) for the build plan.

## License

MIT, see [LICENSE](LICENSE).

---

More of Charlie's projects → [apps.charliekrug.com](https://apps.charliekrug.com)
