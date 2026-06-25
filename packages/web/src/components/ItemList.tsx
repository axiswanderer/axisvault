import { Search, Plus, Star, Globe, Key } from "lucide-react";
import { useVaultStore } from "../store/vaultStore";
import type { DecryptedVaultItem, VaultItemType } from "@axisvault/shared";

/* ── Type metadata ─────────────────────────── */

const TYPE_META: Record<
  "login" | "apikey",
  { label: string; icon: React.ReactNode; iconBg: string; iconColor: string }
> = {
  login: {
    label:      "Logins",
    icon:       <Globe size={13} />,
    iconBg:     "var(--av-accent-glow)",
    iconColor:  "var(--av-accent-400)",
  },
  apikey: {
    label:      "API Keys & Credentials",
    icon:       <Key size={13} />,
    iconBg:     "rgba(255,149,0,0.14)",
    iconColor:  "var(--av-accent-300)",
  },
};

/* ── Component ─────────────────────────────── */

export function ItemList({
  onCreateNew,
}: {
  onCreateNew: (type?: VaultItemType) => void;
}) {
  const items            = useVaultStore((s) => s.items);
  const folders          = useVaultStore((s) => s.folders);
  const selectedFolderId = useVaultStore((s) => s.selectedFolderId);
  const selectedItemId   = useVaultStore((s) => s.selectedItemId);
  const selectItem       = useVaultStore((s) => s.selectItem);
  const searchQuery      = useVaultStore((s) => s.searchQuery);
  const setSearchQuery   = useVaultStore((s) => s.setSearchQuery);

  /* Base filter (folder / favorites) */
  const scoped = items.filter((item) => {
    if (selectedFolderId === "__favorites__") return item.favorite;
    if (selectedFolderId) return item.folderId === selectedFolderId;
    return true;
  });

  /* Search filter */
  const q = searchQuery.trim().toLowerCase();
  const filtered = q
    ? scoped.filter((item) => {
        const usernameMatch = item.data.type === "login"
          ? item.data.username.toLowerCase().includes(q)
          : false;
        const keyHeaderMatch = item.data.type === "apikey"
          ? (item.data.keyHeader ?? "").toLowerCase().includes(q)
          : false;
        return item.name.toLowerCase().includes(q) || usernameMatch || keyHeaderMatch;
      })
    : scoped;

  /* Group into sections */
  const logins  = filtered.filter((i) => i.data.type === "login").sort((a, b) => a.name.localeCompare(b.name));
  const apikeys = filtered.filter((i) => i.data.type === "apikey").sort((a, b) => a.name.localeCompare(b.name));
  const others  = filtered.filter((i) => i.data.type !== "login" && i.data.type !== "apikey").sort((a, b) => a.name.localeCompare(b.name));

  const folderLabel =
    selectedFolderId === "__favorites__"
      ? "Favorites"
      : selectedFolderId
      ? folders.find((f) => f.id === selectedFolderId)?.name ?? "Folder"
      : "All items";

  const isEmpty = filtered.length === 0;

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h2 style={{ fontSize: 14, fontWeight: 600, color: "var(--av-text-primary)", letterSpacing: "-0.01em" }}>
          {folderLabel}
        </h2>
        <button onClick={() => onCreateNew()} style={styles.newBtn} title="New item">
          <Plus size={14} />
        </button>
      </div>

      {/* Search */}
      <div style={styles.searchWrapper}>
        <div style={{ position: "relative" }}>
          <Search
            size={13}
            style={{
              position: "absolute",
              left: 12,
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--av-text-muted)",
              pointerEvents: "none",
            }}
          />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search…"
            style={styles.searchInput}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = "var(--av-border-accent)";
              e.currentTarget.style.boxShadow   = "0 0 0 3px var(--av-accent-glow)";
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = "var(--av-border-default)";
              e.currentTarget.style.boxShadow   = "none";
            }}
          />
        </div>
      </div>

      {/* Sections */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {isEmpty ? (
          <div style={styles.empty}>
            <div style={styles.emptyIcon}>
              <Search size={18} style={{ color: "var(--av-text-muted)" }} />
            </div>
            <p style={{ color: "var(--av-text-muted)", fontSize: 13, margin: 0 }}>
              {q ? "No matches found." : "Nothing here yet."}
            </p>
          </div>
        ) : (
          <>
            {/* Logins */}
            {(logins.length > 0 || !q) && (
              <Section
                type="login"
                items={logins}
                selectedItemId={selectedItemId}
                onSelect={(id) => selectItem(id)}
                onAdd={() => onCreateNew("login")}
                showAdd={!q}
              />
            )}

            {/* API Keys */}
            {(apikeys.length > 0 || !q) && (
              <Section
                type="apikey"
                items={apikeys}
                selectedItemId={selectedItemId}
                onSelect={(id) => selectItem(id)}
                onAdd={() => onCreateNew("apikey")}
                showAdd={!q}
              />
            )}

            {/* Other types (card, note, identity) — flat, no add button */}
            {others.length > 0 && others.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                active={item.id === selectedItemId}
                onClick={() => selectItem(item.id)}
              />
            ))}
          </>
        )}
      </div>
    </div>
  );
}

