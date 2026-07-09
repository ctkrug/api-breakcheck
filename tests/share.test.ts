import { describe, expect, it } from "vitest";
import { decodeShare, encodeShare } from "../src/share";

describe("share link codec", () => {
  it("round-trips a payload through encode/decode", () => {
    const payload = { old: "openapi: 3.0.0", next: "openapi: 3.1.0" };
    const decoded = decodeShare(encodeShare(payload));
    expect(decoded).toEqual(payload);
  });

  it("tolerates a leading # on the hash", () => {
    const payload = { old: "a", next: "b" };
    const encoded = encodeShare(payload);
    expect(decodeShare("#" + encoded)).toEqual(payload);
  });

  it("preserves unicode content", () => {
    const payload = { old: "café: ✓ 你好", next: "emoji: 🚀" };
    expect(decodeShare(encodeShare(payload))).toEqual(payload);
  });

  it("handles a 50KB combined payload without error", () => {
    const big = "x".repeat(25_000);
    const payload = { old: big, next: big + "y" };
    const decoded = decodeShare(encodeShare(payload));
    expect(decoded).toEqual(payload);
  });

  it("returns null for a hash without the expected prefix", () => {
    expect(decodeShare("#nope")).toBeNull();
    expect(decodeShare("")).toBeNull();
  });

  it("returns null for corrupt base64 rather than throwing", () => {
    expect(() => decodeShare("d=!!!not-base64!!!")).not.toThrow();
    // A payload that decodes but isn't the expected shape must be rejected.
    expect(decodeShare("d=eyJmb28iOjF9")).toBeNull();
  });
});
