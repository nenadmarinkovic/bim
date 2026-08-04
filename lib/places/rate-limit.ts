const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 20;

export const DAY_MS = 24 * 60 * 60 * 1000;

export const GLOBAL = "global";

type Bucket = { windowMs: number; times: number[] };

const hits = new Map<string, Bucket>();

const TRUSTED_HOPS = (() => {
  const configured = Number(process.env.TRUSTED_PROXY_HOPS);
  return Number.isInteger(configured) && configured > 0 ? configured : 1;
})();

const IPV4 = /^\d{1,3}(?:\.\d{1,3}){3}$/;
const IPV6 = /^[0-9a-f:]+$/i;

function address(value: string): string | null {
  let candidate = value.trim();
  if (!candidate) return null;

  if (candidate.startsWith("[")) {
    candidate = candidate.slice(1, candidate.indexOf("]"));
  } else if (candidate.includes(":") && IPV4.test(candidate.split(":")[0]!)) {
    candidate = candidate.split(":")[0]!;
  }

  if (IPV4.test(candidate)) return candidate;
  if (candidate.includes(":") && IPV6.test(candidate)) {
    return candidate.toLowerCase();
  }
  return null;
}

export function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const chain = forwarded.split(",");
    const hop = chain[chain.length - TRUSTED_HOPS];
    const found = hop ? address(hop) : null;
    if (found) return found;
  }

  const real = request.headers.get("x-real-ip");
  return (real && address(real)) || "unknown";
}

export function retryAfter(
  scope: string,
  key: string,
  max = MAX_PER_WINDOW,
  windowMs = WINDOW_MS,
): number {
  const now = Date.now();
  const cutoff = now - windowMs;
  const id = `${scope}|${key}`;

  const bucket = hits.get(id);
  const recent =
    bucket && bucket.windowMs === windowMs
      ? bucket.times.filter((at) => at > cutoff)
      : [];

  if (recent.length >= max) {
    hits.set(id, { windowMs, times: recent });
    return Math.max(1, Math.ceil((recent[0]! + windowMs - now) / 1000));
  }

  recent.push(now);
  hits.set(id, { windowMs, times: recent });

  if (hits.size > 10_000) {
    for (const [entry, held] of hits) {
      const last = held.times[held.times.length - 1];
      if (last === undefined || last <= now - held.windowMs) hits.delete(entry);
    }
  }

  return 0;
}
