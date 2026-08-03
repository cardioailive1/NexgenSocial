import { useEffect, useState } from "react";
import { api } from "../api";
import PostCard from "../components/PostCard";
import { useAuth } from "../AuthContext";
import { MediaPicker } from "../components/MediaAttach";

export default function Celebrity() {
  const { user } = useAuth();
  const [posts, setPosts] = useState(null);
  const [body, setBody] = useState("");
  const [files, setFiles] = useState([]);

  async function load() {
    const { posts } = await api.get("/api/posts/explore?category=CELEBRITY");
    setPosts(posts);
  }
  useEffect(() => { load(); }, []);

  async function submitPost(e) {
    e.preventDefault();
    if (!body.trim() && files.length === 0) return;
    const formData = new FormData();
    formData.append("body", body);
    formData.append("category", "CELEBRITY");
    formData.append("audience", "PUBLIC");
    files.forEach((f) => formData.append("media", f));
    await api.upload("/api/posts", formData);
    setBody("");
    setFiles([]);
    load();
  }

  return (
    <div className="container" style={{ maxWidth: 640, paddingTop: 28, paddingBottom: 60 }}>
      <h1 className="h-display" style={{ fontSize: 22, marginBottom: 4 }}>Celebrity</h1>
      <p style={{ color: "var(--slate-400)", fontSize: 14, marginBottom: 16 }}>
        Community-posted celebrity talk, public and searchable. There's no
        licensed data feed here — real celebrity/entertainment wire content
        needs a paid data provider (e.g. a licensing deal with a wire
        service); this tab is what the community itself posts.
      </p>

      <form onSubmit={submitPost} className="card" style={{ padding: 14, marginBottom: 16 }}>
        <textarea placeholder="Share something…" rows={2} value={body} onChange={(e) => setBody(e.target.value)} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
          <MediaPicker files={files} onChange={setFiles} max={10} />
          <button className="btn btn-primary" type="submit">Post</button>
        </div>
      </form>

      {posts === null && <p style={{ color: "var(--slate-400)" }}>Loading…</p>}
      {posts?.length === 0 && <div className="card" style={{ padding: 24, textAlign: "center", color: "var(--slate-400)" }}>No posts yet — be the first.</div>}
      {posts?.map((p) => <PostCard key={p.id} post={p} viewerUsername={user?.username} onChanged={load} />)}
    </div>
  );
}
