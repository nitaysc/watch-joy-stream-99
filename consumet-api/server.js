import express from "express";
import cors from "cors";
import { ANIME } from "@consumet/extensions";

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT ?? 3001;

// Providers that work reliably (Hianime removed — always times out on Cloudflare)
const PROVIDERS = [
  { name: "AnimeSaturn", instance: () => new ANIME.AnimeSaturn() },
  { name: "AnimeUnity", instance: () => new ANIME.AnimeUnity() },
];

async function tryProviders(method, ...args) {
  const errors = [];
  for (const { name, instance } of PROVIDERS) {
    try {
      const provider = instance();
      const result = await Promise.race([
        provider[method](...args),
        new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 5000)),
      ]);
      return { provider: name, data: result };
    } catch (err) {
      errors.push(`${name}: ${err.message}`);
    }
  }
  throw new Error(`All providers failed: ${errors.join(" | ")}`);
}

app.get("/", (_, res) => res.json({ status: "ok", name: "consumet-api" }));

app.get("/anime/search", async (req, res) => {
  try {
    const q = req.query.q;
    if (!q) return res.status(400).json({ error: "Missing ?q=" });
    const { provider, data } = await tryProviders("search", q);
    res.json({ provider, results: data.results ?? [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/anime/info", async (req, res) => {
  try {
    const id = req.query.id;
    if (!id) return res.status(400).json({ error: "Missing ?id=" });
    const { provider, data } = await tryProviders("fetchAnimeInfo", id);
    res.json({ provider, ...data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/anime/episode", async (req, res) => {
  try {
    const id = req.query.id;
    if (!id) return res.status(400).json({ error: "Missing ?id=" });
    const { provider, data } = await tryProviders("fetchEpisodeSources", id);
    res.json({ provider, ...data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/anime/trending", async (req, res) => {
  try {
    // Search popular keywords across providers
    const { provider, data } = await tryProviders("search", "top", 1);
    res.json({ provider, results: data.results ?? [] });
  } catch {
    // Fallback: search known popular anime
    try {
      const { provider, data } = await tryProviders("search", "Attack on Titan", 1);
      res.json({ provider, results: data.results ?? [] });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
});

app.listen(PORT, () => {
  console.log(`consumet-api running on port ${PORT}`);
});
