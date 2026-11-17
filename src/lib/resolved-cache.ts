/** Cross-request caches may retain data, never request-owned promises. */
export function createResolvedCache<T>() {
  const entries = new Map<string, { expiresAt: number; value: T }>();
  return async (key: string, ttlMs: number, load: () => Promise<T>, refresh = false): Promise<T> => {
    const hit = entries.get(key);
    if (!refresh && hit && hit.expiresAt > Date.now()) return hit.value;
    const value = await load();
    entries.set(key, { expiresAt: Date.now() + ttlMs, value });
    return value;
  };
}