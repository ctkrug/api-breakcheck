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

  it("keeps an external (non-local) $ref in place instead of throwing", () => {
    const doc = {
      openapi: "3.0.0",
      target: { $ref: "./models.yaml#/User" },
    };
    const resolved = resolveRefs(doc) as unknown as { target: { $ref: string } };
    expect(resolved.target).toEqual({ $ref: "./models.yaml#/User" });
  });

  it("keeps a dangling local $ref in place instead of throwing", () => {
    const doc = {
      openapi: "3.0.0",
      target: { $ref: "#/components/schemas/DoesNotExist" },
    };
    const resolved = resolveRefs(doc) as unknown as { target: { $ref: string } };
    expect(resolved.target).toEqual({ $ref: "#/components/schemas/DoesNotExist" });
  });

  it("resolves a local $ref whose target is a falsy value", () => {
    const doc = {
      components: { schemas: { Zero: 0 } },
      target: { $ref: "#/components/schemas/Zero" },
    };
    const resolved = resolveRefs(doc) as unknown as { target: unknown };
    expect(resolved.target).toBe(0);
  });
});
