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
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining("# API Breakcheck report"));
  });

  it("collapses the input to a strip after a run and reopens on Edit specs", async () => {
    const app = await mountApp();
    runExample(app);
    const io = app.querySelector(".io")!;
    expect(io.classList.contains("io--collapsed")).toBe(true);
    byText(app, "Edit specs").click();
    expect(io.classList.contains("io--collapsed")).toBe(false);
  });
});
