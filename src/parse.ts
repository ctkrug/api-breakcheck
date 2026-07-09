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
