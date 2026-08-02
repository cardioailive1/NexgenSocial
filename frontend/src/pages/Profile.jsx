import { useEffect, useRef, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { api, API_URL } from "../api";
import { useAuth } from "../AuthContext";
import PostCard from "../components/PostCard";

export default function Profile() {
  const { username } = useParams();
  const { user: viewer } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [posts, setPosts] = useState([]);
  const [busy, setBusy] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState("");
  const avatarInputRef = useRef();
  const isMe = viewer?.username === username;

  async function load() {
    const profile = await api.get(`/api/users/${encodeURIComponent(username)}`);
    setData(profile);
    const { posts } = await api.get(`/api/posts/by/${encodeURIComponent(username)}`);
    setPosts(posts);
  }

  useEffect(() => { load(); }, [username]);

  async function toggleFollow() {
    setBusy(true);
    try {
      if (data.viewerContext.isFollowing) await api.delete(`/api/follows/${encodeURIComponent(username)}`);
      else await api.post(`/api/follows/${encodeURIComponent(username)}`);
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

  async function uploadAvatar(e) {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingAvatar(true);
    setAvatarError("");
    try {
      const formData = new FormData();
      formData.append("avatar", file);
      await api.upload("/api/users/me/avatar", formData);
      await load();
    } catch (err) {
      setAvatarError(err.message);
    } finally {
      setUploadingAvatar(false);
      if (avatarInputRef.current) avatarInputRef.current.value = "";
    }
  }

  async function callUser(kind = "AUDIO") {
    setBusy(true);
    try {
      const { call } = await api.post("/api/messages/calls", { username, kind });
      navigate(`/call/${call.id}`);
    } catch (err) {
      setAvatarError(err.message);
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
          <div style={{ position: "relative", flexShrink: 0 }}>
            <img className="avatar" style={{ width: 72, height: 72 }} src={user.avatarUrl ? api.mediaUrl(user.avatarUrl) : `https://api.dicebear.com/7.x/identicon/svg?seed=${user.username}`} alt="" />
            {isMe && (
              <label
                style={{
                  position: "absolute", bottom: -2, right: -2, width: 26, height: 26, borderRadius: "50%",
                  background: "var(--cyan-400)", color: "var(--navy-950)", display: "flex", alignItems: "center",
                  justifyContent: "center", cursor: "pointer", border: "2px solid var(--navy-900)", fontSize: 13,
                }}
                title="Change profile photo"
              >
                {uploadingAvatar ? "…" : "📷"}
                <input ref={avatarInputRef} type="file" accept="image/*" onChange={uploadAvatar} disabled={uploadingAvatar} style={{ display: "none" }} />
              </label>
            )}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <h1 className="h-display" style={{ fontSize: 22, margin: 0 }}>{user.displayName}</h1>
              {user.tier === "PREMIUM" && <span className="premium-pill">Premium</span>}
            </div>
            <p style={{ color: "var(--slate-400)", margin: "2px 0" }}>@{user.username}</p>
            {avatarError && <p style={{ color: "var(--danger)", fontSize: 12 }}>{avatarError}</p>}
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
              {/* There was previously no way to contact someone from their
                  profile at all -- you could follow or friend them and then
                  had nowhere to go. */}
              <Link className="btn btn-ghost" to={`/messages?with=${user.username}`}>💬 Message</Link>
              <button className="btn btn-ghost" onClick={() => callUser("AUDIO")} disabled={busy}>📞 Call</button>
              <button className="btn btn-ghost" onClick={() => callUser("VIDEO")} disabled={busy}>🎥 Video</button>
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
