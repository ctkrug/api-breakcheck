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

    const resolved = resolveRefs(doc) as unknown as {
      target: { type: string; properties: { id: { type: string } } };
    };
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

    interface NodeSchema {
      type: string;
      properties: { next: NodeSchema | { $ref: string } };
    }

    const resolved = resolveRefs(doc) as unknown as {
      components: { schemas: { Node: NodeSchema } };
    };
    const node = resolved.components.schemas.Node;
    // First hop resolves to the full schema; the self-reference one level down
    // is where the cycle guard kicks in and keeps the raw pointer.
    const firstHop = node.properties.next as NodeSchema;
    expect(firstHop.properties.next).toEqual({
      $ref: "#/components/schemas/Node",
    });
  });
});
