import { describe, expect, it } from "vitest";
import { buildLateEntrySchema, buildSubmissionSchema, normalizeMobile } from "@/lib/validation";

describe("mobile normalization", () => {
  it("adds the default country code to 10-digit numbers", () => {
    expect(normalizeMobile("98765 43210")).toBe("+919876543210");
    expect(normalizeMobile("(987) 654-3210")).toBe("+919876543210");
  });
  it("keeps explicit country codes", () => {
    expect(normalizeMobile("+91 98765 43210")).toBe("+919876543210");
    expect(normalizeMobile("00447911123456")).toBe("+447911123456");
    expect(normalizeMobile("919876543210")).toBe("+919876543210");
  });
  it("rejects garbage", () => {
    expect(normalizeMobile("abc")).toBeNull();
    expect(normalizeMobile("12345")).toBeNull();
  });
});

describe("submission schema", () => {
  const fields = [
    { key: "city", label: "City", type: "TEXT" as const, options: [], required: true },
    { key: "age", label: "Age", type: "NUMBER" as const, options: [], required: false },
    { key: "gender", label: "Gender", type: "SELECT" as const, options: ["Male", "Female", "Other"], required: false },
  ];
  const base = { fullName: "Rahul", mobile: "9876543210", email: "RAHUL@Email.com", selectedOutcome: "HOME", customData: { city: "Pune" } };

  it("accepts a valid submission and normalizes identity fields", () => {
    const r = buildSubmissionSchema(fields, false, false).parse(base);
    expect(r.mobile).toBe("+919876543210");
    expect(r.email).toBe("rahul@email.com");
    expect(r.customData).toEqual({ city: "Pune" });
  });
  it("rejects DRAW when the session does not allow it", () => {
    expect(() => buildSubmissionSchema(fields, false, false).parse({ ...base, selectedOutcome: "DRAW" })).toThrow();
    expect(buildSubmissionSchema(fields, true, false).parse({ ...base, selectedOutcome: "DRAW" }).selectedOutcome).toBe("DRAW");
  });
  it("enforces required custom fields and option lists", () => {
    const s = buildSubmissionSchema(fields, false, false);
    expect(() => s.parse({ ...base, customData: {} })).toThrow();
    expect(() => s.parse({ ...base, customData: { city: "Pune", gender: "Unknown" } })).toThrow();
    expect(s.parse({ ...base, customData: { city: "Pune", age: "34", gender: "Other" } }).customData).toEqual({ city: "Pune", age: 34, gender: "Other" });
  });
  it("rejects unknown custom keys", () => {
    expect(() => buildSubmissionSchema(fields, false, false).parse({ ...base, customData: { city: "Pune", hacker: "x" } })).toThrow();
  });
  it("requires consent only when configured", () => {
    expect(() => buildSubmissionSchema(fields, false, true).parse(base)).toThrow();
    expect(buildSubmissionSchema(fields, false, true).parse({ ...base, consent: true }).consent).toBe(true);
    expect(buildSubmissionSchema(fields, false, false).parse(base).consent).toBeUndefined();
  });
  it("exact score: required when enabled, winner derived from the score, stripped when disabled", () => {
    const on = buildSubmissionSchema(fields, false, false, true);
    expect(() => on.parse(base)).toThrow(); // scores missing
    expect(on.parse({ ...base, predictedHomeScore: "2", predictedAwayScore: "1" })).toMatchObject({ predictedHomeScore: 2, predictedAwayScore: 1, selectedOutcome: "HOME" });
    expect(on.parse({ ...base, predictedHomeScore: "0", predictedAwayScore: "3" }).selectedOutcome).toBe("AWAY"); // client pick ignored, score wins
    expect(on.parse({ ...base, selectedOutcome: undefined, predictedHomeScore: "2", predictedAwayScore: "1" }).selectedOutcome).toBe("HOME"); // no pick needed
    expect(() => on.parse({ ...base, predictedHomeScore: "1", predictedAwayScore: "1" })).toThrow(); // draw score, draw not allowed
    expect(buildSubmissionSchema(fields, true, false, true).parse({ ...base, selectedOutcome: "DRAW", predictedHomeScore: "1", predictedAwayScore: "1" }).selectedOutcome).toBe("DRAW");
    const off = buildSubmissionSchema(fields, false, false, false).parse({ ...base, predictedHomeScore: "2", predictedAwayScore: "1" });
    expect(off.predictedHomeScore).toBeUndefined();
  });
  it("timed-out registration: details only, prediction fields dropped, same identity and custom-field rules", () => {
    const r = buildLateEntrySchema(fields, false).parse({ ...base, selectedOutcome: "HOME", predictedHomeScore: "2", predictedAwayScore: "1" }) as Record<string, unknown>;
    expect(r).toMatchObject({ fullName: "Rahul", mobile: "+919876543210", email: "rahul@email.com", customData: { city: "Pune" } });
    expect(r.selectedOutcome).toBeUndefined();
    expect(r.predictedHomeScore).toBeUndefined();
    expect(() => buildLateEntrySchema(fields, true).parse(base)).toThrow(); // consent required
    expect(() => buildLateEntrySchema(fields, false).parse({ ...base, customData: {} })).toThrow(); // required custom field
    expect(() => buildLateEntrySchema(fields, false).parse({ ...base, mobile: "12" })).toThrow();
  });
  it("ignores client-supplied timestamps and status (Test 9)", () => {
    const r = buildSubmissionSchema(fields, false, false).parse({ ...base, submittedAt: "2020-01-01", serverTime: "2020-01-01", status: "ACTIVE" }) as Record<string, unknown>;
    expect(r.submittedAt).toBeUndefined();
    expect(r.serverTime).toBeUndefined();
    expect(r.status).toBeUndefined();
  });
});
