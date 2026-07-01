import { createServerFn } from "@tanstack/react-start";
import { parse } from "node-html-parser";
import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import {
  getBaseUrl,
  cdnPost,
  proxyFetch,
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
  const res = await proxyFetch(url);
  if (!res.ok) throw new Error(`HDRezka page returned ${res.status}`);
  return await res.text();
}

export const searchHDRezka = async ({ data }: { data: { query: string } }): Promise<HdrezkaSearchItem[]> => {
    const baseUrl = await getBaseUrl();
    const searchUrl = `${baseUrl}/search/?do=search&subaction=search&q=${encodeURIComponent(data.query)}`;
    const html = await fetchPage(searchUrl);
    const items: HdrezkaSearchItem[] = [];
    
    const itemRegex = /<div class="b-content__inline_item-link">[\s\S]*?<a href="([^"]+)">(.*?)<\/a>/g;
    let m;
    while ((m = itemRegex.exec(html)) !== null) {
      const url = m[1];
      const inner = m[2];
      const titleMatch = inner.match(/<span class="enty">([^<]+)<\/span>/);
      const title = titleMatch ? titleMatch[1].trim() : inner.replace(/<[^>]+>/g, "").trim();
      items.push({
        title,
        url,
        description: title,
      });
    }
    return items;
  };

