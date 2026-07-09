import type { OpenApiDocument } from "./types";

/**
 * Resolves every local `$ref` pointer (e.g. "#/components/schemas/User") in an
 * OpenAPI document, replacing it with the fully realized object it points to.
 *
 * Circular refs are preserved as-is (not inlined again) so resolution always
 * terminates: a schema that references itself keeps one `$ref` hop rather
 * than being expanded infinitely.
 */
export function resolveRefs(document: OpenApiDocument): OpenApiDocument {
  const seen = new WeakSet<object>();

  function resolvePointer(pointer: string): unknown {
    if (!pointer.startsWith("#/")) {
      throw new Error(`Unsupported $ref (only local pointers are supported): ${pointer}`);
    }
    const segments = pointer
      .slice(2)
      .split("/")
      .map((segment) => segment.replace(/~1/g, "/").replace(/~0/g, "~"));

    let node: unknown = document;
    for (const segment of segments) {
      if (typeof node !== "object" || node === null) {
        throw new Error(`Cannot resolve $ref "${pointer}": path does not exist`);
      }
      node = (node as Record<string, unknown>)[segment];
    }
    return node;
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
      const target = resolvePointer(pointer);
      return walk(target, new Set([...activeRefs, pointer]));
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
