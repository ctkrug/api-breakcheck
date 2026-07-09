export type OpenApiDocument = Record<string, unknown>;

export type Severity = "breaking" | "safe";

/**
 * Which compatibility surface a node describes. Drives the inline glyph in the
 * tree (see docs/BACKLOG.md story 2.5) and groups reasons by the kind of
 * change they represent.
 */
export type Category = "path" | "operation" | "parameter" | "schema" | "enum" | "format";

export interface DiffNode {
  /** Slash path identifying the node within the spec, e.g. "/paths//users/get". */
  path: string;
  /** Human-readable label for the tree UI, e.g. "GET /users". */
  label: string;
  severity: Severity;
  category: Category;
  /** One-line explanation of why this change is breaking or safe. */
  reason: string;
  children: DiffNode[];
}

export interface DiffResult {
  root: DiffNode;
  breakingCount: number;
  safeCount: number;
}
