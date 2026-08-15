import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { validateEmail } from "../components/PasswordField";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    const problem = validateEmail(email);
    setEmailError(problem);
    if (problem) return;

    setBusy(true);
    setError("");
    try {
      await api.post("/api/auth/forgot-password", { email });
      setSent(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container" style={{ maxWidth: 420, paddingTop: 60 }}>
      <h1 className="h-display" style={{ fontSize: 22, marginBottom: 6 }}>Reset your password</h1>

      {sent ? (
        <div className="card" style={{ padding: 18 }}>
          <p style={{ fontSize: 14, color: "var(--slate-300)", lineHeight: 1.6, marginTop: 0 }}>
            If an account exists for <strong>{email}</strong>, we've sent a link
            to choose a new password. It expires in an hour.
          </p>
          <p style={{ fontSize: 12.5, color: "var(--slate-400)", lineHeight: 1.6 }}>
            Nothing arrived? Check your spam folder, and make sure you used the
            address you signed up with. Delivery can take a couple of minutes.
          </p>
          <Link to="/login" className="btn btn-primary">Back to sign in</Link>
        </div>
      ) : (
        <form onSubmit={submit} className="card" style={{ padding: 18, display: "grid", gap: 12 }}>
          <p style={{ fontSize: 13, color: "var(--slate-400)", margin: 0, lineHeight: 1.5 }}>
            Enter the email address on your account and we'll send you a link to
            set a new password.
          </p>
          <div>
            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setEmailError(null); }}
              autoComplete="email"
              style={emailError ? { borderColor: "var(--danger)" } : undefined}
            />
            {emailError && (
              <div style={{ fontSize: 11.5, color: "var(--danger)", marginTop: 4 }}>{emailError}</div>
            )}
          </div>
          {error && <div style={{ fontSize: 13, color: "var(--danger)" }}>{error}</div>}
          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? "Sending…" : "Send reset link"}
          </button>
          <Link to="/login" style={{ fontSize: 13, color: "var(--cyan-300)", textAlign: "center" }}>
            Back to sign in
          </Link>
        </form>
      )}
    </div>
  );
}
