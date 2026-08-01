export function postToParents(parents: string[], message: unknown) {
  if (typeof window === "undefined" || window.parent === window) return;
  for (const parent of parents) window.parent.postMessage(message, parent);
}

export function listenToParents(
  parents: string[],
  handler: (data: Record<string, unknown>) => void,
) {
  const allowed = new Set(parents);
  const onMessage = (event: MessageEvent) => {
    if (!allowed.has(event.origin)) return;
    if (event.data && typeof event.data === "object") handler(event.data);
  };
  window.addEventListener("message", onMessage);
  return () => window.removeEventListener("message", onMessage);
}
