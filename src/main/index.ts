import { app, BrowserWindow, ipcMain } from "electron";
import { join } from "node:path";
import { loadSnapshot, saveSnapshot } from "./persistence.js";

// Belt + suspenders: ELECTRON_DISABLE_SANDBOX=1 in the env handles the Linux
// SUID sandbox issue before Chromium boots; this line is only a fallback for
// anyone launching the built binary without the env var.
app.commandLine.appendSwitch("no-sandbox");

const isDev = !app.isPackaged;

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    title: "t3-canvas spike",
    webPreferences: {
      preload: join(__dirname, "../preload/index.mjs"),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev && process.env["ELECTRON_RENDERER_URL"]) {
    void win.loadURL(process.env["ELECTRON_RENDERER_URL"]);
    win.webContents.openDevTools({ mode: "detach" });
  } else {
    void win.loadFile(join(__dirname, "../renderer/index.html"));
  }

  return win;
}

void app.whenReady().then(() => {
  ipcMain.handle("t3canvas:loadSnapshot", async () => loadSnapshot());
  ipcMain.handle("t3canvas:saveSnapshot", async (_event, snapshot: unknown) => {
    await saveSnapshot(snapshot);
  });

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
