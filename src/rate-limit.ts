/** 1 IP・1時間あたりの許可回数（スキャン+PDF合算。Browser Rendering のコスト暴走防止） */
export const LIMIT_PER_WINDOW = 10;
const WINDOW_SEC = 3600;

/** KVNamespace のうち使う操作だけの部分型（本物のKVNamespaceも構造的に一致する） */
export interface RateLimitKV {
  get(key: string): Promise<string | null>;
  put(
    key: string,
    value: string,
    options?: { expirationTtl?: number },
  ): Promise<void>;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
}

/** AI所見の1 IP・1日あたりの許可回数（Claude APIのコスト防御） */
export const AI_LIMIT_PER_DAY = 3;
const DAY_SEC = 86400;

export async function checkAiRateLimit(
  kv: RateLimitKV,
  ip: string,
  nowMs: number,
): Promise<RateLimitResult> {
  const day = Math.floor(nowMs / 1000 / DAY_SEC);
  const key = `ai:${ip}:${day}`;
  const current = Number((await kv.get(key)) ?? "0");
  if (current >= AI_LIMIT_PER_DAY) {
    return { allowed: false, remaining: 0 };
  }
  await kv.put(key, String(current + 1), { expirationTtl: DAY_SEC + 60 });
  return { allowed: true, remaining: AI_LIMIT_PER_DAY - current - 1 };
}

export async function checkRateLimit(
  kv: RateLimitKV,
  ip: string,
  nowMs: number,
): Promise<RateLimitResult> {
  const window = Math.floor(nowMs / 1000 / WINDOW_SEC);
  const key = `rl:${ip}:${window}`;
  const current = Number((await kv.get(key)) ?? "0");

  if (current >= LIMIT_PER_WINDOW) {
    return { allowed: false, remaining: 0 };
  }
  // 窓の終わりまで + 余裕60秒で自動失効させる（KVの掃除不要）
  await kv.put(key, String(current + 1), { expirationTtl: WINDOW_SEC + 60 });
  return { allowed: true, remaining: LIMIT_PER_WINDOW - current - 1 };
}
