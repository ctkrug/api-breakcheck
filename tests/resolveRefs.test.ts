import { describe, expect, it } from "vitest";
import { resolveRefs } from "../src/diff/resolveRefs";

describe("resolveRefs", () => {
  it("inlines a simple local $ref", () => {
    const doc = {
      components: {
        schemas: {
          User: { type: "object", properties: { id: { type: "string" } } },
        },
      },
      target: { $ref: "#/components/schemas/User" },
    };

    const resolved = resolveRefs(doc) as any;
    expect(resolved.target).toEqual({
      type: "object",
      properties: { id: { type: "string" } },
    });
  });

  it("terminates on a circular $ref instead of recursing forever", () => {
    const doc = {
      components: {
        schemas: {
          Node: {
            type: "object",
            properties: { next: { $ref: "#/components/schemas/Node" } },
          },
        },
      },
    };

    const resolved = resolveRefs(doc) as any;
    const node = resolved.components.schemas.Node;
    expect(node.properties.next).toEqual({ $ref: "#/components/schemas/Node" });
  });
});
