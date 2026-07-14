import { describe, it, expect } from "vitest";
import { checkRateLimit, LIMIT_PER_WINDOW } from "../src/rate-limit";
import type { RateLimitKV } from "../src/rate-limit";

function fakeKV(): RateLimitKV & { store: Map<string, string> } {
  const store = new Map<string, string>();
  return {
    store,
    async get(key: string) {
      return store.get(key) ?? null;
    },
    async put(key: string, value: string) {
      store.set(key, value);
    },
  };
}

const T0 = 1_752_468_000_000; // 固定時刻

describe("checkRateLimit", () => {
  it("上限までは許可し、残回数が減っていく", async () => {
    const kv = fakeKV();
    for (let i = 0; i < LIMIT_PER_WINDOW; i++) {
      const r = await checkRateLimit(kv, "1.2.3.4", T0);
      expect(r.allowed).toBe(true);
      expect(r.remaining).toBe(LIMIT_PER_WINDOW - 1 - i);
    }
  });

  it("上限を超えると拒否する", async () => {
    const kv = fakeKV();
    for (let i = 0; i < LIMIT_PER_WINDOW; i++)
      await checkRateLimit(kv, "1.2.3.4", T0);
    const r = await checkRateLimit(kv, "1.2.3.4", T0);
    expect(r.allowed).toBe(false);
    expect(r.remaining).toBe(0);
  });

  it("IPごとに独立してカウントする", async () => {
    const kv = fakeKV();
    for (let i = 0; i < LIMIT_PER_WINDOW; i++)
      await checkRateLimit(kv, "1.2.3.4", T0);
    expect((await checkRateLimit(kv, "5.6.7.8", T0)).allowed).toBe(true);
  });

  it("時間窓が変わればカウントはリセットされる", async () => {
    const kv = fakeKV();
    for (let i = 0; i < LIMIT_PER_WINDOW; i++)
      await checkRateLimit(kv, "1.2.3.4", T0);
    const nextWindow = T0 + 3600 * 1000;
    expect((await checkRateLimit(kv, "1.2.3.4", nextWindow)).allowed).toBe(
      true,
    );
  });
});
