/** `EMBED_PARENTS=http://localhost:3000,https://nenadmarinkovic.com` */
export function embedParents(): string[] {
  const parents = new Set<string>();
  for (const entry of (process.env.EMBED_PARENTS ?? "").split(",")) {
    if (!entry.trim()) continue;
    try {
      parents.add(new URL(entry.trim()).origin);
    } catch {
      continue;
    }
  }
  return [...parents];
}
