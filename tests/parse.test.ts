import { describe, expect, it } from "vitest";
import { parseSpec } from "../src/parse";

describe("parseSpec", () => {
  it("parses a JSON document", () => {
    const result = parseSpec('{"openapi":"3.0.0","paths":{}}');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.openapi).toBe("3.0.0");
  });

  it("parses a YAML document", () => {
    const result = parseSpec("openapi: 3.0.0\npaths:\n  /a:\n    get: {}\n");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.paths).toBeTypeOf("object");
  });

  it("reports an empty input as a designed error", () => {
    const result = parseSpec("   \n  ");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/empty/i);
  });

  it("reports invalid YAML with a line number", () => {
    const result = parseSpec("openapi: 3.0.0\n  bad: : :\n:");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toBeTruthy();
      expect(result.message).not.toContain("\n");
    }
  });

  it("rejects a scalar or list at the document root", () => {
    expect(parseSpec("42").ok).toBe(false);
    expect(parseSpec("- a\n- b").ok).toBe(false);
  });

  it("never throws on arbitrary garbage input", () => {
    expect(() => parseSpec("}{ this is not valid : : :")).not.toThrow();
  });
});
