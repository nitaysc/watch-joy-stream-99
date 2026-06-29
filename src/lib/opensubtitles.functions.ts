import { createServerFn } from "@tanstack/react-start";

interface SubSearchParams {
  tmdbId: number;
  season?: number;
  episode?: number;
  language?: string;
}

interface SubtitleResult {
  file_id: number;
  language: string;
  language_english_name: string;
  hearing_impaired: boolean;
  file_name: string;
  fps: number;
}

interface SubSearchResponse {
  total_count: number;
  data: {
    id: string;
    attributes: {
      subtitle_id: number;
      language: string;
      language_english_name: string;
      hearing_impaired: boolean;
      file_id: number;
      file_name: string;
      fps: number;
      votes: number;
      download_count: number;
    };
  }[];
}

const API_KEY = process.env.VITE_OPENSUBTITLES_API_KEY || "QwGYtyCVP7UTixkKh7bViVfW9tMeJH2g";

function srtToVtt(srt: string): string {
  let vtt = "WEBVTT\n\n";
  vtt += srt
    .replace(/\r\n/g, "\n")
    .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, "$1.$2");
  return vtt;
}

export const searchSubtitles = createServerFn({ method: "GET" })
  .inputValidator((d: SubSearchParams) => d)
  .handler(async ({ data }) => {
    const params = new URLSearchParams();
    params.set("tmdb_id", String(data.tmdbId));
    params.set("languages", data.language ?? "en");
    params.set("type", data.season ? "episode" : "movie");
    if (data.season) params.set("season_number", String(data.season));
    if (data.episode) params.set("episode_number", String(data.episode));
    params.set("order_by", "download_count");
    params.set("order_direction", "desc");
    params.set("limit", "30");

    const res = await fetch(`https://api.opensubtitles.com/api/v1/subtitles?${params}`, {
      headers: {
        "Api-Key": API_KEY,
        "User-Agent": "Cinely v1",
      },
    });

    if (!res.ok) return [];

    const json: SubSearchResponse = await res.json();
    return json.data.map((item) => ({
      file_id: item.attributes.file_id,
      language: item.attributes.language,
      language_english_name: item.attributes.language_english_name,
      hearing_impaired: item.attributes.hearing_impaired,
      file_name: item.attributes.file_name,
      fps: item.attributes.fps,
    }));
  });

export const getSubtitleVtt = createServerFn({ method: "GET" })
  .inputValidator((d: { file_id: number }) => d)
  .handler(async ({ data }) => {
    const dlRes = await fetch("https://api.opensubtitles.com/api/v1/download", {
      method: "POST",
      headers: {
        "Api-Key": API_KEY,
        "User-Agent": "Cinely v1",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ file_id: data.file_id }),
    });

    if (!dlRes.ok) throw new Error(`Download failed: ${dlRes.status}`);

    const dlJson: { link: string; file_name: string } = await dlRes.json();

    const subRes = await fetch(dlJson.link);
    if (!subRes.ok) throw new Error(`Subtitle fetch failed: ${subRes.status}`);

    const srt = await subRes.text();
    return { vtt: srtToVtt(srt), fileName: dlJson.file_name };
  });
