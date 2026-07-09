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
});
