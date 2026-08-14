import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api";
import PasswordField, { validatePassword } from "../components/PasswordField";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get("token");

  const [tokenValid, setTokenValid] = useState(null); // null = still checking
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [passwordError, setPasswordError] = useState(null);
  const [confirmError, setConfirmError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  // Checked up front so an expired link says so immediately, rather than
  // after someone types a new password twice.
  useEffect(() => {
    if (!token) { setTokenValid(false); return; }
    api.get(`/api/auth/reset-password/${token}`)
      .then(({ valid }) => setTokenValid(valid))
      .catch(() => setTokenValid(false));
  }, [token]);

  async function submit(e) {
    e.preventDefault();
    const pwProblem = validatePassword(password);
    const confirmProblem = password !== confirm ? "The two passwords don't match." : null;
    setPasswordError(pwProblem);
    setConfirmError(confirmProblem);
    if (pwProblem || confirmProblem) return;

    setBusy(true);
    setError("");
    try {
      await api.post("/api/auth/reset-password", { token, password });
      setDone(true);
      setTimeout(() => navigate("/login"), 2500);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (tokenValid === null) {
    return <div className="container" style={{ maxWidth: 420, paddingTop: 60, color: "var(--slate-400)" }}>Checking your link…</div>;
  }

  if (!tokenValid) {
    return (
      <div className="container" style={{ maxWidth: 420, paddingTop: 60 }}>
        <div className="card" style={{ padding: 18 }}>
          <h1 className="h-display" style={{ fontSize: 19, marginTop: 0 }}>This link has expired</h1>
          <p style={{ fontSize: 13.5, color: "var(--slate-300)", lineHeight: 1.6 }}>
            Reset links last an hour and can only be used once. Request a fresh one.
          </p>
          <Link to="/forgot-password" className="btn btn-primary">Request a new link</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{ maxWidth: 420, paddingTop: 60 }}>
      <h1 className="h-display" style={{ fontSize: 22, marginBottom: 6 }}>Choose a new password</h1>

      {done ? (
        <div className="card" style={{ padding: 18 }}>
          <p style={{ fontSize: 14, color: "var(--cyan-300)" }}>
            Your password has been changed. Taking you to sign in…
          </p>
        </div>
      ) : (
        <form onSubmit={submit} className="card" style={{ padding: 18, display: "grid", gap: 12 }}>
          <PasswordField
            value={password}
            onChange={(e) => { setPassword(e.target.value); setPasswordError(null); }}
            placeholder="New password (8+ characters)"
            autoComplete="new-password"
            error={passwordError}
          />
          <PasswordField
            value={confirm}
            onChange={(e) => { setConfirm(e.target.value); setConfirmError(null); }}
            placeholder="Confirm new password"
            autoComplete="new-password"
            error={confirmError}
          />
          {error && <div style={{ fontSize: 13, color: "var(--danger)" }}>{error}</div>}
          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? "Saving…" : "Change password"}
          </button>
        </form>
      )}
    </div>
  );
}
