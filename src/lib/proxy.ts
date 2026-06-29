const PROXY_BASE = "http://localhost:8080/proxy?url=";

export function getProxiedUrl(rawUrl: string): string {
  if (!rawUrl) return rawUrl;
  if (rawUrl.includes("/proxy?url=")) return rawUrl;
  if (!rawUrl.toLowerCase().includes(".m3u8")) return rawUrl;
  return `${PROXY_BASE}${encodeURIComponent(rawUrl)}`;
}
