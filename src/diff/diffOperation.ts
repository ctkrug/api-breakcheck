import type { Schema } from "./compat";
import { diffSchema } from "./diffSchema";
import type { DiffNode, Severity } from "./types";

type Operation = Record<string, unknown>;

/** True if any node in the subtree (including the node itself) is breaking. */
export function subtreeHasBreaking(node: DiffNode): boolean {
  if (node.severity === "breaking") return true;
  return node.children.some(subtreeHasBreaking);
}

function rollUp(children: DiffNode[]): Severity {
  return children.some(subtreeHasBreaking) ? "breaking" : "safe";
}

function group(path: string, label: string, children: DiffNode[]): DiffNode | null {
  if (children.length === 0) return null;
  const severity = rollUp(children);
  const breaking = children.filter(subtreeHasBreaking).length;
  return {
    path,
    label,
    category: "operation",
    severity,
    reason: breaking > 0 ? `${breaking} breaking change(s) here` : "changes here are backward-compatible",
    children,
  };
}

// --- parameters (backlog story 2.2) ---

interface ParamRef {
  name: string;
  in: string;
  required: boolean;
  schema: Schema;
  raw: Operation;
}

function parametersOf(op: Operation): Map<string, ParamRef> {
  const arr = Array.isArray(op.parameters) ? op.parameters : [];
  const map = new Map<string, ParamRef>();
  for (const p of arr) {
    if (typeof p !== "object" || p === null) continue;
    const obj = p as Operation;
    const name = typeof obj.name === "string" ? obj.name : "";
    const location = typeof obj.in === "string" ? obj.in : "";
    if (!name || !location) continue;
    map.set(`${location} ${name}`, {
      name,
      in: location,
      required: obj.required === true,
      schema: typeof obj.schema === "object" && obj.schema !== null ? (obj.schema as Schema) : {},
      raw: obj,
    });
  }
  return map;
}

function diffParameters(oldOp: Operation, newOp: Operation, basePath: string): DiffNode[] {
  const oldParams = parametersOf(oldOp);
  const newParams = parametersOf(newOp);
  const nodes: DiffNode[] = [];
  const keys = new Set([...oldParams.keys(), ...newParams.keys()]);

  for (const key of keys) {
    const before = oldParams.get(key);
    const after = newParams.get(key);
    const path = `${basePath}/parameters/${key}`;

    if (before && after) {
      if (!before.required && after.required) {
        nodes.push(mk(`${path}#required`, after.name, "breaking", "parameter", `Parameter \`${after.name}\` (${after.in}) is now required; existing clients omit it.`));
      } else if (before.required && !after.required) {
        nodes.push(mk(`${path}#required`, after.name, "safe", "parameter", `Parameter \`${after.name}\` (${after.in}) is now optional; existing clients are unaffected.`));
      }
      nodes.push(...diffSchema(before.schema, after.schema, { path, label: after.name, direction: "request" }));
    } else if (before && !after) {
      nodes.push(mk(path, before.name, "safe", "parameter", `Parameter \`${before.name}\` (${before.in}) was removed; existing clients are unaffected.`));
    } else if (after) {
      nodes.push(
        after.required
          ? mk(path, after.name, "breaking", "parameter", `New required ${after.in} parameter \`${after.name}\`; existing clients do not send it.`)
          : mk(path, after.name, "safe", "parameter", `New optional ${after.in} parameter \`${after.name}\`; existing clients are unaffected.`),
      );
    }
  }
  return nodes;
}

// --- bodies (backlog story 2.3) ---

function jsonSchema(container: unknown): Schema | null {
  if (typeof container !== "object" || container === null) return null;
  const content = (container as Operation).content;
  if (typeof content !== "object" || content === null) return null;
  const media = content as Record<string, unknown>;
  const key = "application/json" in media ? "application/json" : Object.keys(media)[0];
  if (!key) return null;
  const entry = media[key];
  if (typeof entry !== "object" || entry === null) return null;
  const schema = (entry as Operation).schema;
  return typeof schema === "object" && schema !== null ? (schema as Schema) : null;
}

function diffRequestBody(oldOp: Operation, newOp: Operation, basePath: string): DiffNode[] {
  const before = jsonSchema(oldOp.requestBody);
  const after = jsonSchema(newOp.requestBody);
  if (!before || !after) return [];
  return diffSchema(before, after, { path: `${basePath}/requestBody`, label: "requestBody", direction: "request" });
}

function responsesOf(op: Operation): Record<string, unknown> {
  return typeof op.responses === "object" && op.responses !== null ? (op.responses as Record<string, unknown>) : {};
}

function diffResponses(oldOp: Operation, newOp: Operation, basePath: string): DiffNode[] {
  const oldResp = responsesOf(oldOp);
  const newResp = responsesOf(newOp);
  const nodes: DiffNode[] = [];
  for (const code of Object.keys(oldResp)) {
    if (!(code in newResp)) continue;
    const before = jsonSchema(oldResp[code]);
    const after = jsonSchema(newResp[code]);
    if (!before || !after) continue;
    nodes.push(...diffSchema(before, after, { path: `${basePath}/responses/${code}`, label: code, direction: "response" }));
  }
  return nodes;
}

/**
 * Compares two operations sharing a method+path, returning grouped child nodes
 * (parameters / requestBody / responses) for the operation node in the tree.
 */
export function diffOperation(oldOp: Operation, newOp: Operation, basePath: string): DiffNode[] {
  const children: DiffNode[] = [];
  const params = group(`${basePath}/parameters`, "parameters", diffParameters(oldOp, newOp, basePath));
  const body = group(`${basePath}/requestBody`, "requestBody", diffRequestBody(oldOp, newOp, basePath));
  const responses = group(`${basePath}/responses`, "responses", diffResponses(oldOp, newOp, basePath));
  for (const g of [params, body, responses]) if (g) children.push(g);
  return children;
}

function mk(path: string, label: string, severity: Severity, category: DiffNode["category"], reason: string): DiffNode {
  return { path, label, severity, category, reason, children: [] };
}
