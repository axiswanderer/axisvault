import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore, getCachedUnlockMaterial } from "../store/authStore";
import { VaultDialIcon } from "../components/VaultDialIcon";
import { Field, Input, Button } from "../components/ui";
import { InvalidMasterPasswordError } from "@axisvault/shared";

const REASON_COPY: Record<string, string> = {
  manual:          "Vault locked.",
  timeout:         "Locked after inactivity.",
  session_expired: "Session expired.",
};

export function LockScreen() {
  const navigate = useNavigate();
  const lockReason = useAuthStore((s) => s.lockReason);
  const email = useAuthStore((s) => s.email);
  const unlockExisting = useAuthStore((s) => s.unlockExisting);
  const logout = useAuthStore((s) => s.logout);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const cached = getCachedUnlockMaterial();

  if (lockReason === "session_expired" || !cached) {
    return (
      <div style={styles.wrapper}>
        <div className="av-auth-bg">
          <div className="av-auth-grid" />
          <div className="av-auth-corner av-auth-corner-tl" />
          <div className="av-auth-corner av-auth-corner-br" />
        </div>
        <div style={{ ...styles.card, textAlign: "center", maxWidth: 360 }} className="av-glass av-animate-in">
          <div className="av-pulse-ring-wrap" style={{ display: "inline-flex" }}>
            <div className="av-pulse-ring" />
            <div className="av-pulse-ring" />
            <VaultDialIcon locked size={44} />
          </div>
          <h2 style={{ marginTop: 20, marginBottom: 8, fontSize: 17 }}>Session expired</h2>
          <p style={{ fontSize: 13, color: "var(--av-text-muted)", marginBottom: 24 }}>
            Please sign in again to continue.
          </p>
          <Button fullWidth onClick={() => logout().then(() => navigate("/login"))}>
            Go to sign in
          </Button>
        </div>
      </div>
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await unlockExisting(password, cached!.kdfParams, cached!.wrappedVaultKey);
      navigate("/vault");
    } catch (err) {
      if (err instanceof InvalidMasterPasswordError) {
        setError("That master password is incorrect.");
      } else {
        setError("Couldn't unlock the vault. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
      setPassword("");
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

      <div style={{ width: "100%", maxWidth: 380, position: "relative", zIndex: 1 }} className="av-animate-in">
        <div style={{ ...styles.card, textAlign: "center" }} className="av-glass av-scanline-wrap">
          {/* Lock icon with pulse rings */}
          <div className="av-pulse-ring-wrap" style={{ display: "inline-flex", marginBottom: 4 }}>
            <div className="av-pulse-ring" />
            <div className="av-pulse-ring" style={{ animationDelay: "0.8s" }} />
            <div style={styles.iconBg}>
              <VaultDialIcon locked size={40} />
            </div>
          </div>

          <h2 style={{ marginTop: 18, marginBottom: 4, fontSize: 18 }}>
            {REASON_COPY[lockReason ?? "manual"]}
          </h2>
          {email && (
            <p style={{ fontSize: 12, color: "var(--av-text-muted)", margin: "0 0 24px", fontFamily: "var(--av-font-data)" }}>
              {email}
            </p>
          )}

          <form onSubmit={handleSubmit} style={{ textAlign: "left" }}>
            <Field label="Master password">
              <Input
                type="password"
                autoFocus
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="Enter your master password"
              />
            </Field>
            {error && <div style={styles.error}>{error}</div>}
            <Button type="submit" fullWidth disabled={isSubmitting}>
              {isSubmitting ? "Unlocking…" : "Unlock vault"}
            </Button>
          </form>

          <button
            onClick={() => logout().then(() => navigate("/login"))}
            style={styles.signOutBtn}
          >
            Not you? Sign out
          </button>
        </div>
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
  card: {
    borderRadius: "var(--av-radius-xl)",
    padding: 36,
    boxShadow: "var(--av-shadow-lg)",
  },
  iconBg: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 72,
    height: 72,
    borderRadius: "var(--av-radius-lg)",
    background: "var(--av-bg-surface)",
    border: "1px solid var(--av-border-default)",
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
  signOutBtn: {
    width: "100%",
    marginTop: 16,
    background: "none",
    border: "none",
    color: "var(--av-text-muted)",
    fontSize: 12,
    cursor: "pointer",
    transition: "color 120ms ease",
  },
};
