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
  const walk = (node: DiffNode, trail: string[]): LeafChange[] => {
    if (node.children.length === 0) {
      return [{ severity: node.severity, reason: node.reason, location: trail.join(" › ") }];
    }
    const next = node.path === "/paths" ? trail : [...trail, node.label];
    return node.children.flatMap((child) => walk(child, next));
  };
  return walk(result.root, []);
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

  const lines: string[] = ["# API Breakcheck report", ""];

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
