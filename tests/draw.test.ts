import { describe, expect, it } from "vitest";
import { drawWinner, secureShuffle } from "@/lib/draw";

describe("random score-winner draw", () => {
  it("returns a permutation of the pool (nobody added, nobody dropped)", () => {
    const pool = ["a", "b", "c", "d", "e", "f"];
    for (let i = 0; i < 200; i++) {
      const order = secureShuffle(pool);
      expect([...order].sort()).toEqual([...pool].sort());
    }
    expect(pool).toEqual(["a", "b", "c", "d", "e", "f"]); // input untouched
  });

  it("handles empty and single-entry pools", () => {
    expect(drawWinner([])).toEqual({ winner: null, order: [] });
    expect(drawWinner(["only"])).toEqual({ winner: "only", order: ["only"] });
  });

  it("gives every participant the same chance, whatever their position in the pool", () => {
    const pool = ["first", "second", "third", "fourth", "fifth"];
    const runs = 20_000;
    const wins: Record<string, number> = Object.fromEntries(pool.map((p) => [p, 0]));
    for (let i = 0; i < runs; i++) wins[drawWinner(pool).winner as string]++;
    // Expected 20% each; with 20k draws a fair draw stays well inside 17%..23% (±~10 standard deviations).
    for (const p of pool) {
      const share = wins[p] / runs;
      expect(share).toBeGreaterThan(0.17);
      expect(share).toBeLessThan(0.23);
    }
    // In particular the first (earliest) entry is not favoured.
    expect(wins.first / runs).toBeLessThan(0.23);
  });

  it("does not produce the same order every time (not deterministic)", () => {
    const pool = Array.from({ length: 10 }, (_, i) => i);
    const seen = new Set<string>();
    for (let i = 0; i < 50; i++) seen.add(secureShuffle(pool).join(","));
    expect(seen.size).toBeGreaterThan(40);
  });
});
