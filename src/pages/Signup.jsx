import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../AuthContext";
import logo from "../assets/logo.jpg";

export default function Signup() {
  const [form, setForm] = useState({ displayName: "", username: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [inviter, setInviter] = useState(null);
  const inviteToken = searchParams.get("ref");

  useEffect(() => {
    if (!inviteToken) return;
    api.get(`/api/social/invites/${inviteToken}`).then(({ invite }) => setInviter(invite.sender)).catch(() => {});
  }, [inviteToken]);

  function set(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const { token, user } = await api.post("/api/auth/register", { ...form, inviteToken: inviteToken || undefined });
      login(token, user);
      navigate("/");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container" style={{ maxWidth: 420, paddingTop: 60 }}>
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <img src={logo} alt="Corverxis" style={{ width: 56, height: 56, borderRadius: 12, marginBottom: 14 }} />
        <h1 className="h-display" style={{ fontSize: 26, margin: 0 }}>Create your profile</h1>
        <p className="eyebrow" style={{ marginTop: 6 }}>Join NexgenSocial</p>
        {inviter && (
          <p style={{ color: "var(--cyan-300)", fontSize: 13, marginTop: 10 }}>
            {inviter.displayName} (@{inviter.username}) invited you — you'll be added as friends automatically.
          </p>
        )}
      </div>

      <form onSubmit={onSubmit} className="card" style={{ padding: 24, display: "grid", gap: 14 }}>
        <input type="text" placeholder="Display name" value={form.displayName} onChange={set("displayName")} required />
        <input type="text" placeholder="Username" value={form.username} onChange={set("username")} required />
        <input type="email" placeholder="Email" value={form.email} onChange={set("email")} required />
        <input type="password" placeholder="Password (min 8 characters)" value={form.password} onChange={set("password")} required />
        {error && <div style={{ color: "var(--danger)", fontSize: 13 }}>{error}</div>}
        <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? "Creating…" : "Create account"}</button>
      </form>

      <p style={{ textAlign: "center", marginTop: 16, fontSize: 13, color: "var(--slate-400)" }}>
        Already have an account? <Link to="/login" style={{ color: "var(--cyan-400)" }}>Sign in</Link>
      </p>
    </div>
  );
}
