import { describe, expect, it } from "vitest";
import { diffSchema, type Direction } from "../src/diff/diffSchema";
import type { Schema } from "../src/diff/compat";

function run(oldS: Schema, newS: Schema, direction: Direction) {
  return diffSchema(oldS, newS, { path: "/body", label: "body", direction });
}

describe("diffSchema — request direction", () => {
  it("flags a new required field as breaking", () => {
    const nodes = run(
      { type: "object", properties: { a: { type: "string" } } },
      {
        type: "object",
        properties: { a: { type: "string" }, b: { type: "string" } },
        required: ["b"],
      },
      "request",
    );
    const b = nodes.find((n) => n.label === "b");
    expect(b?.severity).toBe("breaking");
  });

  it("treats a new optional field as safe", () => {
    const nodes = run(
      { type: "object", properties: { a: { type: "string" } } },
      { type: "object", properties: { a: { type: "string" }, b: { type: "string" } } },
      "request",
    );
    expect(nodes.find((n) => n.label === "b")?.severity).toBe("safe");
  });

  it("flags optional -> required transition as breaking", () => {
    const nodes = run(
      { type: "object", properties: { a: { type: "string" } } },
      { type: "object", properties: { a: { type: "string" } }, required: ["a"] },
      "request",
    );
    const a = nodes.find((n) => n.path.endsWith("#required"));
    expect(a?.severity).toBe("breaking");
  });

  it("treats a removed request field as safe", () => {
    const nodes = run(
      { type: "object", properties: { a: { type: "string" }, b: { type: "string" } } },
      { type: "object", properties: { a: { type: "string" } } },
      "request",
    );
    expect(nodes.find((n) => n.label === "b")?.severity).toBe("safe");
  });
});

describe("diffSchema — response direction", () => {
  it("flags a removed response field as breaking", () => {
    const nodes = run(
      { type: "object", properties: { a: { type: "string" }, b: { type: "string" } } },
      { type: "object", properties: { a: { type: "string" } } },
      "response",
    );
    expect(nodes.find((n) => n.label === "b")?.severity).toBe("breaking");
  });

  it("treats a new response field as safe", () => {
    const nodes = run(
      { type: "object", properties: { a: { type: "string" } } },
      { type: "object", properties: { a: { type: "string" }, b: { type: "string" } } },
      "response",
    );
    expect(nodes.find((n) => n.label === "b")?.severity).toBe("safe");
  });

  it("flags required -> optional (no longer guaranteed) as breaking", () => {
    const nodes = run(
      { type: "object", properties: { a: { type: "string" } }, required: ["a"] },
      { type: "object", properties: { a: { type: "string" } } },
      "response",
    );
    expect(nodes.find((n) => n.path.endsWith("#required"))?.severity).toBe("breaking");
  });
});

describe("diffSchema — constraint changes (both directions)", () => {
  it("flags an incompatible type change on a nested field as breaking", () => {
    const nodes = run(
      { type: "object", properties: { a: { type: "string" } } },
      { type: "object", properties: { a: { type: "object" } } },
      "request",
    );
    const a = nodes.find((n) => n.label === "a" && n.category === "schema");
    expect(a?.severity).toBe("breaking");
  });

  it("flags a removed enum value as breaking", () => {
    const nodes = run(
      { type: "object", properties: { s: { enum: ["a", "b"] } } },
      { type: "object", properties: { s: { enum: ["a"] } } },
      "request",
    );
    expect(nodes.find((n) => n.category === "enum")?.severity).toBe("breaking");
  });

  it("flags a tightened format as breaking", () => {
    const nodes = run(
      { type: "object", properties: { t: { type: "string" } } },
      { type: "object", properties: { t: { type: "string", format: "date-time" } } },
      "response",
    );
    expect(nodes.find((n) => n.category === "format")?.severity).toBe("breaking");
  });

  it("reports no nodes for identical schemas", () => {
    const schema = { type: "object", properties: { a: { type: "string" } }, required: ["a"] };
    expect(run(schema, { ...schema }, "request")).toEqual([]);
  });

  it("recurses into nested object properties", () => {
    const nodes = run(
      {
        type: "object",
        properties: { outer: { type: "object", properties: { inner: { type: "string" } } } },
      },
      {
        type: "object",
        properties: { outer: { type: "object", properties: { inner: { type: "integer" } } } },
      },
      "request",
    );
    const inner = nodes.find((n) => n.path.includes("/outer/inner"));
    expect(inner?.severity).toBe("breaking");
  });
});
