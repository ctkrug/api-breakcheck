import { h } from "./dom";

export interface InputPane {
  root: HTMLElement;
  getText(): string;
  setText(text: string): void;
  showError(message: string): void;
  clearError(): void;
}

export interface InputPaneOptions {
  label: string;
  placeholder: string;
  onChange?: () => void;
  onSubmit?: () => void;
}

const SPEC_FILE = /\.(json|ya?ml)$/i;

/**
 * One spec input pane: a themed textarea that doubles as a drop zone, plus a
 * file picker. Loading a file or dropping one fills the textarea (story 1.2);
 * a non-JSON/YAML file shows a pane-scoped error and leaves existing content
 * intact. Parse/validation errors surface in the same inline slot (story 3.3).
 */
export function createInputPane(opts: InputPaneOptions): InputPane {
  const textarea = h("textarea", {
    class: "pane__input mono",
    spellcheck: "false",
    autocomplete: "off",
    autocapitalize: "off",
    "aria-label": `${opts.label} OpenAPI spec`,
    placeholder: opts.placeholder,
    oninput: () => {
      clearError();
      opts.onChange?.();
    },
    onkeydown: (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        opts.onSubmit?.();
      }
    },
  }) as HTMLTextAreaElement;

  const error = h("p", { class: "pane__error", role: "alert", hidden: true });

  const fileInput = h("input", {
    type: "file",
    accept: ".json,.yaml,.yml,application/json,application/yaml,text/yaml",
    class: "visually-hidden",
    onchange: () => {
      const file = fileInput.files?.[0];
      if (file) loadFile(file);
      fileInput.value = "";
    },
  }) as HTMLInputElement;

  const fileBtn = h(
    "button",
    { type: "button", class: "btn btn--ghost pane__file", onclick: () => fileInput.click() },
    "Upload file",
  );

  const header = h(
    "div",
    { class: "pane__header" },
    h("span", { class: "pane__label mono" }, opts.label),
    fileBtn,
    fileInput,
  );

  const root = h("div", { class: "pane panel" }, header, textarea, error);

  // Drag-and-drop onto the whole pane.
  const setDrag = (on: boolean) => root.classList.toggle("pane--drag", on);
  root.addEventListener("dragover", (event) => {
    event.preventDefault();
    setDrag(true);
  });
  root.addEventListener("dragleave", (event) => {
    if (event.target === root) setDrag(false);
  });
  root.addEventListener("drop", (event) => {
    event.preventDefault();
    setDrag(false);
    const file = event.dataTransfer?.files?.[0];
    if (file) loadFile(file);
  });

  function loadFile(file: File): void {
    if (!SPEC_FILE.test(file.name)) {
      showError(`${opts.label}: "${file.name}" isn't a .json or .yaml file.`);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      textarea.value = String(reader.result ?? "");
      clearError();
      opts.onChange?.();
    };
    reader.onerror = () => showError(`${opts.label}: couldn't read "${file.name}".`);
    reader.readAsText(file);
  }

  function showError(message: string): void {
    error.textContent = message;
    error.hidden = false;
    root.classList.add("pane--error");
  }

  function clearError(): void {
    error.textContent = "";
    error.hidden = true;
    root.classList.remove("pane--error");
  }

  return {
    root,
    getText: () => textarea.value,
    setText: (text: string) => {
      textarea.value = text;
      clearError();
    },
    showError,
    clearError,
  };
}
