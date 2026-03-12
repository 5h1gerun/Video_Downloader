const fs = require("fs");
const path = require("path");

const electronRoot = path.resolve(__dirname, "..");
const backendRoot = path.join(electronRoot, "backend");

const candidates = [
  path.join(backendRoot, "Video_Downloader", "Video_Downloader.exe"),
  path.join(backendRoot, "Video_Downloader.exe"),
  path.join(backendRoot, "DL_exe", "DL_exe.exe"),
  path.join(backendRoot, "DL_exe.exe")
];

const found = candidates.find((p) => fs.existsSync(p));
if (!found) {
  console.error("[error] Backend executable not found in electron/backend.");
  console.error("[hint] Build and export backend first:");
  console.error("  powershell -ExecutionPolicy Bypass -File ..\\build_exe.ps1 -OneDir -ExportToElectronBackend -Clean");
  process.exit(1);
}

console.log(`[ok] Backend found: ${found}`);
