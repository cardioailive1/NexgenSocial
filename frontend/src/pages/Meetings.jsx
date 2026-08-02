import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";

export default function Meetings() {
  const navigate = useNavigate();
  const [meetings, setMeetings] = useState(null);
  const [friends, setFriends] = useState([]);
  const [groups, setGroups] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);

  const [form, setForm] = useState({
    title: "", description: "", scheduledFor: "",
    waitingRoomEnabled: true, muteOnEntry: true,
    allowParticipantScreenShare: true, allowChat: true,
  });
  const [inviteUserIds, setInviteUserIds] = useState([]);
  const [inviteGroupIds, setInviteGroupIds] = useState([]);

  async function load() {
    setError("");
    try {
      const { meetings } = await api.get("/api/meetings");
      setMeetings(meetings);
    } catch (err) { setError(err.message); }
  }

  useEffect(() => {
    load();
    api.get("/api/friends").then(({ friends }) => setFriends(friends)).catch(() => {});
    api.get("/api/groups/mine").then(({ groups }) => setGroups(groups)).catch(() => {});
  }, []);

  function toggle(list, setList, id) {
    setList(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  }

  async function create(e) {
    e.preventDefault();
    if (!form.title.trim()) { setError("Give the meeting a title."); return; }
    setCreating(true);
    setError("");
    try {
      const { meeting } = await api.post("/api/meetings", { ...form, inviteUserIds, inviteGroupIds });
      setShowForm(false);
      setForm({ title: "", description: "", scheduledFor: "", waitingRoomEnabled: true, muteOnEntry: true, allowParticipantScreenShare: true, allowChat: true });
      setInviteUserIds([]);
      setInviteGroupIds([]);
      await load();
      navigate(`/meet/${meeting.id}`);
    } catch (err) { setError(err.message); }
    finally { setCreating(false); }
  }

  async function joinByCode(e) {
    e.preventDefault();
    setError("");
    try {
      const { meeting } = await api.get(`/api/meetings/by-code/${joinCode.trim().toUpperCase()}`);
      navigate(`/meet/${meeting.id}`);
    } catch (err) { setError(err.message); }
  }

  return (
    <div className="container" style={{ maxWidth: 720, paddingTop: 28, paddingBottom: 60 }}>
      <h1 className="h-display" style={{ fontSize: 22, marginBottom: 4 }}>NexgenMeet</h1>
      <p style={{ color: "var(--slate-400)", fontSize: 14, marginBottom: 20 }}>
        Video meetings with waiting rooms, host controls, chat and recording.
      </p>

      {error && <div className="card" style={{ padding: 12, color: "var(--danger)", fontSize: 13, marginBottom: 12 }}>{error}</div>}

      <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
        <button className="btn btn-primary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Cancel" : "+ New meeting"}
        </button>
        <form onSubmit={joinByCode} style={{ display: "flex", gap: 8, flex: 1, minWidth: 220 }}>
          <input type="text" placeholder="Enter a meeting code" value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)} style={{ textTransform: "uppercase" }} />
          <button className="btn btn-ghost" type="submit" disabled={!joinCode.trim()}>Join</button>
        </form>
      </div>

      {showForm && (
        <form onSubmit={create} className="card" style={{ padding: 16, marginBottom: 20, display: "grid", gap: 12 }}>
          <input type="text" placeholder="Meeting title" value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <textarea rows={2} placeholder="What's it about? (optional)" value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <label style={{ fontSize: 12, color: "var(--slate-300)" }}>
            Scheduled for (optional — leave blank to start now)
            <input type="datetime-local" value={form.scheduledFor}
              onChange={(e) => setForm({ ...form, scheduledFor: e.target.value })} style={{ marginTop: 4 }} />
          </label>

          <div>
            <div className="eyebrow" style={{ fontSize: 10, marginBottom: 8 }}>Host controls</div>
            {[
              ["waitingRoomEnabled", "Waiting room — people wait until you admit them"],
              ["muteOnEntry", "Mute participants when they join"],
              ["allowParticipantScreenShare", "Let participants share their screen"],
              ["allowChat", "Enable in-meeting chat"],
            ].map(([key, label]) => (
              <label key={key} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--slate-300)", marginBottom: 6 }}>
                <input type="checkbox" checked={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.checked })} />
                {label}
              </label>
            ))}
          </div>

          {friends.length > 0 && (
            <div>
              <div className="eyebrow" style={{ fontSize: 10, marginBottom: 6 }}>Invite friends</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {friends.map((f) => (
                  <button type="button" key={f.id} onClick={() => toggle(inviteUserIds, setInviteUserIds, f.id)} className="btn"
                    style={{ fontSize: 11, padding: "5px 9px", background: inviteUserIds.includes(f.id) ? "var(--cyan-400)" : "var(--navy-800)", color: inviteUserIds.includes(f.id) ? "var(--navy-950)" : "var(--slate-300)", border: "1px solid var(--line)" }}>
                    {f.displayName}
                  </button>
                ))}
              </div>
            </div>
          )}

          {groups.length > 0 && (
            <div>
              <div className="eyebrow" style={{ fontSize: 10, marginBottom: 6 }}>Invite groups</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {groups.map((g) => (
                  <button type="button" key={g.id} onClick={() => toggle(inviteGroupIds, setInviteGroupIds, g.id)} className="btn"
                    style={{ fontSize: 11, padding: "5px 9px", background: inviteGroupIds.includes(g.id) ? "var(--cyan-400)" : "var(--navy-800)", color: inviteGroupIds.includes(g.id) ? "var(--navy-950)" : "var(--slate-300)", border: "1px solid var(--line)" }}>
                    {g.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <button className="btn btn-primary" type="submit" disabled={creating} style={{ justifySelf: "start" }}>
            {creating ? "Creating…" : "Create & open meeting"}
          </button>
        </form>
      )}

      <h2 className="eyebrow" style={{ marginBottom: 10 }}>Your meetings</h2>
      {meetings === null && <p style={{ color: "var(--slate-400)", fontSize: 13 }}>Loading…</p>}
      {meetings?.length === 0 && (
        <div className="card" style={{ padding: 24, textAlign: "center", color: "var(--slate-400)", fontSize: 13 }}>
          No meetings yet. Create one, or join with a code.
        </div>
      )}
      {meetings?.map((m) => (
        <div key={m.id} className="card" style={{ padding: 14, marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontWeight: 600, fontSize: 14 }}>{m.title}</span>
              {m.status === "LIVE" && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "var(--danger)", fontSize: 10, fontWeight: 700 }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--danger)" }} /> LIVE
                </span>
              )}
              {m.isHost && <span className="premium-pill">Host</span>}
            </div>
            <div style={{ fontSize: 11, color: "var(--slate-400)", marginTop: 3 }}>
              Code <strong style={{ color: "var(--cyan-300)", fontFamily: "var(--font-mono)" }}>{m.code}</strong>
              {" · "}{m.participantCount} participant{m.participantCount === 1 ? "" : "s"}
              {m.scheduledFor ? ` · ${new Date(m.scheduledFor).toLocaleString()}` : ""}
            </div>
          </div>
          <button className="btn btn-primary" onClick={() => navigate(`/meet/${m.id}`)} style={{ fontSize: 12, padding: "7px 12px" }}>
            {m.status === "LIVE" ? "Join" : "Open"}
          </button>
        </div>
      ))}
    </div>
  );
}
