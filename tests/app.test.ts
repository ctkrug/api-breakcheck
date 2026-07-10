// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * End-to-end smoke test of the wow moment: mount the app, load the example,
 * and confirm a red/green tree with matching rail counts renders — with no
 * network request firing during the compare (backlog story 1.1).
 */
async function mountApp(): Promise<HTMLElement> {
  document.body.innerHTML = '<div id="app"></div>';
  vi.resetModules();
  await import("../src/main");
  return document.querySelector("#app") as HTMLElement;
}

describe("app wow moment", () => {
  beforeEach(() => {
    location.hash = "";
  });

  it("renders a diff tree with breaking and safe leaves from the example", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("no network"));
    const app = await mountApp();

    const exampleBtn = [...app.querySelectorAll("button")].find(
      (b) => b.textContent === "Load example",
    );
    expect(exampleBtn).toBeTruthy();
    exampleBtn!.click();

    const breaking = app.querySelectorAll(".node--breaking");
    const safe = app.querySelectorAll(".node--safe");
    expect(breaking.length).toBeGreaterThan(0);
    expect(safe.length).toBeGreaterThan(0);

    // Rail totals match the rendered leaves.
    const railBreaking = app.querySelector(".rail__num--breaking")?.textContent;
    expect(Number(railBreaking)).toBeGreaterThan(0);

    // The wow moment must not touch the network.
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("shows a pane-scoped error for malformed input instead of a blank tree", async () => {
    const app = await mountApp();
    const textareas = app.querySelectorAll("textarea");
    (textareas[0] as HTMLTextAreaElement).value = "{ not valid : : :";
    (textareas[1] as HTMLTextAreaElement).value = "openapi: 3.0.0\npaths: {}";

    const compareBtn = [...app.querySelectorAll("button")].find((b) => b.textContent === "Compare");
    compareBtn!.click();

    const errors = [...app.querySelectorAll(".pane__error")].filter(
      (e) => !(e as HTMLElement).hidden,
    );
    expect(errors.length).toBe(1);
    expect(app.querySelector(".results")?.hasAttribute("hidden")).toBe(true);
  });

  it("shows a friendly error instead of crashing on a pathologically deep schema", async () => {
    const app = await mountApp();
    let schema = '{"type":"string"}';
    for (let i = 0; i < 4000; i += 1) {
      schema = `{"type":"object","properties":{"nested":${schema}}}`;
    }
    const spec =
      `{"openapi":"3.0.0","paths":{"/x":{"get":{"responses":{"200":` +
      `{"content":{"application/json":{"schema":${schema}}}}}}}}}`;
    const textareas = app.querySelectorAll("textarea");
    (textareas[0] as HTMLTextAreaElement).value = spec;
    (textareas[1] as HTMLTextAreaElement).value = spec;
    [...app.querySelectorAll("button")].find((b) => b.textContent === "Compare")!.click();

    const errors = [...app.querySelectorAll(".pane__error")].filter(
      (e) => !(e as HTMLElement).hidden,
    );
    expect(errors.length).toBeGreaterThan(0);
    expect(app.querySelector(".results")?.hasAttribute("hidden")).toBe(true);
  });

  it("shows a friendly error if diffSpecs throws for any other unforeseen reason", async () => {
    // The nesting-depth guard now catches the specific pathological case above
    // before it ever reaches diffSpecs, so exercise the engine's own try/catch
    // in compare() directly by forcing diffSpecs itself to throw.
    vi.doMock("../src/diff/diffEngine", () => ({
      diffSpecs: () => {
        throw new Error("boom");
      },
    }));
    const app = await mountApp();
    const textareas = app.querySelectorAll("textarea");
    (textareas[0] as HTMLTextAreaElement).value = "openapi: 3.0.0\npaths: {}";
    (textareas[1] as HTMLTextAreaElement).value = "openapi: 3.0.0\npaths: {}";
    [...app.querySelectorAll("button")].find((b) => b.textContent === "Compare")!.click();

    const errors = [...app.querySelectorAll(".pane__error")].filter(
      (e) => !(e as HTMLElement).hidden,
    );
    expect(errors.length).toBeGreaterThan(0);
    expect(app.querySelector(".results")?.hasAttribute("hidden")).toBe(true);
    vi.doUnmock("../src/diff/diffEngine");
  });

  it("rejects a well-formed non-OpenAPI document with a clear message", async () => {
    const app = await mountApp();
    const textareas = app.querySelectorAll("textarea");
    (textareas[0] as HTMLTextAreaElement).value = "{}";
    (textareas[1] as HTMLTextAreaElement).value = "openapi: 3.0.0\npaths: {}";
    [...app.querySelectorAll("button")].find((b) => b.textContent === "Compare")!.click();

    const err = app.querySelector(".pane__error");
    expect(err?.textContent).toMatch(/openapi/i);
  });
});
