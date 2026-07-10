# Design

## Aesthetic direction

**Blueprint/technical.** API Breakcheck reads like an engineering blueprint for a spec: a pale
cyanotype backdrop with a fine grid, precise hairline rules, and annotations that look drafted,
not decorated. The tone is confident and exact — this is a tool for people who read type
signatures for fun — not playful, not corporate-SaaS. It's a **light** technical surface (not
another dark-mode dev tool), which also keeps the portfolio from converging on the usual
terminal/glassy-dark treatment.

## Tokens

| Token                 | Value                      | Notes                                                        |
| --------------------- | -------------------------- | ------------------------------------------------------------ |
| `--bg`                | `#EAF2F6`                  | pale cyanotype blue, the "blueprint paper"                   |
| `--surface-1`         | `#F6FAFC`                  | panel background (spec input, tree container)                |
| `--surface-2`         | `#DCE9EF`                  | recessed / hover surface, nested tree rows                   |
| `--text`              | `#0B2B3C`                  | deep blueprint ink                                           |
| `--text-muted`        | `#4C6B79`                  | secondary labels, path breadcrumbs                           |
| `--accent`            | `#0F6FA3`                  | primary accent — links, focus rings, safe-adjacent UI chrome |
| `--support`           | `#C97A2B`                  | warm drafting-pencil orange, used sparingly for callouts     |
| `--danger` (breaking) | `#B03636`                  | breaking-change red, desaturated enough to sit on cyan paper |
| `--success` (safe)    | `#256F46`                  | safe-change green                                            |
| `--grid-line`         | `rgba(15, 111, 163, 0.14)` | the blueprint grid overlay                                   |

**Type pairing:** [IBM Plex Mono](https://fonts.google.com/specimen/IBM+Plex+Mono) for the
display face (wordmark, headings, and every path/schema token — the tool is _about_ text
diffing, so structural text should look drafted-in-monospace) paired with
[IBM Plex Sans](https://fonts.google.com/specimen/IBM+Plex+Sans) for body copy and UI labels.
System fallback stack: `"IBM Plex Mono", ui-monospace, "SF Mono", Consolas, monospace` and
`"IBM Plex Sans", -apple-system, "Segoe UI", sans-serif`.

**Spacing:** 4px base unit (4/8/12/16/24/32/48/64).

**Corner radius:** 4px on inputs and buttons, 2px on tree-row hover states — drafted, not soft.

**Shadow/depth:** no soft blurred shadows. Depth comes from 1px hairline borders in
`--grid-line`-adjacent tones plus a single flat offset (2px, `rgba(11,43,60,0.12)`) on raised
surfaces (upload panel, modals) — like a drop-shadow on drafting paper, not a glow.

**Motion:** UI transitions 150ms ease-out (panel open/close, hover). Tree node expand/collapse
120ms ease-out with a slight height + opacity tween, not an instant snap. No game-style "juice"
needed — this is a precision tool, not a toy — but every state change gets a deliberate,
snappy transition so the tool feels responsive rather than static.

## Layout intent

The hero **is the diff tree**. Above it sits a compact two-pane input bar (old spec / new spec,
each a drop zone + paste target) that collapses to a slim strip once a diff has been run, so the
tree can claim the vast majority of the viewport.

- **Desktop (1440×900):** two-pane spec input across the top (each pane ~50% width, ~15vh) that
  collapses to a single-line summary strip ("comparing `old.yaml` → `new.yaml` · re-run") once a
  diff exists. Below it, the diff tree fills the remaining ≥70vh, with a slim left-hand summary
  rail (breaking count, safe count, filter toggle) at ~220px and the tree taking the rest.
- **Phone (390×844):** input panes stack vertically, each full-width, collapsing the same way
  after a run. The summary rail becomes a horizontal sticky bar above the tree (counts + filter
  as pill buttons) so the tree still gets the majority of vertical space.
- No dead space: the blueprint grid texture fills the background everywhere the tree/input
  panels don't, so the page never reads as "mostly empty."

## Signature detail

The wordmark renders as a drafted schematic: **API Breakcheck** set in Plex Mono with a small
inline glyph — an open bracket `[` and a check mark sharing a stroke weight with the grid
hairlines — animated on load with a 400ms "drawn-on" stroke reveal (SVG `stroke-dashoffset`
tween), like a pen tracing the line. It plays once per session load, respects
`prefers-reduced-motion` (skips straight to the final state), and doubles as the favicon glyph
(the bracket+check mark alone, on a `--bg` circle).

## Notes

This is a data/diff tool, not a game — the "juice plan" (D1 §5 movement tween / impact feedback /
win celebration / synth SFX) doesn't apply. The equivalent craft requirement here is: every state
(idle, dragging a file over a drop zone, parsing, diffed, error) is explicitly designed per D2,
and the wordmark stroke-reveal above serves as the one signature flourish.
