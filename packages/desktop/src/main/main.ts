import { app, BrowserWindow, Menu, shell, powerMonitor, ipcMain, session } from "electron";
import path from "node:path";

const isDev = !app.isPackaged;

// AxisVault desktop is intentionally a thin shell: all vault logic, crypto,
// and UI live in the shared React app (packages/web), loaded here as a
// local file:// bundle. The main process's only security-relevant jobs are:
//   1. Enforce a strict CSP/permissions model on the renderer.
//   2. Never enable Node integration or disable context isolation.
//   3. Forward OS-level signals (system sleep, screen lock) into the
//      renderer so the SAME in-app auto-lock logic used on web can react
//      to desktop-specific events the browser doesn't expose.
// No master password, derived key, or vault data ever passes through main.

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    backgroundColor: "#0f1115",
    title: "AxisVault",
    webPreferences: {
      preload: path.join(__dirname, "../preload/preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: true,
    },
  });

  if (!isDev) {
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          "Content-Security-Policy": [
            "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' http://localhost:4000 https://*; object-src 'none'; frame-ancestors 'none'; base-uri 'self'",
          ],
        },
      });
    });
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.webContents.on("will-navigate", (event, url) => {
    const target = new URL(url);
    const isLocalApp = target.protocol === "file:";
    const isDevServer = isDev && target.origin === "http://localhost:5173";
    if (!isLocalApp && !isDevServer) {
      event.preventDefault();
      void shell.openExternal(url);
    }
  });

  if (isDev) {
    void mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    void mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }

  Menu.setApplicationMenu(buildMenu());
}

function buildMenu(): Menu {
  return Menu.buildFromTemplate([
    {
      label: "AxisVault",
      submenu: [{ role: "about" }, { type: "separator" }, { role: "quit" }],
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" },
      ],
    },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" },
        
        { role: "zoomIn" },
        { role: "zoomOut" },
        { role: "togglefullscreen" },
      ],
    },
  ]);
}

app.whenReady().then(() => {
  createWindow();

  powerMonitor.on("lock-screen", () => {
    mainWindow?.webContents.send("axisvault:force-lock", "system-lock-screen");
  });
  powerMonitor.on("suspend", () => {
    mainWindow?.webContents.send("axisvault:force-lock", "system-suspend");
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

ipcMain.handle("axisvault:get-app-info", () => ({
  version: app.getVersion(),
  platform: process.platform,
}));
