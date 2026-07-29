import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";

export default function Friends() {
  const [data, setData] = useState(null);
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");

  async function load() {
    setData(await api.get("/api/friends"));
  }
  useEffect(() => { load(); }, []);

  async function respond(id, action) {
    await api.patch(`/api/friends/requests/${id}`, { action });
    load();
  }

  async function sendRequest(e) {
    e.preventDefault();
    setError("");
    try {
      await api.post("/api/friends/requests", { username });
      setUsername("");
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  if (!data) return <div className="container" style={{ paddingTop: 40 }}>Loading…</div>;

  return (
    <div className="container" style={{ maxWidth: 640, paddingTop: 28, paddingBottom: 60 }}>
      <form onSubmit={sendRequest} className="card" style={{ padding: 16, marginBottom: 20, display: "flex", gap: 10 }}>
        <input type="text" placeholder="Invite a friend by username" value={username} onChange={(e) => setUsername(e.target.value)} />
        <button className="btn btn-primary" type="submit">Invite</button>
      </form>
      {error && <div style={{ color: "var(--danger)", fontSize: 13, marginBottom: 16 }}>{error}</div>}

      {data.incomingRequests.length > 0 && (
        <>
          <h2 className="eyebrow" style={{ marginBottom: 10 }}>Invitations</h2>
          {data.incomingRequests.map((req) => (
            <div key={req.id} className="card" style={{ padding: 14, marginBottom: 10, display: "flex", alignItems: "center", gap: 12 }}>
              <img className="avatar" src={api.mediaUrl(req.sender.avatarUrl) || `https://api.dicebear.com/7.x/identicon/svg?seed=${req.sender.username}`} alt="" />
              <span style={{ flex: 1, fontWeight: 600, fontSize: 14 }}>{req.sender.displayName}</span>
              <button className="btn btn-primary" onClick={() => respond(req.id, "accept")}>Accept</button>
              <button className="btn btn-ghost" onClick={() => respond(req.id, "decline")}>Decline</button>
            </div>
          ))}
        </>
      )}

      <h2 className="eyebrow" style={{ margin: "20px 0 10px" }}>Friends ({data.friends.length})</h2>
      {data.friends.length === 0 && <p style={{ color: "var(--slate-400)" }}>No friends yet — invite someone above.</p>}
      {data.friends.map((f) => (
        <Link key={f.id} to={`/u/${f.username}`} className="card" style={{ padding: 14, marginBottom: 10, display: "flex", alignItems: "center", gap: 12 }}>
          <img className="avatar" src={api.mediaUrl(f.avatarUrl) || `https://api.dicebear.com/7.x/identicon/svg?seed=${f.username}`} alt="" />
          <span style={{ fontWeight: 600, fontSize: 14 }}>{f.displayName}</span>
          <span style={{ color: "var(--slate-400)", fontSize: 13 }}>@{f.username}</span>
        </Link>
      ))}
    </div>
  );
}
