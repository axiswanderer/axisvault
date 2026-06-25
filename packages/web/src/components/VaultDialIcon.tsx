interface VaultDialIconProps {
  locked: boolean;
  size?: number;
  className?: string;
}

export function VaultDialIcon({ locked, size = 28, className }: VaultDialIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      className={className}
      role="img"
      aria-label={locked ? "Vault locked" : "Vault unlocked"}
    >
      <defs>
        <linearGradient id="dial-spokes" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffbf66" />
          <stop offset="100%" stopColor="#00e8c2" />
        </linearGradient>
        <linearGradient id="dial-ring" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ff9500" />
          <stop offset="100%" stopColor="#00c9a7" />
        </linearGradient>
        <radialGradient id="dial-center" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffaa33" />
          <stop offset="100%" stopColor="#ff6800" />
        </radialGradient>
      </defs>

      {/* Outer ring */}
      <circle cx="24" cy="24" r="21" fill="var(--av-bg-elevated)" stroke="var(--av-border-default)" strokeWidth="1.5" />
      {/* Inner ring — accent */}
      <circle cx="24" cy="24" r="15.5" stroke="url(#dial-ring)" strokeWidth="1.5" fill="none" opacity="0.55" />

      {/* Rotating spokes */}
      <g
        style={{
          transformOrigin: "24px 24px",
          transform: locked ? "rotate(0deg)" : "rotate(28deg)",
          transition: "transform 500ms cubic-bezier(0.34, 1.56, 0.64, 1)",
        }}
      >
        <line x1="24" y1="10" x2="24" y2="18" stroke="url(#dial-spokes)" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="24" y1="30" x2="24" y2="38" stroke="url(#dial-spokes)" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="10" y1="24" x2="18" y2="24" stroke="url(#dial-spokes)" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="30" y1="24" x2="38" y2="24" stroke="url(#dial-spokes)" strokeWidth="2.5" strokeLinecap="round" />
      </g>

      {/* Center pip */}
      <circle
        cx="24"
        cy="24"
        r="5"
        fill="url(#dial-center)"
        style={{ transition: "opacity 300ms ease", opacity: locked ? 0.6 : 1 }}
      />
    </svg>
  );
}
