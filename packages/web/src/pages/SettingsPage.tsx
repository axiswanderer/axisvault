import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Clock, KeyRound } from "lucide-react";
import { useAuthStore } from "../store/authStore";
import { Field, Input, Button } from "../components/ui";

const AUTO_LOCK_OPTIONS = [
  { label: "1 min",   value: 1 },
  { label: "5 min",   value: 5 },
  { label: "15 min",  value: 15 },
  { label: "30 min",  value: 30 },
  { label: "Never",   value: 0 },
];

export function SettingsPage() {
  const navigate = useNavigate();
  const autoLockMinutes = useAuthStore((s) => s.autoLockMinutes);
  const setAutoLockMinutes = useAuthStore((s) => s.setAutoLockMinutes);
  const changeMasterPassword = useAuthStore((s) => s.changeMasterPassword);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handlePasswordChange(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    if (newPassword.length < 12) {
      setError("New master password must be at least 12 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New passwords don't match.");
      return;
    }
    setIsSubmitting(true);
    try {
      await changeMasterPassword(currentPassword, newPassword);
      setSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't change your master password.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.inner}>
        <button onClick={() => navigate("/vault")} style={styles.backBtn}>
          <ArrowLeft size={14} />
          Back to vault
        </button>

        <h1 style={{ fontSize: 22, marginBottom: 28, letterSpacing: "-0.02em" }}>Settings</h1>

        {/* Auto-lock */}
        <section style={styles.section}>
          <div style={styles.sectionHeader}>
            <div style={styles.sectionIcon}>
              <Clock size={16} style={{ color: "var(--av-accent-300)" }} />
            </div>
            <div>
              <h3 style={{ fontSize: 15, margin: 0 }}>Auto-lock</h3>
              <p style={{ fontSize: 13, color: "var(--av-text-muted)", margin: "2px 0 0" }}>
                Automatically lock after inactivity
              </p>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 16 }}>
            {AUTO_LOCK_OPTIONS.map((opt) => {
              const active = autoLockMinutes === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => setAutoLockMinutes(opt.value)}
                  style={{
                    padding: "8px 16px",
                    borderRadius: "var(--av-radius-sm)",
                    border: `1px solid ${active ? "var(--av-border-accent)" : "var(--av-border-default)"}`,
                    background: active ? "var(--av-accent-glow)" : "var(--av-bg-elevated)",
                    color: active ? "var(--av-accent-200)" : "var(--av-text-secondary)",
                    fontSize: 13,
                    fontWeight: active ? 600 : 400,
                    cursor: "pointer",
                    boxShadow: active ? "var(--av-shadow-glow)" : "none",
                    transition: "all 150ms ease",
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </section>

        {/* Change password */}
        <section style={styles.section}>
          <div style={styles.sectionHeader}>
            <div style={styles.sectionIcon}>
              <KeyRound size={16} style={{ color: "var(--av-accent-300)" }} />
            </div>
            <div>
              <h3 style={{ fontSize: 15, margin: 0 }}>Change master password</h3>
              <p style={{ fontSize: 13, color: "var(--av-text-muted)", margin: "2px 0 0" }}>
                Re-encrypts your vault key automatically. Signs out other devices.
              </p>
            </div>
          </div>
          <form onSubmit={handlePasswordChange} style={{ marginTop: 20 }}>
            <Field label="Current master password">
              <Input
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
              />
            </Field>
            <Field label="New master password">
              <Input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
              />
            </Field>
            <Field label="Confirm new master password">
              <Input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
              />
            </Field>
            {error && (
              <div style={styles.error}>{error}</div>
            )}
            {success && (
              <div style={styles.successBanner}>Master password changed successfully.</div>
            )}
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Changing…" : "Change master password"}
            </Button>
          </form>
        </section>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "var(--av-bg-primary)",
    padding: "32px 24px",
  },
  inner: {
    maxWidth: 580,
    margin: "0 auto",
  },
  backBtn: {
    display: "flex",
    alignItems: "center",
    gap: 7,
    background: "none",
    border: "none",
    color: "var(--av-text-muted)",
    cursor: "pointer",
    fontSize: 13,
    marginBottom: 24,
    padding: 0,
    transition: "color 120ms ease",
  },
  section: {
    background: "var(--av-bg-elevated)",
    border: "1px solid var(--av-border-subtle)",
    borderRadius: "var(--av-radius-lg)",
    padding: 24,
    marginBottom: 16,
  },
  sectionHeader: {
    display: "flex",
    alignItems: "flex-start",
    gap: 14,
  },
  sectionIcon: {
    width: 36,
    height: 36,
    borderRadius: "var(--av-radius-sm)",
    background: "var(--av-accent-glow)",
    border: "1px solid var(--av-border-accent)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginTop: 1,
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
  successBanner: {
    padding: "10px 14px",
    background: "var(--av-success-bg)",
    border: "1px solid var(--av-success-border)",
    borderRadius: "var(--av-radius-sm)",
    color: "var(--av-success)",
    fontSize: 13,
    marginBottom: 16,
  },
};
