import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";

export default function LiveStreams() {
  const [streams, setStreams] = useState(null);
  const [title, setTitle] = useState("");
  const navigate = useNavigate();

  async function load() {
    const { streams } = await api.get("/api/livestreams");
    setStreams(streams);
  }
  useEffect(() => { load(); }, []);

  async function goLive(e) {
    e.preventDefault();
    const { stream } = await api.post("/api/livestreams", { title: title || "Untitled stream" });
    navigate(`/live/${stream.id}`);
  }

  return (
    <div className="container" style={{ maxWidth: 640, paddingTop: 28, paddingBottom: 60 }}>
      <h1 className="h-display" style={{ fontSize: 22, marginBottom: 4 }}>Live</h1>
      <p style={{ color: "var(--slate-400)", fontSize: 14, marginBottom: 16 }}>
        Real peer-to-peer video, straight from your browser — no third-party
        streaming service required. Works great for a handful of viewers;
        for a big public broadcast you'd plug in a media-server provider
        (see the README).
      </p>

      <form onSubmit={goLive} className="card" style={{ padding: 16, marginBottom: 20, display: "flex", gap: 10 }}>
        <input type="text" placeholder="What's this stream about?" value={title} onChange={(e) => setTitle(e.target.value)} />
        <button className="btn btn-primary" type="submit">● Go live</button>
      </form>

      <h2 className="eyebrow" style={{ marginBottom: 10 }}>Live now</h2>
      {streams === null && <p style={{ color: "var(--slate-400)" }}>Loading…</p>}
      {streams?.length === 0 && <p style={{ color: "var(--slate-400)" }}>No one's live right now.</p>}
      {streams?.map((s) => (
        <Link key={s.id} to={`/live/${s.id}`} className="card" style={{ display: "flex", alignItems: "center", gap: 12, padding: 14, marginBottom: 10 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--danger)", flexShrink: 0 }} />
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{s.title}</div>
            <div style={{ color: "var(--slate-400)", fontSize: 12 }}>{s.host.displayName} · @{s.host.username}</div>
          </div>
        </Link>
      ))}
    </div>
  );
}
