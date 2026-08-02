import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../AuthContext";

// Polls for a ringing call and shows a banner anywhere in the app. Polling
// rather than a WebSocket push keeps this to one lightweight request every
// few seconds instead of an open socket per signed-in user.
export default function IncomingCall() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [call, setCall] = useState(null);

  useEffect(() => {
    if (!user) return;
    // Don't ring while you're already inside a call screen.
    if (location.pathname.startsWith("/call/")) return;

    let cancelled = false;

    async function check() {
      try {
        const { call } = await api.get("/api/messages/calls/incoming");
        if (!cancelled) setCall(call);
      } catch { /* ignore transient failures */ }
    }

    // Check immediately as well as on the interval. setInterval alone means
    // a dead zone of one full interval before the first check, during which
    // a call can start and finish unseen.
    check();
    const t = setInterval(check, 3000);
    return () => { cancelled = true; clearInterval(t); };
  }, [user, location.pathname]);

  // A visual-only banner is easy to miss on another tab. Generate a short
  // two-tone ring with the Web Audio API rather than shipping an audio
  // file -- no asset, no autoplay-policy issue once the user has
  // interacted with the page.
  useEffect(() => {
    if (!call) return;
    let ctx;
    let stopped = false;

    function ring() {
      if (stopped) return;
      try {
        ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
        [0, 0.4].forEach((offset) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.frequency.value = offset === 0 ? 480 : 620;
          gain.gain.setValueAtTime(0.0001, ctx.currentTime + offset);
          gain.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + offset + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + offset + 0.35);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(ctx.currentTime + offset);
          osc.stop(ctx.currentTime + offset + 0.36);
        });
      } catch { /* audio blocked; the banner still shows */ }
    }

    ring();
    const t = setInterval(ring, 2500);
    return () => { stopped = true; clearInterval(t); ctx?.close?.(); };
  }, [call]);

  if (!call) return null;

  async function accept() {
    await api.patch(`/api/messages/calls/${call.id}`, { status: "ACTIVE" }).catch(() => {});
    setCall(null);
    navigate(`/call/${call.id}`);
  }

  async function decline() {
    await api.patch(`/api/messages/calls/${call.id}`, { status: "DECLINED" }).catch(() => {});
    setCall(null);
  }

  return (
    <div className="card" style={{
      position: "fixed", bottom: 20, right: 20, zIndex: 100, padding: 14,
      display: "flex", alignItems: "center", gap: 12, borderColor: "var(--cyan-400)",
      boxShadow: "0 8px 30px rgba(0,0,0,0.5)", maxWidth: 320,
    }}>
      <img className="avatar" style={{ width: 40, height: 40 }}
        src={api.mediaUrl(call.caller.avatarUrl) || `https://api.dicebear.com/7.x/identicon/svg?seed=${call.caller.username}`} alt="" />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 13 }}>{call.caller.displayName}</div>
        <div style={{ fontSize: 11, color: "var(--cyan-300)" }}>
          Incoming {call.kind === "VIDEO" ? "video" : "voice"} call…
        </div>
      </div>
      <button className="btn btn-primary" onClick={accept} style={{ fontSize: 11, padding: "6px 10px" }}>Accept</button>
      <button className="btn btn-ghost btn-danger" onClick={decline} style={{ fontSize: 11, padding: "6px 10px" }}>Decline</button>
    </div>
  );
}
