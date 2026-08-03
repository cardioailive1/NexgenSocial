import { useEffect, useState } from "react";
import { enablePush, pushSupported, pushPermission } from "../push";
import { useAuth } from "../AuthContext";
import { api } from "../api";

const DISMISS_KEY = "ngs_push_prompt_dismissed_until";

// Offers to turn on notifications so calls arrive without the site open.
// Deliberately explicit about the limit -- promising "calls anywhere" and
// then failing when the browser is closed would be worse than saying so.
export default function PushPrompt() {
  const { user } = useAuth();
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!user || !pushSupported()) return;
    if (pushPermission() === "granted") return;

    try {
      const until = localStorage.getItem(DISMISS_KEY);
      if (until && Date.now() < Number(until)) return;
    } catch { /* storage unavailable */ }

    // Only prompt if the server can actually deliver -- an offer that
    // can't work is worse than no offer.
    api.get("/api/push/vapid-key")
      .then(({ configured }) => { if (configured) setVisible(true); })
      .catch(() => {});
  }, [user]);

  function dismiss() {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now() + 14 * 24 * 3600 * 1000)); } catch {}
    setVisible(false);
  }

  async function turnOn() {
    setBusy(true);
    setMessage("");
    const res = await enablePush();
    setBusy(false);
    if (res.ok) {
      setMessage("Notifications are on.");
      setTimeout(() => setVisible(false), 1500);
    } else {
      setMessage(res.reason);
    }
  }

  if (!visible) return null;

  return (
    <div className="card" style={{ padding: 14, marginBottom: 16, borderColor: "rgba(41,211,245,0.35)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>
            🔔 Get calls even when this tab is closed
          </div>
          <p style={{ fontSize: 12.5, color: "var(--slate-300)", margin: "0 0 10px", lineHeight: 1.55 }}>
            Turn on notifications and incoming calls and messages will reach you
            without NexgenSocial open on screen.{" "}
            <span style={{ color: "var(--slate-400)" }}>
              Your browser still needs to be running — minimised or in another
              tab is fine, but not fully quit.
            </span>
          </p>
          {message && <div style={{ fontSize: 12, color: "var(--cyan-300)", marginBottom: 8 }}>{message}</div>}
          <button className="btn btn-primary" onClick={turnOn} disabled={busy} style={{ fontSize: 12 }}>
            {busy ? "Enabling…" : "Turn on notifications"}
          </button>
        </div>
        <button onClick={dismiss} style={{ color: "var(--slate-400)", fontSize: 17, lineHeight: 1 }}>×</button>
      </div>
    </div>
  );
}
