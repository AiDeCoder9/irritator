// A tiny bridge so a notification press (handled in index.ts) can open a screen inside the app.
type Listener = (route: string) => void;
const listeners = new Set<Listener>();

export function emitRoute(route: string) {
  listeners.forEach((l) => l(route));
}

export function onRoute(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}
