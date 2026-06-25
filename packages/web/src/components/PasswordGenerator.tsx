import { useEffect, useState } from "react";
import { Copy, RefreshCw, Check } from "lucide-react";
import { generatePassword, type PasswordGeneratorOptions } from "@axisvault/shared";
import { StrengthMeter } from "./StrengthMeter";
import { Button } from "./ui";

const DEFAULT_OPTIONS: PasswordGeneratorOptions = {
  length: 20,
  uppercase: true,
  lowercase: true,
  numbers: true,
  symbols: true,
  excludeAmbiguous: false,
};

const CHAR_LABELS: [keyof PasswordGeneratorOptions, string][] = [
  ["uppercase", "A–Z"],
  ["lowercase", "a–z"],
  ["numbers",   "0–9"],
  ["symbols",   "!@#$"],
];

export function PasswordGenerator({ onUse }: { onUse?: (password: string) => void }) {
  const [options, setOptions] = useState<PasswordGeneratorOptions>(DEFAULT_OPTIONS);
  const [password, setPassword] = useState("");
  const [copied, setCopied] = useState(false);
  const [spinning, setSpinning] = useState(false);

  function regenerate() {
    try {
      setPassword(generatePassword(options));
    } catch {
      setPassword("");
    }
    setSpinning(true);
    setTimeout(() => setSpinning(false), 400);
  }

  useEffect(() => { regenerate(); }, [options]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleCopy() {
    await navigator.clipboard.writeText(password);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
    setTimeout(async () => {
      try {
        const current = await navigator.clipboard.readText();
        if (current === password) await navigator.clipboard.writeText("");
      } catch { /* clipboard permission denied */ }
    }, 30_000);
  }

  const toggle = (key: keyof PasswordGeneratorOptions) =>
    setOptions((o) => ({ ...o, [key]: !o[key] }));

  return (
    <div style={styles.container}>
      {/* Password display */}
      <div style={styles.passwordRow}>
        <div className="av-mono" style={styles.passwordDisplay}>
          {password || "—"}
        </div>
        <button
          onClick={regenerate}
          title="Regenerate"
          style={styles.iconBtn}
        >
          <RefreshCw
            size={14}
            style={{
              transition: "transform 400ms ease",
              transform: spinning ? "rotate(360deg)" : "rotate(0deg)",
            }}
          />
        </button>
        <button
          onClick={handleCopy}
          title="Copy"
          style={{
            ...styles.iconBtn,
            background: copied ? "var(--av-success-bg)" : "var(--av-bg-surface)",
            borderColor: copied ? "var(--av-success-border)" : "var(--av-border-default)",
            color: copied ? "var(--av-success)" : "var(--av-text-secondary)",
          }}
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
        </button>
      </div>

      <StrengthMeter password={password} />

      {/* Length slider */}
      <div style={{ marginTop: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 8 }}>
          <span style={{ color: "var(--av-text-secondary)" }}>Length</span>
          <span className="av-mono" style={{ color: "var(--av-accent-300)", fontWeight: 600 }}>
            {options.length}
          </span>
        </div>
        <input
          type="range"
          min={8}
          max={64}
          value={options.length}
          onChange={(e) => setOptions((o) => ({ ...o, length: Number(e.target.value) }))}
          style={{ width: "100%" }}
        />
      </div>

      {/* Char type toggles */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 14 }}>
        {CHAR_LABELS.map(([key, label]) => (
          <label
            key={key}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 12,
              cursor: "pointer",
              padding: "6px 10px",
              borderRadius: "var(--av-radius-sm)",
              background: options[key] ? "var(--av-accent-glow)" : "var(--av-bg-surface)",
              border: `1px solid ${options[key] ? "var(--av-border-accent)" : "var(--av-border-subtle)"}`,
              color: options[key] ? "var(--av-accent-200)" : "var(--av-text-muted)",
              transition: "all 150ms ease",
            }}
          >
            <input
              type="checkbox"
              checked={!!options[key]}
              onChange={() => toggle(key)}
              style={{ margin: 0 }}
            />
            <span className="av-mono">{label}</span>
          </label>
        ))}
      </div>

      {onUse && (
        <Button fullWidth style={{ marginTop: 14 }} onClick={() => onUse(password)} type="button">
          Use this password
        </Button>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    background: "var(--av-bg-elevated)",
    border: "1px solid var(--av-border-default)",
    borderRadius: "var(--av-radius-md)",
    padding: 16,
  },
  passwordRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  passwordDisplay: {
    flex: 1,
    background: "var(--av-bg-surface)",
    border: "1px solid var(--av-border-subtle)",
    borderRadius: "var(--av-radius-sm)",
    padding: "10px 12px",
    fontSize: 13,
    color: "var(--av-text-primary)",
    wordBreak: "break-all",
    letterSpacing: "0.04em",
    minHeight: 44,
    display: "flex",
    alignItems: "center",
  },
  iconBtn: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 36,
    height: 36,
    background: "var(--av-bg-surface)",
    border: "1px solid var(--av-border-default)",
    borderRadius: "var(--av-radius-sm)",
    color: "var(--av-text-secondary)",
    cursor: "pointer",
    flexShrink: 0,
    transition: "all 150ms ease",
  },
};
