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

  it("flags an added enum value as a safe change", () => {
    const nodes = run(
      { type: "object", properties: { s: { enum: ["a", "b"] } } },
      { type: "object", properties: { s: { enum: ["a", "b", "c"] } } },
      "request",
    );
    expect(nodes.find((n) => n.category === "enum")?.severity).toBe("safe");
  });

  it("treats a reordered enum with the same values as no change", () => {
    const nodes = run(
      { type: "object", properties: { s: { enum: ["a", "b", "c"] } } },
      { type: "object", properties: { s: { enum: ["c", "a", "b"] } } },
      "request",
    );
    expect(nodes.filter((n) => n.category === "enum")).toEqual([]);
  });

  it("reports no nodes for identical schemas", () => {
    const schema = { type: "object", properties: { a: { type: "string" } }, required: ["a"] };
    expect(run(schema, { ...schema }, "request")).toEqual([]);
  });

  it("treats a relaxed (dropped) format as a safe change", () => {
    const nodes = run(
      { type: "object", properties: { t: { type: "string", format: "date-time" } } },
      { type: "object", properties: { t: { type: "string" } } },
      "request",
    );
    const fmt = nodes.find((n) => n.category === "format");
    expect(fmt?.severity).toBe("safe");
    expect(fmt?.reason).toContain("relaxed");
  });

  it("flags a newly-introduced enum constraint as breaking", () => {
    const nodes = run(
      { type: "object", properties: { s: { type: "string" } } },
      { type: "object", properties: { s: { enum: ["a", "b"] } } },
      "request",
    );
    const enumNode = nodes.find((n) => n.category === "enum");
    expect(enumNode?.severity).toBe("breaking");
    expect(enumNode?.reason).toContain("enum constraint");
  });
});

describe("diffSchema — safe optionality transitions", () => {
  it("treats a request field becoming optional as safe", () => {
    const nodes = run(
      { type: "object", properties: { a: { type: "string" } }, required: ["a"] },
      { type: "object", properties: { a: { type: "string" } } },
      "request",
    );
    const node = nodes.find((n) => n.path.endsWith("#required"));
    expect(node?.severity).toBe("safe");
    expect(node?.reason).toContain("now optional");
  });

  it("treats a response field becoming always-present as safe", () => {
    const nodes = run(
      { type: "object", properties: { a: { type: "string" } } },
      { type: "object", properties: { a: { type: "string" } }, required: ["a"] },
      "response",
    );
    const node = nodes.find((n) => n.path.endsWith("#required"));
    expect(node?.severity).toBe("safe");
    expect(node?.reason).toContain("always present");
  });

  it("treats a removed request field as safe with an explanatory reason", () => {
    const nodes = run(
      { type: "object", properties: { a: { type: "string" }, b: { type: "string" } } },
      { type: "object", properties: { a: { type: "string" } } },
      "request",
    );
    const b = nodes.find((n) => n.label === "b");
    expect(b?.severity).toBe("safe");
    expect(b?.reason).toContain("was removed");
  });
});

describe("diffSchema — misc", () => {
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
