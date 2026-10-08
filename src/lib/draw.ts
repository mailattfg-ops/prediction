import { randomInt } from "crypto";

/**
 * Raffle-style winner selection.
 *
 * Algorithm: Durstenfeld's variant of the Fisher-Yates shuffle (Knuth, TAOCP vol. 2, Algorithm P),
 * with every swap index taken from Node's `crypto.randomInt`, which draws from the operating
 * system's CSPRNG and uses rejection sampling, so every index is equally likely (no modulo bias).
 * The result is a uniformly random permutation: every participant in the pool has exactly the same
 * chance of ending up first, regardless of submission time, position, or anything else.
 *
 * References:
 *   https://en.wikipedia.org/wiki/Fisher%E2%80%93Yates_shuffle
 *   https://nodejs.org/api/crypto.html#cryptorandomintmin-max-callback
 */
export const DRAW_METHOD = "Fisher-Yates shuffle (Durstenfeld) with crypto.randomInt (OS CSPRNG, rejection sampling)";

export function secureShuffle<T>(items: readonly T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(i + 1); // uniform in [0, i]
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Shuffles the pool and returns the winner (first) plus the full draw order (runners-up). */
export function drawWinner<T>(pool: readonly T[]): { winner: T | null; order: T[] } {
  const order = secureShuffle(pool);
  return { winner: order[0] ?? null, order };
}
