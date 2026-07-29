# NexgenSocial

A social platform for Corverxis Technologies. Profiles, friends, follows,
threads ("twits"), photo/video posts, groups, and a Premium tier that gates
a marketplace and advertising, with a political hub and media/live-streaming
hub scaffolded for the next build phase.

## Architecture

```
                         ┌─────────────────────┐
                         │      Frontend         │
                         │  React + Vite (SPA)   │
                         │  Node web service      │
                         │  (server.js/Express)   │
                         └──────────┬───────────┘
                                    │ REST / JSON (fetch)
                                    │ Bearer JWT
                         ┌──────────▼───────────┐
                         │      API Server       │
                         │  Node + Express       │
                         │  Render Web Service    │
                         └──────────┬───────────┘
                                    │ Prisma ORM
                         ┌──────────▼───────────┐
                         │  PostgreSQL (managed) │
                         │   Render Postgres      │
                         └───────────────────────┘
```

- **Auth**: email/username + password, bcrypt-hashed, JWT bearer tokens (30-day expiry).
- **Social graph**: `Follow` (one-directional, Twitter-style) is separate from
  `FriendRequest` (two-directional, needs mutual accept, Facebook-style) —
  your spec asked for both, so both exist as distinct models.
- **Content**: `Post` covers text threads, images, and video in one model
  (`type` field), optionally scoped to a `Group`.
- **Groups**: owner + members with roles (`MEMBER` / `ADMIN`), public or private.
- **Premium**: a `tier` field on `User` gates marketplace listings and ad
  creation server-side (not just hidden in the UI) — see `routes/premium.js`.

### Content sections

- **Sports & athletics** — live scores and fixtures from a free public
  sports data API (TheSportsDB), plus a community discussion feed scoped to
  sports posts. Uses TheSportsDB's shared "test" key by default (no signup
  needed to try it) — get your own free key at thesportsdb.com/api.php and
  set `SPORTSDB_API_KEY` for real usage, since the shared test key is rate-
  limited. League coverage is a small hardcoded set (EPL, NBA, NFL, MLB) —
  add more by looking up a league ID on their site.
- **Breaking news** — real headlines pulled live from ABC News, CNN, MSNBC,
  and BBC News's own public RSS feeds, cached 5 minutes. Only headline, a
  short snippet, and a link back to the source are shown — never full
  article text — which is the standard, legal way news aggregators (Google
  News, Apple News, any RSS reader) work. If a feed goes down or changes its
  URL, that source is silently skipped rather than failing the whole page.
- **Celebrity** — a community content category, not a data feed. There's no
  ethical way to aggregate real paparazzi/entertainment-wire content without
  a licensing deal with a wire service (Getty, AP, etc.) — that's a business
  relationship, not something to fake with a scraper. This tab is genuinely
  just what people post.