/* ── Section ───────────────────────────────── */

function Section({
  type,
  items,
  selectedItemId,
  onSelect,
  onAdd,
  showAdd,
}: {
  type: "login" | "apikey";
  items: DecryptedVaultItem[];
  selectedItemId: string | null;
  onSelect: (id: string) => void;
  onAdd: () => void;
  showAdd: boolean;
}) {
  const meta = TYPE_META[type];

  return (
    <div style={styles.section}>
      {/* Section header */}
      <div style={styles.sectionHeader}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <span
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 20,
              height: 20,
              borderRadius: 5,
              background: meta.iconBg,
              color: meta.iconColor,
              flexShrink: 0,
            }}
          >
            {meta.icon}
          </span>
          <span style={styles.sectionLabel}>{meta.label}</span>
          <span style={styles.sectionCount}>{items.length}</span>
        </div>

        {showAdd && (
          <button
            onClick={onAdd}
            style={styles.sectionAddBtn}
            title={`New ${type === "login" ? "login" : "API key"}`}
          >
            <Plus size={12} />
          </button>
        )}
      </div>

      {/* Items */}
      {items.length === 0 ? (
        <div style={styles.sectionEmpty}>
          <span>No {type === "login" ? "logins" : "API keys"} yet.</span>
          {showAdd && (
            <button onClick={onAdd} style={styles.sectionEmptyAdd}>
              <Plus size={11} /> Add one
            </button>
          )}
        </div>
      ) : (
        items.map((item) => (
          <ItemRow
            key={item.id}
            item={item}
            active={item.id === selectedItemId}
            onClick={() => onSelect(item.id)}
          />
        ))
      )}
    </div>
  );
}

/* ── Item row ──────────────────────────────── */

