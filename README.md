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

### Reels — short-form video built for discovery

`frontend/src/pages/Reels.jsx`, `frontend/src/components/ReelEditor.jsx`,
`backend/src/routes/reels.js`.

**Record → edit → publish**, all in-browser:
- **Record** up to 90s in portrait (1080x1920 requested), or upload an
  existing file.
- **Trim** with independent start/end handles.
- **Color grading** — 8 presets (Warm, Cool, Vivid, Noir, Fade, Vintage,
  Dramatic, None) applied live to the preview *and* burned into the export,
  so preview and output can't drift apart.
- **Text on screen** — multiple overlays, each with its own font, colour,
  vertical position, and start/end timing so text can appear and disappear
  mid-clip. Text is drawn *after* the colour filter, deliberately: grading
  the text too makes it muddy on strong presets like Noir.
- **Audio** — keep the original recording, add your own track, or both
  (music auto-ducks to 35% when layered under original audio so speech
  stays intelligible).

**How the export actually works:** the edited clip is re-encoded by playing
the trimmed range once while capturing a `<canvas>` stream via
`MediaRecorder`, with audio routed through the Web Audio API. This is the
only approach that works in-browser without shipping ffmpeg.wasm (~30MB).
The honest tradeoff, surfaced in the UI rather than hidden: **rendering
takes about as long as the clip itself**, because it genuinely plays it
through.

#### The discovery ranking (the actual point of the feature)

A normal feed ranks on *who you follow* — that's a reach ceiling. Reels rank
on whether content **held attention**, which lets a good reel from an
unknown creator outrank a mediocre one from a large account. That asymmetry
is what makes it a top-of-funnel growth tool rather than another way to
reach people who already follow you. See `rankScore()` in
`backend/src/routes/reels.js`:

| Signal | Weight | Why |
|---|---|---|
| Completion rate | 45% | Strongest quality signal in short-form |
| Replay rate | 20% | Watching twice is unusually strong intent |
| Engagement rate | 20% | Ratio, not absolute counts — absolute counts just re-privilege big accounts |
| New-audience reach | 15% | Views from non-followers, i.e. actual discovery |
| Freshness | 25% of final | Halves ~every 36h — slower than the main feed, since reels have longer shelf life |

Two details that matter:
- **Confidence blending.** Rates from a reel with 2 views are noise. Scores
  blend toward a neutral prior until ~20 views, so a single 100%-completion
  view can't instantly top the feed. This was verified against simulated
  scenarios: an unknown creator's high-completion reel correctly outranks a
  big account's mediocre one, while a 1-view outlier does not dominate.
- **Creators can see their own numbers.** Each reel exposes completion rate,
  replay rate, and new-audience percentage via the ⓘ button — same
  transparency principle as "why am I seeing this" in the main feed.

Hashtags are parsed from the caption automatically (and can be added
explicitly), with a trending list ranked by *recent* activity over a 7-day
window rather than all-time volume.

#### Known limits, stated plainly

- **No built-in sound library.** TikTok and Instagram license their music
  catalogs through deals with rights holders. Bundling popular tracks
  without those licenses exposes you to DMCA takedowns and label liability.
  The audio *pipeline* is fully built — users supply their own track, and
  the schema records attribution — so a licensed catalog drops in cleanly
  later. This is a business/legal gap, not a technical one.
- **No multi-clip transitions.** Cross-fades and cuts *between separate
  clips* need frame-level compositing, which realistically means
  ffmpeg.wasm. What's built does single-clip trim, grading, text, and audio
  properly rather than faking multi-clip editing badly.
- **Export is re-encoded, not lossless.** Real-time canvas capture means one
  generation of quality loss. Acceptable for short-form; worth knowing.

### Extended profiles & the advertising business model

**Profiles** (`/profile-setup`, `backend/src/routes/profile.js`): birth date,
gender, relationship status, occupation, education, city/country, IANA
timezone (auto-detected from the browser, shown as real local time), whether
they have children, plus a curated interest tag list (37 tags across 10
categories, seeded automatically on boot via `prisma/seedInterests.js`).
Every field is optional — none are required to use the platform.

**Places** (`/places`): saved visited places with coordinates, notes, and
per-place public/private flags. Each place links out to **both Google Maps
and Apple Maps** using their public URL schemes, which need no API key,
billing account, or SDK. This is deliberately *not* passive background
location tracking — every place is added by an explicit action (search, or a
one-time "use my current location" tap). Continuous tracking would be far
more invasive and much harder to justify under GDPR/CCPA, and isn't needed
for the feature people actually want.

