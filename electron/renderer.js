const STORAGE_KEY = "dl-exe-ui-state-v1";
const MAX_HISTORY = 50;

const PRESETS = {
  "video-best": {
    label: "高画質 MP4",
    audioOnly: false,
    formatSelector: "bv*[height<=1080][ext=mp4]+ba[ext=m4a]/bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4]/bv*+ba/b",
    audioFormat: "mp3"
  },
  "video-balanced": {
    label: "標準 MP4",
    audioOnly: false,
    formatSelector: "b[height<=720][ext=mp4]/b[ext=mp4]/bv*+ba/b",
    audioFormat: "mp3"
  },
  "audio-mp3": {
    label: "音声 MP3",
    audioOnly: true,
    formatSelector: "bestaudio/best",
    audioFormat: "mp3"
  },
  "audio-m4a": {
    label: "音声 M4A",
    audioOnly: true,
    formatSelector: "bestaudio[ext=m4a]/bestaudio/best",
    audioFormat: "m4a"
  }
};

const urlInput = document.getElementById("url");
const outputInput = document.getElementById("output");
const formatInput = document.getElementById("format-selector");
const audioOnlyInput = document.getElementById("audio-only");
const audioFormatInput = document.getElementById("audio-format");
const ffmpegInput = document.getElementById("ffmpeg-location");
const presetSelector = document.getElementById("preset-selector");

const pickOutputButton = document.getElementById("pick-output");
const startButton = document.getElementById("start");
const enqueueButton = document.getElementById("enqueue");
const runQueueButton = document.getElementById("run-queue");
const clearQueueButton = document.getElementById("clear-queue");
const clearHistoryButton = document.getElementById("clear-history");
const clearLogButton = document.getElementById("clear-log");

const queueList = document.getElementById("queue-list");
const queueEmpty = document.getElementById("queue-empty");
const historyList = document.getElementById("history-list");
const historyEmpty = document.getElementById("history-empty");

const statusNode = document.getElementById("status");
const logNode = document.getElementById("log");
const progressValue = document.getElementById("progress-value");
const progressFill = document.getElementById("progress-fill");

const state = loadState();
let isRunning = false;
let activeJobId = null;
let lastFinishedPath = "";

hydrateInputs();
renderQueue();
renderHistory();
setStatus("準備完了");

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        settings: {
          output: parsed.settings?.output || "downloads",
          ffmpegLocation: parsed.settings?.ffmpegLocation || "",
          preset: parsed.settings?.preset || "video-best",
          audioOnly: Boolean(parsed.settings?.audioOnly),
          audioFormat: parsed.settings?.audioFormat || "mp3",
          formatSelector: parsed.settings?.formatSelector || PRESETS["video-best"].formatSelector
        },
        queue: Array.isArray(parsed.queue) ? parsed.queue : [],
        history: Array.isArray(parsed.history) ? parsed.history.slice(0, MAX_HISTORY) : []
      };
    }
  } catch {
    // Ignore malformed storage and use defaults.
  }

  return {
    settings: {
      output: "downloads",
      ffmpegLocation: "",
      preset: "video-best",
      audioOnly: false,
      audioFormat: "mp3",
      formatSelector: PRESETS["video-best"].formatSelector
    },
    queue: [],
    history: []
  };
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function hydrateInputs() {
  outputInput.value = state.settings.output;
  ffmpegInput.value = state.settings.ffmpegLocation;

  const presetValue = PRESETS[state.settings.preset] ? state.settings.preset : "custom";
  presetSelector.value = presetValue;

  audioOnlyInput.checked = state.settings.audioOnly;
  audioFormatInput.value = state.settings.audioFormat;
  formatInput.value = state.settings.formatSelector;
  updateFormatAvailability();
}

function persistSettingsFromInputs() {
  state.settings.output = outputInput.value.trim() || "downloads";
  state.settings.ffmpegLocation = ffmpegInput.value.trim();
  state.settings.preset = presetSelector.value;
  state.settings.audioOnly = audioOnlyInput.checked;
  state.settings.audioFormat = audioFormatInput.value;
  state.settings.formatSelector = formatInput.value.trim() || PRESETS["video-best"].formatSelector;
  saveState();
}

function buildJobFromInputs() {
  const url = urlInput.value.trim();
  if (!url) {
    setStatus("URLを入力してください。", true);
    return null;
  }

  persistSettingsFromInputs();

  const now = new Date();
  return {
    id: `job-${now.getTime()}-${Math.floor(Math.random() * 1000)}`,
    url,
    output: state.settings.output,
    formatSelector: state.settings.formatSelector,
    audioOnly: state.settings.audioOnly,
    audioFormat: state.settings.audioFormat,
    ffmpegLocation: state.settings.ffmpegLocation,
    preset: state.settings.preset,
    status: "queued",
    createdAt: now.toISOString(),
    finishedAt: null,
    resultPath: "",
    errorMessage: ""
  };
}

