import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from "react";

export const Field = ({
  label,
  children,
  hint,
  error,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
  error?: string;
}) => (
  <div style={{ marginBottom: 20 }}>
    <label
      style={{
        display: "block",
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.10em",
        textTransform: "uppercase",
        color: "var(--av-text-muted)",
        fontFamily: "var(--av-font-data)",
        marginBottom: 8,
      }}
    >
      {label}
    </label>
    {children}
    {hint && !error && (
      <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--av-text-muted)" }}>{hint}</p>
    )}
    {error && (
      <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--av-danger)" }}>{error}</p>
    )}
  </div>
);

export const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & { mono?: boolean }
>(({ mono, style, ...props }, ref) => (
  <input
    ref={ref}
    {...props}
    style={{
      width: "100%",
      padding: "11px 14px",
      background: "var(--av-bg-input)",
      border: "1px solid var(--av-border-default)",
      borderRadius: "var(--av-radius-sm)",
      color: "var(--av-text-primary)",
      fontSize: mono ? 13 : 14,
      fontFamily: mono ? "var(--av-font-data)" : "var(--av-font-ui)",
      outline: "none",
      transition: "border-color 150ms ease, box-shadow 150ms ease, background 400ms ease",
      ...style,
    }}
    onFocus={(e) => {
      e.currentTarget.style.borderColor = "var(--av-border-accent)";
      e.currentTarget.style.boxShadow = "0 0 0 3px var(--av-accent-glow), 0 0 12px var(--av-accent-glow)";
      props.onFocus?.(e);
    }}
    onBlur={(e) => {
      e.currentTarget.style.borderColor = "var(--av-border-default)";
      e.currentTarget.style.boxShadow = "none";
      props.onBlur?.(e);
    }}
  />
));
Input.displayName = "Input";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; fullWidth?: boolean }
>(({ variant = "primary", fullWidth, style, disabled, children, className, ...props }, ref) => {
  const isPrimary = variant === "primary";

  const base: React.CSSProperties = {
    padding: "11px 18px",
    borderRadius: "var(--av-radius-sm)",
    fontSize: 14,
    fontWeight: 600,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.45 : 1,
    width: fullWidth ? "100%" : undefined,
    transition: "all 150ms ease",
    border: "none",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    letterSpacing: "-0.01em",
    position: "relative",
    overflow: "hidden",
    ...(isPrimary
      ? {
          background: "linear-gradient(135deg, var(--av-accent-600) 0%, var(--av-accent-400) 60%, var(--av-cyan-500) 100%)",
          color: "#fff",
          boxShadow: "0 0 20px var(--av-accent-glow), 0 1px 0 rgba(255,255,255,0.15) inset",
        }
      : variant === "secondary"
      ? {
          background: "var(--av-bg-elevated)",
          color: "var(--av-text-primary)",
          border: "1px solid var(--av-border-default)",
          boxShadow: "var(--av-shadow-sm)",
        }
      : variant === "ghost"
      ? {
          background: "transparent",
          color: "var(--av-text-secondary)",
          border: "1px solid transparent",
        }
      : {
          background: "var(--av-danger-bg)",
          color: "var(--av-danger)",
          border: "1px solid var(--av-danger-border)",
        }),
    ...style,
  };

  return (
    <button
      ref={ref}
      disabled={disabled}
      {...props}
      className={`${isPrimary ? "av-shimmer" : ""} ${className ?? ""}`}
      style={base}
      onMouseEnter={(e) => {
        if (disabled) return;
        if (isPrimary) {
          e.currentTarget.style.boxShadow = "0 0 32px var(--av-accent-glow-strong), 0 1px 0 rgba(255,255,255,0.20) inset";
          e.currentTarget.style.transform = "translateY(-1px)";
        } else if (variant === "secondary") {
          e.currentTarget.style.borderColor = "var(--av-border-strong)";
          e.currentTarget.style.background = "var(--av-bg-hover)";
        } else if (variant === "ghost") {
          e.currentTarget.style.background = "var(--av-bg-elevated)";
          e.currentTarget.style.borderColor = "var(--av-border-subtle)";
        }
        props.onMouseEnter?.(e);
      }}
      onMouseLeave={(e) => {
        if (disabled) return;
        if (isPrimary) {
          e.currentTarget.style.boxShadow = "0 0 20px var(--av-accent-glow), 0 1px 0 rgba(255,255,255,0.15) inset";
          e.currentTarget.style.transform = "";
        } else if (variant === "secondary") {
          e.currentTarget.style.borderColor = "var(--av-border-default)";
          e.currentTarget.style.background = "var(--av-bg-elevated)";
        } else if (variant === "ghost") {
          e.currentTarget.style.background = "transparent";
          e.currentTarget.style.borderColor = "transparent";
        }
        props.onMouseLeave?.(e);
      }}
      onMouseDown={(e) => {
        if (!disabled) e.currentTarget.style.transform = "scale(0.97)";
        props.onMouseDown?.(e);
      }}
      onMouseUp={(e) => {
        if (!disabled) e.currentTarget.style.transform = "";
        props.onMouseUp?.(e);
      }}
    >
      {children}
    </button>
  );
});
Button.displayName = "Button";

export const Card = ({
  children,
  style,
  className,
}: {
  children: ReactNode;
  style?: React.CSSProperties;
  className?: string;
}) => (
  <div
    className={className}
    style={{
      background: "var(--av-bg-elevated)",
      border: "1px solid var(--av-border-default)",
      borderRadius: "var(--av-radius-lg)",
      boxShadow: "var(--av-shadow-md)",
      padding: 28,
      transition: "background 400ms ease",
      ...style,
    }}
  >
    {children}
  </div>
);
