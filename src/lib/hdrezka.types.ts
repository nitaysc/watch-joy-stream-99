export interface HdrezkaStreamFormat {
  hls: string;
  mp4: string;
}

export interface HdrezkaStream {
  url: string;
  formats: Record<string, HdrezkaStreamFormat>;
  subtitles?: Record<string, string>;
  thumbnails?: string;
}

export interface HdrezkaTranslation {
  id: string;
  name: string;
  isAds: boolean;
  isCamRip: boolean;
  isDefault: boolean;
  isDirector: boolean;
  isPremium: boolean;
}

export interface HdrezkaVideo {
  id: string;
  title: string;
  titleOriginal: string;
  cover: string;
  description: string;
  year: string;
  type: string;
  translations: HdrezkaTranslation[];
  defaultStream?: HdrezkaStream;
  episodes?: HdrezkaEpisodeMap;
}

export type HdrezkaEpisodeMap = Record<number, Record<number, { cdnUrl: string }>>;

export interface HdrezkaSearchItem {
  title: string;
  url: string;
  description: string;
  cover?: string;
}

export interface HdrezkaSource {
  title: string;
  videoId: string;
  translation: HdrezkaTranslation;
  stream?: HdrezkaStream;
}

export const HDREZKA_MIRRORS = [
  "https://hdrezka.ag",
  "https://rezka.ag",
  "https://hdrzk.org",
  "https://hdrezka.cm",
  "https://hdrezka.art",
  "https://hdrezka.uk",
  "https://rezka.cc",
];

export const HDREZKA_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
