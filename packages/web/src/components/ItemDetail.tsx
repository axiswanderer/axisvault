import { useEffect, useState } from "react";
import {
  Copy, Eye, EyeOff, Star, Trash2, Check, Globe,
  Plus, X, Key, ChevronRight, RefreshCw, Calendar,
} from "lucide-react";
import { useVaultStore } from "../store/vaultStore";
import type { LoginItemData, ApiKeyItemData, VaultItemType } from "@axisvault/shared";
import { Input, Button, Field } from "./ui";
import { PasswordGenerator } from "./PasswordGenerator";

/* ── Type picker ─────────────────────────────── */

const ITEM_TYPES: { type: VaultItemType; label: string; icon: React.ReactNode; desc: string }[] = [
  {
    type: "login",
    label: "Login",
    icon: <Globe size={22} />,
    desc: "Username, password & URLs",
  },
  {
    type: "apikey",
    label: "API Key",
    icon: <Key size={22} />,
    desc: "Secret keys & credentials",
  },
];

const COMMON_HEADERS = ["Authorization", "X-API-Key", "X-Auth-Token", "API-Key", "X-Access-Token"];
const COMMON_SCHEMES = ["Bearer", "Token", "Basic", "ApiKey"];

/* ── Props ───────────────────────────────────── */

