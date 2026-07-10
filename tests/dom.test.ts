// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { h } from "../src/ui/dom";

describe("h", () => {
  it("sets the class attribute from the class prop", () => {
    const el = h("div", { class: "a b" });
    expect(el.className).toBe("a b");
  });

  it("sets a true boolean prop as a present, empty attribute", () => {
    const el = h("input", { disabled: true });
    expect(el.hasAttribute("disabled")).toBe(true);
    expect(el.getAttribute("disabled")).toBe("");
  });

  it("omits a false or nullish prop entirely rather than stringifying it", () => {
    const el = h("input", { disabled: false, "aria-hidden": null, "data-x": undefined });
    expect(el.hasAttribute("disabled")).toBe(false);
    expect(el.hasAttribute("aria-hidden")).toBe(false);
    expect(el.hasAttribute("data-x")).toBe(false);
  });

  it("sets raw innerHTML via the html prop", () => {
    const el = h("span", { html: "<b>bold</b>" });
    expect(el.innerHTML).toBe("<b>bold</b>");
  });

  it("assigns dataset entries via the dataset prop", () => {
    const el = h("div", { dataset: { id: "42", kind: "leaf" } });
    expect(el.dataset.id).toBe("42");
    expect(el.dataset.kind).toBe("leaf");
  });

  it("wires on* props as addEventListener calls", () => {
    const onclick = vi.fn();
    const el = h("button", { onclick });
    el.click();
    expect(onclick).toHaveBeenCalledTimes(1);
  });

  it("appends string and Node children, skipping null/undefined/false", () => {
    const child = document.createElement("i");
    const el = h("div", {}, "text", child, null, undefined, false);
    expect(el.childNodes.length).toBe(2);
    expect(el.textContent).toBe("text");
    expect(el.contains(child)).toBe(true);
  });
});
