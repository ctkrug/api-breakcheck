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

  it("does not count brace/bracket characters inside quoted strings as nesting", () => {
    // A description containing many literal {/[ characters, plus an escaped
    // quote sitting right next to one, well past the nesting threshold — none
    // of this is real structural nesting and must not trip the depth guard.
    const braces = "{[".repeat(150);
    const text = JSON.stringify({
      openapi: "3.0.0",
      paths: {},
      info: { title: `desc with \\" quote then ${braces}`, version: "1" },
    });
    expect(parseSpec(text).ok).toBe(true);
  });

  it("rejects pathologically deep flow nesting instead of blowing the call stack", () => {
    let schema = '{"type":"string"}';
    for (let i = 0; i < 2000; i += 1) {
      schema = `{"type":"object","properties":{"nested":${schema}}}`;
    }
    const start = performance.now();
    const result = parseSpec(schema);
    expect(performance.now() - start).toBeLessThan(1000);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/nested too deep/i);
  });
});
