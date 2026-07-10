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

  root.append(masthead(), io, results, explainer(), siteFooter());

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

const REPO_URL = "https://github.com/ctkrug/api-breakcheck";

function masthead(): HTMLElement {
  return h(
    "header",
    { class: "masthead" },
    h(
      "div",
      { class: "masthead__brand" },
      h(
        "div",
        { class: "wordmark" },
        h("span", { class: "wordmark__text" }, "Redline"),
      ),
      h(
        "p",
        { class: "tagline" },
        "Paste two OpenAPI specs and see which changes break your clients, each with a one-line reason. Nothing installed, nothing uploaded.",
      ),
    ),
    h(
      "a",
      { class: "masthead__gh", href: REPO_URL, target: "_blank", rel: "noopener" },
      githubMark(),
      h("span", {}, "GitHub"),
    ),
  );
}

/** Inline GitHub glyph, drawn in currentColor to match the blueprint chrome. */
function githubMark(): HTMLElement {
  const span = h("span", { class: "gh-mark", "aria-hidden": "true" });
  span.innerHTML = `<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z"/></svg>`;
  return span;
}

/**
 * Below-the-fold explainer + FAQ. Plain, useful copy that answers what a
 * breaking API change is and how Redline decides — doubles as the page's
 * search-intent content.
 */
function explainer(): HTMLElement {
  const faqs: Array<[string, string]> = [
    [
      "What counts as a breaking change in an OpenAPI spec?",
      "A change is breaking when a client written against the old spec could stop working: a removed path or operation, a new required request field or parameter, a narrowed type, a tightened format, a dropped enum value, or a response field that is no longer guaranteed. Redline classifies each of these from explicit rules, not guesswork, and shows the exact reason on every node.",
    ],
    [
      "Does Redline upload my spec anywhere?",
      "No. Parsing, $ref resolution, and diffing all run in your browser tab. Nothing is sent to a server, which is why it is safe to paste an internal spec. A shared link encodes both specs inside the URL itself, not a server session.",
    ],
    [
      "Which OpenAPI versions and formats work?",
      "OpenAPI 3.0 and 3.1 documents, written as either JSON or YAML. Local $ref pointers (including nested and circular ones) are resolved before the diff so two specs organized differently but structurally identical produce no noise.",
    ],
    [
      "How is this different from oasdiff or openapi-diff?",
      "Those tools are built for CI: you install a binary or action, write a config file, and wait for a pipeline run. Redline is the ten-second check right before you open the pull request. Paste, compare, read the tree. It complements a CI gate rather than replacing it.",
    ],
    [
      "Can I share or save a comparison?",
      "Yes. Share copies a link that reproduces the exact diff in a fresh tab with no re-upload. Export Markdown copies a report with breaking changes listed first, ready to paste into a pull request description.",
    ],
  ];

  return h(
    "section",
    { class: "explainer", "aria-label": "About Redline" },
    h("h2", { class: "explainer__title" }, "Know the blast radius before you merge"),
    h(
      "p",
      { class: "explainer__lede" },
      "Editing an OpenAPI spec is easy. Knowing whether the edit breaks the clients already calling your API is the hard part, and a plain text diff of two YAML files will not tell you: it buries a single breaking change under hundreds of lines of reordering. Redline reads both specs the way a client would, resolves every $ref, and walks paths, operations, parameters, request bodies, and response schemas to mark each real change breaking or safe.",
    ),
    h(
      "p",
      { class: "explainer__lede" },
      "Every verdict traces to a named compatibility rule, so a red node always comes with the sentence explaining why. That is the whole point: not \"something changed\" but \"this change rejects requests your clients still send.\"",
    ),
    h("h3", { class: "explainer__subtitle" }, "Questions"),
    h(
      "dl",
      { class: "faq" },
      ...faqs.flatMap(([q, a]) => [
        h("dt", { class: "faq__q" }, q),
        h("dd", { class: "faq__a" }, a),
      ]),
    ),
  );
}

function siteFooter(): HTMLElement {
  return h(
    "footer",
    { class: "site-footer" },
    h(
      "a",
      { class: "site-footer__link", href: REPO_URL, target: "_blank", rel: "noopener" },
      "Source on GitHub",
    ),
    h("span", { class: "site-footer__sep", "aria-hidden": "true" }, "·"),
    h(
      "a",
      {
        class: "site-footer__link",
        href: "https://apps.charliekrug.com",
        target: "_blank",
        rel: "noopener",
      },
      "More by Charlie Krug",
    ),
  );
}

const appRoot = document.querySelector<HTMLDivElement>("#app");
if (appRoot) main(appRoot);
