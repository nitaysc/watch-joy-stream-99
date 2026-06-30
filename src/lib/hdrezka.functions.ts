import { createServerFn } from "@tanstack/react-start";
import * as cheerio from "cheerio";
import {
  getBaseUrl,
  buildHeaders,
  cdnPost,
  decodeStreamUrl,
  parseStreamFormats,
  parseSubtitles,
} from "./hdrezka";
import type {
  HdrezkaSearchItem,
  HdrezkaVideo,
  HdrezkaTranslation,
  HdrezkaStream,
  HdrezkaEpisodeMap,
} from "./hdrezka.types";

const reInitCDN = /initCDN(?:Series|Movies)Events\(\d+,\s(\d+),.+?(\{.*?\})\);/;

async function fetchPage(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: buildHeaders(),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`HDRezka page returned ${res.status}`);
  return res.text();
}

export const searchHDRezka = createServerFn({ method: "GET" })
  .inputValidator((d: { query: string }) => d)
  .handler(async ({ data }): Promise<HdrezkaSearchItem[]> => {
    const baseUrl = await getBaseUrl();
    const searchUrl = `${baseUrl}/engine/ajax/search.php?q=${encodeURIComponent(data.query)}`;

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
  });

export const getHDRezkaVideo = createServerFn({ method: "GET" })
  .inputValidator((d: { url: string }) => d)
  .handler(async ({ data }): Promise<HdrezkaVideo | null> => {
    const baseUrl = await getBaseUrl();
    const url = data.url.startsWith("http") ? data.url : `${baseUrl}${data.url}`;

    let html: string;
    try {
      html = await fetchPage(url);
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

    const title = $("h1[itemprop=name]").text().trim();
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

    const typeMatch = url.match(/\/([a-z-]+)\//);
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
        // JSON parse failed
      }
    }

    translations.forEach((t) => {
      if (t.id === defaultTranslatorId) t.isDefault = true;
    });

    return {
      id,
      title,
      titleOriginal,
      cover,
      description,
      year,
      type: videoType,
      translations,
      defaultStream,
    };
  });

export const getHDRezkaEpisodes = createServerFn({ method: "GET" })
  .inputValidator((d: { videoId: string; translatorId: string }) => d)
  .handler(async ({ data }): Promise<HdrezkaEpisodeMap | null> => {
    const baseUrl = await getBaseUrl();
    try {
      const result = await cdnPost(baseUrl, {
        id: data.videoId,
        translator_id: data.translatorId,
        action: "get_episodes",
      });
      if (!result.success) return null;

      const $ = cheerio.load(result.episodes || "");
      const episodes: HdrezkaEpisodeMap = {};

      $(".b-simple_episodes__list").each((_, listEl) => {
        $(listEl)
          .find(".b-simple_episode__item")
          .each((_, epEl) => {
            const $ep = $(epEl);
            const season = parseInt($ep.attr("data-season_id") || "0", 10);
            const episode = parseInt($ep.attr("data-episode_id") || "0", 10);
            const cdnUrl = $ep.attr("data-cdn_url") || "";
            if (season > 0) {
              if (!episodes[season]) episodes[season] = {};
              episodes[season][episode] = {
                cdnUrl: cdnUrl === "null" ? "" : cdnUrl,
              };
            }
          });
      });

      return episodes;
    } catch {
      return null;
    }
  });

export const getHDRezkaStream = createServerFn({ method: "GET" })
  .inputValidator(
    (d: {
      videoId: string;
      translatorId: string;
      isCamRip?: boolean;
      isAds?: boolean;
      isDirector?: boolean;
      season?: number;
      episode?: number;
    }) => d,
  )
  .handler(async ({ data }): Promise<HdrezkaStream | null> => {
    const baseUrl = await getBaseUrl();

    const form: Record<string, string> = {
      id: data.videoId,
      translator_id: data.translatorId,
    };

    if (data.season && data.season > 0) {
      form.season = String(data.season);
      form.episode = String(data.episode ?? 1);
      form.action = "get_stream";
    } else {
      form.is_camrip = data.isCamRip ? "1" : "0";
      form.is_ads = data.isAds ? "1" : "0";
      form.is_director = data.isDirector ? "1" : "0";
      form.action = "get_movie";
    }

    try {
      const result = await cdnPost(baseUrl, form);
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
  });

export const resolveStreamUrl = createServerFn({ method: "GET" })
  .inputValidator(
    (d: {
      videoId: string;
      translatorId: string;
      season?: number;
      episode?: number;
      isCamRip?: boolean;
      isAds?: boolean;
      isDirector?: boolean;
    }) => d,
  )
  .handler(async ({ data }): Promise<{ hls: string; mp4: string } | null> => {
    const stream = await getHDRezkaStream({
      data: {
        videoId: data.videoId,
        translatorId: data.translatorId,
        season: data.season,
        episode: data.episode,
        isCamRip: data.isCamRip,
        isAds: data.isAds,
        isDirector: data.isDirector,
      },
    });
    if (!stream) return null;

    const bestQuality = stream.formats["1080p"] || stream.formats["720p"] || stream.formats["480p"];
    if (!bestQuality) {
      const firstKey = Object.keys(stream.formats)[0];
      if (!firstKey) return null;
      return stream.formats[firstKey];
    }
    return bestQuality;
  });
