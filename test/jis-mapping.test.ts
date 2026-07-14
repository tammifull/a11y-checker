import { describe, it, expect } from "vitest";
import { resolveJisRule } from "../src/jis-mapping";

describe("resolveJisRule", () => {
  it("既知ルール image-alt は ②必須・JIS 1.1.1 にマップされる", () => {
    const r = resolveJisRule("image-alt", "critical");
    expect(r.priority).toBe("required");
    expect(r.jis).toBe("1.1.1");
    expect(r.title).toContain("代替テキスト");
  });

  it("既知ルール no-autoplay-audio は ①重大 にマップされる", () => {
    expect(resolveJisRule("no-autoplay-audio", "moderate").priority).toBe(
      "critical",
    );
  });

  it("既知ルール label は ③個別対応 にマップされる", () => {
    expect(resolveJisRule("label", "critical").priority).toBe("individual");
  });

  it("未知ルールは impact でフォールバックする（serious→required）", () => {
    const r = resolveJisRule("some-unknown-rule", "serious");
    expect(r.priority).toBe("required");
    expect(r.title).toContain("axe原文");
    expect(r.title).toContain("some-unknown-rule");
  });

  it("未知ルール moderate/minor/null は individual", () => {
    expect(resolveJisRule("x", "moderate").priority).toBe("individual");
    expect(resolveJisRule("x", null).priority).toBe("individual");
  });
});
