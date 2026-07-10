import type { DiffNode, DiffResult } from "../diff/types";

export interface LeafChange {
  severity: "breaking" | "safe";
  reason: string;
  /** Breadcrumb of ancestor labels (root excluded), e.g. "/pet › GET /pet › parameters". */
  location: string;
}

/**
 * Flattens the diff tree to its leaf changes, tagging each with a breadcrumb of
 * its ancestor labels so an exported bullet reads in context. The synthetic
 * root ("/paths") is excluded from the breadcrumb.
 */
export function collectLeaves(result: DiffResult): LeafChange[] {
  const walk = (node: DiffNode, trail: string[], isRoot: boolean): LeafChange[] => {
    // The synthetic root ("/paths") is never itself a change — when it has no
    // children (identical specs) it must yield zero leaves, not a phantom one,
    // so the report renders a clean "no differences" state.
    if (!isRoot && node.children.length === 0) {
      return [{ severity: node.severity, reason: node.reason, location: trail.join(" › ") }];
    }
    const next = isRoot ? trail : [...trail, node.label];
    return node.children.flatMap((child) => walk(child, next, false));
  };
  return walk(result.root, [], true);
}

/**
 * Renders the diff as a Markdown report — breaking changes first, then safe —
 * suitable for pasting into a GitHub PR description (backlog story 3.4). Counts
 * in the header match the on-screen summary because both derive from the same
 * leaf set.
 */
export function toMarkdown(result: DiffResult): string {
  const leaves = collectLeaves(result);
  const breaking = leaves.filter((l) => l.severity === "breaking");
  const safe = leaves.filter((l) => l.severity === "safe");

  const lines: string[] = ["# Redline report", ""];

  if (leaves.length === 0) {
    lines.push("No differences found between the two specs.", "");
    return lines.join("\n");
  }

  lines.push(`**${breaking.length} breaking** · **${safe.length} safe** change(s).`, "");

  const section = (title: string, items: LeafChange[]) => {
    if (items.length === 0) return;
    lines.push(`## ${title}`, "");
    for (const item of items) {
      const where = item.location ? ` _(${item.location})_` : "";
      lines.push(`- ${item.reason}${where}`);
    }
    lines.push("");
  };

  section("Breaking changes", breaking);
  section("Safe changes", safe);

  return lines.join("\n").trimEnd() + "\n";
}
