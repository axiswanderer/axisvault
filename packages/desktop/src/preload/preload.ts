import { contextBridge, ipcRenderer } from "electron";

/**
 * This is the ONLY surface the renderer (the shared React app) can see of
 * Electron/Node. Context isolation means the renderer's `window` object is
 * a separate JS realm from this script — `window.axisvault` below is the
 * sole bridge, and it exposes exactly two things: a read-only app-info
 * getter, and a one-way "force lock" event listener. Nothing here can
 * read/write files, spawn processes, or access the network outside of
 * what the renderer's own `fetch` already does (which is the same fetch
 * used by the web build, talking to the same backend).
 */
const axisvaultBridge = {
  getAppInfo: (): Promise<{ version: string; platform: string }> => ipcRenderer.invoke("axisvault:get-app-info"),

  /**
   * Subscribes to OS-level lock signals (system sleep, screen lock) that
   * only Electron can observe. The callback is wired by the renderer to
   * the same `useAuthStore.getState().lock(reason)` action used by the
   * inactivity timer, so desktop and web share one lock code path.
   */
  onForceLock: (callback: (reason: string) => void): (() => void) => {
    const listener = (_event: unknown, reason: string) => callback(reason);
    ipcRenderer.on("axisvault:force-lock", listener);
    return () => ipcRenderer.removeListener("axisvault:force-lock", listener);
  },

  isElectron: true as const,
};

contextBridge.exposeInMainWorld("axisvault", axisvaultBridge);

export type AxisVaultBridge = typeof axisvaultBridge;
