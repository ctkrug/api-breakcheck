# Backlog

Epics and stories for the v1 build. Every story lists concrete, verifiable acceptance criteria —
no "works well" vibes checks. The first story of Epic 1 is the wow moment and must be reachable
before anything else ships.

## Epic 1 — Instant Diff

The core loop: paste two specs, see the tree, understand the blast radius. This is the whole
product; everything else sharpens it.

- [x] **1.1 Paste-and-diff wow moment** _(the wow moment)_
  - Pasting a valid OpenAPI JSON/YAML doc into each of the two input panes and clicking
    "Compare" renders a diff tree within 1 second, with zero prior configuration.
  - The tree root shows a breaking-change count and a safe-change count that match the number of
    red/green leaf nodes rendered.
  - Requires no CLI, no account, no network request beyond loading the page itself (verified: no
    `fetch`/`XHR` calls fire during the compare action).

- [x] **1.2 File upload and drag-drop for specs**
  - Dragging a `.json` or `.yaml`/`.yml` file onto either input pane loads its contents into that
    pane's text state (visible in the paste box) without a page reload.
  - A file-picker button offers the same behavior for non-drag input.
  - Dropping a non-JSON/YAML file (e.g. `.png`) shows an inline error naming the pane and does
    not clear whatever was already loaded there.

- [x] **1.3 Integrate \$ref resolution into the compare pipeline**
  - Two specs that are structurally identical but differ only in `$ref` organization (e.g. one
    inlines a schema, the other references it via `components/schemas`) produce zero diff nodes.
  - A spec containing a circular `$ref` (a schema that references itself, directly or via a
    cycle of 2+ schemas) resolves and diffs without hanging or throwing.
  - Existing `resolveRefs`/`diffSpecs` unit tests continue to pass and gain coverage for a
    multi-hop (A→B→C) reference chain.

- [x] **1.4 Design polish: input panel and tree adopt the blueprint direction**
  - Input panes, buttons, and the tree container use the tokens and type pairing from
    `docs/DESIGN.md` (Plex Mono/Sans loaded, cyanotype palette applied) — no default browser
    styling remains on the compare button or textareas.
  - The two-pane input bar collapses to the single-line summary strip described in
    `docs/DESIGN.md`'s layout intent once a comparison has run.

## Epic 2 — Compatibility Rule Engine

Extends the path-level scaffold diff into the full rule set defined in `docs/VISION.md`, so every
verdict has real API-semantics reasoning behind it, not just presence/absence of a path.

- [x] **2.1 Operation-level breaking/safe rules**
  - Removing an HTTP method from an existing path (e.g. `DELETE /users/{id}` removed while
    `GET /users/{id}` remains) produces a breaking node scoped to that operation, not the whole
    path.
  - Adding a new HTTP method to an existing path produces a safe node.
  - Each node's `reason` text names the method and path (e.g. "DELETE /users/{id} was removed").

- [x] **2.2 Parameter-level rules**
  - Adding a new required parameter (path, query, or header) to an existing operation is flagged
    breaking, with a reason citing the parameter name and location.
  - Removing a parameter, or changing a required parameter to optional, is flagged safe.
  - Narrowing a parameter's declared type (e.g. `string` → `integer`, or adding an `enum`
    restriction where none existed) is flagged breaking.

- [x] **2.3 Request/response body schema field rules**
  - Adding a new required field to a request body schema is flagged breaking; adding an optional
    field is flagged safe.
  - Removing a field previously guaranteed present in a response schema is flagged breaking;
    adding a new response field is flagged safe.
  - Changing a schema field's `type` to an incompatible one (e.g. `string` → `object`) is flagged
    breaking in both request and response directions.

- [x] **2.4 Enum and format narrowing rules**
  - Removing a value from an existing `enum` is flagged breaking (a client relying on that value
    being accepted, or receiving it, would break); adding a new enum value is flagged safe.
  - Tightening a `format` (e.g. `string` → `string`/`date-time`) where the old spec accepted any
    string is flagged breaking; relaxing a format constraint is flagged safe.

- [x] **2.5 Design polish: rule-category iconography and reason readability**
  - Each rule category (path, operation, parameter, schema field, enum/format) has a small
    inline glyph in the tree consistent with the blueprint direction (hairline-stroke icons, not
    filled emoji).
  - Reason text passes a readability check: every reason is a single sentence under ~120
    characters, rendered in `--text` on `--surface-1`/`--surface-2` at ≥4.5:1 contrast.

## Epic 3 — Usability and Sharing

Turns the working diff engine into the "pre-release gut-check" tool described in the vision:
fast to scan, safe to trust on malformed input, and easy to hand to a teammate.

- [x] **3.1 Breaking-only filter and summary rail**
  - Toggling "breaking only" hides every safe leaf node and any branch whose entire subtree is
    safe, while keeping branch nodes that contain at least one breaking descendant expanded down
    to it.
  - The summary rail's breaking/safe counts update live as the filter is toggled and always match
    the visible (or, when off, total) leaf counts.

- [x] **3.2 Shareable comparison link**
  - After a successful compare, clicking "Share" produces a URL that, when opened in a fresh
    browser tab (no prior state), reproduces the identical diff tree without re-uploading either
    spec.
  - The encoded link works for specs up to at least 50KB combined without erroring.

- [x] **3.3 Malformed input handling**
  - Pasting invalid JSON or invalid YAML into either pane shows an inline, pane-scoped parse
    error (with line/column if available) instead of a blank tree or a thrown exception.
  - Pasting well-formed JSON/YAML that isn't a valid OpenAPI document (e.g. missing `openapi` and
    `paths` keys) shows a clear "this doesn't look like an OpenAPI spec" message rather than
    silently producing an empty diff.

- [x] **3.4 Markdown export of the diff tree**
  - An "Export as Markdown" action produces a document listing every breaking change first (with
    its reason), then every safe change, in a format that renders correctly when pasted into a
    GitHub PR description.
  - The exported counts match the on-screen summary rail counts at the time of export.

- [ ] **3.5 Design polish: responsive layout and accessibility pass**
  - The full app is usable with no horizontal scroll and no overlapping elements at 390px, 768px,
    and 1440px viewport widths.
  - Every interactive control (compare button, filter toggle, share/export buttons, tree
    expand/collapse) is reachable via keyboard `Tab` order and shows a visible focus ring using
    `--accent`.
  - Icon-only buttons (expand/collapse, filter pills) carry an `aria-label`.
