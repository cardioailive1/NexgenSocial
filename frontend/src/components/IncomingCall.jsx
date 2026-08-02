import { useEffect, useRef, useState } from "react";
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
  // Browsers create AudioContexts in a "suspended" state and only allow
  // sound after the user has interacted with the page. The previous
  // version built a context on demand when a call arrived -- by which
  // point there may have been no interaction, so it stayed suspended and
  // the ring was silent (confirmed: audio state was "suspended").
  //
  // Fix: create the context once, up front, and resume it on the first
  // click/keypress/touch anywhere in the app. By the time a call arrives
  // it's already unblocked.
  const audioCtxRef = useRef(null);

  useEffect(() => {
    function unlock() {
      try {
        if (!audioCtxRef.current) {
          audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioCtxRef.current.state === "suspended") {
          audioCtxRef.current.resume();
        }
      } catch { /* audio unavailable; the visual banner still works */ }
    }

    // `once` isn't used because a resume can fail on the very first
    // gesture in some browsers; listening until it actually succeeds is
    // more reliable.
    const events = ["click", "keydown", "touchstart"];
    events.forEach((e) => window.addEventListener(e, unlock));
    unlock(); // harmless if it's still blocked; succeeds if already allowed
    return () => events.forEach((e) => window.removeEventListener(e, unlock));
  }, []);

  useEffect(() => {
    if (!call) return;
    let stopped = false;

    function ring() {
      if (stopped) return;
      const ctx = audioCtxRef.current;
      if (!ctx) return;
      // Still suspended means the person hasn't interacted with the page
      // yet. Try once more rather than giving up silently.
      if (ctx.state === "suspended") {
        ctx.resume().catch(() => {});
        return;
      }
      try {
        [0, 0.4].forEach((offset) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.frequency.value = offset === 0 ? 480 : 620;
          gain.gain.setValueAtTime(0.0001, ctx.currentTime + offset);
          gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + offset + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + offset + 0.35);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(ctx.currentTime + offset);
          osc.stop(ctx.currentTime + offset + 0.36);
        });
      } catch { /* the banner still shows */ }
    }

    ring();
    const t = setInterval(ring, 2500);

    // Also flash the tab title, which is visible even when the tab is in
    // the background and doesn't depend on audio being unblocked at all.
    const originalTitle = document.title;
    let flip = false;
    const titleTimer = setInterval(() => {
      flip = !flip;
      document.title = flip ? `📞 ${call.caller.displayName} is calling…` : originalTitle;
    }, 1000);

    return () => {
      stopped = true;
      clearInterval(t);
      clearInterval(titleTimer);
      document.title = originalTitle;
    };
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
