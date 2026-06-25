import { estimateStrength } from "@axisvault/shared";

const LABELS = ["Very weak", "Weak", "Fair", "Strong", "Very strong"];
const COLORS = [
  "var(--av-danger)",
  "var(--av-danger)",
  "var(--av-warning)",
  "var(--av-success)",
  "var(--av-success)",
];
const TRACK_COLORS = [
  "rgba(248,113,113,0.18)",
  "rgba(248,113,113,0.18)",
  "rgba(251,191,36,0.18)",
  "rgba(74,222,128,0.18)",
  "rgba(74,222,128,0.18)",
];

export function StrengthMeter({ password }: { password: string }) {
  if (!password) return null;
  const { score, entropyBits, feedback } = estimateStrength(password);

  return (
    <div style={{ marginTop: 10 }}>
      {/* Bar segments */}
      <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            style={{
              height: 3,
              flex: 1,
              borderRadius: 2,
              background: i <= score ? COLORS[score] : "var(--av-border-default)",
              boxShadow: i <= score ? `0 0 6px ${TRACK_COLORS[score]}` : "none",
              transition: "background 200ms ease, box-shadow 200ms ease",
            }}
          />
        ))}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12 }}>
        <span style={{ color: COLORS[score], fontWeight: 600 }}>{LABELS[score]}</span>
        <span className="av-mono" style={{ color: "var(--av-text-muted)", fontSize: 11 }}>
          ~{entropyBits} bits
        </span>
      </div>

      {feedback.length > 0 && score < 3 && (
        <ul style={{ margin: "6px 0 0", paddingLeft: 16, fontSize: 12, color: "var(--av-text-muted)" }}>
          {feedback.slice(0, 2).map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
