export type UrlGuardResult =
  { ok: true; url: string } | { ok: false; reason: string };

const PRIVATE_IPV4 = [
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
  /^169\.254\./,
  /^0\./,
];

export function validateScanUrl(input: string): UrlGuardResult {
  let parsed: URL;
  try {
    parsed = new URL(input);
  } catch {
    return { ok: false, reason: "URLの形式が正しくありません" };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { ok: false, reason: "http(s) 以外のURLは検査できません" };
  }

  const host = parsed.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost")) {
    return { ok: false, reason: "内部ホストは検査できません" };
  }

  if (PRIVATE_IPV4.some((re) => re.test(host))) {
    return { ok: false, reason: "プライベートIPは検査できません" };
  }

  return { ok: true, url: parsed.href };
}
