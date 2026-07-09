# Architecture

A client-side TypeScript app (Vite). Two OpenAPI specs go in; a red/green diff
tree comes out. No backend, no network calls during a compare — parsing, `$ref`
resolution, and diffing all run in the browser tab.

## Data flow

```
spec text (old / new)
  → parseSpec            (src/parse.ts)        YAML/JSON → object, or inline error
  → validateOpenApi      (src/validate.ts)     structural sanity (openapi 3.x + paths)
  → diffSpecs            (src/diff/diffEngine.ts)
        → resolveRefs    (src/diff/resolveRefs.ts)   inline local $ref, cycle-safe
        → diffPath / diffOperation / diffSchema      semantic comparison
            → compat.ts  (type / enum / format rules)
  → DiffResult { root: DiffNode, breakingCount, safeCount }
  → renderTree           (src/ui/tree.ts)      DiffNode → DOM
```

## Modules

### Diff engine (`src/diff/`) — pure, framework-free, fully unit-tested

- **types.ts** — `DiffNode` (path, label, severity, `category`, reason, children),
  `DiffResult`, `Severity`, `Category`.
- **resolveRefs.ts** — resolves local `#/...` `$ref` pointers; keeps the pointer
  at a cycle boundary so resolution always terminates.
- **compat.ts** — the auditable rule primitives: `isTypeChangeBreaking`,
  `isEnumChangeBreaking`, `isFormatChangeBreaking`, `removedEnumValues`, `typesOf`.
  Every verdict traces to one of these named functions.
- **diffSchema.ts** — recursive, direction-aware (`request` vs `response`) schema
  field diff: type/enum/format narrowing, required-status transitions, field
  add/remove. Add/remove semantics invert between request and response.
- **diffOperation.ts** — parameter matching (by `name`+`in`), request/response
  body schema diffs; groups children into parameters/requestBody/responses
  branches. Exports `subtreeHasBreaking` (used by the tree filter too).
- **diffEngine.ts** — top-level orchestration: `$ref`-resolve both specs, walk
  paths → methods, roll up branch severity, count red/green leaves.

### Input & output helpers (`src/`)

- **parse.ts** — `parseSpec`: YAML (superset of JSON) → discriminated result with
  line/column on failure. Never throws.
- **validate.ts** — `validateOpenApi`: rejects non-OpenAPI documents.
- **share.ts** — `encodeShare`/`decodeShare`: both specs ↔ a base64url hash
  fragment. Comparison lives in the link; nothing is sent to a server.
- **export/markdown.ts** — `toMarkdown`/`collectLeaves`: GitHub-ready report,
  breaking changes first.
- **examples.ts** — the Pet Store demo pair for "Load example".

### UI (`src/ui/`) — DOM, no framework

- **dom.ts** — `h()` hyperscript helper.
- **icons.ts** — per-category hairline SVG glyphs.
- **inputPane.ts** — one spec pane: textarea + drop zone + file picker + inline error.
- **tree.ts** — `renderTree` (expandable/collapsible tree) + `visibleChildren`
  (breaking-only filter, pure/testable).
- **main.ts** — app entry: mounts masthead, panes, actions, summary rail, tree;
  handles compare, filter, share, export, collapse-to-strip, hash restore.

## Run / test / build

```
npm run dev         # local dev server
npm test            # vitest (pure logic + happy-dom UI/app tests)
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm run build       # tsc --noEmit && vite build -> dist/ (base-relative, subpath-safe)
```

The build output in `dist/` is static and uses relative asset paths
(`vite.config.ts` sets `base: "./"`), so it deploys under a subpath such as
`apps.charliekrug.com/api-breakcheck/`.
