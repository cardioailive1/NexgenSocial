import { useState } from "react";

/**
 * Password input with a show/hide toggle.
 *
 * The toggle only changes the input's `type`; the value is never touched,
 * so revealing a password can't alter what gets submitted.
 */
export default function PasswordField({
  value,
  onChange,
  placeholder = "Password",
  autoComplete = "current-password",
  error,
  ...rest
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div>
      <div style={{ position: "relative" }}>
        <input
          type={visible ? "text" : "password"}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete={autoComplete}
          style={{
            width: "100%",
            paddingRight: 68,
            ...(error ? { borderColor: "var(--danger)" } : {}),
          }}
          {...rest}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          // Announced to screen readers, which a bare icon wouldn't be.
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          style={{
            position: "absolute",
            right: 10,
            top: "50%",
            transform: "translateY(-50%)",
            fontSize: 11,
            color: "var(--cyan-300)",
            padding: "4px 6px",
          }}
        >
          {visible ? "Hide" : "Show"}
        </button>
      </div>
      {error && (
        <div style={{ fontSize: 11.5, color: "var(--danger)", marginTop: 4 }}>{error}</div>
      )}
    </div>
  );
}

// Shared so Login, Signup and Reset all validate identically -- three
// slightly different rules would be worse than one.
export const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function validateEmail(email) {
  if (!email.trim()) return "Enter your email address.";
  if (!EMAIL_RE.test(email)) return "That doesn't look like a valid email address.";
  return null;
}

export function validatePassword(password, { minLength = 8 } = {}) {
  if (!password) return "Enter your password.";
  if (password.length < minLength) return `Password must be at least ${minLength} characters.`;
  return null;
}
