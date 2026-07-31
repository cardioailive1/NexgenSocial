import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";

function PersonRow({ person, children }) {
  return (
    <div className="card" style={{ padding: 14, marginBottom: 10, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
      <Link to={`/u/${person.username}`}>
        <img className="avatar" src={api.mediaUrl(person.avatarUrl) || `https://api.dicebear.com/7.x/identicon/svg?seed=${person.username}`} alt="" />
      </Link>
      <div style={{ flex: 1, minWidth: 120 }}>
        <Link to={`/u/${person.username}`} style={{ fontWeight: 600, fontSize: 14 }}>{person.displayName}</Link>
        <div style={{ color: "var(--slate-400)", fontSize: 12 }}>@{person.username}</div>
      </div>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>{children}</div>
    </div>
  );
}

export default function Friends() {
  const [data, setData] = useState(null);
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState(null);

  async function load() {
    setError("");
    try {
      setData(await api.get("/api/friends"));
    } catch (err) {
      setError(err.message);
    }
  }
  useEffect(() => { load(); }, []);

  async function respond(id, action) {
    setBusyId(id);
    try {
      await api.patch(`/api/friends/requests/${id}`, { action });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function cancelRequest(id) {
    setBusyId(id);
    try {
      await api.delete(`/api/friends/requests/${id}`);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function unfriend(userId) {
    setBusyId(userId);
    try {
      await api.delete(`/api/friends/${userId}`);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function sendRequest(e) {
    e.preventDefault();
    setError("");
    setNotice("");
    try {
      await api.post("/api/friends/requests", { username });
      // Says explicitly where the request went. The previous version showed
      // only a transient "sent" state with no follow-up, which read as if
      // nothing had happened.
      setNotice(`Request sent to @${username}. It's now waiting for them to accept — you'll find it under "Requests you've sent" below.`);
      setUsername("");
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  if (!data) return <div className="container" style={{ paddingTop: 40, color: "var(--slate-400)" }}>Loading…</div>;

  return (
    <div className="container" style={{ maxWidth: 640, paddingTop: 28, paddingBottom: 60 }}>
      <h1 className="h-display" style={{ fontSize: 22, marginBottom: 4 }}>Friends</h1>
      <p style={{ color: "var(--slate-400)", fontSize: 14, marginBottom: 16 }}>
        Friend requests need both people to agree. Once you send one it sits
        here until the other person accepts it.
      </p>

      <form onSubmit={sendRequest} className="card" style={{ padding: 16, marginBottom: 12, display: "flex", gap: 10 }}>
        <input type="text" placeholder="Add a friend by username" value={username} onChange={(e) => setUsername(e.target.value)} />
        <button className="btn btn-primary" type="submit" disabled={!username.trim()}>Send request</button>
      </form>

      {notice && <div className="card" style={{ padding: 12, color: "var(--cyan-300)", fontSize: 13, marginBottom: 12 }}>{notice}</div>}
      {error && <div className="card" style={{ padding: 12, color: "var(--danger)", fontSize: 13, marginBottom: 12 }}>{error}</div>}

      {/* Incoming */}
      <h2 className="eyebrow" style={{ margin: "20px 0 10px" }}>
        Requests waiting on you ({data.incomingRequests.length})
      </h2>
      {data.incomingRequests.length === 0 && (
        <p style={{ color: "var(--slate-400)", fontSize: 13, marginBottom: 10 }}>No one's asked to be your friend right now.</p>
      )}
      {data.incomingRequests.map((req) => (
        <PersonRow key={req.id} person={req.sender}>
          <button className="btn btn-primary" disabled={busyId === req.id} onClick={() => respond(req.id, "accept")} style={{ fontSize: 11, padding: "6px 10px" }}>Accept</button>
          <button className="btn btn-ghost" disabled={busyId === req.id} onClick={() => respond(req.id, "decline")} style={{ fontSize: 11, padding: "6px 10px" }}>Decline</button>
        </PersonRow>
      ))}

      {/* Outgoing -- this section is the actual fix */}
      <h2 className="eyebrow" style={{ margin: "24px 0 10px" }}>
        Requests you've sent ({data.sentRequests?.length ?? 0})
      </h2>
      {(!data.sentRequests || data.sentRequests.length === 0) && (
        <p style={{ color: "var(--slate-400)", fontSize: 13, marginBottom: 10 }}>You haven't sent any requests that are still pending.</p>
      )}
      {data.sentRequests?.map((req) => (
        <PersonRow key={req.id} person={req.receiver}>
          <span className="eyebrow" style={{ fontSize: 10 }}>Awaiting reply</span>
          <button className="btn btn-ghost btn-danger" disabled={busyId === req.id} onClick={() => cancelRequest(req.id)} style={{ fontSize: 11, padding: "6px 10px" }}>
            Cancel
          </button>
        </PersonRow>
      ))}

      {/* Accepted */}
      <h2 className="eyebrow" style={{ margin: "24px 0 10px" }}>Friends ({data.friends.length})</h2>
      {data.friends.length === 0 && (
        <p style={{ color: "var(--slate-400)", fontSize: 13 }}>
          No friends yet. Try the <Link to="/people" style={{ color: "var(--cyan-300)" }}>People</Link> page to find someone.
        </p>
      )}
      {data.friends.map((f) => (
        <PersonRow key={f.id} person={f}>
          <button className="btn btn-ghost btn-danger" disabled={busyId === f.id} onClick={() => unfriend(f.id)} style={{ fontSize: 11, padding: "6px 10px" }}>
            Remove
          </button>
        </PersonRow>
      ))}
    </div>
  );
}
