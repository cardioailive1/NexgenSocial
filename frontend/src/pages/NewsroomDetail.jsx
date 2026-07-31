import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import { MediaGallery } from "../components/MediaAttach";

export default function NewsroomDetail() {
  const { slug } = useParams();
  const [newsroom, setNewsroom] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState(null);

  async function load() {
    setError("");
    try {
      const { newsroom } = await api.get(`/api/newsrooms/${slug}`);
      setNewsroom(newsroom);
    } catch (err) {
      setError(err.message);
    }
  }
  useEffect(() => { load(); }, [slug]);

  async function toggleFollow() {
    setBusy(true);
    try {
      if (newsroom.followedByViewer) await api.delete(`/api/newsrooms/${newsroom.id}/follow`);
      else await api.post(`/api/newsrooms/${newsroom.id}/follow`);
      await load();
    } finally { setBusy(false); }
  }

  if (error) return <div className="container" style={{ paddingTop: 40 }}><div className="card" style={{ padding: 16, color: "var(--danger)" }}>{error}</div></div>;
  if (!newsroom) return <div className="container" style={{ paddingTop: 40, color: "var(--slate-400)" }}>Loading newsroom…</div>;

  return (
    <div className="container" style={{ maxWidth: 700, paddingTop: 28, paddingBottom: 60 }}>
      <div className="card" style={{ padding: 20, marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 14, alignItems: "flex-start", flexWrap: "wrap" }}>
          <img className="avatar" style={{ width: 60, height: 60 }}
            src={api.mediaUrl(newsroom.avatarUrl) || `https://api.dicebear.com/7.x/identicon/svg?seed=${newsroom.slug}`} alt="" />
          <div style={{ flex: 1, minWidth: 180 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <h1 className="h-display" style={{ fontSize: 20, margin: 0 }}>{newsroom.name}</h1>
              {newsroom.verified
                ? <span className="premium-pill">✓ Verified</span>
                : <span className="premium-pill" style={{ background: "rgba(255,107,107,0.12)", color: "var(--danger)", borderColor: "rgba(255,107,107,0.3)" }}>Unverified</span>}
            </div>
            {newsroom.description && <p style={{ fontSize: 13, color: "var(--slate-300)", marginTop: 6 }}>{newsroom.description}</p>}
            <div style={{ fontSize: 12, color: "var(--slate-400)", marginTop: 6 }}>
              Published by <strong style={{ color: "var(--slate-300)" }}>{newsroom.organization}</strong>
              {newsroom.beat ? ` · ${newsroom.beat}` : ""}{newsroom.region ? ` · ${newsroom.region}` : ""}
            </div>
            {newsroom.websiteUrl && (
              <a href={newsroom.websiteUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: "var(--cyan-300)" }}>
                {newsroom.websiteUrl} ↗
              </a>
            )}
            <div className="eyebrow" style={{ fontSize: 10, marginTop: 8 }}>
              {newsroom.articles?.length ?? 0} stories · {newsroom.followerCount} followers
            </div>
          </div>
          <button className={newsroom.followedByViewer ? "btn btn-ghost" : "btn btn-primary"} onClick={toggleFollow} disabled={busy}>
            {newsroom.followedByViewer ? "Following" : "Follow"}
          </button>
        </div>

        {newsroom.liveNow && (
          <Link to={`/live/${newsroom.liveNow.id}`} className="card"
            style={{ display: "flex", alignItems: "center", gap: 10, padding: 12, marginTop: 14, borderColor: "rgba(255,107,107,0.35)" }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--danger)" }} />
            <div>
              <div style={{ fontWeight: 600, fontSize: 13 }}>Live now: {newsroom.liveNow.title}</div>
              <div style={{ fontSize: 11, color: "var(--slate-400)" }}>
                Started {new Date(newsroom.liveNow.startedAt).toLocaleTimeString()}
              </div>
            </div>
          </Link>
        )}
      </div>

      <h2 className="eyebrow" style={{ marginBottom: 10 }}>Stories</h2>
      {newsroom.articles?.length === 0 && (
        <div className="card" style={{ padding: 24, textAlign: "center", color: "var(--slate-400)", fontSize: 13 }}>
          Nothing published yet.
        </div>
      )}
      {newsroom.articles?.map((a) => (
        <div key={a.id} className="card" style={{ padding: 14, marginBottom: 10 }}>
          {a.isBreaking && (
            <span className="premium-pill" style={{ background: "rgba(255,107,107,0.15)", color: "var(--danger)", borderColor: "rgba(255,107,107,0.35)", marginBottom: 6, display: "inline-block" }}>
              ● Breaking
            </span>
          )}
          <div style={{ fontWeight: 700, fontSize: 15 }}>{a.headline}</div>
          {a.standfirst && <div style={{ fontSize: 13, color: "var(--slate-300)", marginTop: 4 }}>{a.standfirst}</div>}
          <MediaGallery media={a.media} legacyUrl={a.imageUrl} compact />
          {expandedId === a.id && (
            <div style={{ fontSize: 13, lineHeight: 1.6, marginTop: 10, whiteSpace: "pre-wrap", color: "var(--slate-300)" }}>{a.body}</div>
          )}
          <button onClick={() => setExpandedId(expandedId === a.id ? null : a.id)} style={{ fontSize: 12, color: "var(--cyan-300)", marginTop: 8 }}>
            {expandedId === a.id ? "Show less" : "Read full story"}
          </button>
          <div style={{ fontSize: 11, color: "var(--slate-400)", marginTop: 8 }}>
            {a.byline && <>By {a.byline} · </>}
            {new Date(a.publishedAt).toLocaleString()}
            {a.correctedAt && <span style={{ color: "var(--cyan-300)" }}> · Corrected {new Date(a.correctedAt).toLocaleDateString()}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}
