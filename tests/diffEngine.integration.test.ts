import { describe, expect, it } from "vitest";
import { diffSpecs } from "../src/diff/diffEngine";

const spec = (paths: Record<string, unknown>) => ({
  openapi: "3.0.0",
  info: { title: "T", version: "1.0.0" },
  paths,
});

/** Depth-first flatten of every node, for locating a leaf by a path fragment. */
function flatten(node: { children: unknown[] } & Record<string, unknown>): Record<string, unknown>[] {
  const kids = (node.children as Record<string, unknown>[]) ?? [];
  return [node, ...kids.flatMap((c) => flatten(c as never))];
}

describe("diffSpecs — operation level (story 2.1)", () => {
  it("scopes a removed method to that operation, not the whole path", () => {
    const oldS = spec({ "/users/{id}": { get: {}, delete: {} } });
    const newS = spec({ "/users/{id}": { get: {} } });
    const result = diffSpecs(oldS, newS);
    const removed = flatten(result.root).find((n) => n.label === "DELETE /users/{id}");
    expect(removed?.severity).toBe("breaking");
    expect(String(removed?.reason)).toContain("DELETE /users/{id}");
    expect(result.breakingCount).toBe(1);
  });

  it("flags an added method as safe", () => {
    const oldS = spec({ "/users": { get: {} } });
    const newS = spec({ "/users": { get: {}, post: {} } });
    const result = diffSpecs(oldS, newS);
    expect(flatten(result.root).find((n) => n.label === "POST /users")?.severity).toBe("safe");
    expect(result.safeCount).toBe(1);
  });
});

describe("diffSpecs — parameter level (story 2.2)", () => {
  const withParam = (param: unknown) =>
    spec({ "/search": { get: { parameters: param ? [param] : [] } } });

  it("flags a newly-added required query parameter as breaking", () => {
    const oldS = withParam(null);
    const newS = withParam({ name: "q", in: "query", required: true, schema: { type: "string" } });
    const result = diffSpecs(oldS, newS);
    const node = flatten(result.root).find((n) => n.category === "parameter");
    expect(node?.severity).toBe("breaking");
    expect(String(node?.reason)).toContain("q");
  });

  it("treats making a required parameter optional as safe", () => {
    const oldS = withParam({ name: "q", in: "query", required: true, schema: { type: "string" } });
    const newS = withParam({ name: "q", in: "query", required: false, schema: { type: "string" } });
    const result = diffSpecs(oldS, newS);
    expect(result.breakingCount).toBe(0);
    expect(result.safeCount).toBe(1);
  });

  it("flags narrowing a parameter's type as breaking", () => {
    const oldS = withParam({ name: "q", in: "query", schema: { type: "string" } });
    const newS = withParam({ name: "q", in: "query", schema: { type: "integer" } });
    expect(diffSpecs(oldS, newS).breakingCount).toBe(1);
  });
});

describe("diffSpecs — request/response bodies (story 2.3)", () => {
  const op = (reqSchema: unknown, respSchema: unknown) => ({
    post: {
      requestBody: { content: { "application/json": { schema: reqSchema } } },
      responses: { "200": { content: { "application/json": { schema: respSchema } } } },
    },
  });

  it("flags a new required request field as breaking and a removed response field as breaking", () => {
    const oldS = spec({
      "/things": op(
        { type: "object", properties: { a: { type: "string" } } },
        { type: "object", properties: { x: { type: "string" }, y: { type: "string" } } },
      ),
    });
    const newS = spec({
      "/things": op(
        { type: "object", properties: { a: { type: "string" }, b: { type: "string" } }, required: ["b"] },
        { type: "object", properties: { x: { type: "string" } } },
      ),
    });
    const result = diffSpecs(oldS, newS);
    expect(result.breakingCount).toBe(2);
  });
});

describe("diffSpecs — counts always match rendered leaves", () => {
  it("reports zero for identical specs", () => {
    const s = spec({ "/a": { get: {} } });
    const result = diffSpecs(s, structuredClone(s));
    expect(result.breakingCount).toBe(0);
    expect(result.safeCount).toBe(0);
    expect(result.root.children).toEqual([]);
  });
});
