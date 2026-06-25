export interface AxisVaultElectronBridge {
  getAppInfo(): Promise<{ version: string; platform: string }>;
  onForceLock(callback: (reason: string) => void): () => void;
  isElectron: true;
}

declare global {
  interface Window {
    /** Present only when running inside the Electron desktop shell; undefined on web. */
    axisvault?: AxisVaultElectronBridge;
  }
}

export {};