export const getHDRezkaVideo = async ({ data }: { data: { url: string } }): Promise<HdrezkaVideo | null> => {
    try {
      const baseUrl = await getBaseUrl();
      const url = data.url.startsWith("http") ? data.url : `${baseUrl}${data.url}`;
      const html = await fetchPage(url);
      const root = parse(html);

      const id = root.querySelector(".b-userset__fav_holder")?.getAttribute("data-post_id") || "";
      if (!id) return null;

      const translations: HdrezkaTranslation[] = [];
      const transItems = root.querySelectorAll(".b-translator__item");
      for (const el of transItems) {
        let name = el.textContent.trim();
        // Fallback for getting the ukrainian flag or text inside the translator
        if (el.innerHTML.includes("український")) name += " UA";
        translations.push({
          id: el.getAttribute("data-translator_id") || "",
          name,
          isAds: el.getAttribute("data-ads") === "1",
          isCamRip: el.getAttribute("data-camrip") === "1",
          isDefault: false,
          isDirector: el.getAttribute("data-director") === "1",
          isPremium: el.classList.contains("b-prem_translator"),
        });
      }

      if (translations.length === 0) {
        const tdRegex = /<td[^>]*>(.*?)<\/td>/g;
        let match;
        let name = "Default";
        // Attempt to find the default translator name if no multiple translators exist
        // Note: Simple fallback
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

      const title = root.querySelector("h1[itemprop=name]")?.textContent.trim() || "";
      const titleOriginal = root.querySelector(".b-post__origtitle")?.textContent.trim() || "";
      const cover = root.querySelector('a[data-imagelightbox="cover"]')?.getAttribute("href") || "";
      const description = root.querySelector(".b-post__description_text")?.textContent.trim() || "";
      
      const yearMatch = html.match(/Дата выхода.*?<a[^>]*>(\d{4})/);
      const year = yearMatch ? yearMatch[1] : "";

      const typeMatch = url.match(/\/([a-z-]+)\//);
      const videoType = typeMatch ? typeMatch[1] : "";

      let defaultStream: HdrezkaStream | undefined;
      let defaultTranslatorId = "";

      const htmlRaw = html;
      const lines = htmlRaw.split('\n');
      const initLine = lines.find(l => l.includes('initCDNSeriesEvents(') || l.includes('initCDNMoviesEvents('));

      if (initLine) {
        const idMatch = initLine.match(/initCDN(?:Series|Movies)Events\(\d+,\s*(\d+),/);
        if (idMatch) {
          defaultTranslatorId = idMatch[1];
        }

        const jsonStart = initLine.indexOf('{"id":"cdnplayer"');
        if (jsonStart !== -1) {
          let braceCount = 0;
          let endIdx = -1;
          let inString = false;
          let escapeNext = false;
          
          for (let i = jsonStart; i < initLine.length; i++) {
            const char = initLine[i];
            if (escapeNext) { escapeNext = false; continue; }
            if (char === '\\') { escapeNext = true; continue; }
            if (char === '"') { inString = !inString; continue; }
            if (!inString) {
              if (char === '{') braceCount++;
              else if (char === '}') {
                braceCount--;
                if (braceCount === 0) {
                  endIdx = i;
                  break;
                }
              }
            }
          }

          if (endIdx !== -1) {
            const jsnStr = initLine.substring(jsonStart, endIdx + 1);
            try {
              const jsn = JSON.parse(jsnStr);
              const decodedUrl = decodeStreamUrl(jsn.streams || "");
              const formats = parseStreamFormats(decodedUrl);
              defaultStream = {
                url: decodedUrl,
                formats,
                thumbnails: jsn.thumbnails ? baseUrl + jsn.thumbnails : undefined,
              };
              if (jsn.subtitle && typeof jsn.subtitle === "string") {
                defaultStream.subtitles = parseSubtitles(jsn.subtitle);
              }
            } catch (e) {
              console.error("HDRezka Server JSON parse failed", e);
            }
          }
        }
      }

      translations.forEach((t) => {
        if (t.id === defaultTranslatorId) t.isDefault = true;
      });

      return { id, title, titleOriginal, cover, description, year, type: videoType, translations, defaultStream };
    } catch {
      return null;
    }
  };

export const getHDRezkaEpisodes = async ({ data }: { data: { videoId: string; translatorId: string } }): Promise<HdrezkaEpisodeMap | null> => {
    try {
      const baseUrl = await getBaseUrl();
      const result = await cdnPost(baseUrl, {
        id: data.videoId,
        translator_id: data.translatorId,
        action: "get_episodes",
      });
      if (!result.success) return null;

      const root = parse(result.episodes || "");
      const episodes: HdrezkaEpisodeMap = {};

      const listEls = root.querySelectorAll(".b-simple_episodes__list");
      for (const listEl of listEls) {
        const epEls = listEl.querySelectorAll(".b-simple_episode__item");
        for (const epEl of epEls) {
            const season = parseInt(epEl.getAttribute("data-season_id") || "0", 10);
            const episode = parseInt(epEl.getAttribute("data-episode_id") || "0", 10);
            const cdnUrl = epEl.getAttribute("data-cdn_url") || "";
            if (season > 0) {
              if (!episodes[season]) episodes[season] = {};
              episodes[season][episode] = {
                cdnUrl: cdnUrl === "null" ? "" : cdnUrl,
              };
            }
        }
      }

      return episodes;
    } catch {
      return null;
    }
  };

export const getHDRezkaStream = async ({ data }: { data: { videoId: string; translatorId: string; season?: number; episode?: number; isCamRip?: boolean; isAds?: boolean; isDirector?: boolean } }): Promise<HdrezkaStream | null> => {
    try {
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

      const result = await cdnPost(baseUrl, form);
      const decodedUrl = decodeStreamUrl(result.url || "");
      const formats = parseStreamFormats(decodedUrl);

      const stream: HdrezkaStream = {
        url: decodedUrl,
        formats,
        thumbnails: result.thumbnails ? baseUrl + result.thumbnails : undefined,
      };

      if (result.subtitle && typeof result.subtitle === "string") {
        stream.subtitles = parseSubtitles(result.subtitle);
      }

      return stream;
    } catch {
      return null;
    }
  };

export const resolveStreamUrl = async ({ data }: { data: { videoId: string; translatorId: string; season?: number; episode?: number; isCamRip?: boolean; isAds?: boolean; isDirector?: boolean } }): Promise<{ hls: string; mp4: string } | null> => {
    try {
      const stream = await getHDRezkaStream({ data });
      if (!stream) return null;

      let hlsUrl = stream.formats["1080p"]?.hls || stream.formats["720p"]?.hls || stream.formats["480p"]?.hls || stream.formats["360p"]?.hls || Object.values(stream.formats)[0]?.hls;
      let mp4Url = stream.formats["1080p"]?.mp4 || stream.formats["720p"]?.mp4 || stream.formats["480p"]?.mp4 || stream.formats["360p"]?.mp4 || Object.values(stream.formats)[0]?.mp4;

      if (!hlsUrl && !mp4Url) return null;

      return { hls: hlsUrl || "", mp4: mp4Url || "" };
    } catch {
      return null;
    }
  };

const execFileAsync = promisify(execFile);

export const getHDRezkaNativeStream = createServerFn({ method: "GET" })
  .validator((d: { url: string; season?: number; episode?: number; translatorId?: string }) => d)
  .handler(async ({ data }) => {
  try {
    const scraperPath = path.join(process.cwd(), 'src', 'lib', 'python', 'scraper.py');
    const args = [scraperPath, data.url];
    if (data.season !== undefined && data.episode !== undefined) {
      args.push(data.season.toString(), data.episode.toString());
    }
    if (data.translatorId !== undefined) {
      if (args.length === 2) args.push('null', 'null');
      args.push(data.translatorId.toString());
    }

    const pythonCmd = process.platform === 'win32' ? 'py' : 'python3';
    const { stdout } = await execFileAsync(pythonCmd, args);
    const result = JSON.parse(stdout);
    if (!result.success) throw new Error(result.error);
    return result.videos;
  } catch (error) {
    console.error("HDRezka Python Scraper Error:", error);
    return null;
  }
});
