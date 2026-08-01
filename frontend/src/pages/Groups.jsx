import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import PostCard from "../components/PostCard";
import { useAuth } from "../AuthContext";
import { MediaPicker } from "../components/MediaAttach";

function GroupList() {
  const [groups, setGroups] = useState(null);
  const [myGroupIds, setMyGroupIds] = useState(new Set());
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");

  async function load() {
    setError("");
    try {
      const [{ groups }, mine] = await Promise.all([
        api.get("/api/groups"),
        api.get("/api/groups/mine").catch(() => ({ groups: [] })),
      ]);
      setGroups(groups);
      setMyGroupIds(new Set((mine.groups || []).map((g) => g.id)));
    } catch (err) {
      setError(err.message);
    }
  }
  useEffect(() => { load(); }, []);

  async function createGroup(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    setError("");
    try {
      // Explicitly public. Previously this was left undefined and relied on
      // a default, which made it unclear whether a new group would actually
      // be discoverable by anyone else.
      await api.post("/api/groups", { name, description, isPrivate: false });
      setName("");
      setDescription("");
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  }

  async function joinGroup(id) {
    setBusyId(id);
    setError("");
    try {
      await api.post(`/api/groups/${id}/join`);
      await load(); // refresh so the button state actually updates
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function leaveGroup(id) {
    setBusyId(id);
    try {
      await api.post(`/api/groups/${id}/leave`);
      await load();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="container" style={{ maxWidth: 640, paddingTop: 28, paddingBottom: 60 }}>
      <form onSubmit={createGroup} className="card" style={{ padding: 16, marginBottom: 20, display: "grid", gap: 10 }}>
        <h2 className="eyebrow">Start a group</h2>
        <input type="text" placeholder="Group name" value={name} onChange={(e) => setName(e.target.value)} />
        <textarea placeholder="What's it about?" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        <p style={{ fontSize: 11, color: "var(--slate-400)", margin: 0 }}>
          New groups are public — anyone on NexgenSocial can find and join them.
        </p>
        <button className="btn btn-primary" type="submit" disabled={creating} style={{ justifySelf: "start" }}>
          {creating ? "Creating…" : "Create group"}
        </button>
      </form>

      {error && <div className="card" style={{ padding: 12, color: "var(--danger)", fontSize: 13, marginBottom: 12 }}>{error}</div>}

      <h2 className="eyebrow" style={{ marginBottom: 10 }}>Discover groups</h2>
      {groups === null && <p style={{ color: "var(--slate-400)" }}>Loading…</p>}
      {groups?.length === 0 && <p style={{ color: "var(--slate-400)", fontSize: 13 }}>No public groups yet — start the first one.</p>}

      {groups?.map((g) => {
        const joined = myGroupIds.has(g.id);
        return (
          <div key={g.id} className="card" style={{ padding: 16, marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
              <Link to={`/groups/${g.id}`} style={{ flex: 1 }}>
                <div style={{ fontWeight: 700 }}>{g.name}</div>
                {g.description && <div style={{ color: "var(--slate-400)", fontSize: 13, marginTop: 4 }}>{g.description}</div>}
                <div className="eyebrow" style={{ marginTop: 8, fontSize: 10 }}>
                  {g._count?.members ?? 0} members · by @{g.owner?.username}
                </div>
              </Link>
              {joined ? (
                <button className="btn btn-ghost" disabled={busyId === g.id} onClick={() => leaveGroup(g.id)} style={{ fontSize: 11, padding: "6px 10px" }}>
                  Joined ✓
                </button>
              ) : (
                <button className="btn btn-primary" disabled={busyId === g.id} onClick={() => joinGroup(g.id)} style={{ fontSize: 11, padding: "6px 10px" }}>
                  {busyId === g.id ? "…" : "Join"}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function GroupDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [group, setGroup] = useState(null);
  const [posts, setPosts] = useState([]);
  const [body, setBody] = useState("");
  const [postFiles, setPostFiles] = useState([]);
  const [joined, setJoined] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setError("");
    try {
      const { group } = await api.get(`/api/groups/${id}`);
      setGroup(group);
      setJoined((group.members || []).some((m) => m.user.username === user?.username));
      const { posts } = await api.get(`/api/groups/${id}/posts`);
      setPosts(posts);
    } catch (err) {
      setError(err.message);
    }
  }
  useEffect(() => { load(); }, [id, user]);

  async function toggleMembership() {
    setBusy(true);
    setError("");
    try {
      if (joined) await api.post(`/api/groups/${id}/leave`);
      else await api.post(`/api/groups/${id}/join`);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function postToGroup(e) {
    e.preventDefault();
    if (!body.trim() && postFiles.length === 0) return;
    setError("");
    try {
      const formData = new FormData();
      formData.append("body", body);
      formData.append("groupId", id);
      // The /api/posts endpoint always accepted media -- this composer just
      // never offered it, so group posts were text-only.
      postFiles.forEach((f) => formData.append("media", f));
      await api.upload("/api/posts", formData);
      setBody("");
      setPostFiles([]);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  if (!group) return <div className="container" style={{ paddingTop: 40 }}>Loading group…</div>;

  return (
    <div className="container" style={{ maxWidth: 640, paddingTop: 28, paddingBottom: 60 }}>
      <div className="card" style={{ padding: 20, marginBottom: 20 }}>
        <h1 className="h-display" style={{ margin: 0, fontSize: 22 }}>{group.name}</h1>
        {group.description && <p style={{ color: "var(--slate-400)", marginTop: 6 }}>{group.description}</p>}
        <div className="eyebrow" style={{ fontSize: 10, marginTop: 8 }}>
          {group.members?.length ?? 0} members · by @{group.owner?.username}
        </div>
        <button className={joined ? "btn btn-ghost" : "btn btn-primary"} style={{ marginTop: 12 }} onClick={toggleMembership} disabled={busy}>
          {busy ? "…" : joined ? "Leave group" : "Join group"}
        </button>
      </div>

      {error && <div className="card" style={{ padding: 12, color: "var(--danger)", fontSize: 13, marginBottom: 12 }}>{error}</div>}

      <form onSubmit={postToGroup} className="card" style={{ padding: 16, marginBottom: 20 }}>
        <textarea placeholder={`Post in ${group.name}…`} rows={2} value={body} onChange={(e) => setBody(e.target.value)} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
          <MediaPicker files={postFiles} onChange={setPostFiles} max={10} />
          <button className="btn btn-primary" type="submit">Post</button>
        </div>
      </form>

      {posts.length === 0 && (
        <div className="card" style={{ padding: 20, textAlign: "center", color: "var(--slate-400)", fontSize: 13 }}>
          No posts in this group yet.
        </div>
      )}
      {posts.map((p) => <PostCard key={p.id} post={p} viewerUsername={user?.username} onChanged={load} />)}
    </div>
  );
}

export default function Groups() {
  const { id } = useParams();
  return id ? <GroupDetail /> : <GroupList />;
}
