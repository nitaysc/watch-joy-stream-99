import * as cheerio from "cheerio";
import {
  decodeStreamUrl,
  parseStreamFormats,
  parseSubtitles,
} from "./hdrezka";
import {
  HDREZKA_MIRRORS,
  HDREZKA_USER_AGENT,
  type HdrezkaSearchItem,
  type HdrezkaVideo,
  type HdrezkaTranslation,
  type HdrezkaStream,
  type HdrezkaStreamFormat,
} from "./hdrezka.types";

const PROXIES = [
  (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url: string) => `https://corsproxy.io/?url=${encodeURIComponent(url)}`,
];

async function fetchWithProxy(
  targetUrl: string,
  options?: RequestInit,
): Promise<Response> {
  for (const proxy of PROXIES) {
    try {
      const proxyUrl = proxy(targetUrl);
      const res = await fetch(proxyUrl, {
        ...options,
        signal: AbortSignal.timeout(20000),
      });
      if (res.ok) return res;
    } catch {
      continue;
    }
  }

  throw new Error("All HDRezka proxies failed");
}

async function fetchPage(url: string): Promise<string> {
  const res = await fetchWithProxy(url, {
    headers: {
      "User-Agent": HDREZKA_USER_AGENT,
      Accept: "text/html",
    },
  });
  return res.text();
}

let activeMirrorUrl: string | null = null;

async function getBaseUrl(): Promise<string> {
  if (activeMirrorUrl) return activeMirrorUrl;

  for (const mirror of HDREZKA_MIRRORS) {
    try {
      const res = await fetchWithProxy(mirror);
      if (res.ok) {
        activeMirrorUrl = mirror;
        return mirror;
      }
    } catch {
      continue;
    }
  }

  activeMirrorUrl = HDREZKA_MIRRORS[0];
  return activeMirrorUrl;
}

async function cdnPostClient(
  baseUrl: string,
  form: Record<string, string>,
): Promise<any> {
  const body = new URLSearchParams(form).toString();
  const url = `${baseUrl}/ajax/get_cdn_series/?t=${Date.now()}`;

  const res = await fetchWithProxy(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "X-Requested-With": "XMLHttpRequest",
      "User-Agent": HDREZKA_USER_AGENT,
      Referer: baseUrl + "/",
    },
    body,
  });
  return res.json();
}

const reInitCDN = /initCDN(?:Series|Movies)Events\(\d+,\s(\d+),.+?(\{.*?\})\);/;

export async function clientSearchHDRezka(
  query: string,
): Promise<HdrezkaSearchItem[]> {
  const baseUrl = await getBaseUrl();
  const searchUrl = `${baseUrl}/engine/ajax/search.php?q=${encodeURIComponent(query)}`;

  let html: string;
  try {
    html = await fetchPage(searchUrl);
  } catch {
    return [];
  }

  const $ = cheerio.load(html);
  const items: HdrezkaSearchItem[] = [];

  $(".b-search__live_section > ul > li").each((_, el) => {
    const link = $(el).find("a");
    const rating = $(el).find("span.rating").text();
    $(el).find("span.rating").remove();
    items.push({
      title: $(el).find("span.enty").text() || link.text(),
      url: link.attr("href") || "",
      description: link.text(),
    });
  });

  return items;
}

