/**
 * main.js – Electron Main Process
 * Boots the Python backend, creates the BrowserWindow,
 * handles IPC, and manages app lifecycle.
 */

const { app, BrowserWindow, ipcMain, shell, nativeTheme } = require("electron");
const path   = require("path");
const { spawn } = require("child_process");
const http   = require("http");
const fs     = require("fs");

let mainWindow = null;
let pyProcess  = null;

const BACKEND_URL  = "http://localhost:5000";
const BACKEND_PORT = 5000;

// ─────────────────────────────────────────────
// PYTHON BACKEND MANAGEMENT
// ─────────────────────────────────────────────

function startPythonBackend() {
  const backendDir  = path.join(__dirname, "..", "backend");
  const scriptPath  = path.join(backendDir, "app.py");
  const isWin       = process.platform === "win32";
  const pythonCmd   = isWin ? "python" : "python3";

  // Check if script exists
  if (!fs.existsSync(scriptPath)) {
    console.error("Backend script not found:", scriptPath);
    return;
  }

  console.log("Starting Python backend...");
  pyProcess = spawn(pythonCmd, [scriptPath], {
    cwd: backendDir,
    stdio: ["pipe", "pipe", "pipe"],
  });

  pyProcess.stdout.on("data", (d) => console.log("[Python]", d.toString().trim()));
  pyProcess.stderr.on("data", (d) => console.error("[Python ERR]", d.toString().trim()));
  pyProcess.on("close", (code) => console.log("[Python] exited with code", code));
}

function stopPythonBackend() {
  if (pyProcess) {
    pyProcess.kill();
    pyProcess = null;
  }
}

function waitForBackend(retries = 20, delay = 500) {
  return new Promise((resolve, reject) => {
    const attempt = (remaining) => {
      http.get(`${BACKEND_URL}/health`, (res) => {
        if (res.statusCode === 200) resolve();
        else if (remaining > 0) setTimeout(() => attempt(remaining - 1), delay);
        else reject(new Error("Backend did not start"));
      }).on("error", () => {
        if (remaining > 0) setTimeout(() => attempt(remaining - 1), delay);
        else reject(new Error("Backend unreachable"));
      });
    };
    attempt(retries);
  });
}

// ─────────────────────────────────────────────
// WINDOW CREATION
// ─────────────────────────────────────────────

function createWindow() {
  mainWindow = new BrowserWindow({
    width:           1100,
    height:          760,
    minWidth:        860,
    minHeight:       620,
    titleBarStyle:   "hiddenInset",
    backgroundColor: "#0d0d0f",
    show:            false,
    icon:            path.join(__dirname, "assets", "icons", "icon.png"),
    webPreferences: {
      preload:            path.join(__dirname, "preload.js"),
      contextIsolation:   true,
      nodeIntegration:    false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, "index.html"));

  mainWindow.once("ready-to-show", () => mainWindow.show());

  // Open external links in browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.on("closed", () => { mainWindow = null; });
}

// ─────────────────────────────────────────────
// IPC HANDLERS (renderer → main → renderer)
// ─────────────────────────────────────────────

ipcMain.handle("get-backend-url", () => BACKEND_URL);

ipcMain.handle("get-theme", () => nativeTheme.shouldUseDarkColors ? "dark" : "light");

ipcMain.handle("set-theme", (_, theme) => {
  nativeTheme.themeSource = theme; // 'dark' | 'light' | 'system'
});

// ─────────────────────────────────────────────
// APP LIFECYCLE
// ─────────────────────────────────────────────

app.whenReady().then(async () => {
  startPythonBackend();

  try {
    await waitForBackend();
    console.log("Backend is ready.");
  } catch (e) {
    console.warn("Backend may not be running:", e.message);
  }

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  stopPythonBackend();
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => stopPythonBackend());
