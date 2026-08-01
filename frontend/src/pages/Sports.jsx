import { useEffect, useState } from "react";
import { api } from "../api";
import PostCard from "../components/PostCard";
import { useAuth } from "../AuthContext";
import { MediaPicker } from "../components/MediaAttach";

function ScoreRow({ event, broadcastUrl }) {
  return (
    <div className="card" style={{ padding: 14, marginBottom: 8, borderColor: event.isLive ? "var(--danger)" : "var(--line)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div style={{ fontSize: 13, flex: 1, minWidth: 160 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {event.isLive && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "var(--danger)", fontSize: 11, fontWeight: 700 }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--danger)" }} /> LIVE
              </span>
            )}
            <span style={{ fontWeight: 600 }}>{event.homeTeam} vs {event.awayTeam}</span>
          </div>
          <div style={{ color: "var(--slate-400)", fontSize: 12, marginTop: 2 }}>
            {event.league ? `${event.league} · ` : ""}{event.date} {event.time || ""}{event.venue ? ` · ${event.venue}` : ""}
          </div>
        </div>
        {(event.homeScore !== null && event.homeScore !== undefined) ? (
          <div className="h-display" style={{ fontSize: 18 }}>{event.homeScore} – {event.awayScore}</div>
        ) : (
          <span className="eyebrow">Upcoming</span>
        )}
      </div>

      {(event.broadcastUrl || broadcastUrl) && (
        <a href={event.broadcastUrl || broadcastUrl} target="_blank" rel="noopener noreferrer"
          style={{ fontSize: 11, color: "var(--cyan-300)", display: "inline-block", marginTop: 8 }}>
          📺 Where to watch (official broadcaster) ↗
        </a>
      )}
    </div>
  );
}

export default function Sports() {
  const { user } = useAuth();
  const [leagues, setLeagues] = useState([]);
  const [league, setLeague] = useState("");
  const [scores, setScores] = useState(null);
  const [scoresError, setScoresError] = useState("");
  const [posts, setPosts] = useState(null);
  const [body, setBody] = useState("");
  const [postFiles, setPostFiles] = useState([]);
  const [liveNow, setLiveNow] = useState([]);

  useEffect(() => {
    api.get("/api/sports/leagues").then(({ leagues }) => {
      setLeagues(leagues);
      // Pick the first league the API reports rather than hardcoding a key,
      // which broke when the league list was reorganised.
      if (leagues.length > 0) setLeague((cur) => cur || leagues[0].key);
    }).catch(() => {});
    loadLive();
    // Refresh live scores while the page is open. Not true play-by-play --
    // the underlying free feed updates periodically, not per point.
    const t = setInterval(loadLive, 60000);
    return () => clearInterval(t);
  }, []);

  async function loadLive() {
    try {
      const { live } = await api.get("/api/sports/live");
      setLiveNow(live);
    } catch { /* a failed live poll shouldn't disturb the page */ }
  }

  async function loadScores() {
    setScoresError("");
    setScores(null);
    try {
      const data = await api.get(`/api/sports/scores?league=${league}`);
      setScores(data);
    } catch (err) {
      setScoresError(err.message);
    }
  }
  useEffect(() => { if (league) loadScores(); }, [league]);

  async function loadPosts() {
    const { posts } = await api.get("/api/posts/explore?category=SPORTS");
    setPosts(posts);
  }
  useEffect(() => { loadPosts(); }, []);

  async function submitPost(e) {
    e.preventDefault();
    if (!body.trim() && postFiles.length === 0) return;
    const formData = new FormData();
    formData.append("body", body);
    formData.append("category", "SPORTS");
    formData.append("audience", "PUBLIC");
    postFiles.forEach((f) => formData.append("media", f));
    await api.upload("/api/posts", formData);
    setBody("");
    setPostFiles([]);
    loadPosts();
  }

  return (
    <div className="container" style={{ maxWidth: 640, paddingTop: 28, paddingBottom: 60 }}>
      <h1 className="h-display" style={{ fontSize: 22, marginBottom: 4 }}>Sports & athletics</h1>
      <p style={{ color: "var(--slate-400)", fontSize: 14, marginBottom: 16 }}>
        Live scores from a public sports data feed, plus what the community's saying.
      </p>

      {liveNow.length > 0 && (
        <div className="card" style={{ padding: 14, marginBottom: 16, borderColor: "var(--danger)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--danger)" }} />
            <span className="eyebrow" style={{ color: "var(--danger)" }}>Live now ({liveNow.length})</span>
          </div>
          {liveNow.map((e) => <ScoreRow key={e.id} event={e} />)}
          <p style={{ fontSize: 11, color: "var(--slate-400)", margin: "6px 0 0", lineHeight: 1.5 }}>
            Scores refresh about once a minute. Match video is only available
            from the official rights holder — the link on each fixture takes
            you there.
          </p>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {leagues.map((l) => (
          <button
            key={l.key}
            className="btn"
            style={{ background: league === l.key ? "var(--cyan-400)" : "var(--navy-800)", color: league === l.key ? "var(--navy-950)" : "var(--slate-300)", border: "1px solid var(--line)" }}
            onClick={() => setLeague(l.key)}
          >
            {l.label}
          </button>
        ))}
      </div>

      {scoresError && <div className="card" style={{ padding: 14, color: "var(--danger)", fontSize: 13, marginBottom: 16 }}>{scoresError}</div>}
      {scores && (
        <>
          {scores.upcoming?.length > 0 && (
            <>
              <h2 className="eyebrow" style={{ marginBottom: 8 }}>Upcoming</h2>
              {scores.upcoming.map((e) => <ScoreRow key={e.id} event={e} broadcastUrl={scores.broadcastUrl} />)}
            </>
          )}
          {scores.recent?.length > 0 && (
            <>
              <h2 className="eyebrow" style={{ margin: "16px 0 8px" }}>Recent results</h2>
              {scores.recent.map((e) => <ScoreRow key={e.id} event={e} broadcastUrl={scores.broadcastUrl} />)}
            </>
          )}
          {scores.noData && (
            <div className="card" style={{ padding: 16, fontSize: 13, color: "var(--slate-400)" }}>
              No fixtures returned for this league. That usually means it's
              between seasons — but if it stays empty during a season, the
              league id in <code>backend/src/routes/sports.js</code> may need
              correcting (look it up on thesportsdb.com).
            </div>
          )}
        </>
      )}

      <h2 className="eyebrow" style={{ margin: "24px 0 8px" }}>Community talk</h2>
      <form onSubmit={submitPost} className="card" style={{ padding: 14, marginBottom: 16 }}>
        <textarea placeholder="Talk sports…" rows={2} value={body} onChange={(e) => setBody(e.target.value)} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
          <MediaPicker files={postFiles} onChange={setPostFiles} max={10} />
          <button className="btn btn-primary" type="submit">Post</button>
        </div>
      </form>
      {posts?.map((p) => <PostCard key={p.id} post={p} viewerUsername={user?.username} onChanged={loadPosts} />)}
    </div>
  );
}
