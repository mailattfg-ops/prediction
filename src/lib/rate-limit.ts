import { ApiError } from "./http";

// ponytail: in-memory fixed window per process; move counters to Postgres/Redis if you run several app instances.
const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, max: number, windowMs: number) {
  const now = Date.now();
  let b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    b = { count: 0, resetAt: now + windowMs };
    buckets.set(key, b);
  }
  b.count++;
  if (buckets.size > 10_000) for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
  return { ok: b.count <= max, retryAfterSec: Math.max(1, Math.ceil((b.resetAt - now) / 1000)) };
}

export function assertRateLimit(key: string, max: number, windowMs: number) {
  const r = rateLimit(key, max, windowMs);
  if (!r.ok) throw new ApiError(429, "RATE_LIMITED", `Too many requests. Please try again in ${r.retryAfterSec} seconds.`);
}
