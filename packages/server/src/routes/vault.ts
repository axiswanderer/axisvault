import { Router } from "express";
import { z } from "zod";
import { asyncHandler, HttpError } from "../middleware/errorHandler.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { syncPushSchema } from "./schemas.js";
import * as vaultService from "../services/vaultService.js";

export const vaultRouter = Router();

vaultRouter.use(requireAuth);

const idParamSchema = z.object({ id: z.string().uuid() });

vaultRouter.get(
  "/sync/pull",
  asyncHandler(async (req, res) => {
    if (!req.userId) throw new HttpError(401, "unauthorized", "Not authenticated.");
    const result = await vaultService.pullVault(req.userId);
    res.status(200).json(result);
  }),
);

vaultRouter.post(
  "/sync/push",
  asyncHandler(async (req, res) => {
    if (!req.userId) throw new HttpError(401, "unauthorized", "Not authenticated.");
    const input = syncPushSchema.parse(req.body);
    const result = await vaultService.pushVault(req.userId, input);
    res.status(200).json(result);
  }),
);

vaultRouter.delete(
  "/items/:id",
  asyncHandler(async (req, res) => {
    if (!req.userId) throw new HttpError(401, "unauthorized", "Not authenticated.");
    const { id } = idParamSchema.parse(req.params);
    await vaultService.softDeleteItem(req.userId, id);
    res.status(204).send();
  }),
);

vaultRouter.delete(
  "/folders/:id",
  asyncHandler(async (req, res) => {
    if (!req.userId) throw new HttpError(401, "unauthorized", "Not authenticated.");
    const { id } = idParamSchema.parse(req.params);
    await vaultService.softDeleteFolder(req.userId, id);
    res.status(204).send();
  }),
);

vaultRouter.get(
  "/export",
  asyncHandler(async (req, res) => {
    if (!req.userId) throw new HttpError(401, "unauthorized", "Not authenticated.");
    const result = await vaultService.exportBackup(req.userId);
    res.status(200).json(result);
  }),
);
