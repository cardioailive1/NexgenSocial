import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";

function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

const AUDIENCE_LABEL = { PUBLIC: "Public", FRIENDS: "Friends", FOLLOWERS: "Followers", CIRCLE: "Circle" };

export default function PostCard({ post, viewerUsername, onChanged }) {
  const [liked, setLiked] = useState(post.likedByViewer);
  const [likeCount, setLikeCount] = useState(post.likeCount);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState(null);
  const [commentText, setCommentText] = useState("");
  const [showWhy, setShowWhy] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState(null);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(post.body || "");
  const [showNotes, setShowNotes] = useState(false);
  const [notes, setNotes] = useState(null);
  const [noteText, setNoteText] = useState("");

  const isOwner = viewerUsername === post.author.username;

  async function toggleLike() {
    setLiked((v) => !v);
    setLikeCount((c) => c + (liked ? -1 : 1));
    try {
      if (liked) await api.delete(`/api/posts/${post.id}/like`);
      else await api.post(`/api/posts/${post.id}/like`);
    } catch {
      setLiked((v) => !v);
      setLikeCount((c) => c + (liked ? 1 : -1));
    }
  }

  async function loadComments() {
    setShowComments((v) => !v);
    if (!comments) {
      const { comments: list } = await api.get(`/api/posts/${post.id}/comments`);
      setComments(list);
    }
  }

  async function submitComment(e) {
    e.preventDefault();
    if (!commentText.trim()) return;
    const { comment } = await api.post(`/api/posts/${post.id}/comments`, { body: commentText });
    setComments((list) => [...(list || []), comment]);
    setCommentText("");
  }

  async function loadHistory() {
    setShowHistory((v) => !v);
    if (!history) {
      const { revisions } = await api.get(`/api/posts/${post.id}/history`);
      setHistory(revisions);
    }
  }

  async function saveEdit() {
    if (!editText.trim()) return;
    await api.patch(`/api/posts/${post.id}`, { body: editText });
    setEditing(false);
    onChanged?.();
  }

  async function loadNotes() {
    setShowNotes((v) => !v);
    if (!notes) {
      const { notes: list } = await api.get(`/api/posts/${post.id}/notes`);
      setNotes(list);
    }
  }

  async function submitNote(e) {
    e.preventDefault();
    if (!noteText.trim()) return;
    const { note } = await api.post(`/api/posts/${post.id}/notes`, { body: noteText });
    setNotes((list) => [...(list || []), { ...note, helpfulCount: 0, notHelpfulCount: 0, viewerVote: null }]);
    setNoteText("");
  }

  async function voteNote(noteId, value) {
    await api.post(`/api/posts/notes/${noteId}/vote`, { value });
    setNotes((list) =>
      list.map((n) => {
        if (n.id !== noteId) return n;
        const prevVote = n.viewerVote;
        let helpfulCount = n.helpfulCount, notHelpfulCount = n.notHelpfulCount;
        if (prevVote === 1) helpfulCount--;
        if (prevVote === -1) notHelpfulCount--;
        if (value === 1) helpfulCount++;
        if (value === -1) notHelpfulCount++;
        return { ...n, helpfulCount, notHelpfulCount, viewerVote: value };
      })
    );
  }

  return (
    <article className="card" style={{ padding: 18, marginBottom: 14 }}>
      <div style={{ display: "flex", gap: 12 }}>
        <Link to={`/u/${post.author.username}`}>
          <img className="avatar" src={post.author.avatarUrl || `https://api.dicebear.com/7.x/identicon/svg?seed=${post.author.username}`} alt="" />
        </Link>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
            <Link to={`/u/${post.author.username}`} style={{ fontWeight: 600, fontSize: 14 }}>{post.author.displayName}</Link>
            <span style={{ color: "var(--slate-400)", fontSize: 12 }}>@{post.author.username} · {timeAgo(post.createdAt)}</span>
            {post.editedAt && <span style={{ color: "var(--slate-400)", fontSize: 11 }}>· edited</span>}
            {post.audience && post.audience !== "PUBLIC" && (
              <span className="premium-pill" style={{ background: "rgba(148,197,226,0.12)", color: "var(--slate-300)", borderColor: "var(--line)" }}>
                {AUDIENCE_LABEL[post.audience]}
              </span>
            )}
            {post.isAiGenerated && <span className="premium-pill">AI-generated{post.aiTool ? `: ${post.aiTool}` : ""}</span>}
          </div>

          {!editing && post.body && <p style={{ margin: "8px 0", fontSize: 15, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{post.body}</p>}
          {editing && (
            <div style={{ marginTop: 8 }}>
              <textarea value={editText} onChange={(e) => setEditText(e.target.value)} rows={3} />
              <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                <button className="btn btn-primary" onClick={saveEdit}>Save edit</button>
                <button className="btn btn-ghost" onClick={() => setEditing(false)}>Cancel</button>
              </div>
            </div>
          )}

          {post.mediaUrl && post.type === "VIDEO" && (
            <video controls style={{ width: "100%", borderRadius: 10, marginTop: 8, border: "1px solid var(--line)" }} src={api.mediaUrl(post.mediaUrl)} />
          )}
          {post.mediaUrl && post.type === "IMAGE" && (
            <img src={api.mediaUrl(post.mediaUrl)} alt="" style={{ width: "100%", borderRadius: 10, marginTop: 8, border: "1px solid var(--line)" }} />
          )}

          <div style={{ display: "flex", gap: 16, marginTop: 12, flexWrap: "wrap" }}>
            <button onClick={toggleLike} style={{ fontSize: 13, color: liked ? "var(--cyan-400)" : "var(--slate-300)", fontWeight: 600 }}>
              ♥ {likeCount}
            </button>
            <button onClick={loadComments} style={{ fontSize: 13, color: "var(--slate-300)", fontWeight: 600 }}>
              💬 {post.commentCount}
            </button>
            <button onClick={loadNotes} style={{ fontSize: 13, color: "var(--slate-300)", fontWeight: 600 }}>
              📝 Context {post.contextNoteCount > 0 ? `(${post.contextNoteCount})` : ""}
            </button>
            {post.feedReason && (
              <button onClick={() => setShowWhy((v) => !v)} style={{ fontSize: 13, color: "var(--slate-400)" }}>
                ⓘ Why am I seeing this?
              </button>
            )}
            {isOwner && post.body && !editing && (
              <button onClick={() => setEditing(true)} style={{ fontSize: 13, color: "var(--slate-400)" }}>Edit</button>
            )}
            {post.editedAt && (
              <button onClick={loadHistory} style={{ fontSize: 13, color: "var(--slate-400)" }}>Edit history</button>
            )}
          </div>

          {showWhy && (
            <div style={{ marginTop: 10, fontSize: 12, color: "var(--slate-300)", background: "var(--navy-950)", border: "1px solid var(--line)", borderRadius: 8, padding: 10 }}>
              <div style={{ marginBottom: 4 }}><strong>{post.feedReason}</strong></div>
              {post.scoreBreakdown && (post.scoreBreakdown.recency !== undefined) && (
                <div style={{ color: "var(--slate-400)" }}>
                  Score contribution — recency: {post.scoreBreakdown.recency}, engagement: {post.scoreBreakdown.engagement}
                  {" "}(based on your feed-tuning settings)
                </div>
              )}
            </div>
          )}

          {showHistory && (
            <div style={{ marginTop: 10, fontSize: 12, background: "var(--navy-950)", border: "1px solid var(--line)", borderRadius: 8, padding: 10 }}>
              <div style={{ color: "var(--slate-400)", marginBottom: 6 }}>Previous versions:</div>
              {(history || []).map((r, i) => (
                <div key={r.id} style={{ marginBottom: 6, color: "var(--slate-300)" }}>
                  <span style={{ color: "var(--slate-400)" }}>v{i + 1} · {timeAgo(r.editedAt)}:</span> {r.body}
                </div>
              ))}
              {history?.length === 0 && <div style={{ color: "var(--slate-400)" }}>No prior versions recorded.</div>}
            </div>
          )}

          {showNotes && (
            <div style={{ marginTop: 10, borderTop: "1px solid var(--line)", paddingTop: 10 }}>
              {(notes || []).map((n) => (
                <div key={n.id} style={{ fontSize: 13, marginBottom: 10, background: "var(--navy-950)", border: "1px solid var(--line)", borderRadius: 8, padding: 10 }}>
                  <div style={{ marginBottom: 4 }}>{n.body}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 11, color: "var(--slate-400)" }}>
                    <span>— {n.author.displayName}</span>
                    <button onClick={() => voteNote(n.id, 1)} style={{ color: n.viewerVote === 1 ? "var(--cyan-400)" : "var(--slate-400)" }}>Helpful ({n.helpfulCount})</button>
                    <button onClick={() => voteNote(n.id, -1)} style={{ color: n.viewerVote === -1 ? "var(--danger)" : "var(--slate-400)" }}>Not helpful ({n.notHelpfulCount})</button>
                  </div>
                </div>
              ))}
              {notes?.length === 0 && <div style={{ fontSize: 12, color: "var(--slate-400)", marginBottom: 8 }}>No context added yet — anyone can add some.</div>}
              <form onSubmit={submitNote} style={{ display: "flex", gap: 8 }}>
                <input type="text" placeholder="Add helpful context…" value={noteText} onChange={(e) => setNoteText(e.target.value)} />
                <button className="btn btn-primary" type="submit">Add</button>
              </form>
            </div>
          )}

          {showComments && (
            <div style={{ marginTop: 12, borderTop: "1px solid var(--line)", paddingTop: 12 }}>
              {(comments || []).map((c) => (
                <div key={c.id} style={{ fontSize: 13, marginBottom: 8 }}>
                  <strong>{c.author.displayName}</strong>{" "}
                  <span style={{ color: "var(--slate-300)" }}>{c.body}</span>
                </div>
              ))}
              <form onSubmit={submitComment} style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <input type="text" placeholder="Write a reply…" value={commentText} onChange={(e) => setCommentText(e.target.value)} />
                <button className="btn btn-primary" type="submit">Reply</button>
              </form>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