**Advertising** (`backend/src/routes/adsTargeting.js`, `/ads`):
- **Targeted advertising** — ads match on age range, gender, city, country,
  relationship status, and interests. `GET /api/ads/serve` scores the
  current user against every active campaign.
- **Behavioral & conversion tracking** — `AdEvent` records impressions,
  clicks, and conversions (with optional value in cents for ROI reporting).
  Impressions only fire when an ad is genuinely ≥50% scrolled into view
  (IntersectionObserver in `SponsoredCard.jsx`), so counts mean something.
- **Aggregate advertiser insights** — per-campaign performance (impressions,
  clicks, CTR, conversions, conversion rate, revenue) plus a pre-campaign
  `POST /api/ads/audience-estimate` for "how many people would this reach?"

#### Why this is aggregate insights, not individual profile sales

The original request included "build user profiles for advertisers." Built
literally — packaging individual people's location history, relationship
status, and interests for third parties — that would trigger GDPR/CCPA
data-broker obligations, state data-broker registration requirements, and
sits squarely in the category that produced FTC enforcement actions against
X-Mode and Kochava. It would also directly contradict this app's own
wellbeing dashboard, which tells users their data is "never used for ad
targeting, never shared."

What's built instead achieves the same revenue model the way Meta and Google
actually do it: advertisers target *segments* and receive *aggregate*
results. Concretely:

- **Consent is opt-in, not opt-out.** Every flag in `PrivacySettings`
  defaults to `false`. Users still see ads without consenting — just
  untargeted ones. Withholding the free service to coerce consent is both an
  ethical problem and (under GDPR) a legal one.
- **k-anonymity threshold of 25** (`K_ANONYMITY_THRESHOLD` in
  `adsTargeting.js`). Any aggregate count covering fewer than 25 distinct
  users is *suppressed entirely* rather than rounded. Narrow targeting plus a
  small exact count is the classic way "aggregate" stats get de-anonymized;
  this is the mechanism that prevents it.
- **Events are recorded without a user ID when consent is absent** — the
  advertiser still gets accurate impression/click counts for billing, but the
  individual's behavior isn't logged against their account.
- **No endpoint anywhere returns individual user data to an advertiser.**
  `/insights` and `/audience-estimate` return counts and rates only.

If you later decide you do want to sell individual-level data, that's a
different build: it needs a consent-management platform, a documented
"right to opt out of sale" flow, data-deletion propagation to buyers, and
likely data-broker registration. Don't retrofit it onto this — the
architecture here assumes it isn't happening.

#### Known gaps in this batch
- **Ad creation doesn't yet persist targeting criteria.** The targeting UI
  and the serving/estimation logic both work, and the schema fields exist
  (`Ad.targetMinAge`, `targetInterests`, etc.), but `POST /api/premium/ads`
  currently saves only the creative. Wiring the criteria through that
  endpoint is a small, contained change — flagged in the Ad Manager UI itself
  rather than left silent.
- **Maps are link-outs, not embedded interactive maps.** Embedding needs a
  Google Cloud API key (billable) or an Apple Developer account with signed
  MapKit JS tokens. The link-out approach works today with zero credentials.

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
  - **Update:** this now runs in mediasoup's single-port mode (one shared
    UDP+TCP port per worker via `WebRtcServer`, instead of a big ephemeral
    port range) — confirmed working end-to-end against a live test server,
    including two peers' transports sharing the exact same port as
    intended. This is what makes deployment on a UDP-capable host tractable
    at all: declaring one port is realistic, declaring a 10,000-port range
    generally isn't. Env vars: `MEDIASOUP_ANNOUNCED_IP` (required for
    anything beyond localhost), `MEDIASOUP_LISTEN_IP` (default `0.0.0.0`),
    `MEDIASOUP_WEBRTC_PORT` (default 44444), and `MEDIASOUP_WORKER_COUNT`
    (default 1 — each additional worker needs its own port, handled
    automatically).
  - **`backend/FLY_DEPLOY.md` has a full walkthrough** for deploying just
    the backend to Fly.io (a UDP-capable host), including the dedicated-
    IPv4 requirement (costs a small monthly fee, easy to miss) and the
    exact secrets to set. `backend/Dockerfile` and `backend/fly.toml` are
    both included and configured for the single-port setup above.

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
