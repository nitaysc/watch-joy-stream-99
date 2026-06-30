# Cinely — Streaming App

TanStack Start + React + Tailwind CSS + Video.js streaming app.

## Architecture
- **TMDB** — content metadata (movies, TV, search, trending)
- **Local stream server** — `localhost:8080` provides HLS/MP4 streams
- **HDRezka** — Russian streaming site scraper for Russian dubs

## HDRezka Integration (go-hdrezka port)
- Port of `github.com/n0madic/go-hdrezka` Go library to TypeScript
- Server functions run via TanStack Start (Node.js server-side)
- Uses `cheerio` for HTML parsing (equivalent to Go's `goquery`)
- Implements the same CDN API calls (`/ajax/get_cdn_series/`)
- Handles base64 URL decoding with salt stripping, stream format parsing

### Files
- `src/lib/hdrezka.types.ts` — TypeScript types matching go-hdrezka structures
- `src/lib/hdrezka.ts` — Utilities: mirror probing, CDN POST client, URL decode, format/subtitle parsers
- `src/lib/hdrezka.functions.ts` — Server functions: search, getVideo, getEpisodes, getStream, resolveStreamUrl
- Modified `src/components/MediaDetails.tsx` — "Find Russian Dub (HDRezka)" button, source list per translation
- Modified `src/routes/movie.$id.tsx` — passes `title` prop to MediaDetails
- Modified `src/routes/tv.$id.tsx` — passes `title` prop to MediaDetails

### Known Limitations
- HDRezka is behind Cloudflare (may require proxy/non-US IP)
- Russian geo-blocking may prevent direct access from Railway (US-west)
- If blocked, user needs a SOCKS5 proxy (supported by go-hdrezka but not yet in this port)
- Search expects Russian or English title (not TMDB ID)

<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->
