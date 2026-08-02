import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";

// "People you may know", but every suggestion states WHY it's suggested.
// An unexplained suggestion is one people reasonably distrust, and the
// reason is genuinely available here (mutual friends, shared interests,
// same city) rather than invented.
export default function FriendSuggestions({ limit = 5, compact = false }) {
  const [suggestions, setSuggestions] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [hidden, setHidden] = useState([]);

  async function load() {
    try {
      const { suggestions } = await api.get("/api/suggestions/friends");
      setSuggestions(suggestions);
    } catch { setSuggestions([]); }
  }
  useEffect(() => { load(); }, []);

  async function follow(user) {
    setBusyId(user.id);
    try {
      await api.post(`/api/follows/${encodeURIComponent(user.username)}`);
      setHidden((h) => [...h, user.id]);
    } catch { /* surfaced by the list refreshing unchanged */ }
    finally { setBusyId(null); }
  }

  async function addFriend(user) {
    setBusyId(user.id);
    try {
      await api.post("/api/friends/requests", { username: user.username });
      setHidden((h) => [...h, user.id]);
    } catch { /* already-pending requests fail harmlessly */ }
    finally { setBusyId(null); }
  }

  const visible = (suggestions || []).filter((s) => !hidden.includes(s.id)).slice(0, limit);
  if (!suggestions || visible.length === 0) return null;

  return (
    <div className="card" style={{ padding: 14, marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span className="eyebrow">People you might know</span>
        <Link to="/people" style={{ fontSize: 11, color: "var(--cyan-300)" }}>See all</Link>
      </div>

      {visible.map((s) => (
        <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <Link to={`/u/${s.username}`}>
            <img className="avatar" style={{ width: compact ? 32 : 38, height: compact ? 32 : 38 }}
              src={api.mediaUrl(s.avatarUrl) || `https://api.dicebear.com/7.x/identicon/svg?seed=${s.username}`} alt="" />
          </Link>
          <div style={{ flex: 1, minWidth: 0 }}>
            <Link to={`/u/${s.username}`} style={{ fontWeight: 600, fontSize: 13 }}>{s.displayName}</Link>
            <div style={{ fontSize: 11, color: "var(--cyan-300)" }}>{s.reason}</div>
            {!compact && s.occupation && (
              <div style={{ fontSize: 11, color: "var(--slate-400)" }}>{s.occupation}</div>
            )}
          </div>
          <div style={{ display: "flex", gap: 5 }}>
            <button className="btn btn-primary" disabled={busyId === s.id} onClick={() => follow(s)}
              style={{ fontSize: 10.5, padding: "5px 9px" }}>
              Follow
            </button>
            <button className="btn btn-ghost" disabled={busyId === s.id} onClick={() => addFriend(s)}
              style={{ fontSize: 10.5, padding: "5px 9px" }}>
              Add
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
