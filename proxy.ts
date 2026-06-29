const PROXY_BASE = "http://localhost:8080/proxy?url=";

export function getProxiedUrl(rawUrl: string): string {
  if (!rawUrl) return rawUrl;
  // Don't double-wrap
  if (rawUrl.includes("/proxy?url=")) return rawUrl;
  // Only proxy HLS URLs
  if (!rawUrl.toLowerCase().includes(".m3u8")) return rawUrl;
  return `${PROXY_BASE}${encodeURIComponent(rawUrl)}`;
}

export function getProxiedUrls(urls: string[]): string[] {
  return urls.map(getProxiedUrl);
}
