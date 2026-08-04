const ORIGIN = /^https?:\/\/(?:[a-z0-9.-]+|\[[0-9a-f:]+\])(?::\d{1,5})?$/i;

/** `EMBED_PARENTS=http://localhost:3000,https://nenadmarinkovic.com` */
export function embedParents(): string[] {
  const parents = new Set<string>();
  for (const entry of (process.env.EMBED_PARENTS ?? "").split(",")) {
    if (!entry.trim()) continue;
    try {
      const { origin } = new URL(entry.trim());
      if (ORIGIN.test(origin)) parents.add(origin);
    } catch {
      continue;
    }
  }
  return [...parents];
}
