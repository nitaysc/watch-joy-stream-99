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

/** Safely extract text from a CSS selector; returns null if selector matches nothing. */
function safeText($: cheerio.CheerioAPI, selector: string): string | null {
  try {
    const el = $(selector);
    return el.length > 0 ? el.first().text().trim() || null : null;
  } catch {
    return null;
  }
}

/** Safely extract an attribute from a CSS selector. */
function safeAttr(
  $: cheerio.CheerioAPI,
  selector: string,
  attr: string,
): string | null {
  try {
    const el = $(selector);
    return el.length > 0 ? el.first().attr(attr)?.trim() ?? null : null;
  } catch {
    return null;
  }
}

// ─── Selector Profiles ──────────────────────────────────────────────────────
// Each supported site needs a profile that maps CSS selectors to fields.

type SelectorProfile = {
  title: string;
  year: string;
  rating: string;
  posterUrl: { selector: string; attr: string };
  genre: string;
};

const PROFILES: Record<string, SelectorProfile> = {
  "imdb.com": {
    title: 'h1[data-testid="hero__pageTitle"]',
    year: 'ul[data-testid="hero-title-block__metadata"] li:first-child a',
    rating:
      'div[data-testid="hero-rating-bar__aggregate-rating__score"] span:first-child',
    posterUrl: {
      selector: 'img.ipc-image',
      attr: "src",
    },
    genre: 'div[data-testid="genres"] span.ipc-chip__text',
  },
};

function getProfile(url: string): { domain: string; profile: SelectorProfile } | null {
  for (const [domain, profile] of Object.entries(PROFILES)) {
    if (url.includes(domain)) return { domain, profile };
  }
  return null;
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
      throw new Error("Invalid URL. Please provide a full URL starting with https://");
    }

    // Match a selector profile
    const match = getProfile(url);
    if (!match) {
      throw new Error(
        `No selector profile for this site. Supported: ${Object.keys(PROFILES).join(", ")}`,
      );
    }
    const { profile } = match;

    // Ethical delay
    await randomDelay();

    // Fetch the page
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });

    if (!res.ok) {
      throw new Error(`Fetch failed: ${res.status} ${res.statusText}`);
    }

    const html = await res.text();
    const $ = cheerio.load(html);

    // Extract fields using the profile, with safe fallbacks
    const title = safeText($, profile.title);

    const yearText = safeText($, profile.year);
    const year = yearText
      ? parseInt(yearText.replace(/\D/g, "").slice(0, 4), 10) || null
      : null;

    const rating = safeText($, profile.rating);

    const posterUrl = safeAttr($, profile.posterUrl.selector, profile.posterUrl.attr);

    const genres: string[] = [];
    $(profile.genre).each((_, el) => {
      const text = $(el).text().trim();
      if (text && !genres.includes(text)) genres.push(text);
    });

    return {
      title,
      year,
      rating,
      posterUrl,
      genre: genres,
      sourceUrl: url,
      scrapedAt: new Date().toISOString(),
    };
  });

/** Returns the list of supported site domains. */
export const getSupportedSites = createServerFn({ method: "GET" })
  .handler(async () => {
    return { sites: Object.keys(PROFILES) };
  });
