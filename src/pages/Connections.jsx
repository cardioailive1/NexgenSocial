import { useEffect, useState } from "react";
import { api } from "../api";

const PROVIDERS = [
  { key: "FACEBOOK", label: "Facebook", color: "#1877F2" },
  { key: "INSTAGRAM", label: "Instagram", color: "#E1306C" },
  { key: "X", label: "X (Twitter)", color: "#E7E9EA" },
  { key: "LINKEDIN", label: "LinkedIn", color: "#0A66C2" },
  { key: "TIKTOK", label: "TikTok", color: "#69C9D0" },
  { key: "GOOGLE", label: "Google", color: "#EA4335" },
];

export default function Connections() {
  const [accounts, setAccounts] = useState(null);
  const [busyProvider, setBusyProvider] = useState(null);

  async function load() {
    const { accounts } = await api.get("/api/social/accounts");
    setAccounts(accounts);
  }
  useEffect(() => { load(); }, []);

  const connectedMap = Object.fromEntries((accounts || []).map((a) => [a.provider, a]));

  async function connect(provider) {
    // In production this button redirects to the provider's OAuth consent
    // screen instead of calling this endpoint directly -- see the note in
    // backend/src/routes/social.js. For now it links the account immediately
    // so the rest of the UI (badges, disconnect, etc.) is fully working.
    setBusyProvider(provider);
    try {
      await api.post(`/api/social/accounts/${provider.toLowerCase()}/connect`, {
        displayName: `demo-${provider.toLowerCase()}-account`,
      });
      await load();
    } finally {
      setBusyProvider(null);
    }
  }

  async function disconnect(provider) {
    setBusyProvider(provider);
    try {
      await api.delete(`/api/social/accounts/${provider.toLowerCase()}`);
      await load();
    } finally {
      setBusyProvider(null);
    }
  }

  return (
    <div className="container" style={{ maxWidth: 640, paddingTop: 28, paddingBottom: 60 }}>
      <h1 className="h-display" style={{ fontSize: 22, marginBottom: 4 }}>Linked accounts</h1>
      <p style={{ color: "var(--slate-400)", fontSize: 14, marginBottom: 20 }}>
        Connect other platforms to cross-post and let people recognize you. Real
        OAuth needs API credentials from each platform — until those are added,
        connecting here creates a placeholder link so you can see how it flows.
      </p>

      {accounts === null && <p style={{ color: "var(--slate-400)" }}>Loading…</p>}

      {accounts && PROVIDERS.map((p) => {
        const connected = connectedMap[p.key];
        return (
          <div key={p.key} className="card" style={{ padding: 16, marginBottom: 10, display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: p.color, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, color: "#0a0a0a", fontSize: 15, flexShrink: 0 }}>
              {p.label[0]}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{p.label}</div>
              <div style={{ fontSize: 12, color: "var(--slate-400)" }}>
                {connected ? `Connected as ${connected.displayName}` : "Not connected"}
              </div>
            </div>
            {connected ? (
              <button className="btn btn-ghost btn-danger" disabled={busyProvider === p.key} onClick={() => disconnect(p.key)}>
                {busyProvider === p.key ? "…" : "Disconnect"}
              </button>
            ) : (
              <button className="btn btn-primary" disabled={busyProvider === p.key} onClick={() => connect(p.key)}>
                {busyProvider === p.key ? "…" : "Connect"}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