function enqueueCurrentJob() {
  const job = buildJobFromInputs();
  if (!job) {
    return null;
  }
  state.queue.push(job);
  saveState();
  renderQueue();
  setStatus("キューに追加しました。");
  return job;
}

function updateFormatAvailability() {
  audioFormatInput.disabled = !audioOnlyInput.checked;
  formatInput.disabled = audioOnlyInput.checked;
}

function applyPreset(presetKey) {
  if (presetKey === "custom") {
    state.settings.preset = "custom";
    saveState();
    return;
  }

  const preset = PRESETS[presetKey];
  if (!preset) {
    return;
  }

  audioOnlyInput.checked = preset.audioOnly;
  audioFormatInput.value = preset.audioFormat;
  formatInput.value = preset.formatSelector;
  state.settings.preset = presetKey;
  updateFormatAvailability();
  persistSettingsFromInputs();
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

function appendLog(line, stream = "stdout") {
  const prefix = stream === "stderr" ? "[stderr] " : "";
  logNode.textContent += `${prefix}${line}\n`;
  logNode.scrollTop = logNode.scrollHeight;

  const percent = line.match(/\[downloading\]\s*([\d.]+)%/);
  if (percent) {
    setProgress(Number(percent[1]));
  }

  const finishedMatch = line.match(/\[finished\]\s*Download completed:\s*(.+)$/);
  if (finishedMatch) {
    lastFinishedPath = finishedMatch[1].trim();
    setProgress(100);
  }

  const resultMatch = line.match(/\[result\]\s*(.+)$/);
  if (resultMatch) {
    lastFinishedPath = resultMatch[1].trim();
  }
}

function updateJobStatus(jobId, status, extras = {}) {
  const job = state.queue.find((item) => item.id === jobId);
  if (!job) {
    return;
  }
  job.status = status;
  Object.assign(job, extras);
  saveState();
  renderQueue();
}

function moveToHistory(job) {
  const historyEntry = {
    id: job.id,
    url: job.url,
    output: job.output,
    preset: job.preset,
    status: job.status,
    createdAt: job.createdAt,
    finishedAt: job.finishedAt,
    resultPath: job.resultPath,
    errorMessage: job.errorMessage
  };

  state.history.unshift(historyEntry);
  state.history = state.history.slice(0, MAX_HISTORY);
  saveState();
  renderHistory();
}

function finishJob(job, ok, result) {
  job.status = ok ? "done" : "failed";
  job.finishedAt = new Date().toISOString();
  job.resultPath = ok ? lastFinishedPath || job.output : "";
  job.errorMessage = ok ? "" : result?.message || "不明なエラー";

  moveToHistory(job);
  state.queue = state.queue.filter((entry) => entry.id !== job.id);
  saveState();
  renderQueue();
}

async function executeJob(job) {
  activeJobId = job.id;
  lastFinishedPath = "";

  updateJobStatus(job.id, "running");
  setProgress(0);
  setStatus(`実行中: ${job.url}`);
  appendLog(`=== 開始: ${job.url} ===`);

  const result = await window.dlExeApi.runDownload({
    url: job.url,
    output: job.output,
    formatSelector: job.formatSelector,
    audioOnly: job.audioOnly,
    audioFormat: job.audioFormat,
    ffmpegLocation: job.ffmpegLocation
  });

  finishJob(job, result.ok, result);

  if (result.ok) {
    appendLog(`=== 完了: ${job.url} ===`);
  } else {
    appendLog(`=== 失敗: ${job.url} ===`, "stderr");
    if (result.message) {
      appendLog(result.message, "stderr");
    }
  }

  activeJobId = null;
}

async function runQueue() {
  if (isRunning) {
    setStatus("すでにキュー実行中です。", true);
    return;
  }

  const pending = state.queue.filter((job) => job.status === "queued");
  if (pending.length === 0) {
    setStatus("実行待ちのキューがありません。", true);
    return;
  }

  isRunning = true;
  setButtonsDisabled(true);

  for (const job of pending) {
    await executeJob(job);
  }

  isRunning = false;
  setButtonsDisabled(false);
  setStatus("キュー処理が完了しました。");
}

function setButtonsDisabled(busy) {
  startButton.disabled = busy;
  enqueueButton.disabled = busy;
  runQueueButton.disabled = busy;
}

function queueStatusLabel(status) {
  if (status === "running") {
    return "実行中";
  }
  if (status === "done") {
    return "完了";
  }
  if (status === "failed") {
    return "失敗";
  }
  return "待機中";
}

function renderQueue() {
  queueList.innerHTML = "";

  if (state.queue.length === 0) {
    queueEmpty.style.display = "block";
    return;
  }

  queueEmpty.style.display = "none";

  for (const job of state.queue) {
    const item = document.createElement("li");
    item.className = "item";

    const status = document.createElement("span");
    status.className = `pill pill-${job.status}`;
    status.textContent = queueStatusLabel(job.status);

    const body = document.createElement("div");
    body.className = "item-body";

    const title = document.createElement("div");
    title.className = "item-title";
    title.textContent = job.url;

    const meta = document.createElement("div");
    meta.className = "item-meta";
    meta.textContent = `${job.output} | ${job.preset || "custom"}`;

    body.append(title, meta);

    const actions = document.createElement("div");
    actions.className = "item-actions";

    if (job.status !== "running") {
      const removeButton = document.createElement("button");
      removeButton.className = "btn btn-ghost";
      removeButton.textContent = "削除";
      removeButton.addEventListener("click", () => {
        state.queue = state.queue.filter((entry) => entry.id !== job.id);
        saveState();
        renderQueue();
      });
      actions.appendChild(removeButton);
    }

    item.append(status, body, actions);
    queueList.appendChild(item);
  }
}

function renderHistory() {
  historyList.innerHTML = "";

  if (state.history.length === 0) {
    historyEmpty.style.display = "block";
    return;
  }

  historyEmpty.style.display = "none";

  for (const entry of state.history) {
    const item = document.createElement("li");
    item.className = "item";

    const status = document.createElement("span");
    status.className = `pill pill-${entry.status}`;
    status.textContent = queueStatusLabel(entry.status);

    const body = document.createElement("div");
    body.className = "item-body";

    const title = document.createElement("div");
    title.className = "item-title";
    title.textContent = entry.url;

    const when = entry.finishedAt
      ? new Date(entry.finishedAt).toLocaleString("ja-JP")
      : new Date(entry.createdAt).toLocaleString("ja-JP");

    const meta = document.createElement("div");
    meta.className = "item-meta";
    meta.textContent = entry.status === "failed" && entry.errorMessage
      ? `${when} | ${entry.errorMessage}`
      : `${when}${entry.resultPath ? ` | ${entry.resultPath}` : ""}`;

    body.append(title, meta);

    const actions = document.createElement("div");
    actions.className = "item-actions";

    const requeueButton = document.createElement("button");
    requeueButton.className = "btn btn-ghost";
    requeueButton.textContent = "再追加";
    requeueButton.addEventListener("click", () => {
      const cloned = {
        ...entry,
        id: `job-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        status: "queued",
        createdAt: new Date().toISOString(),
        finishedAt: null,
        errorMessage: "",
        resultPath: ""
      };
      state.queue.push(cloned);
      saveState();
      renderQueue();
      setStatus("履歴からキューへ再追加しました。");
    });
    actions.appendChild(requeueButton);

    if (entry.resultPath) {
      const openButton = document.createElement("button");
      openButton.className = "btn btn-ghost";
      openButton.textContent = "保存先を開く";
      openButton.addEventListener("click", async () => {
        const result = await window.dlExeApi.openPath(entry.resultPath);
        if (!result?.ok) {
          setStatus(result?.message || "保存先を開けませんでした。", true);
        }
      });
      actions.appendChild(openButton);
    }

    item.append(status, body, actions);
    historyList.appendChild(item);
  }
}

pickOutputButton.addEventListener("click", async () => {
  const selected = await window.dlExeApi.selectOutputDirectory();
  if (selected) {
    outputInput.value = selected;
    persistSettingsFromInputs();
  }
});

presetSelector.addEventListener("change", () => {
  applyPreset(presetSelector.value);
});

audioOnlyInput.addEventListener("change", () => {
  updateFormatAvailability();
  if (presetSelector.value !== "custom") {
    presetSelector.value = "custom";
  }
  persistSettingsFromInputs();
});

audioFormatInput.addEventListener("change", () => {
  if (presetSelector.value !== "custom") {
    presetSelector.value = "custom";
  }
  persistSettingsFromInputs();
});

formatInput.addEventListener("input", () => {
  if (presetSelector.value !== "custom") {
    presetSelector.value = "custom";
  }
  persistSettingsFromInputs();
});

ffmpegInput.addEventListener("input", persistSettingsFromInputs);
outputInput.addEventListener("input", persistSettingsFromInputs);

startButton.addEventListener("click", async () => {
  const job = buildJobFromInputs();
  if (!job) {
    return;
  }

  state.queue.push(job);
  saveState();
  renderQueue();

  if (!isRunning) {
    await runQueue();
  }
});

enqueueButton.addEventListener("click", () => {
  enqueueCurrentJob();
});

runQueueButton.addEventListener("click", async () => {
  await runQueue();
});

clearQueueButton.addEventListener("click", () => {
  const before = state.queue.length;
  state.queue = state.queue.filter((job) => job.status === "running");
  saveState();
  renderQueue();
  if (before === state.queue.length) {
    setStatus("削除対象のキューはありません。");
    return;
  }
  setStatus("キューを削除しました。");
});

clearHistoryButton.addEventListener("click", () => {
  state.history = [];
  saveState();
  renderHistory();
  setStatus("履歴を削除しました。");
});

clearLogButton.addEventListener("click", () => {
  logNode.textContent = "";
});

window.dlExeApi.onTaskLog((payload) => {
  if (!payload || !payload.line) {
    return;
  }

  if (activeJobId) {
    appendLog(payload.line, payload.stream);
  }
});
