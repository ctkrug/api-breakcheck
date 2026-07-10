import { describe, expect, it } from "vitest";
import {
  isTypeChangeBreaking,
  isEnumChangeBreaking,
  isFormatChangeBreaking,
  removedEnumValues,
  typesOf,
} from "../src/diff/compat";

describe("typesOf", () => {
  it("reads a single string type", () => {
    expect(typesOf({ type: "string" })).toEqual(new Set(["string"]));
  });

  it("reads an array of types (OpenAPI 3.1)", () => {
    expect(typesOf({ type: ["string", "null"] })).toEqual(new Set(["string", "null"]));
  });

  it("returns an empty set for an untyped schema", () => {
    expect(typesOf({}).size).toBe(0);
  });
});

describe("isTypeChangeBreaking", () => {
  it("flags string -> integer as breaking", () => {
    expect(isTypeChangeBreaking({ type: "string" }, { type: "integer" })).toBe(true);
  });

  it("flags string -> object as breaking", () => {
    expect(isTypeChangeBreaking({ type: "string" }, { type: "object" })).toBe(true);
  });

  it("treats an unchanged type as safe", () => {
    expect(isTypeChangeBreaking({ type: "string" }, { type: "string" })).toBe(false);
  });

  it("treats integer -> number (widening) as safe", () => {
    expect(isTypeChangeBreaking({ type: "integer" }, { type: "number" })).toBe(false);
  });

  it("treats number -> integer (narrowing) as breaking", () => {
    expect(isTypeChangeBreaking({ type: "number" }, { type: "integer" })).toBe(true);
  });

  it("treats string -> [string, null] (widening) as safe", () => {
    expect(isTypeChangeBreaking({ type: "string" }, { type: ["string", "null"] })).toBe(false);
  });

  it("gives no verdict when either side is untyped", () => {
    expect(isTypeChangeBreaking({}, { type: "string" })).toBe(false);
    expect(isTypeChangeBreaking({ type: "string" }, {})).toBe(false);
  });
});

describe("isEnumChangeBreaking", () => {
  it("flags a removed enum value as breaking", () => {
    expect(isEnumChangeBreaking({ enum: ["a", "b", "c"] }, { enum: ["a", "b"] })).toBe(true);
  });

  it("treats an added enum value as safe", () => {
    expect(isEnumChangeBreaking({ enum: ["a", "b"] }, { enum: ["a", "b", "c"] })).toBe(false);
  });

  it("flags introducing an enum where none existed as breaking", () => {
    expect(isEnumChangeBreaking({ type: "string" }, { enum: ["a"] })).toBe(true);
  });

  it("treats dropping an enum constraint as safe", () => {
    expect(isEnumChangeBreaking({ enum: ["a"] }, { type: "string" })).toBe(false);
  });

  it("reports the specific values removed", () => {
    expect(removedEnumValues({ enum: ["a", "b", "c"] }, { enum: ["a"] })).toEqual(["b", "c"]);
  });

  it("reports no removed values when the enum constraint was dropped", () => {
    // isEnumChangeBreaking treats this as safe, so diffSchema never calls
    // removedEnumValues here — but as an independently exported, auditable
    // primitive its own contract for this input still needs to be pinned.
    expect(removedEnumValues({ enum: ["a", "b"] }, { type: "string" })).toEqual([]);
  });
});

describe("isFormatChangeBreaking", () => {
  it("flags adding a format constraint as breaking", () => {
    expect(
      isFormatChangeBreaking({ type: "string" }, { type: "string", format: "date-time" }),
    ).toBe(true);
  });

  it("treats dropping a format constraint as safe", () => {
    expect(isFormatChangeBreaking({ format: "date-time" }, { type: "string" })).toBe(false);
  });

  it("flags swapping to a different format as breaking", () => {
    expect(isFormatChangeBreaking({ format: "date" }, { format: "date-time" })).toBe(true);
  });

  it("treats an unchanged format as safe", () => {
    expect(isFormatChangeBreaking({ format: "uuid" }, { format: "uuid" })).toBe(false);
  });
});
