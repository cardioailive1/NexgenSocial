import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const DIST_DIR = path.join(__dirname, "dist");

app.use(express.static(DIST_DIR));

// SPA fallback: any route that isn't a static file goes to index.html so
// client-side routing (react-router) handles it -- e.g. a hard refresh on
// /u/someone or /live/abc123 still works instead of 404ing.
app.get("*", (_req, res) => {
  res.sendFile(path.join(DIST_DIR, "index.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`NexgenSocial frontend listening on :${PORT}`));
