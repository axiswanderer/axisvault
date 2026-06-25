import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Download, ShieldAlert, Lock } from "lucide-react";
import { api } from "../lib/apiClient";
import { Button } from "../components/ui";

export function ExportPage() {
  const navigate = useNavigate();
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleExport() {
    setIsExporting(true);
    setError(null);
    setDone(false);
    try {
      const backup = await api.exportBackup();
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `axisvault-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't generate the export.");
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.inner}>
        <button onClick={() => navigate("/vault")} style={styles.backBtn}>
          <ArrowLeft size={14} />
          Back to vault
        </button>

        <h1 style={{ fontSize: 22, marginBottom: 8, letterSpacing: "-0.02em" }}>
          Export encrypted backup
        </h1>
        <p style={{ fontSize: 14, color: "var(--av-text-muted)", marginTop: 0, marginBottom: 28 }}>
          Download a full copy of your vault, still encrypted with AES-256-GCM.
        </p>

        <div style={styles.section}>
          {/* Encryption badge */}
          <div style={styles.badge}>
            <Lock size={14} style={{ color: "var(--av-accent-300)" }} />
            <span style={{ fontSize: 12, color: "var(--av-accent-300)", fontWeight: 500 }}>
              AES-256-GCM encrypted — only readable with your master password
            </span>
          </div>

          <p style={{ fontSize: 13, color: "var(--av-text-secondary)", margin: "16px 0" }}>
            This file cannot be opened or read without your master password. It's exactly
            what exists on the server — ciphertext only.
          </p>

          {/* Warning */}
          <div style={styles.warning}>
            <ShieldAlert size={15} style={{ color: "var(--av-warning)", flexShrink: 0, marginTop: 1 }} />
            <span>
              Treat this file like a copy of your master key. Anyone with this file AND your
              master password can access your entire vault.
            </span>
          </div>

          {error && <div style={styles.error}>{error}</div>}
          {done && (
            <div style={styles.success}>
              Backup downloaded successfully. Store it somewhere safe.
            </div>
          )}

          <Button onClick={handleExport} disabled={isExporting} style={{ marginTop: 4 }}>
            <Download size={15} />
            {isExporting ? "Preparing export…" : "Download encrypted backup"}
          </Button>
        </div>
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
    maxWidth: 560,
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
  },
  badge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 7,
    padding: "6px 12px",
    background: "var(--av-accent-glow)",
    border: "1px solid var(--av-border-accent)",
    borderRadius: 20,
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
  success: {
    padding: "10px 14px",
    background: "var(--av-success-bg)",
    border: "1px solid var(--av-success-border)",
    borderRadius: "var(--av-radius-sm)",
    color: "var(--av-success)",
    fontSize: 13,
    marginBottom: 16,
  },
};
