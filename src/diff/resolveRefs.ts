import type { OpenApiDocument } from "./types";

/**
 * Resolves every local `$ref` pointer (e.g. "#/components/schemas/User") in an
 * OpenAPI document, replacing it with the fully realized object it points to.
 *
 * Circular refs are preserved as-is (not inlined again) so resolution always
 * terminates: a schema that references itself keeps one `$ref` hop rather
 * than being expanded infinitely.
 *
 * Refs that can't be resolved locally — external pointers (e.g.
 * "./models.yaml#/User") and dangling local pointers to a component that
 * doesn't exist — are left in place as `{ $ref }` rather than throwing. A
 * spec carrying such refs (extremely common in the wild) still diffs the parts
 * that do resolve, and identical unresolved pointers compare as equal, so the
 * tool degrades gracefully instead of wedging the whole compare.
 */
export function resolveRefs(document: OpenApiDocument): OpenApiDocument {
  const seen = new WeakSet<object>();

  /** Resolves a local pointer; `found` distinguishes "missing" from a falsy target. */
  function resolvePointer(pointer: string): { found: boolean; value: unknown } {
    if (!pointer.startsWith("#/")) {
      return { found: false, value: undefined }; // external ref — not resolvable client-side
    }
    const segments = pointer
      .slice(2)
      .split("/")
      .map((segment) => segment.replace(/~1/g, "/").replace(/~0/g, "~"));

    let node: unknown = document;
    for (const segment of segments) {
      if (typeof node !== "object" || node === null || !(segment in node)) {
        return { found: false, value: undefined }; // dangling pointer — target absent
      }
      node = (node as Record<string, unknown>)[segment];
    }
    return { found: true, value: node };
  }

  function walk(node: unknown, activeRefs: ReadonlySet<string>): unknown {
    if (Array.isArray(node)) {
      return node.map((item) => walk(item, activeRefs));
    }
    if (typeof node !== "object" || node === null) {
      return node;
    }

    const obj = node as Record<string, unknown>;
    if (typeof obj.$ref === "string") {
      const pointer = obj.$ref;
      if (activeRefs.has(pointer)) {
        // Circular reference: keep the pointer instead of expanding forever.
        return { $ref: pointer };
      }
      const { found, value } = resolvePointer(pointer);
      if (!found) {
        // External or dangling pointer: keep it verbatim so the compare survives.
        return { $ref: pointer };
      }
      return walk(value, new Set([...activeRefs, pointer]));
    }

    if (seen.has(obj)) {
      return obj;
    }
    seen.add(obj);

    const resolved: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      resolved[key] = walk(value, activeRefs);
    }
    return resolved;
  }

  return walk(document, new Set()) as OpenApiDocument;
}
