import { resolveRefs } from "./resolveRefs";
import { diffOperation, subtreeHasBreaking } from "./diffOperation";
import type { DiffNode, DiffResult, OpenApiDocument, Severity } from "./types";

/** HTTP methods that carry an OpenAPI operation, in canonical display order. */
const METHODS = ["get", "put", "post", "delete", "options", "head", "patch", "trace"] as const;

/**
 * Full semantic diff of two OpenAPI documents. Both specs are `$ref`-resolved
 * first (so structurally identical specs organized differently produce zero
 * noise), then compared path -> operation -> parameter/schema, with each verdict
 * sourced from the auditable rules in compat.ts / diffSchema / diffOperation.
 */
export function diffSpecs(oldSpec: OpenApiDocument, newSpec: OpenApiDocument): DiffResult {
  const resolvedOld = resolveRefs(oldSpec);
  const resolvedNew = resolveRefs(newSpec);

  const oldPaths = getPaths(resolvedOld);
  const newPaths = getPaths(resolvedNew);
  const pathNames = new Set([...oldPaths.keys(), ...newPaths.keys()]);

  const children: DiffNode[] = [];
  for (const path of [...pathNames].sort()) {
    const node = diffPath(path, oldPaths.get(path), newPaths.get(path));
    if (node) children.push(node);
  }

  const breakingCount = countLeaves(children, "breaking");
  const safeCount = countLeaves(children, "safe");

  return {
    root: {
      path: "/paths",
      label: "API changes",
      category: "path",
      severity: breakingCount > 0 ? "breaking" : "safe",
      reason:
        breakingCount > 0
          ? `${breakingCount} breaking and ${safeCount} safe change(s)`
          : safeCount > 0
            ? `${safeCount} safe change(s); nothing breaking`
            : "No differences found",
      children,
    },
    breakingCount,
    safeCount,
  };
}

function diffPath(path: string, oldItem: unknown, newItem: unknown): DiffNode | null {
  const basePath = `/paths${path}`;
  if (oldItem && !newItem) {
    return leaf(
      basePath,
      path,
      "breaking",
      "path",
      "Path was removed; any client still calling it will fail.",
    );
  }
  if (!oldItem && newItem) {
    return leaf(basePath, path, "safe", "path", "Path is new; existing clients are unaffected.");
  }

  const oldOps = oldItem as Record<string, unknown>;
  const newOps = newItem as Record<string, unknown>;
  const opNodes: DiffNode[] = [];
  for (const method of METHODS) {
    const before = oldOps[method];
    const after = newOps[method];
    const opBase = `${basePath}/${method}`;
    const label = `${method.toUpperCase()} ${path}`;

    if (before && !after) {
      opNodes.push(
        leaf(
          opBase,
          label,
          "breaking",
          "operation",
          `${method.toUpperCase()} ${path} was removed; clients calling it will fail.`,
        ),
      );
    } else if (!before && after) {
      opNodes.push(
        leaf(
          opBase,
          label,
          "safe",
          "operation",
          `${method.toUpperCase()} ${path} is new; existing clients are unaffected.`,
        ),
      );
    } else if (before && after) {
      const kids = diffOperation(
        before as Record<string, unknown>,
        after as Record<string, unknown>,
        opBase,
      );
      if (kids.length) {
        opNodes.push({
          path: opBase,
          label,
          category: "operation",
          severity: kids.some(subtreeHasBreaking) ? "breaking" : "safe",
          reason: kids.some(subtreeHasBreaking)
            ? "Contains breaking changes."
            : "Backward-compatible changes only.",
          children: kids,
        });
      }
    }
  }

  if (opNodes.length === 0) return null;
  return {
    path: basePath,
    label: path,
    category: "path",
    severity: opNodes.some(subtreeHasBreaking) ? "breaking" : "safe",
    reason: opNodes.some(subtreeHasBreaking)
      ? "Contains breaking changes."
      : "Backward-compatible changes only.",
    children: opNodes,
  };
}

/** Counts leaf nodes (the concrete changes) of a given severity across the forest. */
function countLeaves(nodes: DiffNode[], severity: Severity): number {
  let total = 0;
  for (const node of nodes) {
    if (node.children.length === 0) {
      if (node.severity === severity) total += 1;
    } else {
      total += countLeaves(node.children, severity);
    }
  }
  return total;
}

function leaf(
  path: string,
  label: string,
  severity: Severity,
  category: DiffNode["category"],
  reason: string,
): DiffNode {
  return { path, label, severity, category, reason, children: [] };
}

function getPaths(document: OpenApiDocument): Map<string, unknown> {
  const paths = document.paths;
  if (typeof paths !== "object" || paths === null) {
    return new Map();
  }
  return new Map(Object.entries(paths as Record<string, unknown>));
}
