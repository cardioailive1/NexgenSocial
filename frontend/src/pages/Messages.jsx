import { useEffect, useRef, useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../AuthContext";
import { MediaPicker, MediaGallery } from "../components/MediaAttach";

export default function Messages() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [conversations, setConversations] = useState(null);
  const [activeId, setActiveId] = useState(null);
  const [activeOther, setActiveOther] = useState(null);
  const [messages, setMessages] = useState([]);
  const [body, setBody] = useState("");
  const [files, setFiles] = useState([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef(null);

  const withUser = searchParams.get("with");

  async function loadConversations() {
    try {
      const { conversations } = await api.get("/api/messages");
      setConversations(conversations);
      return conversations;
    } catch (err) {
      setError(err.message);
      return [];
    }
  }

  async function openConversation(id, other) {
    setActiveId(id);
    setActiveOther(other);
    setError("");
    try {
      const { messages } = await api.get(`/api/messages/${id}/messages`);
      setMessages(messages);
      // Opening marks read, so refresh the list to clear the badge.
      loadConversations();
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    (async () => {
      const list = await loadConversations();
      // Arriving from a profile with ?with=username opens (or starts) that
      // thread straight away, rather than making them hunt for it.
      if (withUser) {
        try {
          const { conversation } = await api.post(`/api/messages/with/${encodeURIComponent(withUser)}`);
          await loadConversations();
          openConversation(conversation.id, conversation.otherUser);
          setSearchParams({});
        } catch (err) {
          setError(err.message);
        }
      } else if (list.length > 0) {
        openConversation(list[0].id, list[0].otherUser);
      }
    })();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Light polling so a reply appears without a manual refresh. A WebSocket
  // would be lower-latency, but this avoids holding a socket open per user
  // on a single small instance.
  useEffect(() => {
    if (!activeId) return;
    const t = setInterval(async () => {
      try {
        const { messages } = await api.get(`/api/messages/${activeId}/messages`);
        setMessages((prev) => (messages.length !== prev.length ? messages : prev));
      } catch { /* transient failures are not worth surfacing */ }
    }, 5000);
    return () => clearInterval(t);
  }, [activeId]);

  async function send(e) {
    e.preventDefault();
    if (!body.trim() && files.length === 0) return;
    setSending(true);
    setError("");
    try {
      const fd = new FormData();
      if (body.trim()) fd.append("body", body);
      files.forEach((f) => fd.append("media", f));
      const { message } = await api.upload(`/api/messages/${activeId}/messages`, fd);
      setMessages((m) => [...m, message]);
      setBody("");
      setFiles([]);
      loadConversations();
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  async function startCall(kind) {
    if (!activeOther) return;
    try {
      const { call } = await api.post("/api/messages/calls", { username: activeOther.username, kind });
      navigate(`/call/${call.id}`);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="container" style={{ maxWidth: 900, paddingTop: 28, paddingBottom: 60 }}>
      <h1 className="h-display" style={{ fontSize: 22, marginBottom: 16 }}>Messages</h1>

      {error && <div className="card" style={{ padding: 12, color: "var(--danger)", fontSize: 13, marginBottom: 12 }}>{error}</div>}

      <div style={{ display: "flex", gap: 14, alignItems: "flex-start", flexWrap: "wrap" }}>
        {/* Conversation list */}
        <div style={{ flex: "1 1 240px", minWidth: 220, maxWidth: 300 }}>
          {conversations === null && <p style={{ color: "var(--slate-400)", fontSize: 13 }}>Loading…</p>}
          {conversations?.length === 0 && (
            <div className="card" style={{ padding: 16, fontSize: 13, color: "var(--slate-400)" }}>
              No conversations yet. Open someone's profile from{" "}
              <Link to="/people" style={{ color: "var(--cyan-300)" }}>People</Link> and hit Message.
            </div>
          )}
          {conversations?.map((c) => (
            <button key={c.id} onClick={() => openConversation(c.id, c.otherUser)}
              className="card"
              style={{
                display: "flex", alignItems: "center", gap: 10, padding: 12, marginBottom: 8, width: "100%",
                textAlign: "left", borderColor: activeId === c.id ? "var(--cyan-400)" : "var(--line)",
              }}>
              <img className="avatar" style={{ width: 34, height: 34 }}
                src={api.mediaUrl(c.otherUser?.avatarUrl) || `https://api.dicebear.com/7.x/identicon/svg?seed=${c.otherUser?.username}`} alt="" />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{c.otherUser?.displayName || "Conversation"}</div>
                <div style={{ fontSize: 11, color: "var(--slate-400)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {c.lastMessage?.body || (c.lastMessage ? "Sent an attachment" : "No messages yet")}
                </div>
              </div>
              {c.unreadCount > 0 && (
                <span style={{ background: "var(--cyan-400)", color: "var(--navy-950)", borderRadius: 999, fontSize: 10, fontWeight: 700, padding: "2px 7px" }}>
                  {c.unreadCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Thread */}
        <div style={{ flex: "2 1 380px", minWidth: 280 }}>
          {!activeId && (
            <div className="card" style={{ padding: 24, textAlign: "center", color: "var(--slate-400)", fontSize: 13 }}>
              Pick a conversation to read it.
            </div>
          )}

          {activeId && (
            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
              <div style={{ padding: 12, borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 10 }}>
                <img className="avatar" style={{ width: 32, height: 32 }}
                  src={api.mediaUrl(activeOther?.avatarUrl) || `https://api.dicebear.com/7.x/identicon/svg?seed=${activeOther?.username}`} alt="" />
                <div style={{ flex: 1 }}>
                  <Link to={`/u/${activeOther?.username}`} style={{ fontWeight: 600, fontSize: 14 }}>{activeOther?.displayName}</Link>
                  <div style={{ fontSize: 11, color: "var(--slate-400)" }}>@{activeOther?.username}</div>
                </div>
                <button className="btn btn-ghost" onClick={() => startCall("AUDIO")} style={{ fontSize: 12, padding: "6px 10px" }}>📞 Call</button>
                <button className="btn btn-ghost" onClick={() => startCall("VIDEO")} style={{ fontSize: 12, padding: "6px 10px" }}>🎥 Video</button>
              </div>

              <div style={{ maxHeight: 420, overflowY: "auto", padding: 14 }}>
                {messages.length === 0 && (
                  <p style={{ color: "var(--slate-400)", fontSize: 13, textAlign: "center" }}>No messages yet — say hello.</p>
                )}
                {messages.map((m) => {
                  const mine = m.sender.username === user?.username;
                  return (
                    <div key={m.id} style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start", marginBottom: 10 }}>
                      <div style={{
                        maxWidth: "78%", padding: "9px 12px", borderRadius: 12,
                        background: mine ? "var(--cyan-500)" : "var(--navy-800)",
                        color: mine ? "var(--navy-950)" : "var(--white)",
                        border: mine ? "none" : "1px solid var(--line)",
                      }}>
                        {m.body && <div style={{ fontSize: 13.5, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{m.body}</div>}
                        {m.attachments?.length > 0 && <MediaGallery media={m.attachments} compact />}
                        <div style={{ fontSize: 10, opacity: 0.7, marginTop: 4 }}>
                          {new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>

              <form onSubmit={send} style={{ padding: 12, borderTop: "1px solid var(--line)", display: "grid", gap: 8 }}>
                <textarea rows={2} placeholder="Write a message…" value={body} onChange={(e) => setBody(e.target.value)} />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <MediaPicker files={files} onChange={setFiles} max={10} label="📎 Attach" />
                  <button className="btn btn-primary" type="submit" disabled={sending}>
                    {sending ? "Sending…" : "Send"}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
