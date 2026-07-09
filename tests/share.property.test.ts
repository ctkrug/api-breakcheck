import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { decodeShare, encodeShare } from "../src/share";

/**
 * The shareable link is only honest if it survives a round-trip byte-for-byte:
 * whatever two spec texts a user pastes — unicode, emoji, newlines, control
 * characters — must come back identical after encode → (hash) → decode.
 */
describe("share codec — property based", () => {
  it("round-trips arbitrary spec text without loss", () => {
    fc.assert(
      fc.property(fc.string(), fc.string(), (old, next) => {
        const decoded = decodeShare("#" + encodeShare({ old, next }));
        expect(decoded).toEqual({ old, next });
      }),
    );
  });

  it("round-trips full-unicode text (emoji, CJK, surrogate-safe)", () => {
    fc.assert(
      fc.property(fc.fullUnicodeString(), fc.fullUnicodeString(), (old, next) => {
        const decoded = decodeShare("#" + encodeShare({ old, next }));
        expect(decoded).toEqual({ old, next });
      }),
    );
  });

  it("never throws and returns null on arbitrary garbage hashes", () => {
    fc.assert(
      fc.property(fc.string(), (garbage) => {
        // Must not throw; either decodes to a valid payload or returns null.
        const result = decodeShare(garbage);
        expect(result === null || (typeof result.old === "string" && typeof result.next === "string")).toBe(
          true,
        );
      }),
    );
  });
});
