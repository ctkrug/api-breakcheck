import { describe, expect, it } from "vitest";
import { diffOperation, subtreeHasBreaking } from "../src/diff/diffOperation";
import type { DiffNode } from "../src/diff/types";

const flat = (nodes: DiffNode[]): DiffNode[] => nodes.flatMap((n) => [n, ...flat(n.children)]);
const param = (over: Record<string, unknown>) => ({
  name: "q",
  in: "query",
  schema: { type: "string" },
  ...over,
});

describe("diffOperation — parameter transitions", () => {
  it("flags an existing parameter becoming required as breaking", () => {
    const nodes = diffOperation(
      { parameters: [param({ required: false })] },
      { parameters: [param({ required: true })] },
      "/paths/x/get",
    );
    const node = flat(nodes).find((n) => n.path.endsWith("#required"));
    expect(node?.severity).toBe("breaking");
    expect(node?.reason).toContain("now required");
  });

  it("treats an existing parameter becoming optional as safe", () => {
    const nodes = diffOperation(
      { parameters: [param({ required: true })] },
      { parameters: [param({ required: false })] },
      "/paths/x/get",
    );
    const node = flat(nodes).find((n) => n.path.endsWith("#required"));
    expect(node?.severity).toBe("safe");
    expect(node?.reason).toContain("now optional");
  });

  it("treats a removed parameter as safe (client simply stops sending it)", () => {
    const nodes = diffOperation(
      { parameters: [param({ required: true })] },
      { parameters: [] },
      "/paths/x/get",
    );
    const node = flat(nodes).find((n) => n.category === "parameter");
    expect(node?.severity).toBe("safe");
    expect(node?.reason).toContain("was removed");
  });

  it("treats a new optional parameter as safe", () => {
    const nodes = diffOperation(
      { parameters: [] },
      { parameters: [param({ required: false })] },
      "/paths/x/get",
    );
    const node = flat(nodes).find((n) => n.category === "parameter");
    expect(node?.severity).toBe("safe");
    expect(node?.reason).toContain("New optional");
  });

  it("matches parameters by name AND location, not name alone", () => {
    // Same name `q` in two locations: dropping the query one is safe, but a new
    // required header `q` is breaking — they must not be treated as the same param.
    const nodes = diffOperation(
      { parameters: [param({ in: "query", required: false })] },
      { parameters: [param({ in: "header", required: true })] },
      "/paths/x/get",
    );
    const flatNodes = flat(nodes);
    expect(flatNodes.some((n) => n.severity === "breaking")).toBe(true);
    expect(flatNodes.some((n) => n.severity === "safe")).toBe(true);
  });

  it("ignores non-object entries in the parameters array", () => {
    const nodes = diffOperation(
      { parameters: [null, 42, "x", param({ required: false })] },
      { parameters: [param({ required: false })] },
      "/paths/x/get",
    );
    expect(nodes).toEqual([]); // no meaningful change once junk is filtered
  });

  it("ignores a malformed parameter object missing name or in", () => {
    const nodes = diffOperation(
      { parameters: [{ in: "query", schema: { type: "string" } }, param({ required: false })] },
      { parameters: [{ name: "q" }, param({ required: false })] },
      "/paths/x/get",
    );
    expect(nodes).toEqual([]); // no meaningful change once the malformed entries are filtered
  });
});

describe("diffOperation — request body media types", () => {
  it("falls back to the first media type when application/json is absent", () => {
    const body = (type: string) => ({
      post: undefined,
      requestBody: {
        content: { "application/xml": { schema: { type } } },
      },
    });
    const nodes = diffOperation(body("string"), body("integer"), "/paths/x/post");
    expect(nodes.some(subtreeHasBreaking)).toBe(true);
  });
});
