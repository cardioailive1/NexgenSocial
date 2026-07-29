import { useEffect, useState } from "react";
import { api } from "../api";

export default function Circles() {
  const [circles, setCircles] = useState(null);
  const [friends, setFriends] = useState([]);
  const [name, setName] = useState("");
  const [selected, setSelected] = useState([]);

  async function load() {
    const { circles } = await api.get("/api/circles");
    setCircles(circles);
  }

  useEffect(() => {
    load();
    api.get("/api/friends").then(({ friends }) => setFriends(friends)).catch(() => {});
  }, []);

  function toggleSelected(username) {
    setSelected((s) => (s.includes(username) ? s.filter((u) => u !== username) : [...s, username]));
  }

  async function createCircle(e) {
    e.preventDefault();
    if (!name.trim()) return;
    await api.post("/api/circles", { name, memberUsernames: selected });
    setName("");
    setSelected([]);
    load();
  }

  async function removeCircle(id) {
    await api.delete(`/api/circles/${id}`);
    load();
  }

  return (
    <div className="container" style={{ maxWidth: 640, paddingTop: 28, paddingBottom: 60 }}>
      <h1 className="h-display" style={{ fontSize: 22, marginBottom: 4 }}>Circles</h1>
      <p style={{ color: "var(--slate-400)", fontSize: 14, marginBottom: 20 }}>
        A circle is a custom audience for a single post — narrower than "friends"
        or "followers." Pick one when posting to share with, say, just your
        family or just your coworkers.
      </p>

      <form onSubmit={createCircle} className="card" style={{ padding: 16, marginBottom: 20, display: "grid", gap: 10 }}>
        <input type="text" placeholder="Circle name (e.g. Family)" value={name} onChange={(e) => setName(e.target.value)} />
        {friends.length > 0 && (
          <div>
            <div style={{ fontSize: 12, color: "var(--slate-400)", marginBottom: 6 }}>Add friends to this circle:</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {friends.map((f) => (
                <button
                  type="button"
                  key={f.id}
                  onClick={() => toggleSelected(f.username)}
                  className="btn"
                  style={{
                    fontSize: 12, padding: "6px 10px",
                    background: selected.includes(f.username) ? "var(--cyan-400)" : "var(--navy-800)",
                    color: selected.includes(f.username) ? "var(--navy-950)" : "var(--slate-300)",
                    border: "1px solid var(--line)",
                  }}
                >
                  {f.displayName}
                </button>
              ))}
            </div>
          </div>
        )}
        <button className="btn btn-primary" type="submit" style={{ justifySelf: "start" }}>Create circle</button>
      </form>

      {circles === null && <p style={{ color: "var(--slate-400)" }}>Loading…</p>}
      {circles?.length === 0 && <p style={{ color: "var(--slate-400)" }}>No circles yet.</p>}
      {circles?.map((c) => (
        <div key={c.id} className="card" style={{ padding: 16, marginBottom: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontWeight: 700 }}>{c.name}</div>
            <button className="btn btn-ghost btn-danger" onClick={() => removeCircle(c.id)} style={{ fontSize: 11, padding: "6px 10px" }}>Delete</button>
          </div>
          <div style={{ fontSize: 12, color: "var(--slate-400)", marginTop: 6 }}>
            {c.members.length === 0 ? "No members yet" : c.members.map((m) => m.user.displayName).join(", ")}
          </div>
        </div>
      ))}
    </div>
  );
}
