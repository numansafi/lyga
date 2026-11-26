type Listener = (event: { type: 'refresh'; workspaceId: string; ts: number }) => void;

const listeners = new Map<string, Set<Listener>>();

export function subscribeWorkspaceEvents(workspaceId: string, listener: Listener): () => void {
  let set = listeners.get(workspaceId);
  if (!set) {
    set = new Set();
    listeners.set(workspaceId, set);
  }
  set.add(listener);
  return () => {
    set?.delete(listener);
    if (set && set.size === 0) {
      listeners.delete(workspaceId);
    }
  };
}

export function publishWorkspaceEvent(workspaceId: string): void {
  const set = listeners.get(workspaceId);
  if (!set) return;
  const payload = { type: 'refresh' as const, workspaceId, ts: Date.now() };
  for (const fn of set) {
    fn(payload);
  }
}
