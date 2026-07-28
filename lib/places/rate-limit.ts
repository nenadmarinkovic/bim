const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 20;

const hits = new Map<string, number[]>();

export function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

// Callers with a cheaper request than an LLM completion pass their own ceiling.
export function retryAfter(key: string, max = MAX_PER_WINDOW): number {
  const now = Date.now();
  const cutoff = now - WINDOW_MS;

  const recent = (hits.get(key) ?? []).filter((at) => at > cutoff);

  if (recent.length >= max) {
    hits.set(key, recent);
    return Math.max(1, Math.ceil((recent[0]! + WINDOW_MS - now) / 1000));
  }

  recent.push(now);
  hits.set(key, recent);

  if (hits.size > 10_000) {
    for (const [id, times] of hits) {
      if (times[times.length - 1]! <= cutoff) hits.delete(id);
    }
  }

  return 0;
}
