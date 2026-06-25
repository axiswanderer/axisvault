import { z } from "zod";

const kdfParamsSchema = z.object({
  algorithm: z.enum(["argon2id", "pbkdf2-sha256"]),
  memoryKiB: z.number().int().positive().optional(),
  iterations: z.number().int().positive(),
  parallelism: z.number().int().positive().optional(),
  authSalt: z.string().min(16),
  encSalt: z.string().min(16),
  version: z.literal(1),
});

const encryptedBlobSchema = z.object({
  ciphertext: z.string().min(1),
  iv: z.string().min(1),
  v: z.literal(1),
});

const wrappedVaultKeySchema = encryptedBlobSchema.extend({
  wrappedBy: z.literal("masterKey"),
});

export const kdfParamsLookupSchema = z.object({
  email: z.string().email().max(254),
});

export const signupSchema = z.object({
  email: z.string().email().max(254),
  authHash: z.string().min(20).max(512),
  kdfParams: kdfParamsSchema,
  wrappedVaultKey: wrappedVaultKeySchema,
  encryptedHint: encryptedBlobSchema.optional(),
});

export const loginSchema = z.object({
  email: z.string().email().max(254),
  authHash: z.string().min(20).max(512),
  mfaCode: z.string().length(6).optional(),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(20),
});

export const changeMasterPasswordSchema = z.object({
  currentAuthHash: z.string().min(20).max(512),
  newAuthHash: z.string().min(20).max(512),
  newKdfParams: kdfParamsSchema,
  newWrappedVaultKey: wrappedVaultKeySchema,
});

const encryptedItemSchema = z.object({
  id: z.string().uuid(),
  folderId: z.string().uuid().nullable(),
  payload: encryptedBlobSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
  revision: z.number().int().nonnegative(),
});

const encryptedFolderSchema = z.object({
  id: z.string().uuid(),
  parentId: z.string().uuid().nullable(),
  payload: encryptedBlobSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const syncPushSchema = z.object({
  items: z.array(encryptedItemSchema).max(1000),
  folders: z.array(encryptedFolderSchema).max(500),
  baseSyncToken: z.string(),
});
