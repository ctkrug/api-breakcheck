import type { Category } from "../diff/types";

/**
 * Hairline-stroke glyphs, one per rule category (backlog story 2.5). Drawn with
 * `currentColor` and a thin stroke to match the drafted blueprint direction —
 * deliberately not filled emoji. Each is a 16×16 SVG fragment.
 */
const GLYPHS: Record<Category, string> = {
  // route: a forked path
  path: `<path d="M2 8h5l3-4h4M10 12h4" />`,
  // operation: a method verb bracket
  operation: `<path d="M6 3 2 8l4 5M10 3l4 5-4 5" />`,
  // parameter: a slider knob on a rail
  parameter: `<path d="M2 8h12M9 5v6" /><circle cx="9" cy="8" r="1.6" />`,
  // schema field: braces
  schema: `<path d="M6 3q-2 0-2 2v1q0 2-2 2 2 0 2 2v1q0 2 2 2M10 3q2 0 2 2v1q0 2 2 2-2 0-2 2v1q0 2-2 2" />`,
  // enum: stacked options
  enum: `<path d="M3 5h10M3 8h10M3 11h6" />`,
  // format: a stamp / mask
  format: `<rect x="3" y="4" width="10" height="8" rx="1" /><path d="M6 8h4" />`,
};

export function categoryIcon(category: Category): string {
  return `<svg class="cat-icon" viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${GLYPHS[category]}</svg>`;
}

const LABELS: Record<Category, string> = {
  path: "path",
  operation: "operation",
  parameter: "parameter",
  schema: "schema field",
  enum: "enum",
  format: "format",
};

export function categoryLabel(category: Category): string {
  return LABELS[category];
}
