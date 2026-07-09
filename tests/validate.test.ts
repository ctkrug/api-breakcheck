import { describe, expect, it } from "vitest";
import { validateOpenApi } from "../src/validate";

describe("validateOpenApi", () => {
  it("accepts a minimal 3.x document with paths", () => {
    expect(validateOpenApi({ openapi: "3.0.1", paths: {} }).ok).toBe(true);
  });

  it("rejects a document missing both openapi and paths", () => {
    const result = validateOpenApi({ title: "not a spec" });
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/openapi spec/i);
  });

  it("rejects a document missing the openapi version", () => {
    expect(validateOpenApi({ paths: {} }).ok).toBe(false);
  });

  it("rejects a document missing paths", () => {
    expect(validateOpenApi({ openapi: "3.0.0" }).ok).toBe(false);
  });

  it("rejects a non-3.x openapi version", () => {
    expect(validateOpenApi({ openapi: "2.0", paths: {} }).ok).toBe(false);
  });

  it("rejects paths declared as an array", () => {
    expect(validateOpenApi({ openapi: "3.0.0", paths: [] }).ok).toBe(false);
  });
});
