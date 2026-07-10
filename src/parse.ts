import { parse as parseYaml, YAMLParseError } from "yaml";
import type { OpenApiDocument } from "./diff/types";

export interface ParseSuccess {
  ok: true;
  value: OpenApiDocument;
}

export interface ParseFailure {
  ok: false;
  /** Single-line, human-readable failure reason (no stack trace). */
  message: string;
  line?: number;
  column?: number;
}

export type ParseResult = ParseSuccess | ParseFailure;

/**
 * Pathologically deep flow-style nesting ({"a":{"a":{"a":...}}}) blows the
 * YAML parser's recursive-descent call stack, which surfaces as a raw
 * "Maximum call stack size exceeded" JS error rather than a designed one. No
 * real OpenAPI document nests anywhere near this deep, so reject early.
 */
const MAX_NESTING_DEPTH = 200;

/** Max depth of unquoted `{`/`[` nesting in `text`, skipping quoted-string content. */
function maxFlowNestingDepth(text: string): number {
  let depth = 0;
  let maxDepth = 0;
  let quote: '"' | "'" | null = null;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quote) {
      if (quote === '"' && ch === "\\") i += 1;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") quote = ch;
    else if (ch === "{" || ch === "[") maxDepth = Math.max(maxDepth, (depth += 1));
    else if (ch === "}" || ch === "]") depth -= 1;
  }
  return maxDepth;
}

/**
 * Parses spec text as YAML, which is a superset of JSON so it accepts both.
 * Returns a designed failure state (with line/column when the parser provides
 * one) rather than throwing, so callers render an inline error instead of a
 * blank tree or a console stack trace (backlog story 3.3).
 */
export function parseSpec(text: string): ParseResult {
  const trimmed = text.trim();
  if (trimmed === "") {
    return { ok: false, message: "Input is empty — paste or drop an OpenAPI document." };
  }
  if (maxFlowNestingDepth(trimmed) > MAX_NESTING_DEPTH) {
    return {
      ok: false,
      message: `Document is nested too deep (over ${MAX_NESTING_DEPTH} levels) — this looks malformed.`,
    };
  }

  let value: unknown;
  try {
    value = parseYaml(trimmed, { prettyErrors: false });
  } catch (err) {
    if (err instanceof YAMLParseError) {
      const pos = err.linePos?.[0];
      return {
        ok: false,
        message: firstLine(err.message),
        line: pos?.line,
        column: pos?.col,
      };
    }
    return { ok: false, message: err instanceof Error ? firstLine(err.message) : String(err) };
  }

  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return { ok: false, message: "Expected an object at the document root, not a scalar or list." };
  }

  return { ok: true, value: value as OpenApiDocument };
}

function firstLine(message: string): string {
  return message.split("\n")[0]?.trim() ?? message;
}
