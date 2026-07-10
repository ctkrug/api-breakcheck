// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { createInputPane } from "../src/ui/inputPane";

function makePane(over: Partial<Parameters<typeof createInputPane>[0]> = {}) {
  return createInputPane({ label: "Old spec", placeholder: "paste…", ...over });
}

function drop(root: HTMLElement, file: File | null): void {
  const event = new Event("drop", { bubbles: true, cancelable: true }) as Event & {
    dataTransfer: { files: File[] };
  };
  event.dataTransfer = { files: file ? [file] : [] };
  root.dispatchEvent(event);
}

describe("createInputPane", () => {
  it("reads a dropped .json file into the textarea", async () => {
    const onChange = vi.fn();
    const pane = makePane({ onChange });
    drop(pane.root, new File(['{"openapi":"3.0.0"}'], "spec.json", { type: "application/json" }));

    await vi.waitFor(() => expect(pane.getText()).toContain("openapi"));
    expect(onChange).toHaveBeenCalled();
  });

  it("rejects a non-spec file with a pane-scoped error and keeps content", async () => {
    const pane = makePane();
    pane.setText("existing");
    drop(pane.root, new File(["binary"], "photo.png", { type: "image/png" }));

    const err = pane.root.querySelector(".pane__error") as HTMLElement;
    expect(err.hidden).toBe(false);
    expect(err.textContent).toContain("photo.png");
    expect(pane.getText()).toBe("existing"); // untouched
  });

  it("shows a pane-scoped error when the FileReader itself fails", () => {
    const pane = makePane();
    const spy = vi.spyOn(FileReader.prototype, "readAsText").mockImplementation(function (
      this: FileReader,
    ) {
      this.onerror?.(new ProgressEvent("error") as ProgressEvent<FileReader>);
    });
    drop(pane.root, new File(["x"], "spec.json"));

    const err = pane.root.querySelector(".pane__error") as HTMLElement;
    expect(err.hidden).toBe(false);
    expect(err.textContent).toContain("couldn't read");
    spy.mockRestore();
  });

  it("toggles a drag-affordance class on dragover/dragleave", () => {
    const pane = makePane();
    pane.root.dispatchEvent(new Event("dragover", { bubbles: true, cancelable: true }));
    expect(pane.root.classList.contains("pane--drag")).toBe(true);

    const leave = new Event("dragleave", { bubbles: true }) as Event & { target: EventTarget };
    Object.defineProperty(leave, "target", { value: pane.root });
    pane.root.dispatchEvent(leave);
    expect(pane.root.classList.contains("pane--drag")).toBe(false);
  });

  it("fires onSubmit on Cmd/Ctrl+Enter but not on a bare Enter", () => {
    const onSubmit = vi.fn();
    const pane = makePane({ onSubmit });
    const textarea = pane.root.querySelector("textarea")!;

    textarea.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(onSubmit).not.toHaveBeenCalled();

    textarea.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        metaKey: true,
        bubbles: true,
        cancelable: true,
      }),
    );
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("clears its error when the user edits the textarea", () => {
    const pane = makePane();
    pane.showError("boom");
    const textarea = pane.root.querySelector("textarea")!;
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    expect((pane.root.querySelector(".pane__error") as HTMLElement).hidden).toBe(true);
  });
});
