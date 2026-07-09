import { describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  isEnumChangeBreaking,
  isTypeChangeBreaking,
  removedEnumValues,
  typesOf,
} from "../src/diff/compat";

const jsonPrimitive = fc.oneof(
  fc.string(),
  fc.integer(),
  fc.boolean(),
  fc.constant(null),
  fc.double({ noNaN: true }),
);

describe("compat rules — property based", () => {
  it("an unchanged schema is never a breaking type change", () => {
    fc.assert(
      fc.property(fc.dictionary(fc.string(), fc.anything()), (schema) => {
        expect(isTypeChangeBreaking(schema, schema)).toBe(false);
      }),
    );
  });

  it("adding enum values to an existing enum is never breaking", () => {
    fc.assert(
      fc.property(fc.array(jsonPrimitive), fc.array(jsonPrimitive), (base, extra) => {
        const oldSchema = { enum: base };
        const newSchema = { enum: [...base, ...extra] };
        expect(isEnumChangeBreaking(oldSchema, newSchema)).toBe(false);
      }),
    );
  });

  it("removedEnumValues is always a subset of the old enum and disjoint from the new", () => {
    fc.assert(
      fc.property(fc.array(jsonPrimitive), fc.array(jsonPrimitive), (oldE, newE) => {
        const removed = removedEnumValues({ enum: oldE }, { enum: newE });
        const oldKeys = new Set(oldE.map((v) => JSON.stringify(v)));
        const newKeys = new Set(newE.map((v) => JSON.stringify(v)));
        for (const r of removed) {
          const k = JSON.stringify(r);
          expect(oldKeys.has(k)).toBe(true);
          expect(newKeys.has(k)).toBe(false);
        }
      }),
    );
  });

  it("dropping any enum entirely is not flagged as a narrowing breakage", () => {
    fc.assert(
      fc.property(fc.array(jsonPrimitive, { minLength: 1 }), (oldE) => {
        // old had an enum, new has none -> constraint relaxed, not breaking.
        expect(isEnumChangeBreaking({ enum: oldE }, {})).toBe(false);
      }),
    );
  });

  it("typesOf never throws and only yields strings, whatever `type` is", () => {
    fc.assert(
      fc.property(fc.anything(), (t) => {
        const result = typesOf({ type: t } as Record<string, unknown>);
        for (const v of result) expect(typeof v).toBe("string");
      }),
    );
  });
});
