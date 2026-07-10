import { describe, expect, it } from "vitest";
import { diffSpecs } from "../src/diff/diffEngine";

const base = {
  openapi: "3.0.0",
  info: { title: "Example", version: "1.0.0" },
  paths: {
    "/users": { get: {} },
    "/users/{id}": { get: {} },
  },
};

describe("diffSpecs", () => {
  it("flags a removed path as breaking", () => {
    const next = { ...base, paths: { "/users": base.paths["/users"] } };
    const result = diffSpecs(base, next);

    expect(result.breakingCount).toBe(1);
    const removed = result.root.children.find((c) => c.label === "/users/{id}");
    expect(removed?.severity).toBe("breaking");
  });

  it("flags an added path as safe", () => {
    const next = {
      ...base,
      paths: { ...base.paths, "/orders": { get: {} } },
    };
    const result = diffSpecs(base, next);

    expect(result.safeCount).toBe(1);
    const added = result.root.children.find((c) => c.label === "/orders");
    expect(added?.severity).toBe("safe");
  });

  it("reports no changes for an identical spec", () => {
    const result = diffSpecs(base, { ...base });
    expect(result.breakingCount).toBe(0);
    expect(result.safeCount).toBe(0);
  });

  it("does not crash on a null path item present in both specs", () => {
    const spec = { openapi: "3.0.0", paths: { "/x": null } };
    expect(() => diffSpecs(spec, { ...spec, paths: { "/x": null } })).not.toThrow();
    const result = diffSpecs(spec, { openapi: "3.0.0", paths: { "/x": null } });
    expect(result.root.children).toEqual([]);
  });

  it("treats a path whose only-side value is a null/scalar as add/remove", () => {
    const withPath = { openapi: "3.0.0", paths: { "/x": null } };
    const without = { openapi: "3.0.0", paths: {} };
    expect(diffSpecs(withPath, without).breakingCount).toBe(1); // removed -> breaking
    expect(diffSpecs(without, withPath).safeCount).toBe(1); // added -> safe
  });

  it("does not crash when a path item is a scalar string", () => {
    const a = { openapi: "3.0.0", paths: { "/x": "oops" } };
    const b = { openapi: "3.0.0", paths: { "/x": { get: {} } } };
    expect(() => diffSpecs(a, b)).not.toThrow();
    expect(() => diffSpecs(b, a)).not.toThrow();
  });

  it("treats a document whose paths is null/scalar as having no paths", () => {
    // validateOpenApi rejects this before diffSpecs runs in the real app, but
    // diffSpecs is a standalone pure function and must degrade, not crash.
    const malformed = { openapi: "3.0.0", paths: null };
    expect(() => diffSpecs(malformed, base)).not.toThrow();
    const result = diffSpecs(malformed, base);
    // Every path in `base` reads as newly-added against an empty path set.
    expect(result.safeCount).toBe(Object.keys(base.paths).length);
    expect(result.breakingCount).toBe(0);
  });
});
