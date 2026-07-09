import { describe, expect, it } from "vitest";
import { diffSpecs } from "../src/diff/diffEngine";
import { resolveRefs } from "../src/diff/resolveRefs";

/**
 * Story 1.3: the compare pipeline resolves $ref before diffing, so specs that
 * are structurally identical but organized differently produce zero noise.
 */
describe("$ref-aware compare", () => {
  it("produces zero diff when one spec inlines a schema the other references", () => {
    const inlined = {
      openapi: "3.0.0",
      info: { title: "T", version: "1" },
      paths: {
        "/u": {
          post: {
            requestBody: {
              content: {
                "application/json": {
                  schema: { type: "object", properties: { id: { type: "string" } } },
                },
              },
            },
          },
        },
      },
    };
    const referenced = {
      openapi: "3.0.0",
      info: { title: "T", version: "1" },
      components: {
        schemas: { User: { type: "object", properties: { id: { type: "string" } } } },
      },
      paths: {
        "/u": {
          post: {
            requestBody: {
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/User" } },
              },
            },
          },
        },
      },
    };

    const result = diffSpecs(inlined, referenced);
    expect(result.breakingCount).toBe(0);
    expect(result.safeCount).toBe(0);
    expect(result.root.children).toEqual([]);
  });

  it("resolves a multi-hop A -> B -> C reference chain", () => {
    const doc = {
      components: {
        schemas: {
          A: { $ref: "#/components/schemas/B" },
          B: { $ref: "#/components/schemas/C" },
          C: { type: "object", properties: { leaf: { type: "boolean" } } },
        },
      },
      target: { $ref: "#/components/schemas/A" },
    };
    const resolved = resolveRefs(doc) as unknown as {
      target: { type: string; properties: { leaf: { type: string } } };
    };
    expect(resolved.target).toEqual({ type: "object", properties: { leaf: { type: "boolean" } } });
  });

  it("diffs specs containing a circular $ref without hanging or throwing", () => {
    const make = (extraField: boolean) => ({
      openapi: "3.0.0",
      info: { title: "T", version: "1" },
      components: {
        schemas: {
          Tree: {
            type: "object",
            properties: {
              value: { type: "string" },
              ...(extraField ? { label: { type: "string" } } : {}),
              child: { $ref: "#/components/schemas/Tree" },
            },
          },
        },
      },
      paths: {
        "/tree": {
          get: {
            responses: {
              "200": {
                content: { "application/json": { schema: { $ref: "#/components/schemas/Tree" } } },
              },
            },
          },
        },
      },
    });

    // Old spec guarantees `label` in the response; new spec drops it -> breaking,
    // and the diff must terminate despite the self-referential Tree schema.
    expect(() => diffSpecs(make(true), make(false))).not.toThrow();
    const result = diffSpecs(make(true), make(false));
    expect(result.breakingCount).toBe(1);
  });
});