function ItemRow({
  item,
  active,
  onClick,
}: {
  item: DecryptedVaultItem;
  active: boolean;
  onClick: () => void;
}) {
  const isLogin  = item.data.type === "login";
  const isApiKey = item.data.type === "apikey";

  const subtitle = (() => {
    if (isLogin  && item.data.type === "login")  return item.data.username;
    if (isApiKey && item.data.type === "apikey") {
      if (item.data.serviceUrl) return item.data.serviceUrl;
      if (item.data.keyHeader)  return `${item.data.keyHeader}${item.data.keyScheme ? ` · ${item.data.keyScheme}` : ""}`;
      return "";
    }
    return "";
  })();

  const iconBg    = active ? "var(--av-accent-glow)" : (isApiKey ? "rgba(255,149,0,0.14)" : "var(--av-accent-glow)");
  const iconColor = active ? "var(--av-accent-400)" : (isApiKey ? "var(--av-accent-300)" : "var(--av-accent-400)");

  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "9px 14px 9px 20px",
        background: active ? "var(--av-bg-hover)" : "none",
        border: "none",
        borderLeft: active ? "2px solid var(--av-accent-500)" : "2px solid transparent",
        cursor: "pointer",
        textAlign: "left",
        transition: "all 120ms ease",
      }}
      onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = "var(--av-bg-elevated)"; }}
      onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = "none"; }}
    >
      <span
        style={{
          width: 30,
          height: 30,
          borderRadius: "var(--av-radius-sm)",
          background: iconBg,
          color: iconColor,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          transition: "all 120ms ease",
        }}
      >
        {isApiKey ? <Key size={13} /> : <Globe size={13} />}
      </span>

      <span style={{ flex: 1, overflow: "hidden" }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: "var(--av-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {item.name}
        </div>
        {subtitle && (
          <div
            className="av-mono"
            style={{ fontSize: 11, color: "var(--av-text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 1 }}
          >
            {subtitle}
          </div>
        )}
      </span>

      {item.favorite && (
        <Star size={11} fill="var(--av-warning)" color="var(--av-warning)" style={{ flexShrink: 0, opacity: 0.85 }} />
      )}
    </button>
  );
}

/* ── Styles ────────────────────────────────── */

const styles: Record<string, React.CSSProperties> = {
  container: {
    width: "var(--av-itemlist-width)",
    borderRight: "1px solid var(--av-border-subtle)",
    display: "flex",
    flexDirection: "column",
    height: "100vh",
    flexShrink: 0,
    background: "var(--av-bg-primary)",
    transition: "background 400ms ease",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "16px 14px 10px",
  },
  newBtn: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 28,
    height: 28,
    background: "linear-gradient(135deg, var(--av-accent-600), var(--av-accent-400))",
    border: "none",
    borderRadius: "var(--av-radius-sm)",
    color: "#fff",
    cursor: "pointer",
    boxShadow: "0 0 12px var(--av-accent-glow)",
    transition: "box-shadow 150ms ease",
  },
  searchWrapper: {
    padding: "0 14px 10px",
  },
  searchInput: {
    width: "100%",
    padding: "8px 12px 8px 34px",
    background: "var(--av-bg-input)",
    border: "1px solid var(--av-border-default)",
    borderRadius: "var(--av-radius-sm)",
    color: "var(--av-text-primary)",
    fontSize: 13,
    outline: "none",
    transition: "border-color 150ms ease, box-shadow 150ms ease",
    fontFamily: "inherit",
  },
  section: {
    marginBottom: 4,
  },
  sectionHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "10px 14px 6px",
    position: "sticky" as const,
    top: 0,
    background: "var(--av-bg-primary)",
    zIndex: 1,
    borderBottom: "1px solid var(--av-border-subtle)",
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.06em",
    textTransform: "uppercase" as const,
    color: "var(--av-text-muted)",
    fontFamily: "var(--av-font-data)",
  },
  sectionCount: {
    fontSize: 10,
    fontWeight: 600,
    fontFamily: "var(--av-font-data)",
    color: "var(--av-accent-400)",
    background: "var(--av-accent-glow)",
    border: "1px solid var(--av-border-accent)",
    borderRadius: 20,
    padding: "1px 6px",
    letterSpacing: "0.04em",
  },
  sectionAddBtn: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 22,
    height: 22,
    background: "var(--av-bg-elevated)",
    border: "1px solid var(--av-border-default)",
    borderRadius: 5,
    color: "var(--av-text-muted)",
    cursor: "pointer",
    transition: "all 120ms ease",
    flexShrink: 0,
  },
  sectionEmpty: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 20px 14px",
    fontSize: 12,
    color: "var(--av-text-muted)",
  },
  sectionEmptyAdd: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    background: "none",
    border: "none",
    color: "var(--av-accent-400)",
    fontSize: 12,
    fontWeight: 500,
    cursor: "pointer",
    padding: 0,
  },
  empty: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 12,
    padding: "48px 16px",
  },
  emptyIcon: {
    width: 44,
    height: 44,
    borderRadius: "var(--av-radius-md)",
    background: "var(--av-bg-elevated)",
    border: "1px solid var(--av-border-subtle)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
};
