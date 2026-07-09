import { resolveRefs } from "./resolveRefs";
import type { DiffNode, DiffResult, OpenApiDocument } from "./types";

/**
 * Scaffold-level diff: compares the set of `paths` entries between two
 * resolved OpenAPI documents and classifies removed vs. added paths.
 *
 * This intentionally covers only path-level presence for now. Operation,
 * parameter, and schema-level comparison (the real compatibility rules
 * described in docs/VISION.md) land as the build-phase stories in
 * docs/BACKLOG.md — this function exists so the repo is runnable end to end
 * from day one.
 */
export function diffSpecs(oldSpec: OpenApiDocument, newSpec: OpenApiDocument): DiffResult {
  const resolvedOld = resolveRefs(oldSpec);
  const resolvedNew = resolveRefs(newSpec);

  const oldPaths = getPaths(resolvedOld);
  const newPaths = getPaths(resolvedNew);

  const children: DiffNode[] = [];

  for (const path of oldPaths.keys()) {
    if (!newPaths.has(path)) {
      children.push({
        path: `/paths${path}`,
        label: path,
        severity: "breaking",
        reason: "Path was removed; any client still calling it will fail.",
        children: [],
      });
    }
  }

  for (const path of newPaths.keys()) {
    if (!oldPaths.has(path)) {
      children.push({
        path: `/paths${path}`,
        label: path,
        severity: "safe",
        reason: "Path is new; existing clients are unaffected.",
        children: [],
      });
    }
  }

  const breakingCount = children.filter((c) => c.severity === "breaking").length;
  const safeCount = children.filter((c) => c.severity === "safe").length;

  return {
    root: {
      path: "/paths",
      label: "paths",
      severity: breakingCount > 0 ? "breaking" : "safe",
      reason: breakingCount > 0 ? `${breakingCount} path(s) removed` : "No paths were removed",
      children,
    },
    breakingCount,
    safeCount,
  };
}

function getPaths(document: OpenApiDocument): Map<string, unknown> {
  const paths = document.paths;
  if (typeof paths !== "object" || paths === null) {
    return new Map();
  }
  return new Map(Object.entries(paths as Record<string, unknown>));
}
