import { useEffect, useState } from "react";
import { api, API_URL } from "../api";
import { useAuth } from "../AuthContext";

export default function Invite() {
  const { user } = useAuth();
  const [invites, setInvites] = useState(null);
  const [lastLink, setLastLink] = useState("");
  const [copied, setCopied] = useState(false);
  const [copyNotice, setCopyNotice] = useState("");
  const [bulkEmails, setBulkEmails] = useState("");
  const [bulkSending, setBulkSending] = useState(false);
  const [bulkNotice, setBulkNotice] = useState("");
  const [bulkError, setBulkError] = useState("");

  async function load() {
    const { invites } = await api.get("/api/social/invites");
    setInvites(invites);
  }
  useEffect(() => { load(); }, []);

  const appUrl = window.location.origin; // where the frontend is actually hosted

  async function createInvite(channel) {
    const { invite } = await api.post("/api/social/invites", { channel, contact: null });
    const link = `${appUrl}/signup?ref=${invite.token}`;
    setLastLink(link);
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

  // Platforms that expose a public web share URL. Instagram, TikTok and
  // Snapchat deliberately don't -- they have no documented web sharing
  // endpoint, so a "Share to Instagram" button would just be a dead link.
  // Those are handled by copy-then-paste below instead of pretending.
  const WEB_SHARE = {
    facebook: (l, t) => `https://www.facebook.com/sharer/sharer.php?u=${l}`,
    x: (l, t) => `https://twitter.com/intent/tweet?text=${t}&url=${l}`,
    whatsapp: (l, t) => `https://wa.me/?text=${t}%20${l}`,
    linkedin: (l) => `https://www.linkedin.com/sharing/share-offsite/?url=${l}`,
    telegram: (l, t) => `https://t.me/share/url?url=${l}&text=${t}`,
    reddit: (l, t) => `https://www.reddit.com/submit?url=${l}&title=${t}`,
    pinterest: (l, t) => `https://pinterest.com/pin/create/button/?url=${l}&description=${t}`,
    sms: (l, t) => `sms:?&body=${t}%20${l}`,
  };

  const COPY_ONLY = ["instagram", "tiktok", "snapchat"];

  async function shareTo(platform) {
    const link = await createInvite("link");
    const encodedLink = encodeURIComponent(link);

    if (COPY_ONLY.includes(platform)) {
      // Copy the message, then tell them exactly where to paste it. Being
      // explicit about the extra step beats a button that silently does
      // nothing useful.
      try {
        await navigator.clipboard.writeText(`Join me on NexgenSocial! ${link}`);
        setCopyNotice(
          `Invite copied. ${platform === "instagram"
            ? "Paste it into an Instagram DM, or into your bio or story link."
            : platform === "tiktok"
              ? "Paste it into a TikTok DM or your profile bio."
              : "Paste it into a Snapchat message."}`
        );
      } catch {
        setCopyNotice(`Couldn't copy automatically. Here's your link: ${link}`);
      }
      return;
    }

    const build = WEB_SHARE[platform];
    if (!build) return;
    window.open(build(encodedLink, shareText), "_blank", "noopener,noreferrer");
  }

  // --- Bulk email -------------------------------------------------------
  // A web page cannot read your address book -- that's a browser security
  // boundary, not a missing feature. Only native mobile apps can request
  // contact access. Pasting a list is the honest equivalent.
  async function sendBulkEmails(e) {
    e.preventDefault();
    setBulkError("");
    setBulkNotice("");

    const addresses = [...new Set(
      bulkEmails
        .split(/[\s,;\n]+/)
        .map((s) => s.trim())
        .filter(Boolean)
    )];

    const valid = addresses.filter((a) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(a));
    const invalid = addresses.filter((a) => !valid.includes(a));

    if (valid.length === 0) {
      setBulkError("No valid email addresses found. Separate them with commas, spaces or new lines.");
      return;
    }

    setBulkSending(true);
    try {
      // One invite record per recipient, so each can be tracked separately.
      const links = [];
      for (const address of valid) {
        const { invite } = await api.post("/api/social/invites", { channel: "email", contact: address });
        links.push(`${appUrl}/signup?ref=${invite.token}`);
      }
      await load();

      // Opens the user's own mail client with everyone on BCC -- recipients
      // don't see each other's addresses, which matters when you're mailing
      // a list of personal contacts.
      const subject = encodeURIComponent("Join me on NexgenSocial");
      const body = encodeURIComponent(
        `Hi,\n\nI'm on NexgenSocial and thought you might like it.\n\n${links[0]}\n\nSee you there!`
      );
      window.location.href = `mailto:?bcc=${encodeURIComponent(valid.join(","))}&subject=${subject}&body=${body}`;

      setBulkNotice(
        `${valid.length} invite${valid.length === 1 ? "" : "s"} created and your email app should be opening with everyone on BCC.` +
        (invalid.length ? ` ${invalid.length} entr${invalid.length === 1 ? "y was" : "ies were"} skipped as invalid.` : "")
      );
      setBulkEmails("");
    } catch (err) {
      setBulkError(err.message);
    } finally {
      setBulkSending(false);
    }
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
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {[
            ["facebook", "Facebook"], ["x", "X"], ["whatsapp", "WhatsApp"],
            ["linkedin", "LinkedIn"], ["telegram", "Telegram"], ["reddit", "Reddit"],
            ["pinterest", "Pinterest"], ["sms", "Text message"],
          ].map(([key, label]) => (
            <button key={key} className="btn btn-ghost" onClick={() => shareTo(key)} style={{ fontSize: 12, padding: "6px 11px" }}>
              {label}
            </button>
          ))}
        </div>

        <div style={{ marginTop: 10 }}>
          <div className="eyebrow" style={{ fontSize: 10, marginBottom: 6 }}>Copy &amp; paste (these apps don't allow direct web sharing)</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {[["instagram", "Instagram"], ["tiktok", "TikTok"], ["snapchat", "Snapchat"]].map(([key, label]) => (
              <button key={key} className="btn btn-ghost" onClick={() => shareTo(key)} style={{ fontSize: 12, padding: "6px 11px" }}>
                📋 {label}
              </button>
            ))}
          </div>
        </div>

        {copyNotice && (
          <div style={{ fontSize: 12, color: "var(--cyan-300)", marginTop: 10, lineHeight: 1.5 }}>{copyNotice}</div>
        )}
      </div>

      <form onSubmit={sendBulkEmails} className="card" style={{ padding: 16, marginBottom: 20, display: "grid", gap: 10 }}>
        <div style={{ fontWeight: 600, fontSize: 14 }}>Invite your contacts by email</div>
        <p style={{ fontSize: 11.5, color: "var(--slate-400)", margin: 0, lineHeight: 1.5 }}>
          Paste as many addresses as you like — separated by commas, spaces or
          new lines. Everyone goes on BCC, so your contacts never see each
          other's addresses.
        </p>
        <textarea
          rows={4}
          placeholder={"ama@example.com, kofi@example.com\nyaw@example.com"}
          value={bulkEmails}
          onChange={(e) => setBulkEmails(e.target.value)}
        />
        {bulkError && <div style={{ color: "var(--danger)", fontSize: 12 }}>{bulkError}</div>}
        {bulkNotice && <div style={{ color: "var(--cyan-300)", fontSize: 12, lineHeight: 1.5 }}>{bulkNotice}</div>}
        <button className="btn btn-primary" type="submit" disabled={bulkSending || !bulkEmails.trim()} style={{ justifySelf: "start" }}>
          {bulkSending ? "Preparing…" : "Create invites & open email"}
        </button>
        <p style={{ fontSize: 11, color: "var(--slate-400)", margin: 0, lineHeight: 1.5 }}>
          This opens your own email app with the message ready to send — we
          don't send mail on your behalf or store your contacts.
        </p>
      </form>

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