export function ItemDetail({
  itemId,
  isNew,
  defaultType,
  defaultFolderId,
  onClose,
}: {
  itemId: string | null;
  isNew: boolean;
  defaultType?: VaultItemType;
  defaultFolderId: string | null;
  onClose: () => void;
}) {
  const items     = useVaultStore((s) => s.items);
  const saveItem  = useVaultStore((s) => s.saveItem);
  const deleteItem = useVaultStore((s) => s.deleteItem);

  const existing = itemId ? items.find((i) => i.id === itemId) : undefined;

  /* Which type is being edited / will be created.
     defaultType skips the picker when coming from a section's + button. */
  const [pickedType, setPickedType] = useState<VaultItemType | null>(
    isNew ? (defaultType ?? null) : (existing?.data.type ?? null),
  );

  /* Shared */
  const [name, setName]         = useState(existing?.name ?? "");
  const [favorite, setFavorite] = useState(existing?.favorite ?? false);

  /* Login fields */
  const [username, setUsername]   = useState(existing?.data.type === "login" ? existing.data.username : "");
  const [password, setPassword]   = useState(existing?.data.type === "login" ? existing.data.password : "");
  const [uris, setUris]           = useState<string[]>(existing?.data.type === "login" ? existing.data.uris : [""]);
  const [loginNotes, setLoginNotes] = useState(existing?.data.type === "login" ? (existing.data.notes ?? "") : "");

  /* API Key fields */
  const [apiKey, setApiKey]       = useState(existing?.data.type === "apikey" ? existing.data.key : "");
  const [keyHeader, setKeyHeader] = useState(existing?.data.type === "apikey" ? (existing.data.keyHeader ?? "") : "");
  const [keyScheme, setKeyScheme] = useState(existing?.data.type === "apikey" ? (existing.data.keyScheme ?? "") : "");
  const [serviceUrl, setServiceUrl] = useState(existing?.data.type === "apikey" ? (existing.data.serviceUrl ?? "") : "");
  const [expiresAt, setExpiresAt] = useState(existing?.data.type === "apikey" ? (existing.data.expiresAt ?? "") : "");
  const [apiNotes, setApiNotes]   = useState(existing?.data.type === "apikey" ? (existing.data.notes ?? "") : "");

  /* UI state */
  const [showSecret, setShowSecret]   = useState(false);
  const [showGenerator, setShowGenerator] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isDirty, setIsDirty]         = useState(false);
  const [isSaving, setIsSaving]       = useState(false);
  const [saveError, setSaveError]     = useState<string | null>(null);

  /* Reset when item changes */
  useEffect(() => {
    setPickedType(isNew ? (defaultType ?? null) : (existing?.data.type ?? null));
    setName(existing?.name ?? "");
    setFavorite(existing?.favorite ?? false);
    setUsername(existing?.data.type === "login" ? existing.data.username : "");
    setPassword(existing?.data.type === "login" ? existing.data.password : "");
    setUris(existing?.data.type === "login" ? existing.data.uris : [""]);
    setLoginNotes(existing?.data.type === "login" ? (existing.data.notes ?? "") : "");
    setApiKey(existing?.data.type === "apikey" ? existing.data.key : "");
    setKeyHeader(existing?.data.type === "apikey" ? (existing.data.keyHeader ?? "") : "");
    setKeyScheme(existing?.data.type === "apikey" ? (existing.data.keyScheme ?? "") : "");
    setServiceUrl(existing?.data.type === "apikey" ? (existing.data.serviceUrl ?? "") : "");
    setExpiresAt(existing?.data.type === "apikey" ? (existing.data.expiresAt ?? "") : "");
    setApiNotes(existing?.data.type === "apikey" ? (existing.data.notes ?? "") : "");
    setIsDirty(false);
    setShowSecret(false);
    setShowGenerator(false);
    setSaveError(null);
  }, [itemId, isNew, defaultType]); // eslint-disable-line react-hooks/exhaustive-deps

  function markDirty<T>(setter: (v: T) => void) {
    return (v: T) => { setter(v); setIsDirty(true); };
  }

  async function copyToClipboard(value: string, field: string) {
    await navigator.clipboard.writeText(value);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 1500);
    setTimeout(async () => {
      try {
        const cur = await navigator.clipboard.readText();
        if (cur === value) await navigator.clipboard.writeText("");
      } catch { /* clipboard read permission denied */ }
    }, 30_000);
  }

  async function handleSave() {
    if (!name.trim()) { setSaveError("Give this item a name before saving."); return; }
    setIsSaving(true);
    setSaveError(null);
    try {
      if (pickedType === "login") {
        const data: LoginItemData = {
          type: "login",
          username,
          password,
          uris: uris.filter((u) => u.trim().length > 0),
          notes: loginNotes || undefined,
        };
        await saveItem({ id: existing?.id, folderId: existing?.folderId ?? defaultFolderId, name: name.trim(), data, favorite });
      } else if (pickedType === "apikey") {
        const data: ApiKeyItemData = {
          type: "apikey",
          key: apiKey,
          keyHeader:  keyHeader.trim()  || undefined,
          keyScheme:  keyScheme.trim()  || undefined,
          serviceUrl: serviceUrl.trim() || undefined,
          expiresAt:  expiresAt.trim()  || undefined,
          notes:      apiNotes.trim()   || undefined,
        };
        await saveItem({ id: existing?.id, folderId: existing?.folderId ?? defaultFolderId, name: name.trim(), data, favorite });
      }
      setIsDirty(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Couldn't save this item.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (!existing) return;
    if (!window.confirm(`Delete "${existing.name}"? This cannot be undone.`)) return;
    await deleteItem(existing.id);
    onClose();
  }

  /* ── Empty state ── */
  if (!itemId && !isNew) {
    return (
      <div style={styles.emptyState}>
        <div style={styles.emptyIconWrap}>
          <Key size={22} style={{ color: "var(--av-text-muted)" }} />
        </div>
        <p style={{ color: "var(--av-text-muted)", fontSize: 13, margin: "12px 0 4px" }}>
          Select an item or create a new one
        </p>
        <p style={{ color: "var(--av-text-muted)", fontSize: 11, margin: 0, fontFamily: "var(--av-font-data)", letterSpacing: "0.06em" }}>
          ALL DATA ENCRYPTED CLIENT-SIDE
        </p>
      </div>
    );
  }

  /* ── Type picker (new item, no type chosen yet) ── */
  if (isNew && pickedType === null) {
    return (
      <div style={styles.detail} className="av-animate-in">
        <div style={styles.pickerHeader}>
          <h2 style={{ fontSize: 16 }}>New item</h2>
          <IconBtn onClick={onClose}><X size={15} /></IconBtn>
        </div>
        <div style={styles.pickerBody}>
          <p style={{ fontSize: 13, color: "var(--av-text-muted)", margin: "0 0 24px" }}>
            What would you like to store?
          </p>
          <div style={styles.pickerGrid}>
            {ITEM_TYPES.map(({ type, label, icon, desc }) => (
              <button
                key={type}
                onClick={() => setPickedType(type)}
                style={styles.pickerCard}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "var(--av-border-accent)";
                  e.currentTarget.style.background   = "var(--av-bg-hover)";
                  e.currentTarget.style.boxShadow    = "var(--av-shadow-glow)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "var(--av-border-default)";
                  e.currentTarget.style.background   = "var(--av-bg-elevated)";
                  e.currentTarget.style.boxShadow    = "var(--av-shadow-sm)";
                }}
              >
                <span style={styles.pickerCardIcon}>{icon}</span>
                <span style={{ fontWeight: 600, fontSize: 14, color: "var(--av-text-primary)" }}>{label}</span>
                <span style={{ fontSize: 12, color: "var(--av-text-muted)", marginTop: 2 }}>{desc}</span>
                <ChevronRight size={14} style={{ color: "var(--av-accent-400)", marginTop: 10 }} />
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  /* ── Detail form ── */
  return (
    <div style={styles.detail} className="av-animate-in">
      {/* Header */}
      <div style={styles.header}>
        <input
          value={name}
          onChange={(e) => markDirty(setName)(e.target.value)}
          placeholder={pickedType === "apikey" ? "Key name…" : "Item name…"}
          style={styles.nameInput}
        />
        <div style={{ display: "flex", gap: 6 }}>
          <IconBtn
            onClick={() => markDirty(setFavorite)(!favorite)}
            title="Favorite"
            active={favorite}
          >
            <Star size={15} fill={favorite ? "var(--av-warning)" : "none"} color={favorite ? "var(--av-warning)" : "var(--av-text-muted)"} />
          </IconBtn>
          {existing && (
            <IconBtn onClick={handleDelete} title="Delete" danger>
              <Trash2 size={15} color="var(--av-danger)" />
            </IconBtn>
          )}
          <IconBtn onClick={onClose} title="Close"><X size={15} /></IconBtn>
        </div>
      </div>

      {/* Type badge */}
      <div style={styles.typeBadge}>
        {pickedType === "apikey" ? <Key size={11} /> : <Globe size={11} />}
        <span>{pickedType === "apikey" ? "API Key / Credential" : "Login"}</span>
      </div>

      {/* Fields */}
      <div style={styles.body}>
        {pickedType === "login" && (
          <LoginForm
            username={username} setUsername={markDirty(setUsername)}
            password={password} setPassword={markDirty(setPassword)}
            uris={uris} setUris={markDirty(setUris)}
            notes={loginNotes} setNotes={markDirty(setLoginNotes)}
            showPassword={showSecret} setShowPassword={setShowSecret}
            showGenerator={showGenerator} setShowGenerator={setShowGenerator}
            copiedField={copiedField} copyToClipboard={copyToClipboard}
          />
        )}

        {pickedType === "apikey" && (
          <ApiKeyForm
            apiKey={apiKey} setApiKey={markDirty(setApiKey)}
            keyHeader={keyHeader} setKeyHeader={markDirty(setKeyHeader)}
            keyScheme={keyScheme} setKeyScheme={markDirty(setKeyScheme)}
            serviceUrl={serviceUrl} setServiceUrl={markDirty(setServiceUrl)}
            expiresAt={expiresAt} setExpiresAt={markDirty(setExpiresAt)}
            notes={apiNotes} setNotes={markDirty(setApiNotes)}
            showKey={showSecret} setShowKey={setShowSecret}
            copiedField={copiedField} copyToClipboard={copyToClipboard}
          />
        )}

        {saveError && <div style={styles.errorBanner}>{saveError}</div>}

        {(isDirty || isNew) && (
          <Button fullWidth onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving…" : isNew ? "Create item" : "Save changes"}
          </Button>
        )}
      </div>
    </div>
  );
}

/* ── Login form ─────────────────────────────── */

function LoginForm({
  username, setUsername,
  password, setPassword,
  uris, setUris,
  notes, setNotes,
  showPassword, setShowPassword,
  showGenerator, setShowGenerator,
  copiedField, copyToClipboard,
}: {
  username: string; setUsername: (v: string) => void;
  password: string; setPassword: (v: string) => void;
  uris: string[];   setUris: (v: string[]) => void;
  notes: string;    setNotes: (v: string) => void;
  showPassword: boolean; setShowPassword: (v: boolean) => void;
  showGenerator: boolean; setShowGenerator: (v: (prev: boolean) => boolean) => void;
  copiedField: string | null;
  copyToClipboard: (v: string, f: string) => void;
}) {
  return (
    <>
      <Field label="Username">
        <div style={rowStyle}>
          <Input name="item-username" value={username} onChange={(e) => setUsername(e.target.value)} mono />
          <CopyBtn onClick={() => copyToClipboard(username, "username")} copied={copiedField === "username"} />
        </div>
      </Field>

      <Field label="Password">
        <div style={rowStyle}>
          <div style={{ position: "relative", flex: 1 }}>
            <Input
              name="item-password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              mono
              style={{ paddingRight: 42 }}
            />
            <button onClick={() => setShowPassword(!showPassword)} style={styles.inlineBtn} title={showPassword ? "Hide" : "Reveal"}>
              {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
          <CopyBtn onClick={() => copyToClipboard(password, "password")} copied={copiedField === "password"} />
        </div>
        <button onClick={() => setShowGenerator((v) => !v)} style={styles.subtleLink}>
          <RefreshCw size={11} /> {showGenerator ? "Hide generator" : "Generate password"}
        </button>
        {showGenerator && (
          <div style={{ marginTop: 12 }}>
            <PasswordGenerator onUse={setPassword} />
          </div>
        )}
      </Field>

      <Field label="Website URLs">
        {uris.map((uri, idx) => (
          <div key={idx} style={{ ...rowStyle, marginBottom: 8 }}>
            <Input
              value={uri}
              placeholder="https://example.com"
              onChange={(e) => setUris(uris.map((u, i) => (i === idx ? e.target.value : u)))}
            />
            {uris.length > 1 && (
              <IconBtn onClick={() => setUris(uris.filter((_, i) => i !== idx))}><X size={13} /></IconBtn>
            )}
          </div>
        ))}
        <button onClick={() => setUris([...uris, ""])} style={styles.subtleLink}>
          <Plus size={11} /> Add URL
        </button>
      </Field>

      <Field label="Notes">
        <NoteArea value={notes} onChange={setNotes} />
      </Field>
    </>
  );
}

/* ── API Key form ───────────────────────────── */

function ApiKeyForm({
  apiKey, setApiKey,
  keyHeader, setKeyHeader,
  keyScheme, setKeyScheme,
  serviceUrl, setServiceUrl,
  expiresAt, setExpiresAt,
  notes, setNotes,
  showKey, setShowKey,
  copiedField, copyToClipboard,
}: {
  apiKey: string;    setApiKey: (v: string) => void;
  keyHeader: string; setKeyHeader: (v: string) => void;
  keyScheme: string; setKeyScheme: (v: string) => void;
  serviceUrl: string; setServiceUrl: (v: string) => void;
  expiresAt: string; setExpiresAt: (v: string) => void;
  notes: string;     setNotes: (v: string) => void;
  showKey: boolean;  setShowKey: (v: boolean) => void;
  copiedField: string | null;
  copyToClipboard: (v: string, f: string) => void;
}) {
  /* Preview of how the key would look in an HTTP header */
  const headerPreview = keyHeader
    ? `${keyHeader}: ${keyScheme ? `${keyScheme} ` : ""}${showKey ? (apiKey || "•••••••••") : "•••••••••"}`
    : null;

  /* Expiry state */
  const isExpired = expiresAt ? new Date(expiresAt) < new Date() : false;
  const daysLeft  = expiresAt
    ? Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86_400_000)
    : null;

  return (
    <>
      {/* Key value */}
      <Field label="Secret key">
        <div style={rowStyle}>
          <div style={{ position: "relative", flex: 1 }}>
            <Input
              name="api-key-value"
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              mono
              placeholder="sk-••••••••••••••••"
              style={{ paddingRight: 42, background: "var(--av-bg-surface)" }}
            />
            <button onClick={() => setShowKey(!showKey)} style={styles.inlineBtn} title={showKey ? "Hide key" : "Reveal key"}>
              {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
          <CopyBtn onClick={() => copyToClipboard(apiKey, "apikey")} copied={copiedField === "apikey"} />
        </div>
      </Field>

      {/* Header + scheme row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Header name">
          <div style={{ position: "relative" }}>
            <Input
              value={keyHeader}
              onChange={(e) => setKeyHeader(e.target.value)}
              placeholder="X-API-Key"
              list="av-header-hints"
            />
            <datalist id="av-header-hints">
              {COMMON_HEADERS.map((h) => <option key={h} value={h} />)}
            </datalist>
          </div>
        </Field>

        <Field label="Value scheme">
          <div style={{ position: "relative" }}>
            <Input
              value={keyScheme}
              onChange={(e) => setKeyScheme(e.target.value)}
              placeholder="Bearer"
              list="av-scheme-hints"
            />
            <datalist id="av-scheme-hints">
              {COMMON_SCHEMES.map((s) => <option key={s} value={s} />)}
            </datalist>
          </div>
        </Field>
      </div>

      {/* HTTP header preview */}
      {headerPreview && (
        <div style={styles.headerPreview}>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", color: "var(--av-text-muted)", fontFamily: "var(--av-font-data)" }}>
            HEADER PREVIEW
          </span>
          <div style={{ marginTop: 6 }} className="av-mono">
            <span style={{ color: "var(--av-accent-400)" }}>{keyHeader}</span>
            <span style={{ color: "var(--av-text-muted)" }}>: </span>
            {keyScheme && <span style={{ color: "var(--av-cyan-400)" }}>{keyScheme} </span>}
            <span style={{ color: "var(--av-text-primary)", wordBreak: "break-all" }}>
              {showKey ? (apiKey || "•••••••••") : "•••••••••••••••••"}
            </span>
          </div>
        </div>
      )}

      {/* Service URL */}
      <Field label="Service URL">
        <Input
          value={serviceUrl}
          onChange={(e) => setServiceUrl(e.target.value)}
          placeholder="https://api.example.com"
          type="url"
        />
      </Field>

      {/* Expiry */}
      <Field label="Expires">
        <div style={{ position: "relative" }}>
          <Input
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            type="date"
            style={expiresAt && isExpired
              ? { borderColor: "var(--av-danger-border)", background: "var(--av-danger-bg)" }
              : expiresAt && daysLeft !== null && daysLeft <= 14
              ? { borderColor: "var(--av-warning-border)", background: "var(--av-warning-bg)" }
              : {}}
          />
          <Calendar
            size={14}
            style={{
              position: "absolute",
              right: 12,
              top: "50%",
              transform: "translateY(-50%)",
              color: isExpired ? "var(--av-danger)" : daysLeft !== null && daysLeft <= 14 ? "var(--av-warning)" : "var(--av-text-muted)",
              pointerEvents: "none",
            }}
          />
        </div>
        {isExpired && (
          <p style={{ margin: "5px 0 0", fontSize: 12, color: "var(--av-danger)", fontWeight: 500 }}>
            This key has expired.
          </p>
        )}
        {!isExpired && daysLeft !== null && daysLeft <= 14 && (
          <p style={{ margin: "5px 0 0", fontSize: 12, color: "var(--av-warning)", fontWeight: 500 }}>
            Expires in {daysLeft} day{daysLeft !== 1 ? "s" : ""}.
          </p>
        )}
      </Field>

      <Field label="Notes">
        <NoteArea value={notes} onChange={setNotes} />
      </Field>
    </>
  );
}

/* ── Shared sub-components ──────────────────── */

function NoteArea({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={4}
      style={styles.notes}
      onFocus={(e) => {
        e.currentTarget.style.borderColor = "var(--av-border-accent)";
        e.currentTarget.style.boxShadow = "0 0 0 3px var(--av-accent-glow)";
      }}
      onBlur={(e) => {
        e.currentTarget.style.borderColor = "var(--av-border-default)";
        e.currentTarget.style.boxShadow = "none";
      }}
    />
  );
}

function IconBtn({
  children, onClick, title, active, danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title?: string;
  active?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 34, height: 34,
        background: active ? "var(--av-warning-bg)" : danger ? "var(--av-danger-bg)" : "var(--av-bg-elevated)",
        border: `1px solid ${active ? "var(--av-warning-border)" : danger ? "var(--av-danger-border)" : "var(--av-border-default)"}`,
        borderRadius: "var(--av-radius-sm)",
        color: "var(--av-text-secondary)",
        cursor: "pointer",
        flexShrink: 0,
        transition: "all 120ms ease",
      }}
    >
      {children}
    </button>
  );
}

function CopyBtn({ onClick, copied }: { onClick: () => void; copied: boolean }) {
  return (
    <button
      onClick={onClick}
      title="Copy"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 34, height: 34,
        background: copied ? "var(--av-success-bg)" : "var(--av-bg-elevated)",
        border: `1px solid ${copied ? "var(--av-success-border)" : "var(--av-border-default)"}`,
        borderRadius: "var(--av-radius-sm)",
        color: copied ? "var(--av-success)" : "var(--av-text-secondary)",
        cursor: "pointer",
        flexShrink: 0,
        transition: "all 150ms ease",
      }}
    >
      {copied ? <Check size={14} /> : <Copy size={14} />}
    </button>
  );
}

const rowStyle: React.CSSProperties = { display: "flex", gap: 8, alignItems: "flex-start" };

const styles: Record<string, React.CSSProperties> = {
  detail: {
    flex: 1,
    height: "100vh",
    display: "flex",
    flexDirection: "column",
    overflowY: "auto",
    background: "var(--av-bg-primary)",
    transition: "background 400ms ease",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "20px 28px",
    borderBottom: "1px solid var(--av-border-subtle)",
    gap: 12,
  },
  nameInput: {
    fontSize: 20,
    fontWeight: 600,
    letterSpacing: "-0.02em",
    background: "none",
    border: "none",
    color: "var(--av-text-primary)",
    outline: "none",
    flex: 1,
    fontFamily: "inherit",
  },
  typeBadge: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "6px 28px",
    fontSize: 10,
    fontWeight: 700,
    fontFamily: "var(--av-font-data)",
    letterSpacing: "0.10em",
    textTransform: "uppercase" as const,
    color: "var(--av-accent-400)",
    borderBottom: "1px solid var(--av-border-subtle)",
    background: "var(--av-accent-glow)",
  },
  body: {
    padding: "24px 28px",
    maxWidth: 580,
  },
  inlineBtn: {
    position: "absolute",
    right: 10,
    top: "50%",
    transform: "translateY(-50%)",
    background: "none",
    border: "none",
    color: "var(--av-text-muted)",
    cursor: "pointer",
    display: "flex",
    padding: 2,
    transition: "color 120ms ease",
  },
  subtleLink: {
    display: "flex",
    alignItems: "center",
    gap: 5,
    background: "none",
    border: "none",
    color: "var(--av-accent-400)",
    fontSize: 12,
    fontWeight: 500,
    cursor: "pointer",
    padding: 0,
    marginTop: 8,
    transition: "color 120ms ease",
  },
  headerPreview: {
    background: "var(--av-bg-surface)",
    border: "1px solid var(--av-border-subtle)",
    borderLeft: "3px solid var(--av-accent-500)",
    borderRadius: "var(--av-radius-sm)",
    padding: "10px 14px",
    marginBottom: 20,
    fontSize: 12,
  },
  notes: {
    width: "100%",
    padding: "11px 14px",
    background: "var(--av-bg-input)",
    border: "1px solid var(--av-border-default)",
    borderRadius: "var(--av-radius-sm)",
    color: "var(--av-text-primary)",
    fontSize: 13,
    fontFamily: "var(--av-font-ui)",
    resize: "vertical",
    outline: "none",
    transition: "border-color 150ms ease, box-shadow 150ms ease",
  },
  errorBanner: {
    padding: "10px 14px",
    background: "var(--av-danger-bg)",
    border: "1px solid var(--av-danger-border)",
    borderRadius: "var(--av-radius-sm)",
    color: "var(--av-danger)",
    fontSize: 13,
    marginBottom: 16,
  },
  emptyState: {
    flex: 1,
    height: "100vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    background: "var(--av-bg-primary)",
    transition: "background 400ms ease",
  },
  emptyIconWrap: {
    width: 56, height: 56,
    borderRadius: "var(--av-radius-lg)",
    background: "var(--av-bg-elevated)",
    border: "1px solid var(--av-border-subtle)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  pickerHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "20px 28px",
    borderBottom: "1px solid var(--av-border-subtle)",
  },
  pickerBody: {
    padding: "28px",
  },
  pickerGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 14,
    maxWidth: 440,
  },
  pickerCard: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    padding: "20px 18px",
    background: "var(--av-bg-elevated)",
    border: "1px solid var(--av-border-default)",
    borderRadius: "var(--av-radius-lg)",
    cursor: "pointer",
    textAlign: "left",
    boxShadow: "var(--av-shadow-sm)",
    transition: "all 160ms ease",
    gap: 4,
  },
  pickerCardIcon: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 44, height: 44,
    borderRadius: "var(--av-radius-md)",
    background: "var(--av-accent-glow)",
    border: "1px solid var(--av-border-accent)",
    color: "var(--av-accent-400)",
    marginBottom: 8,
  },
};
