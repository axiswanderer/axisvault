import { useState, type FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { VaultDialIcon } from "../components/VaultDialIcon";
import { Field, Input, Button } from "../components/ui";
import { ApiRequestError } from "../lib/apiClient";

export function LoginPage() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await login(email, password);
      navigate("/vault");
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.statusCode === 423 ? err.message : "Email or master password is incorrect.");
      } else {
        setError("Couldn't sign in. Please check your connection and try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div style={styles.wrapper}>
      {/* Futuristic background */}
      <div className="av-auth-bg">
        <div className="av-auth-grid" />
        <div className="av-auth-corner av-auth-corner-tl" />
        <div className="av-auth-corner av-auth-corner-br" />
        <div className="av-auth-corner av-auth-corner-mid" />
      </div>

      <div style={styles.content} className="av-animate-in">
        {/* Brand */}
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

        {/* Card with scanline */}
        <div style={styles.card} className="av-glass av-scanline-wrap">
          <h2 style={{ fontSize: 17, marginBottom: 6 }}>Welcome back</h2>
          <p style={{ fontSize: 13, color: "var(--av-text-muted)", margin: "0 0 24px" }}>
            Sign in to access your encrypted vault.
          </p>

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
                autoComplete="current-password"
                placeholder="Your master password"
              />
            </Field>

            {error && <div style={styles.error}>{error}</div>}

            <Button type="submit" fullWidth disabled={isSubmitting} style={{ marginTop: 4 }}>
              {isSubmitting ? "Unlocking…" : "Unlock vault"}
            </Button>
          </form>

          <p style={{ textAlign: "center", fontSize: 13, color: "var(--av-text-muted)", marginTop: 20, marginBottom: 0 }}>
            New here?{" "}
            <Link to="/signup" style={{ color: "var(--av-accent-400)", fontWeight: 600 }}>
              Create a vault
            </Link>
          </p>
        </div>

        <p style={styles.footer}>
          AES-256-GCM · Argon2id · Client-side only
        </p>
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
    maxWidth: 400,
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
