import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import PostCard from "../components/PostCard";

function GroupList() {
  const [groups, setGroups] = useState(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);

  async function load() {
    const { groups } = await api.get("/api/groups");
    setGroups(groups);
  }
  useEffect(() => { load(); }, []);

  async function createGroup(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    try {
      await api.post("/api/groups", { name, description });
      setName("");
      setDescription("");
      load();
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="container" style={{ maxWidth: 640, paddingTop: 28, paddingBottom: 60 }}>
      <form onSubmit={createGroup} className="card" style={{ padding: 16, marginBottom: 20, display: "grid", gap: 10 }}>
        <h2 className="eyebrow">Start a group</h2>
        <input type="text" placeholder="Group name" value={name} onChange={(e) => setName(e.target.value)} />
        <textarea placeholder="What's it about?" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        <button className="btn btn-primary" type="submit" disabled={creating} style={{ justifySelf: "start" }}>
          {creating ? "Creating…" : "Create group"}
        </button>
      </form>

      <h2 className="eyebrow" style={{ marginBottom: 10 }}>Discover groups</h2>
      {groups === null && <p style={{ color: "var(--slate-400)" }}>Loading…</p>}
      {groups?.map((g) => (
        <Link key={g.id} to={`/groups/${g.id}`} className="card" style={{ display: "block", padding: 16, marginBottom: 10 }}>
          <div style={{ fontWeight: 700 }}>{g.name}</div>
          {g.description && <div style={{ color: "var(--slate-400)", fontSize: 13, marginTop: 4 }}>{g.description}</div>}
          <div className="eyebrow" style={{ marginTop: 8, fontSize: 10 }}>{g._count.members} members</div>
        </Link>
      ))}
      {groups?.length === 0 && <p style={{ color: "var(--slate-400)" }}>No public groups yet — start the first one.</p>}
    </div>
  );
}

function GroupDetail() {
  const { id } = useParams();
  const [group, setGroup] = useState(null);
  const [posts, setPosts] = useState([]);
  const [body, setBody] = useState("");

  useEffect(() => {
    (async () => {
      const { group } = await api.get(`/api/groups/${id}`);
      setGroup(group);
      const { posts } = await api.get(`/api/groups/${id}/posts`);
      setPosts(posts);
    })();
  }, [id]);

  async function joinGroup() {
    await api.post(`/api/groups/${id}/join`);
  }

  async function postToGroup(e) {
    e.preventDefault();
    if (!body.trim()) return;
    const formData = new FormData();
    formData.append("body", body);
    formData.append("groupId", id);
    await api.upload("/api/posts", formData);
    setBody("");
    const { posts } = await api.get(`/api/groups/${id}/posts`);
    setPosts(posts);
  }

  if (!group) return <div className="container" style={{ paddingTop: 40 }}>Loading group…</div>;

  return (
    <div className="container" style={{ maxWidth: 640, paddingTop: 28, paddingBottom: 60 }}>
      <div className="card" style={{ padding: 20, marginBottom: 20 }}>
        <h1 className="h-display" style={{ margin: 0, fontSize: 22 }}>{group.name}</h1>
        {group.description && <p style={{ color: "var(--slate-400)", marginTop: 6 }}>{group.description}</p>}
        <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={joinGroup}>Join group</button>
      </div>

      <form onSubmit={postToGroup} className="card" style={{ padding: 16, marginBottom: 20 }}>
        <textarea placeholder={`Post in ${group.name}…`} rows={2} value={body} onChange={(e) => setBody(e.target.value)} />
        <button className="btn btn-primary" type="submit" style={{ marginTop: 8 }}>Post</button>
      </form>

      {posts.map((p) => <PostCard key={p.id} post={p} />)}
    </div>
  );
}

export default function Groups() {
  const { id } = useParams();
  return id ? <GroupDetail /> : <GroupList />;
}
