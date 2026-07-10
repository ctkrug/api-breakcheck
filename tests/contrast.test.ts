import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * WCAG 2.x relative-luminance contrast ratio between two sRGB hex colors.
 * https://www.w3.org/TR/WCAG21/#dfn-contrast-ratio
 */
function contrastRatio(hexA: string, hexB: string): number {
  const luminance = (hex: string): number => {
    const [r, g, b] = (hex.match(/\w\w/g) ?? []).map((c) => {
      const v = parseInt(c, 16) / 255;
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const [l1, l2] = [luminance(hexA), luminance(hexB)].sort((a, b) => b - a);
  return (l1 + 0.05) / (l2 + 0.05);
}

const css = readFileSync(new URL("../src/style.css", import.meta.url), "utf8");

function token(name: string): string {
  const match = css.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`));
  if (!match) throw new Error(`token --${name} not found in style.css`);
  return match[1];
}

describe("design tokens — text contrast", () => {
  // The BREAKING/SAFE badges (.row__badge, 0.62rem — small text, needs 4.5:1)
  // render on every tree-panel surface the app uses, not just --bg.
  const panelSurfaces = ["bg", "surface-1", "surface-2"];

  it.each(["danger", "success"])(
    "--%s meets 4.5:1 against every panel surface it renders text on",
    (name) => {
      const fg = token(name);
      for (const surface of panelSurfaces) {
        const bg = token(surface);
        expect(
          contrastRatio(fg, bg),
          `--${name} (${fg}) vs --${surface} (${bg})`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    },
  );
});
