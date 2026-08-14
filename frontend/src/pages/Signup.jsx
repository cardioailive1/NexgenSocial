import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api";
import PasswordField, { validateEmail, validatePassword } from "../components/PasswordField";
import { POLICY_VERSION } from "../legal/documents";
import PlatformHighlights from "../components/PlatformHighlights";
import { useAuth } from "../AuthContext";
import logo from "../assets/logo.jpg";

export default function Signup() {
  const [form, setForm] = useState({ displayName: "", username: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [emailError, setEmailError] = useState(null);
  const [passwordError, setPasswordError] = useState(null);
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

    // Caught inline rather than sent to the server and returned as a
    // generic failure (UAT-010).
    const emailProblem = validateEmail(form.email);
    const passwordProblem = validatePassword(form.password, { minLength: 8 });
    setEmailError(emailProblem);
    setPasswordError(passwordProblem);
    if (emailProblem || passwordProblem) return;

    if (!accepted) {
      setError("Please accept the Terms of Use and Privacy Policy to continue.");
      return;
    }
    setBusy(true);
    try {
      const { token, user } = await api.post("/api/auth/register", {
        ...form,
        inviteToken: inviteToken || undefined,
        acceptedTerms: true,
        policyVersion: POLICY_VERSION,
      });
      login(token, user);
      navigate("/");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container" style={{ maxWidth: 920, paddingTop: 48, paddingBottom: 60 }}>
      <div style={{ display: "flex", gap: 36, alignItems: "flex-start", flexWrap: "wrap" }}>
      <div style={{ flex: "1 1 340px", minWidth: 300, maxWidth: 420 }}>
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
        <div>
          <input
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={(e) => { set("email")(e); setEmailError(null); }}
            autoComplete="email"
            style={emailError ? { borderColor: "var(--danger)" } : undefined}
            aria-invalid={!!emailError}
          />
          {emailError && (
            <div style={{ fontSize: 11.5, color: "var(--danger)", marginTop: 4 }}>{emailError}</div>
          )}
        </div>

        <PasswordField
          value={form.password}
          onChange={(e) => { set("password")(e); setPasswordError(null); }}
          placeholder="Password (min 8 characters)"
          autoComplete="new-password"
          error={passwordError}
        />
        <label style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12, color: "var(--slate-300)", lineHeight: 1.5 }}>
          <input
            type="checkbox"
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
            style={{ marginTop: 2, flexShrink: 0 }}
          />
          <span>
            I have read and agree to the{" "}
            <Link to="/legal/terms" target="_blank" style={{ color: "var(--cyan-300)", textDecoration: "underline" }}>Terms of Use</Link>
            {" "}and{" "}
            <Link to="/legal/privacy" target="_blank" style={{ color: "var(--cyan-300)", textDecoration: "underline" }}>Privacy Policy</Link>.
            I understand NexgenSocial is free and funded by advertising, and that
            ad personalisation is off unless I turn it on.
          </span>
        </label>

        {error && <div style={{ color: "var(--danger)", fontSize: 13 }}>{error}</div>}
        <button className="btn btn-primary" type="submit" disabled={busy || !accepted}>{busy ? "Creating…" : "Create account"}</button>
      </form>

      <p style={{ textAlign: "center", marginTop: 16, fontSize: 13, color: "var(--slate-400)" }}>
        Already have an account? <Link to="/login" style={{ color: "var(--cyan-400)" }}>Sign in</Link>
      </p>
      </div>

      {/* Sits beside the form on wide screens and wraps beneath it on
          narrow ones, so the form itself is always what's reachable first
          on a phone. */}
      <div style={{ flex: "1 1 320px", minWidth: 280, paddingTop: 8 }}>
        <PlatformHighlights />
      </div>
      </div>
    </div>
  );
}
