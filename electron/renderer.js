const urlInput = document.getElementById("url");
const outputInput = document.getElementById("output");
const formatInput = document.getElementById("format-selector");
const audioOnlyInput = document.getElementById("audio-only");
const audioFormatInput = document.getElementById("audio-format");
const ffmpegInput = document.getElementById("ffmpeg-location");
const pickOutputButton = document.getElementById("pick-output");
const startButton = document.getElementById("start");
const updateButton = document.getElementById("update");
const clearLogButton = document.getElementById("clear-log");
const statusNode = document.getElementById("status");
const logNode = document.getElementById("log");
const progressValue = document.getElementById("progress-value");
const progressFill = document.getElementById("progress-fill");

outputInput.value = "downloads";
audioFormatInput.disabled = !audioOnlyInput.checked;

function appendLog(line, stream = "stdout") {
  const prefix = stream === "stderr" ? "[stderr] " : "";
  logNode.textContent += `${prefix}${line}\n`;
  logNode.scrollTop = logNode.scrollHeight;
  const percent = line.match(/\[downloading\]\s*([\d.]+)%/);
  if (percent) {
    setProgress(Number(percent[1]));
  }
  if (line.includes("[finished]")) {
    setProgress(100);
  }
}

function setStatus(text, isError = false) {
  statusNode.textContent = text;
  statusNode.style.color = isError ? "#ff8d8d" : "#9fb2d5";
}

function setProgress(value) {
  const clamped = Math.min(100, Math.max(0, value || 0));
  progressValue.textContent = `${clamped.toFixed(1)}%`;
  progressFill.style.width = `${clamped}%`;
}

function setBusy(busy) {
  startButton.disabled = busy;
  updateButton.disabled = busy;
}

audioOnlyInput.addEventListener("change", () => {
  audioFormatInput.disabled = !audioOnlyInput.checked;
  formatInput.disabled = audioOnlyInput.checked;
});

pickOutputButton.addEventListener("click", async () => {
  const selected = await window.dlExeApi.selectOutputDirectory();
  if (selected) {
    outputInput.value = selected;
  }
});

clearLogButton.addEventListener("click", () => {
  logNode.textContent = "";
});

startButton.addEventListener("click", async () => {
  const url = urlInput.value.trim();
  if (!url) {
    setStatus("URL を入力してください", true);
    return;
  }

  setBusy(true);
  setStatus("Downloading...");
  setProgress(0);
  appendLog("=== Download started ===");

  const result = await window.dlExeApi.runDownload({
    url,
    output: outputInput.value.trim() || "downloads",
    formatSelector: formatInput.value.trim() || "bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4]/bv*+ba/b",
    audioOnly: audioOnlyInput.checked,
    audioFormat: audioFormatInput.value,
    ffmpegLocation: ffmpegInput.value.trim()
  });

  setBusy(false);
  if (result.ok) {
    setStatus("Done");
    appendLog("=== Completed successfully ===");
  } else {
    setStatus(`Failed (code: ${result.code})`, true);
    if (result.message) {
      appendLog(result.message, "stderr");
    }
  }
});

updateButton.addEventListener("click", async () => {
  setBusy(true);
  setStatus("Updating yt-dlp...");
  appendLog("=== Updating yt-dlp ===");

  const result = await window.dlExeApi.updateYtDlp();
  setBusy(false);

  if (result.ok) {
    setStatus("yt-dlp updated");
  } else {
    setStatus(`Update failed (code: ${result.code})`, true);
    if (result.message) {
      appendLog(result.message, "stderr");
    }
  }
});

window.dlExeApi.onTaskLog((payload) => {
  appendLog(payload.line, payload.stream);
});
