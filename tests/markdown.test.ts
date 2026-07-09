import { describe, expect, it } from "vitest";
import { collectLeaves, toMarkdown } from "../src/export/markdown";
import { diffSpecs } from "../src/diff/diffEngine";

const spec = (paths: Record<string, unknown>) => ({
  openapi: "3.0.0",
  info: { title: "T", version: "1" },
  paths,
});

describe("toMarkdown", () => {
  it("lists breaking changes before safe ones", () => {
    const oldS = spec({ "/a": { get: {}, delete: {} } });
    const newS = spec({ "/a": { get: {} }, "/b": { get: {} } });
    const result = diffSpecs(oldS, newS);
    const md = toMarkdown(result);

    const breakingIdx = md.indexOf("Breaking changes");
    const safeIdx = md.indexOf("Safe changes");
    expect(breakingIdx).toBeGreaterThan(-1);
    expect(safeIdx).toBeGreaterThan(breakingIdx);
  });

  it("header counts match the summary counts", () => {
    const oldS = spec({ "/a": { get: {}, delete: {} } });
    const newS = spec({ "/a": { get: {} }, "/b": { get: {} } });
    const result = diffSpecs(oldS, newS);
    const md = toMarkdown(result);
    expect(md).toContain(`**${result.breakingCount} breaking**`);
    expect(md).toContain(`**${result.safeCount} safe**`);
  });

  it("collectLeaves count matches breaking + safe totals", () => {
    const oldS = spec({ "/a": { get: {}, delete: {} } });
    const newS = spec({ "/a": { get: {} }, "/b": { get: {} } });
    const result = diffSpecs(oldS, newS);
    expect(collectLeaves(result).length).toBe(result.breakingCount + result.safeCount);
  });

  it("renders a clean 'no differences' report for identical specs", () => {
    const s = spec({ "/a": { get: {} } });
    const md = toMarkdown(diffSpecs(s, structuredClone(s)));
    expect(md).toContain("No differences found");
    expect(md).not.toContain("Breaking changes");
    // The synthetic root must not leak in as a phantom "safe change".
    expect(md).not.toContain("Safe changes");
    expect(md).not.toMatch(/\d+ safe/);
  });

  it("excludes the synthetic root from collected leaves when nothing changed", () => {
    const s = spec({ "/a": { get: {} } });
    expect(collectLeaves(diffSpecs(s, structuredClone(s)))).toEqual([]);
  });

  it("includes a breadcrumb location for nested changes", () => {
    const oldS = spec({ "/a": { get: { parameters: [] } } });
    const newS = spec({
      "/a": {
        get: {
          parameters: [{ name: "q", in: "query", required: true, schema: { type: "string" } }],
        },
      },
    });
    const leaves = collectLeaves(diffSpecs(oldS, newS));
    expect(leaves[0]?.location).toContain("GET /a");
  });
});
