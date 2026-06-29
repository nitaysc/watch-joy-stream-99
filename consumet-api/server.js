import express from "express";
import cors from "cors";
import { ANIME } from "@consumet/extensions";

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT ?? 3001;

// Health check
app.get("/", (_, res) => res.json({ status: "ok", name: "consumet-api" }));

// Search anime
app.get("/anime/search", async (req, res) => {
  try {
    const q = req.query.q;
    if (!q) return res.status(400).json({ error: "Missing ?q=" });
    const provider = new ANIME.Gogoanime();
    const data = await provider.search(q);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Anime info + episode list
app.get("/anime/info", async (req, res) => {
  try {
    const id = req.query.id;
    if (!id) return res.status(400).json({ error: "Missing ?id=" });
    const provider = new ANIME.Gogoanime();
    const data = await provider.fetchAnimeInfo(id);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Episode streaming links
app.get("/anime/episode", async (req, res) => {
  try {
    const id = req.query.id;
    if (!id) return res.status(400).json({ error: "Missing ?id=" });
    const provider = new ANIME.Gogoanime();
    const data = await provider.fetchEpisodeSources(id);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Recent episodes
app.get("/anime/recent", async (req, res) => {
  try {
    const provider = new ANIME.Gogoanime();
    const data = await provider.fetchRecentEpisodes();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`consumet-api running on port ${PORT}`);
});
