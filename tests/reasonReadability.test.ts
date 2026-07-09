import { describe, expect, it } from "vitest";
import { diffSpecs } from "../src/diff/diffEngine";
import { collectLeaves } from "../src/export/markdown";
import { parseSpec } from "../src/parse";
import { EXAMPLE_NEW, EXAMPLE_OLD } from "../src/examples";

/**
 * Story 2.5 readability check: every leaf reason is a single sentence under
 * ~120 characters. Runs against the real example diff, which exercises path,
 * operation, parameter, schema, and enum categories.
 */
describe("reason readability", () => {
  const oldDoc = parseSpec(EXAMPLE_OLD);
  const newDoc = parseSpec(EXAMPLE_NEW);
  if (!oldDoc.ok || !newDoc.ok) throw new Error("example specs must parse");
  const result = diffSpecs(oldDoc.value, newDoc.value);

  it("produces a rich mix of breaking and safe changes", () => {
    expect(result.breakingCount).toBeGreaterThanOrEqual(3);
    expect(result.safeCount).toBeGreaterThanOrEqual(2);
  });

  it("keeps every reason a single short sentence", () => {
    const reasons = collectLeaves(result).map((l) => l.reason);
    for (const reason of reasons) {
      expect(reason.length, reason).toBeLessThanOrEqual(120);
      // exactly one sentence: at most one terminal period, and no mid-string ". "
      expect(reason.split(". ").length, reason).toBeLessThanOrEqual(1);
    }
  });
});
