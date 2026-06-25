import type {
  EncryptedVaultItem,
  EncryptedFolder,
  SyncPushRequest,
  SyncPushResponse,
  SyncPullResponse,
  ExportBackupResponse,
  KdfParams,
} from "@axisvault/shared";
import { pool } from "../db/pool.js";
import { HttpError } from "../middleware/errorHandler.js";

interface ItemRow {
  id: string;
  folder_id: string | null;
  payload_ciphertext: string;
  payload_iv: string;
  revision: number;
  created_at: string;
  updated_at: string;
}

interface FolderRow {
  id: string;
  parent_id: string | null;
  payload_ciphertext: string;
  payload_iv: string;
  created_at: string;
  updated_at: string;
}

function rowToItem(row: ItemRow): EncryptedVaultItem {
  return {
    id: row.id,
    folderId: row.folder_id,
    payload: { ciphertext: row.payload_ciphertext, iv: row.payload_iv, v: 1 },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    revision: row.revision,
  };
}

function rowToFolder(row: FolderRow): EncryptedFolder {
  return {
    id: row.id,
    parentId: row.parent_id,
    payload: { ciphertext: row.payload_ciphertext, iv: row.payload_iv, v: 1 },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function getCurrentClock(userId: string): Promise<number> {
  const result = await pool.query<{ clock: string }>("SELECT clock FROM sync_clocks WHERE user_id = $1", [userId]);
  return Number(result.rows[0]?.clock ?? 0);
}

async function bumpClock(userId: string): Promise<number> {
  const result = await pool.query<{ clock: string }>(
    "UPDATE sync_clocks SET clock = clock + 1 WHERE user_id = $1 RETURNING clock",
    [userId],
  );
  return Number(result.rows[0].clock);
}

/** Full pull: returns every non-deleted item/folder plus the current sync clock. Used on first login per device. */
export async function pullVault(userId: string): Promise<SyncPullResponse> {
  const [itemsResult, foldersResult, clock] = await Promise.all([
    pool.query<ItemRow>(
      "SELECT id, folder_id, payload_ciphertext, payload_iv, revision, created_at, updated_at FROM vault_items WHERE user_id = $1 AND deleted_at IS NULL",
      [userId],
    ),
    pool.query<FolderRow>(
      "SELECT id, parent_id, payload_ciphertext, payload_iv, created_at, updated_at FROM folders WHERE user_id = $1 AND deleted_at IS NULL",
      [userId],
    ),
    getCurrentClock(userId),
  ]);

  return {
    items: itemsResult.rows.map(rowToItem),
    folders: foldersResult.rows.map(rowToFolder),
    syncToken: String(clock),
  };
}

/**
 * Push: applies the client's encrypted items/folders. Uses simple
 * optimistic concurrency — each item carries a `revision`; if the
 * server's stored revision is higher than what the client last saw,
 * it's a conflict and the client must re-pull before resolving it
 * (last-write-wins is NOT applied silently, to avoid clobbering a
 * different device's edits without the user knowing).
 */
export async function pushVault(userId: string, input: SyncPushRequest): Promise<SyncPushResponse> {
  const client = await pool.connect();
  const conflicts: SyncPushResponse["conflicts"] = [];

  try {
    await client.query("BEGIN");

    for (const folder of input.folders) {
      await client.query(
        `INSERT INTO folders (id, user_id, parent_id, payload_ciphertext, payload_iv, updated_at)
         VALUES ($1, $2, $3, $4, $5, now())
         ON CONFLICT (id) DO UPDATE SET
           parent_id = EXCLUDED.parent_id,
           payload_ciphertext = EXCLUDED.payload_ciphertext,
           payload_iv = EXCLUDED.payload_iv,
           updated_at = now()
         WHERE folders.user_id = $2`,
        [folder.id, userId, folder.parentId, folder.payload.ciphertext, folder.payload.iv],
      );
    }

    for (const item of input.items) {
      const existing = await client.query<{ revision: number }>(
        "SELECT revision FROM vault_items WHERE id = $1 AND user_id = $2",
        [item.id, userId],
      );

      if (existing.rows.length > 0 && existing.rows[0].revision > item.revision) {
        conflicts.push({ id: item.id, serverRevision: existing.rows[0].revision });
        continue; // skip applying this one — client must reconcile
      }

      await client.query(
        `INSERT INTO vault_items (id, user_id, folder_id, payload_ciphertext, payload_iv, revision, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, now())
         ON CONFLICT (id) DO UPDATE SET
           folder_id = EXCLUDED.folder_id,
           payload_ciphertext = EXCLUDED.payload_ciphertext,
           payload_iv = EXCLUDED.payload_iv,
           revision = vault_items.revision + 1,
           updated_at = now()
         WHERE vault_items.user_id = $2`,
        [item.id, userId, item.folderId, item.payload.ciphertext, item.payload.iv, item.revision],
      );
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  const newClock = await bumpClock(userId);
  return { syncToken: String(newClock), conflicts };
}

export async function softDeleteItem(userId: string, itemId: string): Promise<void> {
  const result = await pool.query(
    "UPDATE vault_items SET deleted_at = now() WHERE id = $1 AND user_id = $2",
    [itemId, userId],
  );
  if (result.rowCount === 0) throw new HttpError(404, "not_found", "Vault item not found.");
  await bumpClock(userId);
}

export async function softDeleteFolder(userId: string, folderId: string): Promise<void> {
  const result = await pool.query(
    "UPDATE folders SET deleted_at = now() WHERE id = $1 AND user_id = $2",
    [folderId, userId],
  );
  if (result.rowCount === 0) throw new HttpError(404, "not_found", "Folder not found.");
  await bumpClock(userId);
}

export async function exportBackup(userId: string): Promise<ExportBackupResponse> {
  const userResult = await pool.query<{ kdf_params: KdfParams; wrapped_vault_key_ciphertext: string; wrapped_vault_key_iv: string }>(
    "SELECT kdf_params, wrapped_vault_key_ciphertext, wrapped_vault_key_iv FROM users WHERE id = $1",
    [userId],
  );
  const user = userResult.rows[0];
  if (!user) throw new HttpError(404, "not_found", "User not found.");

  const { items, folders } = await pullVault(userId);

  return {
    exportedAt: new Date().toISOString(),
    kdfParams: user.kdf_params,
    wrappedVaultKey: { ciphertext: user.wrapped_vault_key_ciphertext, iv: user.wrapped_vault_key_iv, v: 1, wrappedBy: "masterKey" },
    items,
    folders,
    formatVersion: 1,
  };
}
