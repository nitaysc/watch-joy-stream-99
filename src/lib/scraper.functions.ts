import { createServerFn } from "@tanstack/react-start";
import * as cheerio from "cheerio";

// ─── Types ───────────────────────────────────────────────────────────────────

export type ScrapedMovie = {
  title: string | null;
  year: number | null;
  rating: string | null;
  posterUrl: string | null;
  genre: string[];
  sourceUrl: string;
  scrapedAt: string;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Random delay between 2–5 seconds to avoid overloading servers. */
function randomDelay(): Promise<void> {
  const ms = Math.floor(Math.random() * 3000) + 2000;
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Extract JSON-LD structured data from a page.
 * Most major sites (IMDb, Rotten Tomatoes, etc.) embed machine-readable
 * metadata in <script type="application/ld+json"> tags. This is far more
 * reliable than CSS selectors because it survives JS-rendered pages.
 */
function extractJsonLd($: cheerio.CheerioAPI): any | null {
  const scripts = $('script[type="application/ld+json"]');
  for (let i = 0; i < scripts.length; i++) {
    try {
      const raw = $(scripts[i]).html();
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      // Look for Movie or TVSeries schema types
      if (
        parsed["@type"] === "Movie" ||
        parsed["@type"] === "TVSeries" ||
        parsed["@type"] === "TVEpisode"
      ) {
        return parsed;
      }
    } catch {
      // Malformed JSON — skip
    }
  }
  return null;
}

/** Parse a JSON-LD object into our standardized ScrapedMovie shape. */
function parseJsonLd(ld: any, sourceUrl: string): ScrapedMovie {
  // Title
  const title: string | null = ld.name ?? ld.headline ?? null;

  // Year — from datePublished or dateCreated
  let year: number | null = null;
  const dateStr = ld.datePublished ?? ld.dateCreated ?? null;
  if (dateStr) {
    const match = String(dateStr).match(/(\d{4})/);
    if (match) year = parseInt(match[1], 10);
  }

  // Rating — from aggregateRating
  let rating: string | null = null;
  if (ld.aggregateRating) {
    const val = ld.aggregateRating.ratingValue;
    if (val != null) rating = String(val);
  }

  // Poster — from image (can be string or object)
  let posterUrl: string | null = null;
  if (typeof ld.image === "string") {
    posterUrl = ld.image;
  } else if (ld.image?.url) {
    posterUrl = ld.image.url;
  }

  // Genres — string or array
  let genre: string[] = [];
  if (Array.isArray(ld.genre)) {
    genre = ld.genre.map(String);
  } else if (typeof ld.genre === "string") {
    genre = ld.genre.split(",").map((g: string) => g.trim()).filter(Boolean);
  }

  return {
    title,
    year,
    rating,
    posterUrl,
    genre,
    sourceUrl,
    scrapedAt: new Date().toISOString(),
  };
}

// ─── Supported domains ──────────────────────────────────────────────────────

const SUPPORTED_DOMAINS = ["imdb.com", "rottentomatoes.com"];

function isSupportedUrl(url: string): boolean {
  return SUPPORTED_DOMAINS.some((d) => url.includes(d));
}

// ─── Server Functions ────────────────────────────────────────────────────────

export const scrapeMovieData = createServerFn({ method: "POST" })
  .inputValidator((d: { url: string }) => d)
  .handler(async ({ data }): Promise<ScrapedMovie> => {
    const { url } = data;

    // Validate URL
    try {
      new URL(url);
    } catch {
      throw new Error(
        "Invalid URL. Please provide a full URL starting with https://",
      );
    }

    if (!isSupportedUrl(url)) {
      throw new Error(
        `Unsupported site. Currently supports: ${SUPPORTED_DOMAINS.join(", ")}`,
      );
    }

    // Ethical delay
    await randomDelay();

    // Fetch the page
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });

    if (!res.ok) {
      throw new Error(`Fetch failed: ${res.status} ${res.statusText}`);
    }

    const html = await res.text();
    const $ = cheerio.load(html);

    // Strategy: extract JSON-LD first (most reliable), fall back to meta tags
    const ld = extractJsonLd($);

    if (ld) {
      return parseJsonLd(ld, url);
    }

    // Fallback: parse Open Graph / standard meta tags
    const title =
      $('meta[property="og:title"]').attr("content")?.trim() ??
      $("title").text().trim() ??
      null;

    let year: number | null = null;
    const ogDesc =
      $('meta[property="og:description"]').attr("content") ?? "";
    const yearMatch = ogDesc.match(/\b(19|20)\d{2}\b/);
    if (yearMatch) year = parseInt(yearMatch[0], 10);

    const posterUrl =
      $('meta[property="og:image"]').attr("content")?.trim() ?? null;

    return {
      title: title || null,
      year,
      rating: null,
      posterUrl,
      genre: [],
      sourceUrl: url,
      scrapedAt: new Date().toISOString(),
    };
  });

/** Returns the list of supported site domains. */
export const getSupportedSites = createServerFn({ method: "GET" }).handler(
  async () => {
    return { sites: SUPPORTED_DOMAINS };
  },
);
