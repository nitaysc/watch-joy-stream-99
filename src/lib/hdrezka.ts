import { HDREZKA_MIRRORS, HDREZKA_USER_AGENT, type HdrezkaStreamFormat } from "./hdrezka.types";

let activeMirror: string | null = null;

async function probeMirror(mirror: string): Promise<boolean> {
  try {
    const res = await fetch(mirror, {
      headers: { "User-Agent": HDREZKA_USER_AGENT },
      signal: AbortSignal.timeout(8000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function getBaseUrl(): Promise<string> {
  if (activeMirror) return activeMirror;
  for (const m of HDREZKA_MIRRORS) {
    if (await probeMirror(m)) {
      activeMirror = m;
      return m;
    }
  }
  throw new Error("No working HDRezka mirror found");
}

export function buildHeaders(): Record<string, string> {
  return {
    "User-Agent": HDREZKA_USER_AGENT,
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
    Referer: (activeMirror ?? HDREZKA_MIRRORS[0]) + "/",
  };
}

export async function cdnPost(
  baseUrl: string,
  form: Record<string, string>,
): Promise<any> {
  const body = new URLSearchParams(form).toString();
  const url =
    baseUrl +
    `/ajax/get_cdn_series/?t=${Date.now()}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "X-Requested-With": "XMLHttpRequest",
      "User-Agent": HDREZKA_USER_AGENT,
      Referer: baseUrl + "/",
    },
    body,
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`CDN API returned ${res.status}`);
  return res.json();
}

const knownSalts = [
  "IyMjI14hISMjIUBA",
  "QEBAQEAhIyMhXl5e",
  "JCQhIUAkJEBeIUAjJCRA",
  "JCQjISFAIyFAIyM=",
  "Xl5eIUAjIyEhIyM=",
];

const saltFallbackLen = 16;

export function decodeStreamUrl(encoded: string): string {
  if (encoded.startsWith("[") || encoded.startsWith("http")) {
    return encoded;
  }
  let url = encoded.replace(/^#h/, "");
  for (let i = 0; i < 60 && url.includes("//_//"); i++) {
    const idx = url.indexOf("//_//");
    const after = url.slice(idx + 5);
    let matched = false;
    for (const salt of knownSalts) {
      if (after.startsWith(salt)) {
        url = url.slice(0, idx) + after.slice(salt.length);
        matched = true;
        break;
      }
    }
    if (!matched) {
      const end = idx + 5 + saltFallbackLen;
      url = url.slice(0, idx) + url.slice(Math.min(end, url.length));
    }
  }
  try {
    return atob(url);
  } catch {
    return url;
  }
}

const reQuality = /\[([^\]]+)\]/g;

export function parseStreamFormats(str: string): Record<string, HdrezkaStreamFormat> {
  const formats: Record<string, HdrezkaStreamFormat> = {};
  const matches: { quality: string; start: number; end: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = reQuality.exec(str)) !== null) {
    matches.push({ quality: m[1], start: m.index, end: reQuality.lastIndex });
  }
  for (let i = 0; i < matches.length; i++) {
    const { quality } = matches[i];
    const start = matches[i].end;
    const end = i + 1 < matches.length ? matches[i + 1].start : str.length;
    const urlStr = str.slice(start, end).replace(/,+$/, "").trim();
    const urls = urlStr.split(" or ").map((u) => u.trim()).filter(Boolean);
    let hls = "";
    let mp4 = "";
    const hlsIdx = urls.findIndex((u) => u.endsWith(":hls:manifest.m3u8"));
    if (hlsIdx !== -1) {
      hls = urls[hlsIdx];
      mp4 = urls.find((u, j) => j !== hlsIdx) ?? "";
      if (hls && !mp4) mp4 = hls.replace(/:hls:manifest\.m3u8$/, "");
    } else {
      hls = urls[0] ?? "";
      mp4 = urls[urls.length - 1] ?? hls;
    }
    formats[quality] = { hls, mp4 };
  }
  return formats;
}

export function parseSubtitles(subs: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const entry of subs.split(",")) {
    const endBracket = entry.indexOf("]");
    if (endBracket === -1) continue;
    const key = entry.slice(1, endBracket).trim();
    let value = entry.slice(endBracket + 1).trim();
    if (value.includes(" or ")) {
      const parts = value.split(" or ").map((s) => s.trim());
      value = parts[parts.length - 1];
    }
    result[key] = value;
  }
  return result;
}
