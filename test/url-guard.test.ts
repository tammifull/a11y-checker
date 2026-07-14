import { describe, it, expect } from "vitest";
import { validateScanUrl } from "../src/url-guard";

describe("validateScanUrl", () => {
  it("通常のhttps URLを許可する", () => {
    expect(validateScanUrl("https://example.com")).toEqual({
      ok: true,
      url: "https://example.com/",
    });
  });

  it("httpも許可する", () => {
    expect(validateScanUrl("http://example.com").ok).toBe(true);
  });

  it("http以外のスキームを拒否する", () => {
    expect(validateScanUrl("ftp://example.com").ok).toBe(false);
    expect(validateScanUrl("file:///etc/passwd").ok).toBe(false);
    expect(validateScanUrl("javascript:alert(1)").ok).toBe(false);
  });

  it("localhostを拒否する", () => {
    expect(validateScanUrl("http://localhost").ok).toBe(false);
    expect(validateScanUrl("http://127.0.0.1").ok).toBe(false);
  });

  it("プライベートIP帯を拒否する", () => {
    expect(validateScanUrl("http://10.0.0.1").ok).toBe(false);
    expect(validateScanUrl("http://192.168.1.1").ok).toBe(false);
    expect(validateScanUrl("http://172.16.0.1").ok).toBe(false);
    expect(validateScanUrl("http://169.254.1.1").ok).toBe(false);
  });

  it("不正な文字列を拒否する", () => {
    expect(validateScanUrl("not a url").ok).toBe(false);
    expect(validateScanUrl("").ok).toBe(false);
  });
});
