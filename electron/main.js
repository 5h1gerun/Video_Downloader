const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const { spawn, spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const isPackaged = app.isPackaged;
const runtimeRoot = isPackaged ? process.resourcesPath : projectRoot;
const backendMain = path.join(projectRoot, "src", "main.py");

let activeProcess = null;

function createWindow() {
  const win = new BrowserWindow({
    width: 1160,
    height: 840,
    minWidth: 980,
    minHeight: 680,
    backgroundColor: "#0c1426",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.loadFile(path.join(__dirname, "index.html"));
}

function splitLines(buffer, cb) {
  let carry = "";
  buffer.on("data", (chunk) => {
    carry += chunk.toString("utf8");
    const parts = carry.split(/\r?\n/);
    carry = parts.pop() || "";
    for (const line of parts) {
      cb(line);
    }
  });
  buffer.on("end", () => {
    if (carry) {
      cb(carry);
    }
  });
}

function findPythonExecutable() {
  const envPath = process.env.DL_EXE_PYTHON;
  if (envPath && fs.existsSync(envPath)) {
    return envPath;
  }

  const userHome = process.env.USERPROFILE || process.env.HOME || "";
  const condaEnvName = process.env.DL_EXE_CONDA_ENV || "Cbot";
  if (userHome) {
    const condaCandidates = [
      path.join(userHome, "miniconda3", "envs", condaEnvName, "python.exe"),
      path.join(userHome, "anaconda3", "envs", condaEnvName, "python.exe")
    ];
    for (const candidate of condaCandidates) {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }
  }

  const condaPrefix = process.env.CONDA_PREFIX;
  if (condaPrefix) {
    const condaPython = path.join(condaPrefix, "python.exe");
    if (fs.existsSync(condaPython)) {
      return condaPython;
    }
  }

  const venvPython = path.join(projectRoot, ".venv", "Scripts", "python.exe");
  if (fs.existsSync(venvPython)) {
    return venvPython;
  }

  const whereResult = spawnSync("where", ["python"], { shell: false, windowsHide: true });
  if (whereResult.status === 0) {
    const lines = String(whereResult.stdout || "")
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    for (const candidate of lines) {
      if (fs.existsSync(candidate) && !candidate.toLowerCase().endsWith("windowsapps\\python.exe")) {
        return candidate;
      }
    }
  }

  return "python";
}

function resolveBackendLaunch() {
  const envBackendExe = process.env.DL_EXE_BACKEND_EXE;
  if (envBackendExe && fs.existsSync(envBackendExe)) {
    return { command: envBackendExe, prefixArgs: [], cwd: path.dirname(envBackendExe) };
  }

  const exeCandidates = isPackaged
    ? [
        path.join(runtimeRoot, "backend", "Video_Downloader", "Video_Downloader.exe"),
        path.join(runtimeRoot, "backend", "Video_Downloader.exe"),
        path.join(path.dirname(process.execPath), "backend", "Video_Downloader", "Video_Downloader.exe"),
        path.join(path.dirname(process.execPath), "backend", "Video_Downloader.exe")
      ]
    : [
        path.join(projectRoot, "Video_Downloader.exe"),
        path.join(projectRoot, "DL_exe.exe"),
        path.join(projectRoot, "..", "Video_Downloader.exe"),
        path.join(projectRoot, "..", "DL_exe.exe")
      ];

  for (const exePath of exeCandidates) {
    if (fs.existsSync(exePath)) {
      return { command: exePath, prefixArgs: [], cwd: path.dirname(exePath) };
    }
  }

  if (!fs.existsSync(backendMain)) {
    return {
      error: `Backend not found. Missing both exe and script: ${backendMain}`
    };
  }

  return {
    command: findPythonExecutable(),
    prefixArgs: [backendMain],
    cwd: projectRoot
  };
}

function buildCommonSpawnOptions(cwd) {
  return {
    cwd: cwd || projectRoot,
    shell: false,
    env: {
      ...process.env,
      PYTHONIOENCODING: "utf-8",
      PYTHONUTF8: "1"
    }
  };
}

ipcMain.handle("select-output-directory", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openDirectory", "createDirectory"]
  });
  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }
  return result.filePaths[0];
});

ipcMain.handle("run-download", async (event, params) => {
  if (activeProcess) {
    return { ok: false, code: -1, message: "Another task is running." };
  }

  const launch = resolveBackendLaunch();
  if (launch.error) {
    return { ok: false, code: -1, message: launch.error };
  }

  const args = [...launch.prefixArgs, "--url", params.url, "--output", params.output];

  if (params.audioOnly) {
    args.push("--audio-only", "--audio-format", params.audioFormat);
  } else {
    args.push("--format", params.formatSelector || "bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4]/bv*+ba/b");
  }

  if (params.ffmpegLocation) {
    args.push("--ffmpeg-location", params.ffmpegLocation);
  }

  return new Promise((resolve) => {
    const child = spawn(launch.command, args, buildCommonSpawnOptions(launch.cwd));
    activeProcess = child;

    splitLines(child.stdout, (line) => {
      event.sender.send("task-log", { stream: "stdout", line });
    });
    splitLines(child.stderr, (line) => {
      event.sender.send("task-log", { stream: "stderr", line });
    });

    child.on("error", (err) => {
      activeProcess = null;
      resolve({ ok: false, code: -1, message: err.message });
    });

    child.on("close", (code) => {
      activeProcess = null;
      resolve({ ok: code === 0, code: code || 0 });
    });
  });
});

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
