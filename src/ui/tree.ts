import type { DiffNode } from "../diff/types";
import { subtreeHasBreaking } from "../diff/diffOperation";
import { categoryIcon, categoryLabel } from "./icons";

export interface TreeOptions {
  /** When true, hide safe leaves and any branch with no breaking descendant. */
  breakingOnly: boolean;
}

/** Children that should render given the current filter (story 3.1). */
export function visibleChildren(node: DiffNode, breakingOnly: boolean): DiffNode[] {
  if (!breakingOnly) return node.children;
  return node.children.filter(subtreeHasBreaking);
}

/**
 * Builds the diff tree as DOM. Branch nodes are expandable; leaf nodes carry the
 * one-line reason inline. Rendering is pure over its inputs, so callers re-render
 * on filter change rather than mutating in place.
 */
export function renderTree(root: DiffNode, opts: TreeOptions): HTMLElement {
  const container = document.createElement("div");
  container.className = "tree";
  container.setAttribute("role", "tree");

  const children = visibleChildren(root, opts.breakingOnly);
  if (children.length === 0) {
    container.appendChild(emptyState(root, opts.breakingOnly));
    return container;
  }
  for (const child of children) {
    container.appendChild(renderNode(child, opts, 0));
  }
  return container;
}

function renderNode(node: DiffNode, opts: TreeOptions, depth: number): HTMLElement {
  const el = document.createElement("div");
  el.className = `node node--${node.severity}`;
  el.setAttribute("role", "treeitem");
  el.style.setProperty("--depth", String(depth));

  const kids = visibleChildren(node, opts.breakingOnly);
  const hasChildren = kids.length > 0;

  const row = document.createElement("div");
  row.className = "row";

  if (hasChildren) {
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "row__toggle";
    toggle.setAttribute("aria-expanded", "true");
    toggle.setAttribute("aria-label", `Collapse ${node.label}`);
    toggle.textContent = "▾";
    toggle.addEventListener("click", () => {
      const collapsed = el.classList.toggle("collapsed");
      toggle.setAttribute("aria-expanded", String(!collapsed));
      toggle.setAttribute("aria-label", `${collapsed ? "Expand" : "Collapse"} ${node.label}`);
    });
    row.appendChild(toggle);
  } else {
    const spacer = document.createElement("span");
    spacer.className = "row__toggle row__toggle--leaf";
    spacer.setAttribute("aria-hidden", "true");
    row.appendChild(spacer);
  }

  const dot = document.createElement("span");
  dot.className = "row__dot";
  dot.setAttribute("aria-hidden", "true");
  row.appendChild(dot);

  const icon = document.createElement("span");
  icon.className = "row__icon";
  icon.innerHTML = categoryIcon(node.category);
  icon.title = categoryLabel(node.category);
  row.appendChild(icon);

  const label = document.createElement("span");
  label.className = "row__label";
  label.textContent = node.label;
  row.appendChild(label);

  const badge = document.createElement("span");
  badge.className = "row__badge";
  badge.textContent = node.severity === "breaking" ? "BREAKING" : "SAFE";
  row.appendChild(badge);

  el.appendChild(row);

  const reason = document.createElement("p");
  reason.className = "row__reason";
  reason.textContent = node.reason;
  el.appendChild(reason);

  if (hasChildren) {
    const childrenWrap = document.createElement("div");
    childrenWrap.className = "children";
    const inner = document.createElement("div");
    inner.className = "children__inner";
    inner.setAttribute("role", "group");
    for (const child of kids) {
      inner.appendChild(renderNode(child, opts, depth + 1));
    }
    childrenWrap.appendChild(inner);
    el.appendChild(childrenWrap);
  }

  return el;
}

function emptyState(root: DiffNode, breakingOnly: boolean): HTMLElement {
  const el = document.createElement("div");
  el.className = "tree__empty";
  const heading = document.createElement("p");
  heading.className = "tree__empty-title";
  if (root.children.length === 0) {
    heading.textContent = "No differences";
    const sub = document.createElement("p");
    sub.className = "tree__empty-sub";
    sub.textContent = "The two specs are equivalent once $ref pointers are resolved.";
    el.append(heading, sub);
  } else if (breakingOnly) {
    heading.textContent = "No breaking changes";
    const sub = document.createElement("p");
    sub.className = "tree__empty-sub";
    sub.textContent = "Every change is backward-compatible. Toggle the filter to see safe changes.";
    el.append(heading, sub);
  }
  return el;
}
