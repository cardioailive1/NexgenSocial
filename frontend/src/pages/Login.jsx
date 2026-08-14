import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";
import PasswordField, { validateEmail, validatePassword } from "../components/PasswordField";
import { useAuth } from "../AuthContext";
import logo from "../assets/logo.jpg";

export default function Login() {
  const [emailOrUsername, setEmailOrUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [emailError, setEmailError] = useState(null);
  const [passwordError, setPasswordError] = useState(null);
  const [busy, setBusy] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function onSubmit(e) {
    e.preventDefault();
    setError("");

    // Validated before hitting the network so problems are explained
    // inline rather than coming back as a generic server failure.
    //
    // This field accepts an email OR a username, so email format is only
    // enforced when the value actually looks like an email attempt --
    // rejecting a valid username for "not being an email" would be worse
    // than no validation at all.
    const looksLikeEmail = emailOrUsername.includes("@");
    const identifierProblem = !emailOrUsername.trim()
      ? "Enter your email address or username."
      : looksLikeEmail
        ? validateEmail(emailOrUsername)
        : null;
    const passwordProblem = validatePassword(password, { minLength: 1 });

    setEmailError(identifierProblem);
    setPasswordError(passwordProblem);
    if (identifierProblem || passwordProblem) return;

    setBusy(true);
    try {
      const { token, user } = await api.post("/api/auth/login", { emailOrUsername, password });
      login(token, user);
      navigate("/");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container" style={{ maxWidth: 420, paddingTop: 80 }}>
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <img src={logo} alt="Corverxis" style={{ width: 56, height: 56, borderRadius: 12, marginBottom: 14 }} />
        <h1 className="h-display" style={{ fontSize: 26, margin: 0 }}>Welcome back</h1>
        <p className="eyebrow" style={{ marginTop: 6 }}>Sign in to NexgenSocial</p>
      </div>

      <form onSubmit={onSubmit} className="card" style={{ padding: 24, display: "grid", gap: 14 }}>
        <div>
          <input
            type="text"
            placeholder="Email or username"
            value={emailOrUsername}
            onChange={(e) => { setEmailOrUsername(e.target.value); setEmailError(null); }}
            autoComplete="username"
            style={emailError ? { borderColor: "var(--danger)" } : undefined}
            aria-invalid={!!emailError}
          />
          {emailError && (
            <div style={{ fontSize: 11.5, color: "var(--danger)", marginTop: 4 }}>{emailError}</div>
          )}
        </div>

        <PasswordField
          value={password}
          onChange={(e) => { setPassword(e.target.value); setPasswordError(null); }}
          autoComplete="current-password"
          error={passwordError}
        />

        {error && <div style={{ color: "var(--danger)", fontSize: 13 }}>{error}</div>}
        <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>

        <Link to="/forgot-password" style={{ fontSize: 12.5, color: "var(--cyan-300)", textAlign: "center" }}>
          Forgot your password?
        </Link>
      </form>

      <p style={{ textAlign: "center", marginTop: 16, fontSize: 13, color: "var(--slate-400)" }}>
        New here? <Link to="/signup" style={{ color: "var(--cyan-400)" }}>Create an account</Link>
      </p>
    </div>
  );
}
