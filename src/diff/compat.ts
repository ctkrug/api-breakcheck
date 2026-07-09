/**
 * Auditable compatibility primitives. Every verdict in the diff tree traces
 * back to one of these named functions rather than an inline heuristic, so the
 * reasoning behind "breaking" vs "safe" lives in exactly one place (see
 * docs/VISION.md — "Compatibility rules are explicit and auditable").
 *
 * The unit of comparison is a JSON-Schema-ish fragment as it appears in an
 * OpenAPI document: an object that may carry `type`, `enum`, `format`,
 * `properties`, and `required`.
 */

export type Schema = Record<string, unknown>;

/** OpenAPI 3.1 allows `type` to be a single string or an array of strings. */
export function typesOf(schema: Schema): Set<string> {
  const t = schema.type;
  if (typeof t === "string") return new Set([t]);
  if (Array.isArray(t)) return new Set(t.filter((x): x is string => typeof x === "string"));
  return new Set();
}

/** `integer` values are a strict subset of `number`; encode that one widening. */
const WIDER_THAN: Record<string, string> = { integer: "number" };

function isSubtype(narrow: string, wide: string): boolean {
  return narrow === wide || WIDER_THAN[narrow] === wide;
}

/**
 * A type change is breaking when some value valid under the old type is no
 * longer valid under the new one — i.e. the new type set is not a widening of
 * the old. `string -> integer` and `string -> object` are breaking;
 * `integer -> number` (widening) and an unchanged type are safe.
 */
export function isTypeChangeBreaking(oldSchema: Schema, newSchema: Schema): boolean {
  const oldTypes = typesOf(oldSchema);
  const newTypes = typesOf(newSchema);
  if (oldTypes.size === 0 || newTypes.size === 0) return false; // untyped: no verdict
  // Every old type must remain accepted (directly or via widening) by some new type.
  for (const ot of oldTypes) {
    const stillAccepted = [...newTypes].some((nt) => isSubtype(ot, nt));
    if (!stillAccepted) return true;
  }
  return false;
}

function enumOf(schema: Schema): unknown[] | null {
  return Array.isArray(schema.enum) ? schema.enum : null;
}

/**
 * Removing a value from an `enum`, or introducing an `enum` where none existed,
 * narrows the accepted set and is breaking. Adding a value to an existing enum
 * widens it and is safe.
 */
export function isEnumChangeBreaking(oldSchema: Schema, newSchema: Schema): boolean {
  const oldEnum = enumOf(oldSchema);
  const newEnum = enumOf(newSchema);
  if (newEnum === null) return false; // constraint dropped or never present -> not narrowing
  if (oldEnum === null) return true; // new enum constrains a previously-open value
  const newSet = new Set(newEnum.map((v) => JSON.stringify(v)));
  return oldEnum.some((v) => !newSet.has(JSON.stringify(v)));
}

/** The enum values dropped from old -> new, for building a precise reason string. */
export function removedEnumValues(oldSchema: Schema, newSchema: Schema): unknown[] {
  const oldEnum = enumOf(oldSchema) ?? [];
  const newEnum = enumOf(newSchema);
  if (newEnum === null) return [];
  const newSet = new Set(newEnum.map((v) => JSON.stringify(v)));
  return oldEnum.filter((v) => !newSet.has(JSON.stringify(v)));
}

/**
 * Tightening `format` is breaking: the old spec accepted any string, the new
 * one demands a shape (e.g. `date-time`, `uuid`). Relaxing — dropping a format
 * constraint — is safe.
 */
export function isFormatChangeBreaking(oldSchema: Schema, newSchema: Schema): boolean {
  const oldFormat = typeof oldSchema.format === "string" ? oldSchema.format : null;
  const newFormat = typeof newSchema.format === "string" ? newSchema.format : null;
  if (newFormat === null) return false; // relaxed or absent
  return oldFormat !== newFormat; // added a format, or swapped to a different one
}
