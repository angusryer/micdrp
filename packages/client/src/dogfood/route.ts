/**
 * Which screen is on show, for anything outside the navigator that needs to
 * know (INV-DOG-002).
 *
 * The control sits above the navigator so it survives navigation, which means
 * it cannot use `useRoute` — that only works inside a screen. The navigator
 * publishes here instead, and the control subscribes.
 */
type Listener = (route: string) => void;

let route: string | null = null;
const listeners = new Set<Listener>();

/** Called by the navigator whenever the visible screen changes. */
export function publishRoute(next: string): void {
  if (next === route) {
    return;
  }
  route = next;
  listeners.forEach((listener) => listener(next));
}

/** The screen on show, or null before the navigator has mounted. */
export function currentRoute(): string | null {
  return route;
}

export function subscribeToRoute(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Test seam. Never called by app code. */
export function resetRouteForTests(): void {
  route = null;
  listeners.clear();
}
