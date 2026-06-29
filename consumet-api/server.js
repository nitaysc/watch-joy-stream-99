import express from "express";
import cors from "cors";
import { ANIME } from "@consumet/extensions";

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT ?? 3001;

const provider = new ANIME.AnimeSaturn();

app.get("/", (_, res) => res.json({ status: "ok", name: "consumet-api" }));

app.get("/anime/search", async (req, res) => {
  try {
    const q = req.query.q;
    if (!q) return res.status(400).json({ error: "Missing ?q=" });
    const data = await provider.search(q);
    res.json({ provider: "AnimeSaturn", results: data.results ?? [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/anime/info", async (req, res) => {
  try {
    const id = req.query.id;
    if (!id) return res.status(400).json({ error: "Missing ?id=" });
    const data = await provider.fetchAnimeInfo(id);
    res.json({ provider: "AnimeSaturn", ...data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/anime/episode", async (req, res) => {
  try {
    const id = req.query.id;
    if (!id) return res.status(400).json({ error: "Missing ?id=" });
    const data = await provider.fetchEpisodeSources(id);
    res.json({ provider: "AnimeSaturn", ...data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/anime/trending", async (req, res) => {
  try {
    const data = await provider.search("top", 1);
    let results = data.results ?? [];
    if (results.length === 0) {
      const fallback = await provider.search("Attack on Titan", 1);
      results = fallback.results ?? [];
    }
    res.json({ provider: "AnimeSaturn", results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`consumet-api running on port ${PORT}`);
});
