import { useState, type FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import { useAuthStore } from "../store/authStore";
import { VaultDialIcon } from "../components/VaultDialIcon";
import { Field, Input, Button } from "../components/ui";
import { StrengthMeter } from "../components/StrengthMeter";
import { ApiRequestError } from "../lib/apiClient";

export function SignupPage() {
  const navigate = useNavigate();
  const signup = useAuthStore((s) => s.signup);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const passwordsMatch = password.length > 0 && password === confirmPassword;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 12) {
      setError("Master password must be at least 12 characters — it's the only thing protecting your entire vault.");
      return;
    }
    if (!passwordsMatch) {
      setError("Passwords don't match.");
      return;
    }
    setIsSubmitting(true);
    try {
      await signup(email, password);
      navigate("/vault");
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.message);
      } else {
        setError("Something went wrong creating your account. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div style={styles.wrapper}>
      <div className="av-auth-bg">
        <div className="av-auth-grid" />
        <div className="av-auth-corner av-auth-corner-tl" />
        <div className="av-auth-corner av-auth-corner-br" />
        <div className="av-auth-corner av-auth-corner-mid" />
      </div>

      <div style={styles.content} className="av-animate-in">
        <div style={styles.brand}>
          <VaultDialIcon locked size={34} />
          <div>
            <h1 className="av-glitch av-gradient-text" style={{ fontSize: 22, margin: 0 }}>
              AxisVault
            </h1>
            <p style={{ fontSize: 11, color: "var(--av-text-muted)", margin: 0, marginTop: 2, fontFamily: "var(--av-font-data)", letterSpacing: "0.06em" }}>
              ZERO-KNOWLEDGE SECURITY
            </p>
          </div>
        </div>

        <div style={styles.card} className="av-glass av-scanline-wrap">
          <h2 style={{ fontSize: 17, marginBottom: 4 }}>Create your vault</h2>
          <p style={{ fontSize: 13, color: "var(--av-text-muted)", margin: "0 0 20px" }}>
            Your master password encrypts everything. We never see it.
          </p>

          <div style={styles.warning}>
            <ShieldAlert size={15} style={{ color: "var(--av-warning)", flexShrink: 0, marginTop: 1 }} />
            <span>
              There is no "forgot password." If you lose it, your vault is permanently unrecoverable — that's what makes it secure.
            </span>
          </div>

          <form onSubmit={handleSubmit}>
            <Field label="Email">
              <Input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                placeholder="you@example.com"
              />
            </Field>
            <Field label="Master password">
              <Input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                placeholder="At least 12 characters"
              />
              <StrengthMeter password={password} />
            </Field>
            <Field
              label="Confirm master password"
              error={confirmPassword && !passwordsMatch ? "Passwords don't match" : undefined}
            >
              <Input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                placeholder="Repeat your password"
              />
            </Field>

            {error && <div style={styles.error}>{error}</div>}

            <Button type="submit" fullWidth disabled={isSubmitting} style={{ marginTop: 4 }}>
              {isSubmitting ? "Creating vault…" : "Create vault"}
            </Button>
          </form>

          <p style={{ textAlign: "center", fontSize: 13, color: "var(--av-text-muted)", marginTop: 20, marginBottom: 0 }}>
            Already have a vault?{" "}
            <Link to="/login" style={{ color: "var(--av-accent-400)", fontWeight: 600 }}>
              Sign in
            </Link>
          </p>
        </div>

        <p style={styles.footer}>AES-256-GCM · Argon2id · Client-side only</p>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    background: "var(--av-bg-base)",
    position: "relative",
    transition: "background 400ms ease",
  },
  content: {
    width: "100%",
    maxWidth: 420,
    position: "relative",
    zIndex: 1,
  },
  brand: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    marginBottom: 28,
    justifyContent: "center",
  },
  card: {
    borderRadius: "var(--av-radius-xl)",
    padding: 32,
    boxShadow: "var(--av-shadow-lg)",
  },
  warning: {
    display: "flex",
    gap: 10,
    fontSize: 12,
    color: "var(--av-text-secondary)",
    background: "var(--av-warning-bg)",
    border: "1px solid var(--av-warning-border)",
    borderRadius: "var(--av-radius-sm)",
    padding: "12px 14px",
    marginBottom: 20,
    lineHeight: 1.5,
  },
  error: {
    padding: "10px 14px",
    background: "var(--av-danger-bg)",
    border: "1px solid var(--av-danger-border)",
    borderRadius: "var(--av-radius-sm)",
    color: "var(--av-danger)",
    fontSize: 13,
    marginBottom: 16,
  },
  footer: {
    textAlign: "center",
    fontSize: 10,
    fontFamily: "var(--av-font-data)",
    letterSpacing: "0.08em",
    color: "var(--av-text-muted)",
    marginTop: 20,
  },
};
