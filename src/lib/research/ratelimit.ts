/** Best-effort in-memory rate limiter (per warm instance). Not a security boundary; it curbs accidental bursts of paid runs. */
const buckets = new Map<string, number[]>();

export function allow(key: string, perMinute: number, now = Date.now()): boolean {
  const windowStart = now - 60_000;
  const hits = (buckets.get(key) ?? []).filter((t) => t > windowStart);
  if (hits.length >= perMinute) {
    buckets.set(key, hits);
    return false;
  }
  hits.push(now);
  buckets.set(key, hits);
  return true;
}
