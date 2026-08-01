import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../AuthContext";
import PostCard from "../components/PostCard";

// Sections of the platform worth surfacing to someone who doesn't yet know
// what's here. Ordered by how likely a new person is to find them useful,
// not alphabetically.
const DESTINATIONS = [
  { to: "/reels", icon: "🎬", title: "Reels", body: "Short video that reaches beyond your followers." },
  { to: "/people", icon: "👥", title: "People", body: "Find and follow others on NexgenSocial." },
  { to: "/groups", icon: "💬", title: "Groups", body: "Communities around shared interests." },
  { to: "/newsrooms", icon: "📰", title: "Media", body: "Newsroom pages and live broadcasts." },
  { to: "/news", icon: "🌍", title: "Breaking news", body: "Headlines from ABC, CNN, MSNBC and BBC." },
  { to: "/marketplace", icon: "🛍", title: "Marketplace", body: "Buy and sell with photo and video listings." },
  { to: "/jobs", icon: "💼", title: "Jobs", body: "Roles with salary ranges shown up front." },
  { to: "/political", icon: "🗳", title: "Political", body: "Campaign pages and a public ad archive." },
  { to: "/live", icon: "🔴", title: "Live", body: "Broadcasts happening right now." },
];

function LiveScoreRow({ event }) {
  return (
    <div style={{
      padding: "10px 12px", borderRadius: 10, background: "var(--navy-950)",
      border: `1px solid ${event.isLive ? "var(--danger)" : "var(--line)"}`, marginBottom: 8,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div style={{ fontSize: 13, minWidth: 0, flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {event.isLive && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "var(--danger)", fontSize: 10, fontWeight: 700 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--danger)" }} /> LIVE
              </span>
            )}
            <span style={{ fontWeight: 600 }}>{event.homeTeam} v {event.awayTeam}</span>
          </div>
          <div style={{ fontSize: 11, color: "var(--slate-400)", marginTop: 2 }}>
            {event.league ? `${event.league} · ` : ""}{event.date} {event.time || ""}
          </div>
        </div>
        {(event.homeScore !== null && event.homeScore !== undefined)
          ? <div className="h-display" style={{ fontSize: 15 }}>{event.homeScore} – {event.awayScore}</div>
          : <span className="eyebrow" style={{ fontSize: 9 }}>Upcoming</span>}
      </div>
      {event.broadcastUrl && (
        <a href={event.broadcastUrl} target="_blank" rel="noopener noreferrer"
          style={{ fontSize: 10.5, color: "var(--cyan-300)", display: "inline-block", marginTop: 6 }}>
          📺 Official broadcaster ↗
        </a>
      )}
    </div>
  );
}

export default function Explore() {
  const { user } = useAuth();
  const [leagues, setLeagues] = useState([]);
  const [activeLeague, setActiveLeague] = useState(null);
  const [scores, setScores] = useState(null);
  const [liveNow, setLiveNow] = useState([]);
  const [trendingTags, setTrendingTags] = useState([]);
  const [posts, setPosts] = useState(null);
  const [scoresError, setScoresError] = useState("");

  useEffect(() => {
    api.get("/api/sports/leagues").then(({ leagues }) => setLeagues(leagues)).catch(() => {});
    api.get("/api/reels/hashtags/trending").then(({ trending }) => setTrendingTags(trending)).catch(() => {});
    api.get("/api/posts/explore?category=SPORTS").then(({ posts }) => setPosts(posts)).catch(() => setPosts([]));

    loadLive();
    const t = setInterval(loadLive, 60000);
    return () => clearInterval(t);
  }, []);

  async function loadLive() {
    try {
      const { live } = await api.get("/api/sports/live");
      setLiveNow(live);
    } catch { /* a failed poll shouldn't disturb the page */ }
  }

  async function openLeague(key) {
    setActiveLeague(key);
    setScores(null);
    setScoresError("");
    try {
      setScores(await api.get(`/api/sports/scores?league=${key}`));
    } catch (err) {
      setScoresError(err.message);
    }
  }

  // Group leagues by sport so the list reads as "sports you can explore"
  // rather than a flat wall of competition names.
  const bySport = leagues.reduce((acc, l) => {
    (acc[l.sport || "Other"] = acc[l.sport || "Other"] || []).push(l);
    return acc;
  }, {});

  return (
    <div className="container" style={{ maxWidth: 760, paddingTop: 28, paddingBottom: 60 }}>
      <h1 className="h-display" style={{ fontSize: 22, marginBottom: 4 }}>Explore</h1>
      <p style={{ color: "var(--slate-400)", fontSize: 14, marginBottom: 20 }}>
        Everything happening on NexgenSocial — live scores, trending video, and
        the parts of the platform you might not have found yet.
      </p>

      {/* Live sport first: it's the most time-sensitive thing on the page */}
      {liveNow.length > 0 && (
        <div className="card" style={{ padding: 14, marginBottom: 20, borderColor: "var(--danger)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--danger)" }} />
            <span className="eyebrow" style={{ color: "var(--danger)" }}>Live now ({liveNow.length})</span>
          </div>
          {liveNow.map((e) => <LiveScoreRow key={e.id} event={e} />)}
          <p style={{ fontSize: 10.5, color: "var(--slate-400)", margin: "4px 0 0", lineHeight: 1.5 }}>
            Scores refresh about once a minute. Match video is only available from
            the official rights holder.
          </p>
        </div>
      )}

      {/* Sports browser */}
      <div className="card" style={{ padding: 16, marginBottom: 20 }}>
        <h2 className="eyebrow" style={{ marginBottom: 12 }}>Sports</h2>

        {leagues.length === 0 && <p style={{ fontSize: 13, color: "var(--slate-400)" }}>Loading leagues…</p>}

        {Object.entries(bySport).map(([sport, list]) => (
          <div key={sport} style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: "var(--slate-400)", marginBottom: 6 }}>{sport}</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {list.map((l) => (
                <button key={l.key} className="btn" onClick={() => openLeague(l.key)}
                  style={{
                    fontSize: 12, padding: "6px 11px",
                    background: activeLeague === l.key ? "var(--cyan-400)" : "var(--navy-800)",
                    color: activeLeague === l.key ? "var(--navy-950)" : "var(--slate-300)",
                    border: "1px solid var(--line)",
                  }}>
                  {l.label}
                </button>
              ))}
            </div>
          </div>
        ))}

        {scoresError && <div style={{ color: "var(--danger)", fontSize: 12, marginTop: 10 }}>{scoresError}</div>}

        {activeLeague && scores && (
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--line)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
              <strong style={{ fontSize: 14 }}>{scores.league}</strong>
              {scores.broadcastUrl && (
                <a href={scores.broadcastUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: "var(--cyan-300)" }}>
                  📺 Where to watch ↗
                </a>
              )}
            </div>

            {scores.noData ? (
              <p style={{ fontSize: 12, color: "var(--slate-400)", lineHeight: 1.5 }}>
                No fixtures returned. This league may be between seasons.
                {scores.verified === false && (
                  <> This league id hasn't been verified against TheSportsDB — if it stays
                  empty during a season, correct it in <code>backend/src/routes/sports.js</code>.</>
                )}
              </p>
            ) : (
              <>
                {scores.upcoming?.slice(0, 5).map((e) => <LiveScoreRow key={e.id} event={{ ...e, broadcastUrl: scores.broadcastUrl }} />)}
                {scores.recent?.slice(0, 5).map((e) => <LiveScoreRow key={e.id} event={{ ...e, broadcastUrl: scores.broadcastUrl }} />)}
              </>
            )}
          </div>
        )}
      </div>

      {/* Trending reel hashtags */}
      {trendingTags.length > 0 && (
        <div className="card" style={{ padding: 16, marginBottom: 20 }}>
          <h2 className="eyebrow" style={{ marginBottom: 10 }}>Trending in Reels</h2>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {trendingTags.slice(0, 15).map((t) => (
              <Link key={t.tag} to="/reels" className="btn"
                style={{ fontSize: 12, padding: "5px 10px", background: "var(--navy-800)", color: "var(--cyan-300)", border: "1px solid var(--line)" }}>
                #{t.tag} <span style={{ opacity: 0.6 }}>{t.reelCount}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Everywhere else on the platform */}
      <div className="card" style={{ padding: 16, marginBottom: 20 }}>
        <h2 className="eyebrow" style={{ marginBottom: 12 }}>Browse the platform</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
          {DESTINATIONS.map((d) => (
            <Link key={d.to} to={d.to}
              style={{
                display: "flex", gap: 10, alignItems: "flex-start", padding: 11,
                borderRadius: 10, background: "var(--navy-950)", border: "1px solid var(--line)",
              }}>
              <span style={{ fontSize: 17, lineHeight: 1 }}>{d.icon}</span>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: "block", fontWeight: 600, fontSize: 13 }}>{d.title}</span>
                <span style={{ display: "block", fontSize: 11.5, color: "var(--slate-400)", lineHeight: 1.4 }}>{d.body}</span>
              </span>
            </Link>
          ))}
        </div>
      </div>

      {/* Sports conversation */}
      <h2 className="eyebrow" style={{ marginBottom: 10 }}>Sports talk</h2>
      {posts === null && <p style={{ color: "var(--slate-400)", fontSize: 13 }}>Loading…</p>}
      {posts?.length === 0 && (
        <div className="card" style={{ padding: 20, textAlign: "center", color: "var(--slate-400)", fontSize: 13 }}>
          No sports posts yet. Start one from the <Link to="/sports" style={{ color: "var(--cyan-300)" }}>Sports</Link> page.
        </div>
      )}
      {posts?.slice(0, 10).map((p) => (
        <PostCard key={p.id} post={p} viewerUsername={user?.username} onChanged={() => {}} />
      ))}
    </div>
  );
}
