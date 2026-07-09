# Vision

## The problem

You're about to merge an API change. Somewhere between "I edited the OpenAPI spec" and
"this shipped," you'd like to know: _did I just break a client?_ The honest answer requires
understanding OpenAPI compatibility semantics — removed fields, tightened validation, changed
types, `$ref` chains — not just eyeballing a text diff of two YAML files, which buries a single
one-line breaking change under hundreds of lines of cosmetic reordering noise.

The tools that _can_ answer this properly (`oasdiff`, `openapi-diff`, etc.) are built for CI:
install a binary or action, write a config file, wire it into a pipeline, wait for a run. That's
the right tool for enforcement, but it's the wrong tool for the moment right before you open the
PR, when you just want a fast, honest gut-check with zero setup.

## Who it's for

API developers and API-owning teams, at the moment they've just changed a spec and want to know
the blast radius before anyone else looks at it — not as a CI gate, but as a pre-flight check.
Also useful for reviewers: paste the PR's before/after spec and see the same tree the author saw.

## The core idea

Paste (or drop) two OpenAPI documents. Get a tree, not a wall of text: every path, operation, and
schema change is a node, colored red (breaking) or green (safe), with one plain-English sentence
explaining _why_. No config file, no CLI, no account, no server round-trip — the whole comparison
runs in the browser tab.

## Key design decisions

- **Client-side only.** Specs can contain internal API shapes teams don't want uploaded anywhere.
  Parsing, `$ref` resolution, and diffing all happen in the browser; nothing is sent to a server.
  This is also what makes the "shareable link" feature honest — the link encodes the comparison,
  not a server-side session.
- **`$ref`-aware, not string-aware.** A raw text diff of two spec files is dominated by pointer
  noise (`$ref` targets moving, key reordering) that has nothing to do with compatibility. The
  diff engine resolves every local `$ref` before comparing, so two schemas that are structurally
  identical but organized differently produce zero diff noise.
- **Compatibility rules are explicit and auditable**, not vibes-based heuristics. A change is
  **breaking** if an existing client, written against the old spec, could send a request that the
  new spec rejects, or receive a response shape the new spec no longer guarantees. Concretely:
  - Removing a path, operation, or a previously-required response field → breaking.
  - Adding a new required request parameter/body field → breaking (an old client won't send it).
  - Narrowing a type, format, or enum (e.g. `string` → `"active" | "inactive"`) → breaking.
  - Making a previously-optional request field required → breaking.
  - Adding a new path, operation, or optional field → safe.
  - Making a previously-required response field optional, widening a type, or relaxing a
    constraint → safe (existing clients still get what they expect, and more).
  - This rule set grows incrementally as build stories land (see `docs/BACKLOG.md`); each rule is
    a named, testable function, not an inline heuristic, so the reasoning behind every verdict is
    traceable to one place in the code.
- **One-line reasons, always.** Every leaf in the diff tree carries a plain-English sentence.
  "Breaking" without a reason isn't actionable; the reason is the actual product.
- **Tree over table.** OpenAPI specs are nested (paths → operations → parameters/schemas →
  properties); a flat list of changes loses that structure and makes large diffs unscannable. A
  collapsible tree lets you collapse untouched branches and focus on what changed.
- **Zero-install web app, not a CLI.** The competitive edge isn't the diff algorithm alone — tools
  like `oasdiff` already do rigorous diffing — it's that this one requires nothing installed and
  nothing configured to get an answer in the ten seconds before a merge.

## What "v1 done" looks like

- Paste or upload two OpenAPI 3.x documents (JSON or YAML) and get a diff tree within a second,
  with no setup step in between.
- `$ref` resolution handles nested and circular references without crashing or hanging.
- The compatibility rule set (above) covers paths, operations, parameters, request bodies, and
  response schemas — the surfaces that actually break clients.
- Every diff node shows a one-line reason; the tree can be collapsed/expanded and filtered to
  breaking-only.
- Malformed input (invalid JSON/YAML, non-OpenAPI documents) produces a clear inline error, never
  a silent failure or a crash.
- The whole thing is a static site, deployable with no backend, matching the design direction in
  `docs/DESIGN.md`.
