import { create } from "zustand";
import { encryptJson, decryptJson, type DecryptedVaultItem, type DecryptedFolder, type VaultItemData } from "@axisvault/shared";
import { api } from "../lib/apiClient";
import { useAuthStore, registerVaultClearer } from "./authStore";

interface VaultState {
  items: DecryptedVaultItem[];
  folders: DecryptedFolder[];
  syncToken: string;
  isSyncing: boolean;
  lastSyncError: string | null;
  searchQuery: string;
  selectedFolderId: string | null;
  selectedItemId: string | null;

  setSearchQuery: (q: string) => void;
  selectFolder: (id: string | null) => void;
  selectItem: (id: string | null) => void;

  pullFromServer: () => Promise<void>;
  saveItem: (item: { id?: string; folderId: string | null; name: string; data: VaultItemData; favorite: boolean }) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
  saveFolder: (name: string, parentId: string | null, id?: string) => Promise<void>;
  deleteFolder: (id: string) => Promise<void>;
  clearLocalState: () => void;
}

function requireVaultKey(): CryptoKey {
  const vaultKey = useAuthStore.getState().vaultKey;
  if (!vaultKey) throw new Error("Vault is locked. Unlock it before accessing credentials.");
  return vaultKey;
}

export const useVaultStore = create<VaultState>((set, get) => ({
  items: [],
  folders: [],
  syncToken: "0",
  isSyncing: false,
  lastSyncError: null,
  searchQuery: "",
  selectedFolderId: null,
  selectedItemId: null,

  setSearchQuery: (q) => set({ searchQuery: q }),
  selectFolder: (id) => set({ selectedFolderId: id, selectedItemId: null }),
  selectItem: (id) => set({ selectedItemId: id }),

  async pullFromServer() {
    set({ isSyncing: true, lastSyncError: null });
    try {
      const vaultKey = requireVaultKey();
      const { items, folders, syncToken } = await api.syncPull();

      const decryptedItems: DecryptedVaultItem[] = [];
      for (const encItem of items) {
        try {
          const decoded = await decryptJson<{ name: string; data: VaultItemData; favorite: boolean }>(encItem.payload, vaultKey);
          decryptedItems.push({
            id: encItem.id,
            folderId: encItem.folderId,
            name: decoded.name,
            data: decoded.data,
            favorite: decoded.favorite,
            createdAt: encItem.createdAt,
            updatedAt: encItem.updatedAt,
            revision: encItem.revision,
          });
        } catch {
          // Skip items that fail to decrypt (corrupted or from a future
          // schema version) rather than crashing the whole vault load.
          continue;
        }
      }

      const decryptedFolders: DecryptedFolder[] = [];
      for (const encFolder of folders) {
        try {
          const decoded = await decryptJson<{ name: string }>(encFolder.payload, vaultKey);
          decryptedFolders.push({ id: encFolder.id, name: decoded.name, parentId: encFolder.parentId });
        } catch {
          continue;
        }
      }

      set({ items: decryptedItems, folders: decryptedFolders, syncToken, isSyncing: false });
    } catch (err) {
      set({ isSyncing: false, lastSyncError: err instanceof Error ? err.message : "Sync failed." });
      throw err;
    }
  },

  async saveItem(input) {
    const vaultKey = requireVaultKey();
    const id = input.id ?? crypto.randomUUID();
    const now = new Date().toISOString();
    const existing = get().items.find((i) => i.id === id);
    const nextRevision = existing ? existing.revision + 1 : 1;

    const payload = await encryptJson({ name: input.name, data: input.data, favorite: input.favorite }, vaultKey);

    const result = await api.syncPush({
      items: [
        {
          id,
          folderId: input.folderId,
          payload,
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
          revision: nextRevision,
        },
      ],
      folders: [],
      baseSyncToken: get().syncToken,
    });

    const updatedItem: DecryptedVaultItem = {
      id,
      folderId: input.folderId,
      name: input.name,
      data: input.data,
      favorite: input.favorite,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      revision: nextRevision,
    };

    if (result.conflicts.some((c) => c.id === id)) {
      // Someone else's edit (likely from another device) is newer than
      // what we based this save on. Don't clobber local state with our
      // stale-relative-to-server write — surface the conflict and let the
      // caller decide (typically: re-pull, then let the user redo the edit).
      set({ syncToken: result.syncToken });
      throw new Error("This item was changed on another device. Refresh and try again.");
    }

    set((state) => ({
      items: existing ? state.items.map((i) => (i.id === id ? updatedItem : i)) : [...state.items, updatedItem],
      syncToken: result.syncToken,
      selectedItemId: id,
    }));
  },

  async deleteItem(id) {
    await api.deleteItem(id);
    set((state) => ({
      items: state.items.filter((i) => i.id !== id),
      selectedItemId: state.selectedItemId === id ? null : state.selectedItemId,
    }));
  },

  async saveFolder(name, parentId, id) {
    const vaultKey = requireVaultKey();
    const folderId = id ?? crypto.randomUUID();
    const now = new Date().toISOString();
    const existing = get().folders.find((f) => f.id === folderId);

    const payload = await encryptJson({ name }, vaultKey);

    const result = await api.syncPush({
      items: [],
      folders: [
        {
          id: folderId,
          parentId,
          payload,
          createdAt: now,
          updatedAt: now,
        },
      ],
      baseSyncToken: get().syncToken,
    });

    const updatedFolder: DecryptedFolder = { id: folderId, name, parentId };
    set((state) => ({
      folders: existing ? state.folders.map((f) => (f.id === folderId ? updatedFolder : f)) : [...state.folders, updatedFolder],
      syncToken: result.syncToken,
    }));
  },

  async deleteFolder(id) {
    await api.deleteFolder(id);
    set((state) => ({
      folders: state.folders.filter((f) => f.id !== id),
      // Items in a deleted folder move to "no folder" rather than vanishing.
      items: state.items.map((i) => (i.folderId === id ? { ...i, folderId: null } : i)),
      selectedFolderId: state.selectedFolderId === id ? null : state.selectedFolderId,
    }));
  },

  clearLocalState() {
    set({ items: [], folders: [], syncToken: "0", selectedFolderId: null, selectedItemId: null, searchQuery: "" });
  },
}));

registerVaultClearer(() => useVaultStore.getState().clearLocalState());
