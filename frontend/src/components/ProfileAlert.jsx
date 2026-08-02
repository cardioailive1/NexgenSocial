import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../AuthContext";

const DISMISS_KEY = "ngs_profile_alert_dismissed_until";

// A banner prompting people to finish setting up. Deliberately dismissible
// and time-limited: a nag that can't be silenced is worse than no nag at
// all, and people who genuinely don't want to fill in a profile shouldn't
// be pestered forever.
export default function ProfileAlert() {
  const { user } = useAuth();
  const [status, setStatus] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!user) return;
    try {
      const until = localStorage.getItem(DISMISS_KEY);
      if (until && Date.now() < Number(until)) { setDismissed(true); return; }
    } catch { /* storage unavailable; just show it */ }

    api.get("/api/suggestions/profile-status")
      .then(setStatus)
      .catch(() => {});
  }, [user]);

  function dismiss() {
    // Snoozed for a week rather than forever -- a half-finished profile is
    // worth mentioning again eventually, just not tomorrow.
    try { localStorage.setItem(DISMISS_KEY, String(Date.now() + 7 * 24 * 3600 * 1000)); } catch {}
    setDismissed(true);
  }

  if (!user || dismissed || !status || status.isComplete || status.missing.length === 0) return null;

  const top = status.missing.slice(0, 3);

  return (
    <div className="card" style={{ padding: 14, marginBottom: 16, borderColor: "rgba(41,211,245,0.35)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
            <span style={{ fontWeight: 600, fontSize: 14 }}>Finish setting up your profile</span>
            <span className="premium-pill">{status.completeness}% complete</span>
          </div>

          {/* Progress bar -- concrete feedback beats a vague prompt. */}
          <div style={{ height: 5, borderRadius: 999, background: "var(--navy-800)", overflow: "hidden", marginBottom: 10 }}>
            <div style={{
              width: `${status.completeness}%`, height: "100%",
              background: "linear-gradient(90deg, var(--cyan-400), var(--cyan-500))",
              transition: "width 0.3s ease",
            }} />
          </div>

          <div style={{ display: "grid", gap: 6 }}>
            {top.map((m) => (
              <Link key={m.key} to={m.action}
                style={{ display: "flex", alignItems: "baseline", gap: 8, fontSize: 12.5, color: "var(--slate-300)" }}>
                <span style={{ color: "var(--cyan-300)" }}>→</span>
                <span>
                  <strong style={{ color: "var(--white)" }}>{m.label}</strong>
                  {m.hint && <span style={{ color: "var(--slate-400)" }}> — {m.hint}</span>}
                </span>
              </Link>
            ))}
          </div>
        </div>

        <button onClick={dismiss} title="Remind me later"
          style={{ color: "var(--slate-400)", fontSize: 17, lineHeight: 1, flexShrink: 0 }}>
          ×
        </button>
      </div>
    </div>
  );
}
