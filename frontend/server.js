import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const DIST_DIR = path.join(__dirname, "dist");
const INDEX_HTML = path.join(DIST_DIR, "index.html");

// Fail loudly and clearly at startup if the build never ran, instead of
// booting "successfully" and then throwing a raw ENOENT stack trace on
// the first real request -- that's confusing to debug from a host's
// dashboard where a green "live" status can be misleading.
if (!fs.existsSync(INDEX_HTML)) {
  console.error(
    `FATAL: ${INDEX_HTML} doesn't exist.\n` +
    "This means \"npm run build\" never ran (or failed) before \"npm start\".\n" +
    "Check that your host's Build Command is: npm install && npm run build"
  );
  process.exit(1);
}

app.use(express.static(DIST_DIR));

// SPA fallback: any route that isn't a static file goes to index.html so
// client-side routing (react-router) handles it -- e.g. a hard refresh on
// /u/someone or /live/abc123 still works instead of 404ing.
app.get("*", (_req, res) => {
  res.sendFile(INDEX_HTML);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`NexgenSocial frontend listening on :${PORT}`));
