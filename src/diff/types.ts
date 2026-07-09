export type OpenApiDocument = Record<string, unknown>;

export type Severity = "breaking" | "safe";

export interface DiffNode {
  /** Dot/slash path identifying the node within the spec, e.g. "/paths//users/get". */
  path: string;
  /** Human-readable label for the tree UI, e.g. "GET /users". */
  label: string;
  severity: Severity;
  /** One-line explanation of why this change is breaking or safe. */
  reason: string;
  children: DiffNode[];
}

export interface DiffResult {
  root: DiffNode;
  breakingCount: number;
  safeCount: number;
}
