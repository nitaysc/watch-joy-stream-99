import { HDREZKA_MIRRORS, type HdrezkaStreamFormat } from "./hdrezka.types";

const CINEPRO_BASE = "https://core-production-ef8a.up.railway.app";
const TIMEOUT = 5000;

/* ------------------------------------------------------------------ */
/*  Railway proxy helpers                                             */
/* ------------------------------------------------------------------ */

function extractProxyResponse(text: string): string | null {
  const m = text.match(/\/v1\/proxy\?data=(.+)$/);
  if (!m) return null;
  try {
    const decoded = decodeURIComponent(m[1]);
    const obj = JSON.parse(decoded);
    const raw = obj.url as string;
    const sepIdx = raw.indexOf("//");
    return sepIdx !== -1 ? raw.slice(sepIdx + 2) : raw;
  } catch {
    return null;
  }
}

async function railFetch(url: string): Promise<Response | null> {
  try {
    const proxyUrl = `${CINEPRO_BASE}/v1/proxy?data=${encodeURIComponent(JSON.stringify({ url }))}`;
    const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(TIMEOUT) });
    if (!res.ok) return null;
    const text = await res.text();
    const content = extractProxyResponse(text);
    if (!content) return null;
    return new Response(content, { status: 200, headers: { "content-type": "text/html" } });
  } catch {
    return null;
  }
}

async function railPost(url: string, form: Record<string, string>): Promise<Response | null> {
  // GET-style with form as query params
  const fullUrl = `${url}&${new URLSearchParams(form).toString()}`;
  const r1 = await railFetch(fullUrl);
  if (r1) return r1;
  // POST with body
  try {
    const res = await fetch(`${CINEPRO_BASE}/v1/proxy`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, method: "POST", body: new URLSearchParams(form).toString() }),
      signal: AbortSignal.timeout(TIMEOUT),
    });
    if (!res.ok) return null;
    const text = await res.text();
    const content = extractProxyResponse(text);
    if (!content) return null;
    return new Response(content, { status: 200, headers: { "content-type": "application/json" } });
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/*  Exported fetch helpers                                            */
/* ------------------------------------------------------------------ */

export async function proxyFetch(url: string, _options?: RequestInit): Promise<Response> {
  const res = await railFetch(url);
  if (res) return res;
  throw new Error(`Railway proxy returned no response for ${url}`);
}

export async function proxyPost(url: string, form: Record<string, string>): Promise<Response> {
  const res = await railPost(url, form);
  if (res) return res;
  throw new Error(`Railway proxy POST failed for ${url}`);
}

/* ------------------------------------------------------------------ */
/*  Original module exports                                           */
/* ------------------------------------------------------------------ */

let activeMirror: string | null = HDREZKA_MIRRORS[0];

export async function getBaseUrl(): Promise<string> {
  return activeMirror!;
}

export async function cdnPost(
  baseUrl: string,
  form: Record<string, string>,
): Promise<any> {
  const url = baseUrl + `/ajax/get_cdn_series/?t=${Date.now()}`;
  const res = await proxyPost(url, form);
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
