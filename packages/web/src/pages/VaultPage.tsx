import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { VaultItemType } from "@axisvault/shared";
import { useVaultStore } from "../store/vaultStore";
import { Sidebar } from "../components/Sidebar";
import { ItemList } from "../components/ItemList";
import { ItemDetail } from "../components/ItemDetail";

export function VaultPage() {
  const navigate = useNavigate();
  const pullFromServer  = useVaultStore((s) => s.pullFromServer);
  const selectedItemId  = useVaultStore((s) => s.selectedItemId);
  const selectedFolderId = useVaultStore((s) => s.selectedFolderId);
  const selectItem      = useVaultStore((s) => s.selectItem);

  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newItemType, setNewItemType]     = useState<VaultItemType | undefined>(undefined);
  const [loadError, setLoadError]         = useState<string | null>(null);

  useEffect(() => {
    pullFromServer().catch((err) => {
      setLoadError(err instanceof Error ? err.message : "Couldn't load your vault.");
    });
  }, [pullFromServer]);

  function handleCreateNew(type?: VaultItemType) {
    selectItem(null);
    setNewItemType(type);
    setIsCreatingNew(true);
  }

  function handleCloseDetail() {
    selectItem(null);
    setIsCreatingNew(false);
    setNewItemType(undefined);
  }

  if (loadError) {
    return (
      <div style={{ display: "flex", height: "100vh", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16, background: "var(--av-bg-primary)" }}>
        <div style={{ padding: "12px 18px", background: "var(--av-danger-bg)", border: "1px solid var(--av-danger-border)", borderRadius: "var(--av-radius-sm)", color: "var(--av-danger)", fontSize: 14 }}>
          {loadError}
        </div>
        <button onClick={() => navigate("/login")} style={{ background: "none", border: "none", color: "var(--av-accent-300)", fontSize: 13, cursor: "pointer" }}>
          Return to sign in
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", background: "var(--av-bg-primary)" }}>
      <Sidebar />
      <ItemList onCreateNew={handleCreateNew} />
      <ItemDetail
        itemId={isCreatingNew ? null : selectedItemId}
        isNew={isCreatingNew}
        defaultType={newItemType}
        defaultFolderId={selectedFolderId === "__favorites__" ? null : selectedFolderId}
        onClose={handleCloseDetail}
      />
    </div>
  );
}
