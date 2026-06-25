import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Folder, Star, Plus, LockKeyhole, Download, Settings, Layers, Sun, Moon } from "lucide-react";
import { useVaultStore } from "../store/vaultStore";
import { useAuthStore } from "../store/authStore";
import { useTheme } from "../hooks/useTheme";
import { VaultDialIcon } from "./VaultDialIcon";

export function Sidebar() {
  const navigate = useNavigate();
  const folders = useVaultStore((s) => s.folders);
  const items = useVaultStore((s) => s.items);
  const selectedFolderId = useVaultStore((s) => s.selectedFolderId);
  const selectFolder = useVaultStore((s) => s.selectFolder);
  const saveFolder = useVaultStore((s) => s.saveFolder);
  const lock = useAuthStore((s) => s.lock);
  const email = useAuthStore((s) => s.email);
  const { theme, toggleTheme } = useTheme();

  const [isAddingFolder, setIsAddingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  const favoriteCount = items.filter((i) => i.favorite).length;

  async function handleCreateFolder() {
    if (newFolderName.trim()) await saveFolder(newFolderName.trim(), null);
    setNewFolderName("");
    setIsAddingFolder(false);
  }

  return (
    <aside style={styles.sidebar}>
      {/* Brand */}
      <div style={styles.brand}>
        <VaultDialIcon locked={false} size={24} />
        <span className="av-glitch av-gradient-text" style={{ fontWeight: 700, fontSize: 15, letterSpacing: "-0.02em" }}>
          AxisVault
        </span>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
        <NavItem
          icon={<Layers size={15} />}
          label="All items"
          count={items.length}
          active={selectedFolderId === null}
          onClick={() => selectFolder(null)}
        />
        <NavItem
          icon={<Star size={15} />}
          label="Favorites"
          count={favoriteCount}
          active={selectedFolderId === "__favorites__"}
          onClick={() => selectFolder("__favorites__")}
        />

        <div style={styles.sectionHeader}>
          <span>Folders</span>
          <button
            onClick={() => setIsAddingFolder(true)}
            style={styles.addFolderBtn}
            title="New folder"
          >
            <Plus size={13} />
          </button>
        </div>

        {folders.map((folder) => (
          <NavItem
            key={folder.id}
            icon={<Folder size={15} />}
            label={folder.name}
            count={items.filter((i) => i.folderId === folder.id).length}
            active={selectedFolderId === folder.id}
            onClick={() => selectFolder(folder.id)}
          />
        ))}

        {isAddingFolder && (
          <div style={{ padding: "4px 12px" }}>
            <input
              autoFocus
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateFolder();
                if (e.key === "Escape") setIsAddingFolder(false);
              }}
              onBlur={handleCreateFolder}
              placeholder="Folder name…"
              style={styles.folderInput}
            />
          </div>
        )}
      </nav>

      {/* Footer */}
      <div style={styles.footer}>
        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          style={styles.themeToggle}
          title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        >
          <span style={{ display: "flex", alignItems: "center", gap: 9 }}>
            {theme === "dark"
              ? <Sun size={14} style={{ color: "var(--av-accent-400)" }} />
              : <Moon size={14} style={{ color: "var(--av-accent-400)" }} />
            }
            <span style={{ fontSize: 13 }}>
              {theme === "dark" ? "Light mode" : "Dark mode"}
            </span>
          </span>
          <span style={styles.themePill}>
            {theme === "dark" ? "DARK" : "LIGHT"}
          </span>
        </button>

        <div style={styles.footerDivider} />

        <FooterBtn icon={<Settings size={14} />} label="Settings" onClick={() => navigate("/settings")} />
        <FooterBtn icon={<Download size={14} />} label="Export" onClick={() => navigate("/export")} />
        <FooterBtn
          icon={<LockKeyhole size={14} />}
          label="Lock vault"
          onClick={() => lock("manual")}
          accent
        />
        {email && (
          <div style={styles.email} title={email}>
            {email}
          </div>
        )}
      </div>
    </aside>
  );
}

