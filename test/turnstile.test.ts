import { describe, it, expect, vi } from "vitest";
import { verifyTurnstile } from "../src/turnstile";

function fetchReturning(body: unknown, status = 200): typeof fetch {
  return vi.fn(
    async () => new Response(JSON.stringify(body), { status }),
  ) as unknown as typeof fetch;
}

describe("verifyTurnstile", () => {
  it("siteverify が success:true なら通す", async () => {
    const ok = await verifyTurnstile(
      "secret",
      "token",
      "1.2.3.4",
      fetchReturning({ success: true }),
    );
    expect(ok).toBe(true);
  });

  it("success:false なら弾く", async () => {
    const ok = await verifyTurnstile(
      "secret",
      "bad",
      null,
      fetchReturning({ success: false }),
    );
    expect(ok).toBe(false);
  });

  it("siteverify がHTTPエラーでも例外を投げず false を返す", async () => {
    const ok = await verifyTurnstile(
      "secret",
      "token",
      null,
      fetchReturning({}, 500),
    );
    expect(ok).toBe(false);
  });

  it("トークンが空文字なら fetch せずに false", async () => {
    const spy = fetchReturning({ success: true });
    const ok = await verifyTurnstile("secret", "", null, spy);
    expect(ok).toBe(false);
    expect(spy).not.toHaveBeenCalled();
  });

  it("siteverify にsecret/response/remoteipをPOSTする", async () => {
    const spy = fetchReturning({ success: true });
    await verifyTurnstile("sec", "tok", "1.2.3.4", spy);
    const [url, init] = (spy as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    );
    const params = init.body as URLSearchParams;
    expect(params.get("secret")).toBe("sec");
    expect(params.get("response")).toBe("tok");
    expect(params.get("remoteip")).toBe("1.2.3.4");
  });
});
