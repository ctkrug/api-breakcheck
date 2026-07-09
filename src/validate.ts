import type { OpenApiDocument } from "./diff/types";

export interface ValidationResult {
  ok: boolean;
  message?: string;
}

/**
 * Cheap structural sanity check — not full OpenAPI schema validation. It exists
 * to catch the "well-formed JSON/YAML that isn't an OpenAPI document" case
 * (backlog story 3.3) so the tool reports a clear message rather than silently
 * producing an empty diff. Requires an `openapi: 3.x` version and a `paths`
 * object, the two surfaces the diff engine actually reads.
 */
export function validateOpenApi(doc: OpenApiDocument): ValidationResult {
  const version = doc.openapi;
  const hasVersion = typeof version === "string" && /^3\./.test(version);
  const paths = doc.paths;
  const hasPaths = typeof paths === "object" && paths !== null && !Array.isArray(paths);

  if (!hasVersion && !hasPaths) {
    return { ok: false, message: "This doesn't look like an OpenAPI spec (no `openapi` version or `paths`)." };
  }
  if (!hasVersion) {
    return { ok: false, message: "Missing or unsupported `openapi` version — expected a 3.x string." };
  }
  if (!hasPaths) {
    return { ok: false, message: "Missing a `paths` object — nothing to compare." };
  }
  return { ok: true };
}