function NavItem({
  icon,
  label,
  count,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "8px 14px",
        margin: "1px 0",
        background: active ? "var(--av-bg-hover)" : "none",
        border: "none",
        borderLeft: active ? "2px solid var(--av-accent-500)" : "2px solid transparent",
        borderRadius: active ? "0 var(--av-radius-sm) var(--av-radius-sm) 0" : 0,
        color: active ? "var(--av-text-primary)" : "var(--av-text-secondary)",
        fontSize: 13,
        fontWeight: active ? 500 : 400,
        cursor: "pointer",
        textAlign: "left",
        transition: "all 150ms ease",
        boxShadow: active ? "inset 0 0 12px rgba(255,149,0,0.06)" : "none",
        animation: active ? "activePulse 3s ease-in-out infinite" : "none",
      }}
      onMouseEnter={(e) => {
        if (!active) {
          e.currentTarget.style.background = "var(--av-bg-elevated)";
          e.currentTarget.style.color = "var(--av-text-primary)";
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.currentTarget.style.background = "none";
          e.currentTarget.style.color = "var(--av-text-secondary)";
        }
      }}
    >
      <span style={{ display: "flex", alignItems: "center", gap: 9, overflow: "hidden" }}>
        <span
          style={{
            color: active ? "var(--av-accent-400)" : "var(--av-text-muted)",
            flexShrink: 0,
            transition: "color 150ms ease",
          }}
        >
          {icon}
        </span>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {label}
        </span>
      </span>
      {count > 0 && (
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            fontFamily: "var(--av-font-data)",
            color: active ? "var(--av-accent-400)" : "var(--av-text-muted)",
            background: active ? "var(--av-accent-glow)" : "var(--av-border-subtle)",
            borderRadius: 20,
            padding: "1px 7px",
            flexShrink: 0,
            letterSpacing: "0.04em",
          }}
        >
          {count}
        </span>
      )}
    </button>
  );
}

function FooterBtn({
  icon,
  label,
  onClick,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  accent?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: 9,
        padding: "7px 10px",
        background: "none",
        border: "none",
        color: accent ? "var(--av-accent-400)" : "var(--av-text-secondary)",
        fontSize: 13,
        cursor: "pointer",
        borderRadius: "var(--av-radius-sm)",
        transition: "all 120ms ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "var(--av-bg-elevated)";
        e.currentTarget.style.color = accent ? "var(--av-accent-300)" : "var(--av-text-primary)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "none";
        e.currentTarget.style.color = accent ? "var(--av-accent-400)" : "var(--av-text-secondary)";
      }}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

const styles: Record<string, React.CSSProperties> = {
  sidebar: {
    width: "var(--av-sidebar-width)",
    background: "var(--av-bg-surface)",
    borderRight: "1px solid var(--av-border-subtle)",
    display: "flex",
    flexDirection: "column",
    height: "100vh",
    flexShrink: 0,
    transition: "background 400ms ease",
  },
  brand: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "16px 14px",
    borderBottom: "1px solid var(--av-border-subtle)",
  },
  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "16px 14px 6px",
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: "0.10em",
    textTransform: "uppercase" as const,
    color: "var(--av-text-muted)",
    fontFamily: "var(--av-font-data)",
  },
  addFolderBtn: {
    background: "none",
    border: "none",
    color: "var(--av-text-muted)",
    cursor: "pointer",
    display: "flex",
    padding: 3,
    borderRadius: 4,
    transition: "color 120ms ease",
  },
  folderInput: {
    width: "100%",
    padding: "7px 10px",
    background: "var(--av-bg-input)",
    border: "1px solid var(--av-border-accent)",
    borderRadius: "var(--av-radius-sm)",
    color: "var(--av-text-primary)",
    fontSize: 13,
    outline: "none",
    boxShadow: "0 0 0 3px var(--av-accent-glow)",
    fontFamily: "var(--av-font-ui)",
  },
  footer: {
    borderTop: "1px solid var(--av-border-subtle)",
    padding: "10px 8px",
  },
  footerDivider: {
    height: 1,
    background: "var(--av-border-subtle)",
    margin: "6px 0",
  },
  themeToggle: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "7px 10px",
    background: "var(--av-bg-elevated)",
    border: "1px solid var(--av-border-default)",
    borderRadius: "var(--av-radius-sm)",
    color: "var(--av-text-secondary)",
    cursor: "pointer",
    marginBottom: 4,
    transition: "all 150ms ease",
  },
  themePill: {
    fontSize: 9,
    fontWeight: 700,
    fontFamily: "var(--av-font-data)",
    letterSpacing: "0.12em",
    color: "var(--av-accent-400)",
    background: "var(--av-accent-glow)",
    border: "1px solid var(--av-border-accent)",
    borderRadius: 20,
    padding: "2px 7px",
  },
  email: {
    fontSize: 11,
    color: "var(--av-text-muted)",
    fontFamily: "var(--av-font-data)",
    padding: "6px 10px 2px",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
};