export async function clientGetHDRezkaVideo(
  url: string,
): Promise<HdrezkaVideo | null> {
  const baseUrl = await getBaseUrl();
  const fullUrl = url.startsWith("http") ? url : `${baseUrl}${url}`;

  let html: string;
  try {
    html = await fetchPage(fullUrl);
  } catch {
    return null;
  }

  const $ = cheerio.load(html);

  const id = $(".b-userset__fav_holder").attr("data-post_id") || "";
  if (!id) return null;

  const translations: HdrezkaTranslation[] = [];
  $(".b-translator__item").each((_, el) => {
    const $el = $(el);
    let name = $el.text().trim();
    const ua = $el.find('img[title="Украинский"]').attr("title");
    if (ua === "Украинский") name += " UA";
    translations.push({
      id: $el.attr("data-translator_id") || "",
      name,
      isAds: $el.attr("data-ads") === "1",
      isCamRip: $el.attr("data-camrip") === "1",
      isDefault: false,
      isDirector: $el.attr("data-director") === "1",
      isPremium: $el.hasClass("b-prem_translator"),
    });
  });

  if (translations.length === 0) {
    const name = $('tr:contains("В переводе:") td')
      .first()
      .next()
      .text()
      .trim();
    if (name) {
      translations.push({
        id: "",
        name,
        isAds: false,
        isCamRip: false,
        isDefault: true,
        isDirector: false,
        isPremium: false,
      });
    }
  }

  const pageTitle = $("h1[itemprop=name]").text().trim();
  const titleOriginal = $(".b-post__origtitle").text().trim();
  const cover =
    $('a[data-imagelightbox="cover"]').attr("href") || "";
  const description = $(".b-post__description_text").text().trim();
  const releaseDate = $('tr:contains("Дата выхода:") td')
    .first()
    .next()
    .text()
    .trim();
  const yearMatch = releaseDate.match(/\d{4}/);
  const year = yearMatch ? yearMatch[0] : "";

  const typeMatch = fullUrl.match(/\/([a-z-]+)\//);
  const videoType = typeMatch ? typeMatch[1] : "";

  let defaultStream: HdrezkaStream | undefined;
  let defaultTranslatorId = "";

  const htmlRaw = $.html();
  const initMatch = reInitCDN.exec(htmlRaw);
  if (initMatch) {
    defaultTranslatorId = initMatch[1];
    try {
      const jsn = JSON.parse(initMatch[2]);
      const decodedUrl = decodeStreamUrl(jsn.streams || "");
      const formats = parseStreamFormats(decodedUrl);
      defaultStream = {
        url: decodedUrl,
        formats,
        thumbnails: jsn.thumbnails
          ? baseUrl + jsn.thumbnails
          : undefined,
      };
      if (jsn.subtitle && typeof jsn.subtitle === "string") {
        defaultStream.subtitles = parseSubtitles(jsn.subtitle);
      }
    } catch {
    }
  }

  translations.forEach((t) => {
    if (t.id === defaultTranslatorId) t.isDefault = true;
  });

  return {
    id,
    title: pageTitle,
    titleOriginal,
    cover,
    description,
    year,
    type: videoType,
    translations,
    defaultStream,
  };
}

export async function clientResolveStreamUrl(params: {
  videoId: string;
  translatorId: string;
  season?: number;
  episode?: number;
  isCamRip?: boolean;
  isAds?: boolean;
  isDirector?: boolean;
}): Promise<{ hls: string; mp4: string } | null> {
  const stream = await clientGetHDRezkaStream(params);
  if (!stream) return null;

  const bestQuality =
    stream.formats["1080p"] ||
    stream.formats["720p"] ||
    stream.formats["480p"];
  if (!bestQuality) {
    const firstKey = Object.keys(stream.formats)[0];
    if (!firstKey) return null;
    return stream.formats[firstKey];
  }
  return bestQuality;
}

async function clientGetHDRezkaStream(params: {
  videoId: string;
  translatorId: string;
  season?: number;
  episode?: number;
  isCamRip?: boolean;
  isAds?: boolean;
  isDirector?: boolean;
}): Promise<HdrezkaStream | null> {
  const baseUrl = await getBaseUrl();

  const form: Record<string, string> = {
    id: params.videoId,
    translator_id: params.translatorId,
  };

  if (params.season && params.season > 0) {
    form.season = String(params.season);
    form.episode = String(params.episode ?? 1);
    form.action = "get_stream";
  } else {
    form.is_camrip = params.isCamRip ? "1" : "0";
    form.is_ads = params.isAds ? "1" : "0";
    form.is_director = params.isDirector ? "1" : "0";
    form.action = "get_movie";
  }

  try {
    const result = await cdnPostClient(baseUrl, form);
    const decodedUrl = decodeStreamUrl(result.url || "");
    const formats = parseStreamFormats(decodedUrl);

    const stream: HdrezkaStream = {
      url: decodedUrl,
      formats,
      thumbnails: result.thumbnails
        ? baseUrl + result.thumbnails
        : undefined,
    };

    if (result.subtitle && typeof result.subtitle === "string") {
      stream.subtitles = parseSubtitles(result.subtitle);
    }

    return stream;
  } catch {
    return null;
  }
}
