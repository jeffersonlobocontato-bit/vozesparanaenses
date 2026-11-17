import { describe, expect, test } from "bun:test";
import { createResolvedCache } from "../src/lib/resolved-cache";

describe("request-safe cache", () => {
  test("a pending request never blocks a separate request", async () => {
    const cache = createResolvedCache<number>();
    let finish: ((n: number) => void) | undefined;
    const first = cache("home", 60_000, () => new Promise(resolve => { finish = resolve; }));
    expect(await cache("home", 60_000, async () => 2)).toBe(2);
    finish?.(1);
    expect(await first).toBe(1);
  });
  test("completed data is reused and explicit refresh reloads it", async () => {
    const cache = createResolvedCache<number>();
    expect(await cache("home", 60_000, async () => 1)).toBe(1);
    expect(await cache("home", 60_000, async () => 2)).toBe(1);
    expect(await cache("home", 60_000, async () => 3, true)).toBe(3);
  });
  test("failed loads can be tried again", async () => {
    const cache = createResolvedCache<number>();
    await expect(cache("home", 60_000, async () => { throw new Error("failed"); })).rejects.toThrow("failed");
    expect(await cache("home", 60_000, async () => 4)).toBe(4);
  });
  test("expired entries reload", async () => {
    const cache = createResolvedCache<number>();
    expect(await cache("home", -1, async () => 1)).toBe(1);
    expect(await cache("home", 60_000, async () => 2)).toBe(2);
  });
});