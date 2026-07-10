import "./style.css";
import { diffSpecs } from "./diff/diffEngine";
import type { DiffResult } from "./diff/types";
import { parseSpec } from "./parse";
import { validateOpenApi } from "./validate";
import { toMarkdown } from "./export/markdown";
import { decodeShare, encodeShare } from "./share";
import { EXAMPLE_NEW, EXAMPLE_OLD } from "./examples";
import { h } from "./ui/dom";
import { createInputPane, type InputPane } from "./ui/inputPane";
import { renderTree } from "./ui/tree";

interface AppState {
  breakingOnly: boolean;
  result: DiffResult | null;
  collapsed: boolean;
}

function main(root: HTMLElement): void {
  const state: AppState = { breakingOnly: false, result: null, collapsed: false };

  const oldPane = createInputPane({
    label: "Old spec",
    placeholder: "Paste your current OpenAPI 3.x spec (JSON or YAML) — or drop a file.",
    onSubmit: compare,
  });
  const newPane = createInputPane({
    label: "New spec",
    placeholder: "Paste the proposed spec to compare against the old one.",
    onSubmit: compare,
  });

  // --- results host ---
  const treeHost = h("div", { class: "tree-host" });
  const railBreaking = h("strong", { class: "rail__num rail__num--breaking" }, "0");
  const railSafe = h("strong", { class: "rail__num rail__num--safe" }, "0");
  const filterBtn = h(
    "button",
    {
      type: "button",
      class: "btn btn--ghost rail__filter",
      "aria-pressed": "false",
      onclick: toggleFilter,
    },
    "Breaking only",
  );
  const shareBtn = h(
    "button",
    { type: "button", class: "btn btn--ghost", onclick: share },
    "Share",
  );
  const exportBtn = h(
    "button",
    { type: "button", class: "btn btn--ghost", onclick: exportMarkdown },
    "Export Markdown",
  );

  const rail = h(
    "aside",
    { class: "rail panel", "aria-label": "Change summary" },
    h(
      "div",
      { class: "rail__counts" },
      h(
        "div",
        { class: "rail__stat" },
        railBreaking,
        h("span", { class: "rail__lbl" }, "breaking"),
      ),
      h("div", { class: "rail__stat" }, railSafe, h("span", { class: "rail__lbl" }, "safe")),
    ),
    h("div", { class: "rail__actions" }, filterBtn, shareBtn, exportBtn),
  );

  const results = h(
    "section",
    { class: "results", hidden: true, "aria-live": "polite" },
    rail,
    h("div", { class: "tree-wrap panel" }, treeHost),
  );

  // --- input section (collapses to a strip after a run) ---
  const compareBtn = h(
    "button",
    { type: "button", class: "btn btn--primary", onclick: compare },
    "Compare",
  );
  const exampleBtn = h(
    "button",
    { type: "button", class: "btn btn--ghost", onclick: loadExample },
    "Load example",
  );
  const clearBtn = h(
    "button",
    { type: "button", class: "btn btn--ghost", onclick: clearAll },
    "Clear",
  );

  const editSpecsBtn = h(
    "button",
    { type: "button", class: "btn btn--ghost", onclick: editSpecs },
    "Edit specs",
  );
  const strip = h(
    "div",
    { class: "io__strip" },
    h("span", { class: "io__strip-text mono" }, "comparing old ↦ new"),
    editSpecsBtn,
  );

  const io = h(
    "section",
    { class: "io" },
    h("div", { class: "io__panes" }, oldPane.root, newPane.root),
    h("div", { class: "io__actions" }, compareBtn, exampleBtn, clearBtn),
    strip,
  );

  root.append(masthead(), io, results);

  const live = h("div", { class: "toast-host", "aria-live": "polite", "aria-atomic": "true" });
  root.append(live);

  // Restore a shared comparison, if the hash carries one — both at initial
  // load and when the hash changes underneath us (browser back/forward
  // between two different share links doesn't reload the page).
  function restoreFromHash(): void {
    const shared = decodeShare(location.hash);
    if (shared) {
      oldPane.setText(shared.old);
      newPane.setText(shared.next);
      compare();
    }
  }
  restoreFromHash();
  window.addEventListener("hashchange", restoreFromHash);

  // --- behavior ---

  function compare(): void {
    const oldParsed = parseAndValidate(oldPane);
    const newParsed = parseAndValidate(newPane);
    if (!oldParsed || !newParsed) return;

    let result: DiffResult;
    try {
      result = diffSpecs(oldParsed, newParsed);
    } catch {
      // The engine is defensive, but never let an unforeseen input wedge the UI:
      // surface a pane-scoped error instead of a blank screen.
      newPane.showError("Couldn't compare these specs — please check they're valid OpenAPI.");
      return;
    }
    state.result = result;
    state.collapsed = true;
    renderResults();
    // Compare/Load-example/Ctrl+Enter all fire from a control this collapse is
    // about to hide, which drops focus to <body> and corrupts subsequent Tab
    // order in Chromium. Move focus to the strip's own control explicitly.
    io.classList.add("io--collapsed");
    results.hidden = false;
    editSpecsBtn.focus();
    strip.querySelector(".io__strip-text")!.textContent = summaryLine(state.result);
    results.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function parseAndValidate(pane: InputPane): Record<string, unknown> | null {
    const parsed = parseSpec(pane.getText());
    if (!parsed.ok) {
      const where = parsed.line ? ` (line ${parsed.line})` : "";
      pane.showError(`${parsed.message}${where}`);
      return null;
    }
    const valid = validateOpenApi(parsed.value);
    if (!valid.ok) {
      pane.showError(valid.message ?? "Not a valid OpenAPI document.");
      return null;
    }
    pane.clearError();
    return parsed.value;
  }

  function renderResults(): void {
    if (!state.result) return;
    treeHost.replaceChildren(renderTree(state.result.root, { breakingOnly: state.breakingOnly }));
    railBreaking.textContent = String(state.result.breakingCount);
    railSafe.textContent = String(state.breakingOnly ? 0 : state.result.safeCount);
    railSafe.classList.toggle("rail__num--dim", state.breakingOnly);
  }

  function toggleFilter(): void {
    state.breakingOnly = !state.breakingOnly;
    filterBtn.setAttribute("aria-pressed", String(state.breakingOnly));
    filterBtn.classList.toggle("is-active", state.breakingOnly);
    renderResults();
  }

  function loadExample(): void {
    oldPane.setText(EXAMPLE_OLD);
    newPane.setText(EXAMPLE_NEW);
    compare();
  }

  function clearAll(): void {
    oldPane.setText("");
    newPane.setText("");
    state.result = null;
    results.hidden = true;
    io.classList.remove("io--collapsed");
    if (location.hash) history.replaceState(null, "", location.pathname + location.search);
  }

  function editSpecs(): void {
    io.classList.remove("io--collapsed");
    oldPane.root.querySelector("textarea")?.focus();
  }

  function share(): void {
    const hash = encodeShare({ old: oldPane.getText(), next: newPane.getText() });
    history.replaceState(null, "", "#" + hash);
    copy(location.href, "Share link copied to clipboard");
  }

  function exportMarkdown(): void {
    if (!state.result) return;
    copy(toMarkdown(state.result), "Markdown report copied to clipboard");
  }

  function copy(text: string, message: string): void {
    const done = () => toast(message);
    if (navigator.clipboard?.writeText) {
      navigator.clipboard
        .writeText(text)
        .then(done, () => toast("Copy failed — check clipboard permissions."));
    } else {
      toast("Clipboard unavailable in this browser.");
    }
  }

  function toast(message: string): void {
    const el = h("div", { class: "toast" }, message);
    live.append(el);
    window.setTimeout(() => el.classList.add("toast--in"), 10);
    window.setTimeout(() => {
      el.classList.remove("toast--in");
      window.setTimeout(() => el.remove(), 200);
    }, 2600);
  }
}

function summaryLine(result: DiffResult): string {
  const { breakingCount: b, safeCount: s } = result;
  if (b === 0 && s === 0) return "no differences — specs are equivalent";
  return `${b} breaking · ${s} safe`;
}

function masthead(): HTMLElement {
  return h(
    "header",
    { class: "masthead" },
    h(
      "div",
      {},
      h(
        "div",
        { class: "wordmark" },
        h("span", {}, "API"),
        h("span", { class: "brk" }, "Break"),
        h("span", {}, "check"),
        h("span", { class: "tick", "aria-hidden": "true" }),
      ),
      h(
        "p",
        { class: "tagline" },
        "Paste two OpenAPI specs and see, instantly, which changes break clients — no CLI, no config, nothing leaves your browser.",
      ),
    ),
  );
}

const appRoot = document.querySelector<HTMLDivElement>("#app");
if (appRoot) main(appRoot);
