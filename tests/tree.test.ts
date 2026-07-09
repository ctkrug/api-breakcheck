// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { renderTree, visibleChildren } from "../src/ui/tree";
import { diffSpecs } from "../src/diff/diffEngine";
import type { DiffNode } from "../src/diff/types";

const spec = (paths: Record<string, unknown>) => ({ openapi: "3.0.0", info: { title: "T", version: "1" }, paths });

const mixed = () =>
  diffSpecs(spec({ "/a": { get: {}, delete: {} } }), spec({ "/a": { get: {} }, "/b": { get: {} } }));

describe("visibleChildren", () => {
  it("returns all children when the filter is off", () => {
    const root = mixed().root;
    expect(visibleChildren(root, false).length).toBe(root.children.length);
  });

  it("keeps only branches with a breaking descendant when filtering", () => {
    const root = mixed().root;
    const filtered = visibleChildren(root, true);
    expect(filtered.every(hasBreaking)).toBe(true);
    expect(filtered.length).toBeLessThan(root.children.length);
  });
});

function hasBreaking(node: DiffNode): boolean {
  return node.severity === "breaking" || node.children.some(hasBreaking);
}

describe("renderTree", () => {
  it("renders a leaf per change with a reason and severity class", () => {
    const el = renderTree(mixed().root, { breakingOnly: false });
    const breakingNodes = el.querySelectorAll(".node--breaking");
    expect(breakingNodes.length).toBeGreaterThan(0);
    expect(el.querySelector(".row__reason")?.textContent).toBeTruthy();
  });

  it("hides safe leaves in breaking-only mode", () => {
    const off = renderTree(mixed().root, { breakingOnly: false });
    const on = renderTree(mixed().root, { breakingOnly: true });
    expect(on.querySelectorAll(".node--safe").length).toBe(0);
    expect(off.querySelectorAll(".node--safe").length).toBeGreaterThan(0);
  });

  it("collapses a branch when its toggle is clicked", () => {
    const el = renderTree(mixed().root, { breakingOnly: false });
    const branch = el.querySelector(".node") as HTMLElement;
    const toggle = branch.querySelector(".row__toggle") as HTMLButtonElement;
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    toggle.click();
    expect(branch.classList.contains("collapsed")).toBe(true);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
  });

  it("shows a designed empty state for identical specs", () => {
    const s = spec({ "/a": { get: {} } });
    const el = renderTree(diffSpecs(s, structuredClone(s)).root, { breakingOnly: false });
    expect(el.querySelector(".tree__empty-title")?.textContent).toMatch(/no differences/i);
  });
});