- **Live streams: a dedicated SFU engine** — real server-side media routing
  via [mediasoup](https://mediasoup.org), the same class of technology
  production live-streaming products build on. This replaced an earlier
  peer-to-peer version: the host's camera/mic go up to the server *once* (a
  mediasoup "send" transport), and the server fans that out to every viewer
  from its own router, rather than the host connecting to each viewer
  directly. See `backend/src/sfu/` (worker pool, per-stream Room/Router,
  transport creation) and `backend/src/livestreamSignaling.js` (the
  WebSocket JSON-RPC protocol both sides speak), paired with
  `frontend/src/pages/LiveRoom.jsx` using `mediasoup-client`.

  **This was actually tested, not just written**: mediasoup was installed
  and its native worker binary built and run in the same kind of sandboxed
  environment this project ships from, confirming worker/router/transport
  creation genuinely works. The full signaling protocol was then exercised
  with real WebSocket clients — JWT-authenticated host join, unauthorized
  host rejection, transport creation with real ICE candidates, and
  role-based produce restrictions all passed against a live server. A full
  two-browser video handshake (real ICE/DTLS/SRTP end to end) needs an
  actual browser's WebRTC stack to verify and wasn't reproducible in this
  environment, but every piece up to that point is confirmed working.

  **The one thing that determines whether this works at all where you
  deploy it: UDP.** mediasoup needs to bind a range of UDP ports and tell
  each browser its real public IP via `MEDIASOUP_ANNOUNCED_IP` (see
  `backend/src/sfu/transport.js`) — WebRTC media doesn't travel over your
  regular HTTPS port. Typical PaaS "web service" hosting (including
  Render's) is built around proxying a single HTTP(S) port and often
  doesn't expose a UDP port range to the internet at all. Concretely:

  - **Signaling** (the WebSocket handshake) works fine anywhere Node runs,
    Render included — it's just HTTP.
  - **The actual audio/video** needs the host running this to have a real
    public IP with a UDP port range (`MEDIASOUP_RTC_MIN_PORT`–
    `MEDIASOUP_RTC_MAX_PORT`, defaulting to 40000–49999) reachable from the
    internet. A plain VM with a public IP (a DigitalOcean/Linode/EC2
    instance, or similar) is the natural fit. Some platforms (Fly.io is a
    notable example) do support UDP for exactly this use case — check
    whichever host you pick before assuming it'll work.
  - If UDP truly isn't available where you're deploying, mediasoup can fall
    back to TCP (already enabled here via `enableTcp: true`), which works
    through more restrictive networks but adds latency and won't perform as
    well under load.
  - Env vars this piece adds: `MEDIASOUP_ANNOUNCED_IP` (required for
    anything beyond localhost), `MEDIASOUP_LISTEN_IP` (default `0.0.0.0`),
    `MEDIASOUP_RTC_MIN_PORT` / `MEDIASOUP_RTC_MAX_PORT`, and
    `MEDIASOUP_WORKER_COUNT` (default 1 — one worker per CPU core is the
    usual scaling rule as concurrent rooms grow).

  This is still meaningfully better than the mesh version for anything with
  more than a few viewers, and it costs nothing beyond whatever VM you run
  it on — no LiveKit/Mux/Cloudflare Stream account needed. But it does mean
  the live-streaming piece specifically may need different hosting than the
  rest of this app (which is plain HTTP and runs anywhere fine, Render
  included).

### Frontier features (things mainstream platforms don't offer)

- **Adjustable feed algorithm** — every person sets their own recency /
  engagement / diversity weights (`Feed page > Tune my feed algorithm`).
  The backend scores and ranks posts live against those weights instead of
  a hidden platform-wide formula. See `scoreAndRank()` in
  `backend/src/routes/posts.js`.
- **"Why am I seeing this"** — every post in the feed carries a plain-language
  reason ("You follow @x", "Your post") plus its actual score breakdown,
  visible on demand via the ⓘ button on each post.
- **Public edit history** — editing a post snapshots the previous version
  first (`PostRevision`), and anyone can view the diff trail via "Edit
  history." Nothing changes silently.
- **One-click full data export** — `Profile > Export my data` downloads a
  single JSON file with your profile, posts (with revisions), comments,
  likes, friends, follows, group memberships, linked accounts, and invites.
  No support ticket, no waiting period.
- **Crowd-sourced context notes** — anyone can attach context to any post
  and anyone can vote it helpful/not (`ContextNote` + `NoteVote`), platform-
  wide rather than gated to one company's program.
- **Screen-time dashboard with no infinite scroll** — time is tracked
  entirely client-side (`frontend/src/useScreenTime.js`), never sent to the
  server or used for targeting. The feed also intentionally has no infinite
  scroll — it loads a fixed batch (50 posts) and stops.
- **Custom audience circles** — post to a circle you define (e.g. "Family"),
  not just the binary public/friends most platforms offer. See `Circle` /
  `CircleMember` and the audience selector in the post composer.
- **Mandatory AI-content disclosure** — attaching AI-generated media requires
  checking a disclosure box; disclosed posts carry a visible "AI-generated"
  badge everywhere they appear. This is a self-disclosure UI, not an
  automated detector — see the caveat below.

**Honesty check on the two features that can't be fully "solved" by any app:**
Self-disclosed AI labeling only works if people check the box — there's no
reliable automated way to detect AI-generated media today, so this is a
norm-setting feature, not an enforcement one. And crowd-sourced notes inherit
whatever biases the crowd has; the vote tally is shown transparently rather
than hidden, but it isn't a truth oracle.

### What's fully built
Profiles (create/edit), friend invites/accept/decline/unfriend, follow/unfollow,
threads with likes and comments, photo/video upload, groups (create/join/leave/post),
premium upsell + marketplace + business ads (schema, API, and UI), a working
invite-link system (share to Facebook/X/WhatsApp/LinkedIn/email, no API keys
needed, auto-friends whoever signs up through your link), and a linked-accounts
settings page for Facebook/Instagram/X/LinkedIn/TikTok/Google. Also: in-browser instant
video recording (camera opens right in the composer, records up to 60s, posts
immediately -- no separate app, no upload screen) via `QuickVideoRecorder.jsx`.

**On "linking social accounts" and "importing friends" specifically:**
Facebook, Instagram, and X don't let third-party apps read a user's full
friends list anymore (locked down platform-wide since ~2015, for privacy
reasons) — so there's no real endpoint to "import friends from X" even in
a finished product. The actual working pattern, which is what's built here,
is a shareable invite link. Linking an account for *sign-in* or cross-posting
is a separate, real capability — see the OAuth note below for what's needed
to finish it.

### What's scaffolded, not finished
- **Political Place and Media Coverage/Live Streams**: real database models and
  category fields ready (`Ad.category`, `Group` as a general-purpose topic
  container) and a placeholder tab in the Premium UI, but no dedicated
  livestream engine yet.
- **Linked social accounts (real OAuth)**: the `SocialAccount` model, connect/
  disconnect API, and settings UI (`frontend/src/pages/Connections.jsx`) are
  fully built and working end-to-end — but "Connect" currently creates the
  link directly rather than sending you through the provider's real login
  screen. To finish it: register a developer app with each platform
  (Facebook Login, Sign in with X, LinkedIn OAuth, etc.), get a client ID +
  secret for each, and implement the standard OAuth redirect → callback →
  token exchange in `backend/src/routes/social.js` (Passport.js has ready-made
  strategies for most of these if you'd rather not hand-roll it). None of that
  can be done without you creating those developer accounts — it's not
  something I can provision. Live video needs a real streaming provider — Mux and
Cloudflare Stream both have a "swap in an ingest URL" style API that would
plug into a new `Livestream` model (ingest URL, playback URL, viewer count,
live chat). I didn't build fake streaming since that would just be UI theater.

### Known production gaps worth knowing about
- **File uploads use local disk** (`backend/src/uploads`). Render's free/starter
  web services have an *ephemeral* filesystem — uploads vanish on redeploy or
  restart. Before going live, swap `multer.diskStorage` in
  `backend/src/routes/posts.js` for direct-to-S3 (or Cloudflare R2, or a
  Render persistent Disk) and store the resulting URL instead.
- **Payments are stubbed.** `/api/premium/upgrade` just flips the tier flag —
  wire it to Stripe (or your processor of choice) via a webhook before
  charging real money.
- **Free-tier Postgres on Render** sleeps/expires after a period of
  inactivity on the free plan — fine for a demo, not for production.

## Local development

Requires Node 18+ and a local Postgres (or a free one from Render/Neon/Supabase).

```bash
# Backend
cd backend
cp .env.example .env        # fill in DATABASE_URL and JWT_SECRET
npm install
npx prisma migrate dev --name init
npm run dev                 # http://localhost:4000

# Frontend (separate terminal)
cd frontend
cp .env.example .env        # VITE_API_URL=http://localhost:4000
npm install
npm run dev                 # http://localhost:5173 -- hot-reloading dev server (Vite)
```

To run the frontend the same way it runs in production (build + Node server,
no hot reload):

```bash
cd frontend
npm run build                # writes static files to dist/
npm start                    # node server.js, serves dist/ -- http://localhost:3000
```

## Deploying to Render

This repo includes `render.yaml` (a Render **Blueprint**) that provisions all
three pieces — API, frontend, and Postgres — in one go. The frontend is
deployed as a **Node web service** (`frontend/server.js`, a small Express
app that serves the built React files and handles the SPA fallback route),
not Render's static-site/CDN hosting. Either way the app is client-rendered
in the browser and talks to the same backend API — this only changes how
the files get served. `npm start` runs `node server.js` after `npm run build`
has produced the `dist` folder.

1. Push this repo to GitHub.
2. In the Render dashboard: **New → Blueprint**, point it at your repo. Render
   reads `render.yaml` and creates `nexgensocial-db`, `nexgensocial-api`, and
   `nexgensocial-web`.
3. After the first deploy, two env vars need to be filled in manually (they
   reference each other's URLs, which don't exist until both services exist):
   - On `nexgensocial-api`: set `CLIENT_URL` to your frontend's Render URL.
   - On `nexgensocial-web`: set `VITE_API_URL` to your backend's Render URL,
     then trigger a manual redeploy of the frontend (Vite bakes env vars in
     at build time).
4. Done — the blueprint already wires `DATABASE_URL` from the managed
   Postgres instance and generates a random `JWT_SECRET`.

## Suggested next build steps, roughly in order

1. Move uploads to S3-compatible storage (unblocks reliable video/photo posts).
2. Wire Stripe for the Premium upgrade flow.
3. Add a `Livestream` model + a provider (Mux/Cloudflare Stream) for the
   Media hub; reuse `Group` + `Post` for the Political hub's discussion side.
4. Add pagination/cursoring to the feed and group/comment lists (currently
   capped at 50 for simplicity).
5. Notifications (friend requests, likes, comments) — a `Notification` model
   plus either polling or WebSockets.
