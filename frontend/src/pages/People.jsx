import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import FriendSuggestions from "../components/FriendSuggestions";

export default function People() {
  const [users, setUsers] = useState(null);
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");

  async function load(q = "") {
    setError("");
    try {
      const { users } = await api.get(`/api/users${q ? `?q=${encodeURIComponent(q)}` : ""}`);
      setUsers(users);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => { load(); }, []);

  // Debounce so typing doesn't fire a request per keystroke.
  useEffect(() => {
    const t = setTimeout(() => load(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  async function act(user, action) {
    setBusyId(user.id);
    setError("");
    try {
      if (action === "follow") await api.post(`/api/follows/${user.username}`);
      if (action === "unfollow") await api.delete(`/api/follows/${user.username}`);
      if (action === "friend") await api.post("/api/friends/requests", { username: user.username });
      if (action === "accept") await api.patch(`/api/friends/requests/${user.friendRequestId}`, { action: "accept" });
      if (action === "cancel") await api.delete(`/api/friends/requests/${user.friendRequestId}`);
      await load(query);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  function friendButton(u) {
    if (u.friendStatus === "ACCEPTED") {
      return <span className="premium-pill">Friends</span>;
    }
    if (u.friendStatus === "PENDING" && u.friendRequestIncoming) {
      return (
        <button className="btn btn-primary" disabled={busyId === u.id} onClick={() => act(u, "accept")} style={{ fontSize: 11, padding: "6px 10px" }}>
          Accept request
        </button>
      );
    }
    if (u.friendStatus === "PENDING") {
      // Previously this was a dead end: a static "Request sent" label with
      // no way to check on it or take it back. Now it can be cancelled here,
      // and the Friends page lists it too.
      return (
        <>
          <span className="eyebrow" style={{ fontSize: 10 }}>Request sent</span>
          <button
            className="btn btn-ghost btn-danger"
            disabled={busyId === u.id}
            onClick={() => act(u, "cancel")}
            style={{ fontSize: 11, padding: "6px 10px" }}
          >
            Cancel
          </button>
        </>
      );
    }
    return (
      <button className="btn btn-ghost" disabled={busyId === u.id} onClick={() => act(u, "friend")} style={{ fontSize: 11, padding: "6px 10px" }}>
        Add friend
      </button>
    );
  }

  return (
    <div className="container" style={{ maxWidth: 640, paddingTop: 28, paddingBottom: 60 }}>
      <h1 className="h-display" style={{ fontSize: 22, marginBottom: 4 }}>People</h1>
      <p style={{ color: "var(--slate-400)", fontSize: 14, marginBottom: 16 }}>
        Everyone on NexgenSocial. Follow to see their posts, or send a friend
        request to connect both ways. Sent requests wait for the other person
        to accept — you can track them on your{" "}
        <Link to="/friends" style={{ color: "var(--cyan-300)" }}>Friends</Link> page.
      </p>

      <FriendSuggestions limit={5} />

      <input
        type="text"
        placeholder="Search by name or username…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        style={{ marginBottom: 16 }}
      />

      {error && <div className="card" style={{ padding: 12, color: "var(--danger)", fontSize: 13, marginBottom: 12 }}>{error}</div>}
      {users === null && <p style={{ color: "var(--slate-400)" }}>Loading…</p>}
      {users?.length === 0 && (
        <div className="card" style={{ padding: 24, textAlign: "center", color: "var(--slate-400)", fontSize: 13 }}>
          {query ? "No one matches that search." : "No other accounts yet."}
        </div>
      )}

      {users?.map((u) => (
        <div key={u.id} className="card" style={{ padding: 14, marginBottom: 10, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <Link to={`/u/${u.username}`}>
            <img className="avatar" src={api.mediaUrl(u.avatarUrl) || `https://api.dicebear.com/7.x/identicon/svg?seed=${u.username}`} alt="" />
          </Link>
          <div style={{ flex: 1, minWidth: 120 }}>
            <Link to={`/u/${u.username}`} style={{ fontWeight: 600, fontSize: 14 }}>{u.displayName}</Link>
            <div style={{ color: "var(--slate-400)", fontSize: 12 }}>@{u.username}</div>
            {u.bio && <div style={{ color: "var(--slate-300)", fontSize: 12, marginTop: 2 }}>{u.bio}</div>}
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            <button
              className={u.isFollowing ? "btn btn-ghost" : "btn btn-primary"}
              disabled={busyId === u.id}
              onClick={() => act(u, u.isFollowing ? "unfollow" : "follow")}
              style={{ fontSize: 11, padding: "6px 10px" }}
            >
              {u.isFollowing ? "Unfollow" : "Follow"}
            </button>
            {friendButton(u)}
          </div>
        </div>
      ))}
    </div>
  );
}
