import { useEffect, useState } from "react";
import { api } from "../api";
import PostCard from "../components/PostCard";
import { useAuth } from "../AuthContext";

function ScoreRow({ event }) {
  return (
    <div className="card" style={{ padding: 14, marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <div style={{ fontSize: 13 }}>
        <div style={{ fontWeight: 600 }}>{event.homeTeam} vs {event.awayTeam}</div>
        <div style={{ color: "var(--slate-400)", fontSize: 12 }}>{event.date} {event.time || ""} {event.venue ? `· ${event.venue}` : ""}</div>
      </div>
      {(event.homeScore !== null && event.homeScore !== undefined) ? (
        <div className="h-display" style={{ fontSize: 16 }}>{event.homeScore} – {event.awayScore}</div>
      ) : (
        <span className="eyebrow">Upcoming</span>
      )}
    </div>
  );
}

export default function Sports() {
  const { user } = useAuth();
  const [leagues, setLeagues] = useState([]);
  const [league, setLeague] = useState("soccer");
  const [scores, setScores] = useState(null);
  const [scoresError, setScoresError] = useState("");
  const [posts, setPosts] = useState(null);
  const [body, setBody] = useState("");

  useEffect(() => {
    api.get("/api/sports/leagues").then(({ leagues }) => setLeagues(leagues)).catch(() => {});
  }, []);

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
  useEffect(() => { loadScores(); }, [league]);

  async function loadPosts() {
    const { posts } = await api.get("/api/posts/explore?category=SPORTS");
    setPosts(posts);
  }
  useEffect(() => { loadPosts(); }, []);

  async function submitPost(e) {
    e.preventDefault();
    if (!body.trim()) return;
    const formData = new FormData();
    formData.append("body", body);
    formData.append("category", "SPORTS");
    formData.append("audience", "PUBLIC");
    await api.upload("/api/posts", formData);
    setBody("");
    loadPosts();
  }

  return (
    <div className="container" style={{ maxWidth: 640, paddingTop: 28, paddingBottom: 60 }}>
      <h1 className="h-display" style={{ fontSize: 22, marginBottom: 4 }}>Sports & athletics</h1>
      <p style={{ color: "var(--slate-400)", fontSize: 14, marginBottom: 16 }}>
        Live scores from a public sports data feed, plus what the community's saying.
      </p>

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
              {scores.upcoming.map((e) => <ScoreRow key={e.id} event={e} />)}
            </>
          )}
          {scores.recent?.length > 0 && (
            <>
              <h2 className="eyebrow" style={{ margin: "16px 0 8px" }}>Recent results</h2>
              {scores.recent.map((e) => <ScoreRow key={e.id} event={e} />)}
            </>
          )}
          {!scores.upcoming?.length && !scores.recent?.length && (
            <p style={{ color: "var(--slate-400)" }}>No fixtures found for this league right now.</p>
          )}
        </>
      )}

      <h2 className="eyebrow" style={{ margin: "24px 0 8px" }}>Community talk</h2>
      <form onSubmit={submitPost} className="card" style={{ padding: 14, marginBottom: 16 }}>
        <textarea placeholder="Talk sports…" rows={2} value={body} onChange={(e) => setBody(e.target.value)} />
        <button className="btn btn-primary" type="submit" style={{ marginTop: 8 }}>Post</button>
      </form>
      {posts?.map((p) => <PostCard key={p.id} post={p} viewerUsername={user?.username} onChanged={loadPosts} />)}
    </div>
  );
}
