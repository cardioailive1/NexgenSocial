import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api, API_URL } from "../api";
import { useAuth } from "../AuthContext";
import PostCard from "../components/PostCard";

export default function Profile() {
  const { username } = useParams();
  const { user: viewer } = useAuth();
  const [data, setData] = useState(null);
  const [posts, setPosts] = useState([]);
  const [busy, setBusy] = useState(false);
  const isMe = viewer?.username === username;

  async function load() {
    const profile = await api.get(`/api/users/${username}`);
    setData(profile);
    const { posts } = await api.get(`/api/posts/by/${username}`);
    setPosts(posts);
  }

  useEffect(() => { load(); }, [username]);

  async function toggleFollow() {
    setBusy(true);
    try {
      if (data.viewerContext.isFollowing) await api.delete(`/api/follows/${username}`);
      else await api.post(`/api/follows/${username}`);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function sendFriendRequest() {
    setBusy(true);
    try {
      await api.post("/api/friends/requests", { username });
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function exportData() {
    const res = await fetch(`${API_URL}/api/users/me/export`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("ngs_token")}` },
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `nexgensocial-export-${username}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!data) return <div className="container" style={{ paddingTop: 40 }}>Loading profile…</div>;

  const { user, stats, viewerContext } = data;

  return (
    <div className="container" style={{ maxWidth: 640, paddingTop: 28, paddingBottom: 60 }}>
      <div className="card" style={{ padding: 24, marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <img className="avatar" style={{ width: 72, height: 72 }} src={user.avatarUrl || `https://api.dicebear.com/7.x/identicon/svg?seed=${user.username}`} alt="" />
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <h1 className="h-display" style={{ fontSize: 22, margin: 0 }}>{user.displayName}</h1>
              {user.tier === "PREMIUM" && <span className="premium-pill">Premium</span>}
            </div>
            <p style={{ color: "var(--slate-400)", margin: "2px 0" }}>@{user.username}</p>
            {user.bio && <p style={{ marginTop: 8, fontSize: 14 }}>{user.bio}</p>}
            <div style={{ display: "flex", gap: 16, marginTop: 10, fontSize: 13, color: "var(--slate-300)" }}>
              <span><strong>{stats.followerCount}</strong> followers</span>
              <span><strong>{stats.followingCount}</strong> following</span>
              <span><strong>{stats.friendCount}</strong> friends</span>
            </div>
          </div>

          {isMe && (
            <button className="btn btn-ghost" onClick={exportData} style={{ alignSelf: "start" }}>Export my data</button>
          )}

          {!isMe && viewerContext && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <button className="btn btn-primary" onClick={toggleFollow} disabled={busy}>
                {viewerContext.isFollowing ? "Unfollow" : "Follow"}
              </button>
              {viewerContext.friendStatus === "NONE" && (
                <button className="btn btn-ghost" onClick={sendFriendRequest} disabled={busy}>Add friend</button>
              )}
              {viewerContext.friendStatus === "PENDING" && (
                <span className="eyebrow" style={{ textAlign: "center" }}>Request sent</span>
              )}
              {viewerContext.friendStatus === "ACCEPTED" && (
                <span className="eyebrow" style={{ textAlign: "center", color: "var(--cyan-400)" }}>Friends</span>
              )}
            </div>
          )}
        </div>
      </div>

      {posts.map((post) => <PostCard key={post.id} post={post} viewerUsername={viewer?.username} onChanged={load} />)}
      {posts.length === 0 && (
        <div className="card" style={{ padding: 24, textAlign: "center", color: "var(--slate-400)" }}>
          No threads yet.
        </div>
      )}
    </div>
  );
}
