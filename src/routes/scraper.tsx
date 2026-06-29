import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { scrapeMovieData } from "@/lib/scraper.functions";
import type { ScrapedMovie } from "@/lib/scraper.functions";
import {
  Loader2,
  Search,
  Globe,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
} from "lucide-react";

export const Route = createFileRoute("/scraper")({
  component: ScraperPage,
  head: () => ({
    meta: [
      { title: "Scraper — Cinely Admin" },
      { name: "description", content: "Test the web scraper service" },
    ],
  }),
});

function ScraperPage() {
  const [url, setUrl] = useState("");
  const [result, setResult] = useState<ScrapedMovie | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [elapsed, setElapsed] = useState<number | null>(null);

  const handleScrape = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setElapsed(null);
    const start = Date.now();
    try {
      const data = await scrapeMovieData({ data: { url: url.trim() } });
      setResult(data);
      setElapsed(Date.now() - start);
    } catch (err: any) {
      setError(err.message ?? "Unknown error");
      setElapsed(Date.now() - start);
    } finally {
      setLoading(false);
    }
  };

  const EXAMPLE_URLS = [
    { label: "The Shawshank Redemption", url: "https://www.imdb.com/title/tt0111161/" },
    { label: "Inception", url: "https://www.imdb.com/title/tt1375666/" },
    { label: "Breaking Bad", url: "https://www.imdb.com/title/tt0903747/" },
  ];

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      {/* Header */}
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary uppercase tracking-wider mb-4">
          <Globe className="h-3.5 w-3.5" />
          Admin Tool
        </div>
        <h1 className="text-3xl font-bold sm:text-4xl">Web Scraper</h1>
        <p className="mt-2 text-muted-foreground max-w-xl">
          Enter a URL to extract movie or TV series metadata. The scraper parses
          the page HTML server-side using Cheerio, with a built-in 2–5s ethical
          delay between requests.
        </p>
      </div>

      {/* Input */}
      <div className="rounded-xl bg-card ring-1 ring-border p-4 space-y-3">
        <div className="flex gap-3">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleScrape()}
            placeholder="https://www.imdb.com/title/tt0111161/"
            className="flex-1 rounded-lg bg-background px-4 py-3 text-sm ring-1 ring-border placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary transition"
          />
          <button
            onClick={handleScrape}
            disabled={loading || !url.trim()}
            className="flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            {loading ? "Scraping…" : "Scrape"}
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          <span className="text-xs text-muted-foreground py-1">Try:</span>
          {EXAMPLE_URLS.map((ex) => (
            <button
              key={ex.url}
              onClick={() => setUrl(ex.url)}
              className="rounded-full bg-muted/60 px-3 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition"
            >
              {ex.label}
            </button>
          ))}
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="mt-6 flex items-center gap-3 rounded-xl bg-muted/40 p-5 text-sm text-muted-foreground ring-1 ring-border/50 animate-pulse">
          <Loader2 className="h-5 w-5 animate-spin text-primary shrink-0" />
          <div>
            <p className="font-medium text-foreground">Fetching & parsing HTML…</p>
            <p className="text-xs mt-0.5">
              Includes a random 2–5 second ethical delay to avoid overloading the
              server.
            </p>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mt-6 flex items-start gap-3 rounded-xl bg-destructive/10 p-5 text-sm text-destructive ring-1 ring-destructive/20">
          <AlertCircle className="h-5 w-5 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">Scrape Failed</p>
            <p className="mt-1 opacity-80">{error}</p>
            {elapsed !== null && (
              <p className="mt-2 text-xs opacity-60">
                Took {(elapsed / 1000).toFixed(1)}s
              </p>
            )}
          </div>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="mt-6 space-y-4">
          {/* Success badge */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-emerald-400">
              <CheckCircle2 className="h-4 w-4" />
              Scraped successfully
              {elapsed !== null && (
                <span className="text-muted-foreground">
                  — {(elapsed / 1000).toFixed(1)}s
                </span>
              )}
            </div>
            <a
              href={result.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition"
            >
              Source <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          {/* Preview Card */}
          <div className="flex gap-5 rounded-xl bg-card ring-1 ring-border p-5">
            {result.posterUrl && (
              <img
                src={result.posterUrl}
                alt={result.title ?? "Poster"}
                className="h-44 w-auto rounded-lg ring-1 ring-border object-cover shrink-0"
              />
            )}
            <div className="space-y-2 min-w-0">
              <h2 className="text-xl font-bold truncate">
                {result.title ?? "Unknown Title"}
              </h2>
              <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                {result.year && <span>{result.year}</span>}
                {result.rating && (
                  <span className="flex items-center gap-1">
                    ⭐ {result.rating}
                  </span>
                )}
              </div>
              {result.genre.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {result.genre.map((g) => (
                    <span
                      key={g}
                      className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary"
                    >
                      {g}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Data Table */}
          <div className="overflow-hidden rounded-xl ring-1 ring-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/60">
                  <th className="px-4 py-3 text-left font-semibold text-[11px] uppercase tracking-wider text-muted-foreground w-32">
                    Field
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-[11px] uppercase tracking-wider text-muted-foreground">
                    Value
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {Object.entries(result).map(([key, value]) => (
                  <tr key={key} className="hover:bg-muted/20 transition">
                    <td className="px-4 py-3 font-mono text-xs text-primary align-top">
                      {key}
                    </td>
                    <td className="px-4 py-3 text-sm break-all">
                      {value === null ? (
                        <span className="italic text-muted-foreground/60">
                          null
                        </span>
                      ) : Array.isArray(value) ? (
                        value.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {(value as string[]).map((v) => (
                              <span
                                key={v}
                                className="rounded bg-muted px-2 py-0.5 text-xs"
                              >
                                {v}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="italic text-muted-foreground/60">
                            empty
                          </span>
                        )
                      ) : (
                        String(value)
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Raw JSON */}
          <details className="group rounded-xl bg-muted/20 ring-1 ring-border">
            <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground transition select-none">
              <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
              Raw JSON Output
            </summary>
            <pre className="overflow-auto px-4 pb-4 text-xs font-mono text-foreground/80 leading-relaxed">
              {JSON.stringify(result, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </main>
  );
}
