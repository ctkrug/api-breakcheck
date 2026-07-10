// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { encodeShare } from "../src/share";
import { EXAMPLE_NEW, EXAMPLE_OLD } from "../src/examples";

async function mountApp(): Promise<HTMLElement> {
  document.body.innerHTML = '<div id="app"></div>';
  vi.resetModules();
  await import("../src/main");
  return document.querySelector("#app") as HTMLElement;
}

const byText = (app: HTMLElement, text: string) =>
  [...app.querySelectorAll("button")].find((b) => b.textContent === text) as HTMLButtonElement;

function runExample(app: HTMLElement) {
  byText(app, "Load example").click();
}

describe("app behaviors", () => {
  beforeEach(() => {
    location.hash = "";
  });

  it("restores and renders a comparison carried in the URL hash", async () => {
    location.hash = encodeShare({ old: EXAMPLE_OLD, next: EXAMPLE_NEW });
    const app = await mountApp();
    expect(app.querySelectorAll(".node--breaking").length).toBeGreaterThan(0);
    expect(app.querySelector(".results")?.hasAttribute("hidden")).toBe(false);
  });

  it("re-renders when the hash changes via browser back/forward navigation", async () => {
    location.hash = encodeShare({ old: EXAMPLE_OLD, next: EXAMPLE_OLD });
    const app = await mountApp();
    expect(app.querySelector(".rail__num--breaking")?.textContent).toBe("0");

    location.hash = encodeShare({ old: EXAMPLE_OLD, next: EXAMPLE_NEW });
    window.dispatchEvent(new HashChangeEvent("hashchange"));

    expect(Number(app.querySelector(".rail__num--breaking")?.textContent)).toBeGreaterThan(0);
  });

  it("ignores a garbage hash without crashing or rendering results", async () => {
    location.hash = "#d=not-valid-base64!!!";
    const app = await mountApp();
    expect(app.querySelector(".results")?.hasAttribute("hidden")).toBe(true);
  });

  it("toggles the breaking-only filter and dims the safe count", async () => {
    const app = await mountApp();
    runExample(app);
    const safe = app.querySelector(".rail__num--safe")!;
    const before = safe.textContent;
    expect(Number(before)).toBeGreaterThan(0);

    byText(app, "Breaking only").click();
    expect(safe.textContent).toBe("0");
    expect(safe.classList.contains("rail__num--dim")).toBe(true);
    expect(byText(app, "Breaking only").getAttribute("aria-pressed")).toBe("true");

    byText(app, "Breaking only").click();
    expect(safe.textContent).toBe(before);
  });

  it("clears everything and drops the hash", async () => {
    const app = await mountApp();
    runExample(app);
    byText(app, "Share").click();
    expect(location.hash).toContain("d=");

    byText(app, "Clear").click();
    expect(app.querySelector(".results")?.hasAttribute("hidden")).toBe(true);
    expect(location.hash).toBe("");
    expect((app.querySelectorAll("textarea")[0] as HTMLTextAreaElement).value).toBe("");
  });

  it("copies a share link and a Markdown report to the clipboard", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });

    const app = await mountApp();
    runExample(app);

    byText(app, "Share").click();
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining("#d="));

    byText(app, "Export Markdown").click();
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining("# Redline report"));
  });

  it("collapses the input to a strip after a run and reopens on Edit specs", async () => {
    const app = await mountApp();
    runExample(app);
    const io = app.querySelector(".io")!;
    expect(io.classList.contains("io--collapsed")).toBe(true);
    byText(app, "Edit specs").click();
    expect(io.classList.contains("io--collapsed")).toBe(false);
  });

  it("moves focus to Edit specs after a run instead of dropping it to <body>", async () => {
    // Compare/Load-example fire from a control this collapse is about to hide,
    // which otherwise drops focus to <body> and confuses subsequent Tab order.
    const app = await mountApp();
    runExample(app);
    expect(document.activeElement).toBe(byText(app, "Edit specs"));
  });

  it("summarizes identical specs as no differences in the collapsed strip", async () => {
    const app = await mountApp();
    const textareas = app.querySelectorAll("textarea");
    (textareas[0] as HTMLTextAreaElement).value = EXAMPLE_OLD;
    (textareas[1] as HTMLTextAreaElement).value = EXAMPLE_OLD;
    byText(app, "Compare").click();
    expect(app.querySelector(".io__strip-text")?.textContent).toMatch(/no differences/i);
  });

  it("survives a rapid double-click on Compare without duplicating the tree", async () => {
    const app = await mountApp();
    const textareas = app.querySelectorAll("textarea");
    (textareas[0] as HTMLTextAreaElement).value = EXAMPLE_OLD;
    (textareas[1] as HTMLTextAreaElement).value = EXAMPLE_NEW;
    const compareBtn = byText(app, "Compare");
    compareBtn.click();
    compareBtn.click();

    const breakingBefore = app.querySelector(".rail__num--breaking")?.textContent;
    expect(app.querySelectorAll(".tree").length).toBe(1);
    expect(Number(breakingBefore)).toBeGreaterThan(0);
  });

  it("shows pane errors instead of a blank tree when both panes are empty", async () => {
    const app = await mountApp();
    byText(app, "Compare").click();
    const errors = [...app.querySelectorAll(".pane__error")].filter(
      (e) => !(e as HTMLElement).hidden,
    );
    expect(errors.length).toBe(2);
    expect(app.querySelector(".results")?.hasAttribute("hidden")).toBe(true);
  });

  it("stays correct across many edit/compare round-trips (no leaked state)", async () => {
    const app = await mountApp();
    for (let i = 0; i < 10; i += 1) {
      runExample(app);
      byText(app, "Edit specs").click();
      byText(app, "Clear").click();
    }
    runExample(app);
    expect(app.querySelectorAll(".tree").length).toBe(1);
    expect(app.querySelectorAll(".toast-host .toast").length).toBe(0);
    expect(Number(app.querySelector(".rail__num--breaking")?.textContent)).toBeGreaterThan(0);
  });
});
