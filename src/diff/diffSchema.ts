import {
  isEnumChangeBreaking,
  isFormatChangeBreaking,
  isTypeChangeBreaking,
  removedEnumValues,
  typesOf,
  type Schema,
} from "./compat";
import type { DiffNode } from "./types";

/**
 * Whether a schema sits on the request side (a value the client sends) or the
 * response side (a value the client receives). Add/remove semantics invert
 * between the two: a removed response field is breaking, a removed request
 * field is not; a new required request field is breaking, a new response field
 * is not.
 */
export type Direction = "request" | "response";

export interface SchemaContext {
  /** Slash path used as the node's stable id, e.g. ".../requestBody/status". */
  path: string;
  /** Display label — the field name, or the body label at the root. */
  label: string;
  direction: Direction;
}

function propertiesOf(schema: Schema): Record<string, Schema> {
  const props = schema.properties;
  if (typeof props !== "object" || props === null) return {};
  const out: Record<string, Schema> = {};
  for (const [k, v] of Object.entries(props as Record<string, unknown>)) {
    if (typeof v === "object" && v !== null) out[k] = v as Schema;
  }
  return out;
}

function requiredOf(schema: Schema): Set<string> {
  return new Set(
    Array.isArray(schema.required) ? schema.required.filter((x) => typeof x === "string") : [],
  );
}

function fmt(types: Set<string>): string {
  return [...types].join(" | ") || "untyped";
}

/**
 * Recursively compares two resolved schema fragments, emitting one DiffNode per
 * incompatible or notable change. Nested object properties recurse with the
 * same direction; required-status transitions are decided at the parent since
 * `required` lives on the enclosing object.
 */
export function diffSchema(oldSchema: Schema, newSchema: Schema, ctx: SchemaContext): DiffNode[] {
  const nodes: DiffNode[] = [];

  // --- constraint-level rules on this schema ---
  if (isTypeChangeBreaking(oldSchema, newSchema)) {
    nodes.push({
      path: ctx.path,
      label: ctx.label,
      severity: "breaking",
      category: "schema",
      reason: `\`${ctx.label}\` changed type from ${fmt(typesOf(oldSchema))} to ${fmt(typesOf(newSchema))}; existing values are rejected.`,
      children: [],
    });
  }

  if (isEnumChangeBreaking(oldSchema, newSchema)) {
    const removed = removedEnumValues(oldSchema, newSchema).map((v) => JSON.stringify(v));
    const detail = removed.length ? ` (${removed.join(", ")})` : "";
    nodes.push({
      path: `${ctx.path}#enum`,
      label: ctx.label,
      severity: "breaking",
      category: "enum",
      reason: removed.length
        ? `\`${ctx.label}\` no longer accepts ${removed.join(", ")}; clients using those values break.`
        : `\`${ctx.label}\` gained an enum constraint${detail}; previously any value was allowed.`,
      children: [],
    });
  } else if (hasAddedEnumValues(oldSchema, newSchema)) {
    nodes.push({
      path: `${ctx.path}#enum`,
      label: ctx.label,
      severity: "safe",
      category: "enum",
      reason: `\`${ctx.label}\` added enum value(s); existing values are still accepted.`,
      children: [],
    });
  }

  if (isFormatChangeBreaking(oldSchema, newSchema)) {
    nodes.push({
      path: `${ctx.path}#format`,
      label: ctx.label,
      severity: "breaking",
      category: "format",
      reason: `\`${ctx.label}\` now requires format "${String(newSchema.format)}"; previously any value was accepted.`,
      children: [],
    });
  } else if (typeof oldSchema.format === "string" && typeof newSchema.format !== "string") {
    nodes.push({
      path: `${ctx.path}#format`,
      label: ctx.label,
      severity: "safe",
      category: "format",
      reason: `\`${ctx.label}\` relaxed its format constraint; existing values remain valid.`,
      children: [],
    });
  }

  // --- property-level rules ---
  const oldProps = propertiesOf(oldSchema);
  const newProps = propertiesOf(newSchema);
  const oldReq = requiredOf(oldSchema);
  const newReq = requiredOf(newSchema);
  const names = new Set([...Object.keys(oldProps), ...Object.keys(newProps)]);

  for (const name of names) {
    const childPath = `${ctx.path}/${name}`;
    const inOld = name in oldProps;
    const inNew = name in newProps;

    if (inOld && inNew) {
      nodes.push(
        ...requiredTransition(name, childPath, oldReq.has(name), newReq.has(name), ctx.direction),
      );
      nodes.push(
        ...diffSchema(oldProps[name] as Schema, newProps[name] as Schema, {
          path: childPath,
          label: name,
          direction: ctx.direction,
        }),
      );
    } else if (inOld && !inNew) {
      nodes.push(fieldRemoved(name, childPath, ctx.direction));
    } else {
      nodes.push(fieldAdded(name, childPath, newReq.has(name), ctx.direction));
    }
  }

  return nodes;
}

/** True only when `new` introduces enum values absent from `old` (ignores reordering). */
function hasAddedEnumValues(oldSchema: Schema, newSchema: Schema): boolean {
  if (!Array.isArray(newSchema.enum)) return false;
  const oldValues = new Set(
    (Array.isArray(oldSchema.enum) ? oldSchema.enum : []).map((v) => JSON.stringify(v)),
  );
  return newSchema.enum.some((v) => !oldValues.has(JSON.stringify(v)));
}

function requiredTransition(
  name: string,
  path: string,
  wasRequired: boolean,
  isRequired: boolean,
  direction: Direction,
): DiffNode[] {
  if (wasRequired === isRequired) return [];
  const base = { path: `${path}#required`, label: name, category: "schema" as const, children: [] };
  if (direction === "request") {
    return isRequired
      ? [
          {
            ...base,
            severity: "breaking",
            reason: `Request field \`${name}\` is now required; existing clients may not send it.`,
          },
        ]
      : [
          {
            ...base,
            severity: "safe",
            reason: `Request field \`${name}\` is now optional; existing clients are unaffected.`,
          },
        ];
  }
  // response
  return isRequired
    ? [
        {
          ...base,
          severity: "safe",
          reason: `Response field \`${name}\` is now always present; existing clients are unaffected.`,
        },
      ]
    : [
        {
          ...base,
          severity: "breaking",
          reason: `Response field \`${name}\` is no longer guaranteed; clients relying on it may break.`,
        },
      ];
}

function fieldRemoved(name: string, path: string, direction: Direction): DiffNode {
  const base = { path, label: name, category: "schema" as const, children: [] };
  if (direction === "response") {
    return {
      ...base,
      severity: "breaking",
      reason: `Response field \`${name}\` was removed; clients relying on it will break.`,
    };
  }
  return {
    ...base,
    severity: "safe",
    reason: `Request field \`${name}\` was removed; existing clients are unaffected.`,
  };
}

function fieldAdded(
  name: string,
  path: string,
  isRequired: boolean,
  direction: Direction,
): DiffNode {
  const base = { path, label: name, category: "schema" as const, children: [] };
  if (direction === "request") {
    return isRequired
      ? {
          ...base,
          severity: "breaking",
          reason: `New required request field \`${name}\`; existing clients do not send it.`,
        }
      : {
          ...base,
          severity: "safe",
          reason: `New optional request field \`${name}\`; existing clients are unaffected.`,
        };
  }
  return {
    ...base,
    severity: "safe",
    reason: `New response field \`${name}\`; existing clients ignore unknown fields.`,
  };
}
