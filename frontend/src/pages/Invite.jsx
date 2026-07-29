import { useEffect, useState } from "react";
import { api, API_URL } from "../api";
import { useAuth } from "../AuthContext";

export default function Invite() {
  const { user } = useAuth();
  const [invites, setInvites] = useState(null);
  const [contact, setContact] = useState("");
  const [lastLink, setLastLink] = useState("");
  const [copied, setCopied] = useState(false);

  async function load() {
    const { invites } = await api.get("/api/social/invites");
    setInvites(invites);
  }
  useEffect(() => { load(); }, []);

  const appUrl = window.location.origin; // where the frontend is actually hosted

  async function createInvite(channel) {
    const { invite } = await api.post("/api/social/invites", { channel, contact: contact || null });
    const link = `${appUrl}/signup?ref=${invite.token}`;
    setLastLink(link);
    setContact("");
    load();
    return link;
  }

  async function copyLink() {
    const link = await createInvite("link");
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const shareText = encodeURIComponent(`Join me on NexgenSocial — ${user?.displayName || "a friend"} sent this invite:`);

  async function shareTo(platform) {
    const link = await createInvite("link");
    const encodedLink = encodeURIComponent(link);
    const urls = {
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedLink}`,
      x: `https://twitter.com/intent/tweet?text=${shareText}&url=${encodedLink}`,
      whatsapp: `https://wa.me/?text=${shareText}%20${encodedLink}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedLink}`,
    };
    window.open(urls[platform], "_blank", "noopener,noreferrer");
  }

  async function shareEmail() {
    const link = await createInvite("email", contact);
    window.location.href = `mailto:${contact}?subject=${encodeURIComponent("Join me on NexgenSocial")}&body=${shareText}%20${encodeURIComponent(link)}`;
  }

  return (
    <div className="container" style={{ maxWidth: 640, paddingTop: 28, paddingBottom: 60 }}>
      <h1 className="h-display" style={{ fontSize: 22, marginBottom: 4 }}>Invite friends</h1>
      <p style={{ color: "var(--slate-400)", fontSize: 14, marginBottom: 20 }}>
        Platforms don't let apps read your friends list anymore — sharing a link
        is the part that actually works. Whoever signs up through your link is
        auto-added as a friend.
      </p>

      <div className="card" style={{ padding: 16, marginBottom: 16 }}>
        <button className="btn btn-primary" onClick={copyLink} style={{ width: "100%", marginBottom: 12 }}>
          {copied ? "Copied!" : "Copy my invite link"}
        </button>
        {lastLink && (
          <div style={{ fontSize: 12, color: "var(--slate-400)", wordBreak: "break-all", marginBottom: 12 }}>{lastLink}</div>
        )}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn btn-ghost" onClick={() => shareTo("facebook")}>Share to Facebook</button>
          <button className="btn btn-ghost" onClick={() => shareTo("x")}>Share to X</button>
          <button className="btn btn-ghost" onClick={() => shareTo("whatsapp")}>Share to WhatsApp</button>
          <button className="btn btn-ghost" onClick={() => shareTo("linkedin")}>Share to LinkedIn</button>
        </div>
      </div>

      <div className="card" style={{ padding: 16, marginBottom: 20 }}>
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8 }}>Invite by email</div>
        <div style={{ display: "flex", gap: 8 }}>
          <input type="text" placeholder="friend@example.com" value={contact} onChange={(e) => setContact(e.target.value)} />
          <button className="btn btn-primary" onClick={shareEmail} disabled={!contact}>Send</button>
        </div>
      </div>

      <h2 className="eyebrow" style={{ marginBottom: 10 }}>Sent invites</h2>
      {invites?.length === 0 && <p style={{ color: "var(--slate-400)" }}>No invites sent yet.</p>}
      {invites?.map((inv) => (
        <div key={inv.id} className="card" style={{ padding: 14, marginBottom: 8, display: "flex", justifyContent: "space-between", fontSize: 13 }}>
          <span style={{ color: "var(--slate-300)" }}>{inv.contact || `via ${inv.channel}`}</span>
          <span style={{ color: inv.status === "ACCEPTED" ? "var(--cyan-400)" : "var(--slate-400)" }}>
            {inv.status === "ACCEPTED" ? "Joined" : "Pending"}
          </span>
        </div>
      ))}

      <p style={{ fontSize: 11, color: "var(--slate-400)", marginTop: 20 }}>
        Backend URL in use: <code>{API_URL}</code>
      </p>
    </div>
  );
}
