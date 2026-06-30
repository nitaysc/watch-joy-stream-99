import { HDREZKA_MIRRORS, HDREZKA_USER_AGENT, type HdrezkaStreamFormat } from "./hdrezka.types";

const CINEPRO_BASE = "https://core-production-ef8a.up.railway.app";

/* ------------------------------------------------------------------ */
/*  Proxy helpers                                                     */
/* ------------------------------------------------------------------ */

async function tryRailwayProxy(
  url: string,
  options?: RequestInit & { form?: Record<string, string> },
): Promise<Response | null> {
  // GET with bare URL (no custom headers — proxy uses its own)
  try {
    const proxyUrl = `${CINEPRO_BASE}/v1/proxy?data=${encodeURIComponent(JSON.stringify({ url }))}`;
    const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(10000) });
    if (res.ok) return res;
  } catch {}

  // POST with bare URL
  try {
    const res = await fetch(`${CINEPRO_BASE}/v1/proxy`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
      signal: AbortSignal.timeout(10000),
    });
    if (res.ok) return res;
  } catch {}

  // GET with URL + form data (for CDN POST fallback)
  if (options?.form) {
    try {
      const fullUrl = `${url}&${new URLSearchParams(options.form).toString()}`;
      const proxyUrl = `${CINEPRO_BASE}/v1/proxy?data=${encodeURIComponent(JSON.stringify({ url: fullUrl }))}`;
      const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(10000) });
      if (res.ok) return res;
    } catch {}
  }

  return null;
}

async function tryAllorigins(url: string): Promise<Response | null> {
  try {
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
    const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(8000) });
    if (res.ok) {
      const json = await res.json();
      if (json.contents) {
        return new Response(json.contents, {
          status: 200,
          headers: { "content-type": res.headers.get("content-type") ?? "text/html" },
        });
      }
    }
  } catch {}
  return null;
}

async function tryCodetabs(url: string): Promise<Response | null> {
  try {
    const proxyUrl = `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`;
    const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(8000) });
    if (res.ok) return res;
  } catch {}
  return null;
}

async function tryDirect(url: string, options?: RequestInit): Promise<Response | null> {
  try {
    const res = await fetch(url, { ...options, signal: AbortSignal.timeout(8000) });
    if (res.ok) return res;
  } catch {}
  return null;
}

/* ------------------------------------------------------------------ */
/*  Exported fetch helpers                                            */
/* ------------------------------------------------------------------ */

const proxyChain = [
  tryRailwayProxy,
  tryAllorigins,
  tryCodetabs,
  tryDirect,
];

export async function proxyFetch(
  url: string,
  options?: RequestInit,
): Promise<Response> {
  if (!options?.method || options.method === "GET") {
    for (const proxy of proxyChain) {
      const res = await proxy(url, options);
      if (res) return res;
    }
  }

  // Final direct fallback (will throw on failure)
  return fetch(url, { ...options, signal: AbortSignal.timeout(8000) });
}

export async function proxyPost(
  url: string,
  form: Record<string, string>,
): Promise<Response> {
  const railRes = await tryRailwayProxy(url, { ...({ form } as any), method: "POST" });
  if (railRes) return railRes;

  const aoRes = await tryAllorigins(`${url}&${new URLSearchParams(form).toString()}`);
  if (aoRes) {
    return new Response(await aoRes.text(), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }

  const directRes = await tryDirect(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": HDREZKA_USER_AGENT,
    },
    body: new URLSearchParams(form).toString(),
  });
  if (directRes) return directRes;

  throw new Error("All HDRezka POST attempts failed");
}

/* ------------------------------------------------------------------ */
/*  Original module exports                                           */
/* ------------------------------------------------------------------ */

let activeMirror: string | null = null;

async function probeMirror(mirror: string): Promise<boolean> {
  try {
    const res = await proxyFetch(mirror);
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
  activeMirror = HDREZKA_MIRRORS[0];
  return activeMirror;
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
